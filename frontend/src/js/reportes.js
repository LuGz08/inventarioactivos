// src/js/reportes.js
import { API } from "/src/js/api.js";

Chart.register(ChartDataLabels);

// ==========================================
// ESTADO GLOBAL
// ==========================================
const state = {
  raw: { productos: [], movimientos: [] },
  filtered: { productos: [], movimientos: [] },
  activeTab: 'financiero', // Default
  charts: {}
};

const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  await cargarDatos();
  setupUI();
  aplicarFiltros();
});

async function cargarDatos() {
  try {
    const [resProd, resMov] = await Promise.all([
      API.get("productos/"),
      API.get("movimientos/")
    ]);

    state.raw.productos = (Array.isArray(resProd) ? resProd : resProd.results || []).map(enrichProduct);
    state.raw.movimientos = (Array.isArray(resMov) ? resMov : resMov.results || []);

    poblarSelects();
  } catch (error) {
    console.error("Error datos:", error);
    document.getElementById("kpiContainer").innerHTML = `<div class="col-12"><div class="alert alert-danger">Error cargando datos. Verifique conexión.</div></div>`;
  }
}

// Procesar datos para facilitar filtrado
function enrichProduct(p) {
  const hoy = new Date();
  let estGar = "Sin info";
  
  if (p.fecha_venc_garantia) {
    const venc = new Date(p.fecha_venc_garantia);
    const diff = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
    estGar = diff < 0 ? "Vencida" : diff <= 30 ? "Por Vencer" : "Vigente";
  }

  return {
    ...p,
    sucursal_nombre: p.sucursal?.nombre || p.sucursal_nombre || "Sin Asignar",
    categoria_nombre: p.categoria?.nombre || p.categoria_nombre || "General",
    marca_nombre: p.modelo?.marca_nombre || "Genérico",
    proveedor_nombre: p.proveedor?.nombre || p.proveedor_nombre || "Desconocido",
    estado_nombre: p.estado?.nombre || p.estado_nombre || "-",
    valor_num: parseFloat(p.valor_compra || 0),
    fecha_compra_dt: p.fecha_compra ? new Date(p.fecha_compra) : null,
    estado_garantia_calc: estGar
  };
}

function poblarSelects() {
  const unique = (key) => [...new Set(state.raw.productos.map(p => p[key]).filter(Boolean))].sort();
  
  fillSelect("fSucursal", unique("sucursal_nombre"));
  fillSelect("fCategoria", unique("categoria_nombre"));
  fillSelect("fMarca", unique("marca_nombre"));
  fillSelect("fEstado", unique("estado_nombre"));
  fillSelect("fProveedor", unique("proveedor_nombre"));
}

function fillSelect(id, list) {
  const sel = document.getElementById(id);
  sel.innerHTML = '<option value="">Todos</option>';
  list.forEach(v => sel.innerHTML += `<option value="${v}">${v}</option>`);
}

function setupUI() {
  // Tabs change listener
  document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(btn => {
    btn.addEventListener('shown.bs.tab', (e) => {
      state.activeTab = e.target.getAttribute('data-report');
      actualizarInterfazFiltros();
      aplicarFiltros(); // Re-aplicar para la nueva vista
    });
  });

  // Filtros
  document.getElementById("btnAplicarFiltros").addEventListener("click", aplicarFiltros);
  document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
    document.querySelectorAll(".filter-sidebar input, .filter-sidebar select").forEach(el => el.value = "");
    aplicarFiltros();
  });

  // Exportar
  document.getElementById("btnExportarExcel").addEventListener("click", exportarExcel);
  document.getElementById("btnExportarPDF").addEventListener("click", exportarPDF);
}

function actualizarInterfazFiltros() {
  // Ocultar todos los grupos
  document.querySelectorAll('.filter-group').forEach(el => el.classList.add('d-none'));
  
  const lblFecha = document.getElementById("lblFecha");
  const tab = state.activeTab;

  // Mostrar según tab
  if (tab === 'movimientos') {
    document.getElementById('filtros-movimiento').classList.remove('d-none');
    lblFecha.innerText = "Fecha Movimiento";
  } else if (tab === 'garantias') {
    document.getElementById('filtros-garantia').classList.remove('d-none');
    document.getElementById('filtros-producto').classList.remove('d-none'); // También útil
    lblFecha.innerText = "Vencimiento Garantía";
  } else {
    // Financiero y Operativo
    document.getElementById('filtros-producto').classList.remove('d-none');
    lblFecha.innerText = "Fecha Compra";
  }

  // Actualizar texto botones
  const label = tab.charAt(0).toUpperCase() + tab.slice(1);
  document.getElementById("btnExportarExcel").innerHTML = `<i class="bi bi-file-earmark-excel me-2"></i>Excel ${label}`;
  document.getElementById("btnExportarPDF").innerHTML = `<i class="bi bi-file-pdf me-2"></i>PDF ${label}`;
}

// ==========================================
// FILTRADO DE DATOS
// ==========================================
function aplicarFiltros() {
  const f = {
    desde: val("fFechaDesde") ? new Date(val("fFechaDesde")) : null,
    hasta: val("fFechaHasta") ? new Date(val("fFechaHasta")) : null,
    sucursal: val("fSucursal"),
    categoria: val("fCategoria"),
    marca: val("fMarca"),
    estado: val("fEstado"),
    min: parseFloat(val("fPrecioMin")) || 0,
    max: parseFloat(val("fPrecioMax")) || Infinity,
    tipoMov: val("fTipoMov"),
    skuMov: val("fSkuMov").toLowerCase(),
    estGar: val("fEstadoGar"),
    prov: val("fProveedor")
  };

  // 1. Filtrar Productos (Base para Financiero, Operativo, Garantías)
  state.filtered.productos = state.raw.productos.filter(p => {
    if (f.sucursal && p.sucursal_nombre !== f.sucursal) return false;
    if (f.categoria && p.categoria_nombre !== f.categoria) return false;
    if (f.marca && p.marca_nombre !== f.marca) return false;
    if (f.estado && p.estado_nombre !== f.estado) return false;
    if (p.valor_num < f.min || p.valor_num > f.max) return false;
    
    // Fecha según contexto
    if (state.activeTab === 'garantias') {
      const v = p.fecha_venc_garantia ? new Date(p.fecha_venc_garantia) : null;
      if (f.desde && (!v || v < f.desde)) return false;
      if (f.hasta && (!v || v > f.hasta)) return false;
      if (f.estGar && p.estado_garantia_calc !== f.estGar) return false;
      if (f.prov && p.proveedor_nombre !== f.prov) return false;
    } else {
      // Compra
      if (f.desde && (!p.fecha_compra_dt || p.fecha_compra_dt < f.desde)) return false;
      if (f.hasta && (!p.fecha_compra_dt || p.fecha_compra_dt > f.hasta)) return false;
    }
    return true;
  });

  // 2. Filtrar Movimientos
  state.filtered.movimientos = state.raw.movimientos.filter(m => {
    const d = new Date(m.fecha);
    if (f.desde && d < f.desde) return false;
    if (f.hasta && d > f.hasta) return false;
    if (f.tipoMov && m.tipo !== f.tipoMov) return false;
    if (f.skuMov && !m.sku.toLowerCase().includes(f.skuMov)) return false;
    return true;
  });

  renderDashboard();
}

function val(id) { return document.getElementById(id).value; }

// ==========================================
// RENDERIZADO
// ==========================================
function renderDashboard() {
  const tab = state.activeTab;
  
  if (tab === 'financiero') renderFinanciero();
  else if (tab === 'operativo') renderOperativo();
  else if (tab === 'movimientos') renderMovimientos();
  else if (tab === 'garantias') renderGarantias();

  renderKPIs(); // KPIs siempre visibles o adaptados
}

function renderKPIs() {
  const p = state.filtered.productos;
  const m = state.filtered.movimientos;
  const val = p.reduce((s, i) => s + i.valor_num, 0);
  const gar = p.filter(i => ["Vencida", "Por Vencer"].includes(i.estado_garantia_calc)).length;

  const html = `
    <div class="col-md-3"><div class="kpi-card d-flex gap-3 align-items-center"><div class="kpi-icon bg-primary bg-opacity-10 text-primary"><i class="bi bi-box-seam"></i></div><div><h3 class="mb-0 fw-bold">${p.length}</h3><small class="text-muted">Productos</small></div></div></div>
    <div class="col-md-3"><div class="kpi-card d-flex gap-3 align-items-center"><div class="kpi-icon bg-success bg-opacity-10 text-success"><i class="bi bi-currency-dollar"></i></div><div><h3 class="mb-0 fw-bold">${formatShort(val)}</h3><small class="text-muted">Valor Total</small></div></div></div>
    <div class="col-md-3"><div class="kpi-card d-flex gap-3 align-items-center"><div class="kpi-icon bg-warning bg-opacity-10 text-warning"><i class="bi bi-activity"></i></div><div><h3 class="mb-0 fw-bold">${m.length}</h3><small class="text-muted">Movimientos</small></div></div></div>
    <div class="col-md-3"><div class="kpi-card d-flex gap-3 align-items-center"><div class="kpi-icon bg-danger bg-opacity-10 text-danger"><i class="bi bi-shield-exclamation"></i></div><div><h3 class="mb-0 fw-bold">${gar}</h3><small class="text-muted">Riesgo Garantía</small></div></div></div>
  `;
  document.getElementById("kpiContainer").innerHTML = html;
}

function renderFinanciero() {
  const data = groupBySum(state.filtered.productos, "categoria_nombre", "valor_num");
  renderChart("chartFinanciero", "bar", Object.keys(data), Object.values(data), "Valor ($)", "#0d6efd");

  const top = [...state.filtered.productos].sort((a,b) => b.valor_num - a.valor_num).slice(0, 5);
  document.getElementById("tbodyTopCostosos").innerHTML = top.map(p => `
    <tr><td><div class="fw-bold text-truncate" style="max-width:140px">${p.categoria_nombre}</div><small class="text-muted">${p.nro_serie}</small></td><td class="text-end fw-bold text-success">${money.format(p.valor_num)}</td></tr>
  `).join("");
}

function renderOperativo() {
  const suc = groupByCount(state.filtered.productos, "sucursal_nombre");
  renderChart("chartSucursales", "bar", Object.keys(suc), Object.values(suc), "Equipos", "#20c997");

  const est = groupByCount(state.filtered.productos, "estado_nombre");
  renderChart("chartEstados", "doughnut", Object.keys(est), Object.values(est), "Estado", ["#198754", "#ffc107", "#dc3545", "#6c757d"]);
}

function renderMovimientos() {
  const line = {};
  state.filtered.movimientos.forEach(m => {
    const k = new Date(m.fecha).toLocaleDateString("es-CL", {day:'2-digit', month:'2-digit'});
    line[k] = (line[k] || 0) + 1;
  });
  // Ordenar fechas
  const sortedKeys = Object.keys(line).sort((a,b) => a.localeCompare(b));
  renderChart("chartMovimientos", "line", sortedKeys, sortedKeys.map(k=>line[k]), "Operaciones", "#ffc107", {fill:true});

  document.getElementById("countMovimientos").innerText = `${state.filtered.movimientos.length} regs`;
  document.getElementById("tbodyMovimientos").innerHTML = state.filtered.movimientos.slice(0, 50).map(m => `
    <tr>
      <td>${new Date(m.fecha).toLocaleDateString()}</td>
      <td><span class="badge bg-${m.tipo==='entrada'?'success':m.tipo==='salida'?'danger':'info'}">${m.tipo}</span></td>
      <td>${m.sku}</td>
      <td class="small text-muted">${m.hacia || m.referencia || '-'}</td>
    </tr>
  `).join("");
}

function renderGarantias() {
  const data = groupByCount(state.filtered.productos, "estado_garantia_calc");
  
  // Mapear colores según estado para que coincidan con las badges de la tabla
  const labels = Object.keys(data);
  const values = Object.values(data);
  const colors = labels.map(estado => {
    switch(estado) {
      case "Vencida": return "#dc3545";      // Rojo (badge bg-danger)
      case "Por Vencer": return "#ffc107";   // Amarillo (badge bg-warning)
      case "Vigente": return "#198754";      // Verde (badge bg-success)
      case "Sin info": return "#6c757d";     // Gris (badge bg-secondary)
      default: return "#e9ecef";             // Gris claro por defecto
    }
  });
  
  renderChart("chartGarantias", "pie", labels, values, "Total", colors);

  const rows = state.filtered.productos.filter(p => ["Vencida", "Por Vencer"].includes(p.estado_garantia_calc))
    .sort((a,b) => new Date(a.fecha_venc_garantia) - new Date(b.fecha_venc_garantia)).slice(0, 20);
  
  document.getElementById("tbodyGarantias").innerHTML = rows.map(p => `
    <tr>
      <td class="fw-bold small">${p.nro_serie}</td>
      <td class="small">${p.categoria_nombre}</td>
      <td class="small text-truncate" style="max-width:100px">${p.proveedor_nombre}</td>
      <td class="small">${p.fecha_venc_garantia}</td>
      <td><span class="badge bg-${p.estado_garantia_calc==='Vencida'?'danger':'warning'}">${p.estado_garantia_calc}</span></td>
    </tr>
  `).join("");
}

// ==========================================
// EXPORTACIÓN ESPECÍFICA
// ==========================================
function exportarExcel() {
  const wb = XLSX.utils.book_new();
  const tab = state.activeTab;
  let data = [], name = "Reporte";

  if (tab === 'financiero') {
    name = "Financiero";
    data = state.filtered.productos.map(p => ({
      "Categoría": p.categoria_nombre, "Marca": p.marca_nombre, "Serie": p.nro_serie,
      "Modelo": p.modelo_nombre, "Costo": p.valor_num, "Sucursal": p.sucursal_nombre
    }));
  } else if (tab === 'operativo') {
    name = "Operativo";
    data = state.filtered.productos.map(p => ({
      "Sucursal": p.sucursal_nombre, "Categoría": p.categoria_nombre, "Serie": p.nro_serie,
      "Estado": p.estado_nombre, "Ubicación": p.ubicacion || '-'
    }));
  } else if (tab === 'movimientos') {
    name = "Movimientos";
    data = state.filtered.movimientos.map(m => ({
      "Fecha": new Date(m.fecha).toLocaleString(), "Tipo": m.tipo, "SKU": m.sku,
      "Cantidad": m.cantidad, "Origen": m.desde, "Destino": m.hacia
    }));
  } else if (tab === 'garantias') {
    name = "Garantias";
    data = state.filtered.productos.map(p => ({
      "Serie": p.nro_serie, "Equipo": p.categoria_nombre, "Proveedor": p.proveedor_nombre,
      "Vencimiento": p.fecha_venc_garantia, "Estado Garantía": p.estado_garantia_calc
    }));
  }

  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, name);
  XLSX.writeFile(wb, `Reporte_${name}_${Date.now()}.xlsx`);
}

function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const tab = state.activeTab;
  const fecha = new Date().toLocaleDateString();

  doc.setFontSize(16); doc.setTextColor(13, 110, 253);
  doc.text(`Reporte ${tab.toUpperCase()}`, 14, 20);
  doc.setFontSize(10); doc.setTextColor(100);
  doc.text(`Generado: ${fecha}`, 14, 28);

  let head = [], body = [];

  if (tab === 'financiero') {
    head = [['Categoría', 'Serie', 'Sucursal', 'Valor']];
    body = state.filtered.productos.map(p => [p.categoria_nombre, p.nro_serie, p.sucursal_nombre, money.format(p.valor_num)]);
    doc.text(`Total Valorizado: ${money.format(state.filtered.productos.reduce((s,i)=>s+i.valor_num,0))}`, 14, 35);
  } else if (tab === 'operativo') {
    head = [['Sucursal', 'Categoría', 'Serie', 'Estado']];
    body = state.filtered.productos.map(p => [p.sucursal_nombre, p.categoria_nombre, p.nro_serie, p.estado_nombre]);
  } else if (tab === 'movimientos') {
    head = [['Fecha', 'Tipo', 'SKU', 'Destino']];
    body = state.filtered.movimientos.map(m => [new Date(m.fecha).toLocaleDateString(), m.tipo, m.sku, m.hacia || '-']);
  } else if (tab === 'garantias') {
    head = [['Serie', 'Proveedor', 'Vence', 'Estado']];
    body = state.filtered.productos.map(p => [p.nro_serie, p.proveedor_nombre, p.fecha_venc_garantia||'-', p.estado_garantia_calc]);
  }

  doc.autoTable({ startY: 40, head: head, body: body, theme: 'grid' });
  doc.save(`Reporte_${tab}_${Date.now()}.pdf`);
}

// ==========================================
// UTILIDADES
// ==========================================
function renderChart(id, type, labels, data, label, colors, opts={}) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  
  // Destruir gráfico anterior si existe
  if (state.charts[id]) {
    state.charts[id].destroy();
  }
  
  state.charts[id] = new Chart(ctx, {
    type,
    data: { 
      labels, 
      datasets: [{ 
        label, 
        data, 
        backgroundColor: colors, 
        borderColor: '#fff', 
        borderWidth: 1, 
        ...opts 
      }] 
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false, // CRÍTICO: permite que el canvas respete la altura del contenedor
      plugins: { 
        legend: { 
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 10,
            font: { size: 11 }
          }
        }, 
        datalabels: { 
          color: 'white',
          font: { weight: 'bold', size: 10 },
          formatter: v => v > 0 ? v : null 
        } 
      },
      // Configuraciones específicas según tipo de gráfico
      ...(type === 'bar' && {
        scales: {
          y: { 
            beginAtZero: true,
            ticks: { font: { size: 10 } }
          },
          x: {
            ticks: { font: { size: 10 } }
          }
        }
      }),
      ...(type === 'line' && {
        scales: {
          y: { 
            beginAtZero: true,
            ticks: { font: { size: 10 } }
          },
          x: {
            ticks: { font: { size: 10 } }
          }
        }
      })
    }
  });
}

function groupByCount(arr, k) { return arr.reduce((a, i) => { a[i[k]] = (a[i[k]]||0)+1; return a; }, {}); }
function groupBySum(arr, k, v) { return arr.reduce((a, i) => { a[i[k]] = (a[i[k]]||0)+i[v]; return a; }, {}); }
function formatShort(n) { return n>=1e6 ? `$${(n/1e6).toFixed(1)}M` : n>=1e3 ? `$${(n/1e3).toFixed(1)}K` : n; }