// src/js/dashboard.js
import { API } from "/src/js/api.js";

// Estado global del dashboard
let dashboardData = {
  resumen: {
    totalActivos: 0,
    totalCategorias: 0, // NUEVO: Reemplaza al valor monetario
    enUso: 0,
    mantencion: 0,
    garantiaVigente: 0,
    porVencer: 0,
    fueraGarantia: 0,
  },
  sucursales: [],
  categorias: [],
  actividades: []
};

// Formato Peso Chileno
const formatoCLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0
});

// Normalizar respuestas de API
function normalizarLista(resp) {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (resp.results && Array.isArray(resp.results)) return resp.results;
  return [];
}

// =============================
//  CONTROL DE CARGA UI
// =============================
function mostrarCargando(show) {
  const overlay = document.getElementById("dashboard-loading");
  if (!overlay) return;
  
  if (show) {
    overlay.classList.remove("d-none");
    overlay.style.display = "flex";
  } else {
    overlay.classList.add("d-none");
    overlay.style.display = "none";
  }
}

// =============================
//  CARGAR DATOS (CORE)
// =============================
async function cargarDatosDashboard() {
  mostrarCargando(true);
  
  try {
    if (typeof API === 'undefined') {
        throw new Error("El módulo API no se cargó correctamente.");
    }

    const [productosResp, notificacionesResp] = await Promise.all([
      API.get("productos/").catch(e => {
          console.warn("Fallo al obtener productos:", e); 
          return [];
      }),
      API.get("notificaciones/").catch(e => {
          console.warn("Fallo al obtener notificaciones:", e); 
          return [];
      }),
    ]);

    procesarProductos(normalizarLista(productosResp));
    procesarNotificaciones(normalizarLista(notificacionesResp));

    renderizarTodo();

  } catch (error) {
    console.error("Error crítico en dashboard:", error);
    mostrarErrorUI(error.message);
  } finally {
    mostrarCargando(false);
  }
}

function procesarProductos(productos) {
  const resumen = dashboardData.resumen;
  const mapaSucursales = {};
  const mapaCategorias = {};

  // Resetear contadores
  resumen.totalActivos = 0;
  resumen.totalCategorias = 0;
  resumen.enUso = 0;
  resumen.mantencion = 0;
  resumen.garantiaVigente = 0;
  resumen.porVencer = 0;
  resumen.fueraGarantia = 0;

  if (!productos || productos.length === 0) return;

  // Filtrar productos activos (ID 2 = Baja, se excluyen del conteo operativo)
  const productosActivos = productos.filter(p => p.estado !== 2);

  resumen.totalActivos = productosActivos.length;

  productosActivos.forEach((p) => {
    const estadoId = p.estado; 
    
    // Estados (1: Activo, 3: Mantención)
    if (estadoId === 1) {
        resumen.enUso++;
    } else if (estadoId === 3) {
        resumen.mantencion++;
    }

    // Garantía
    const garantia = (p.estado_garantia || "").toString().toLowerCase();
    if (garantia.includes("vigente")) resumen.garantiaVigente++;
    else if (garantia.includes("por vencer")) resumen.porVencer++;
    else resumen.fueraGarantia++;

    // Agrupar Sucursales
    const sucNombre = p.sucursal_nombre || (p.sucursal && p.sucursal.nombre) || getNombreObj(p.sucursal) || "Sin Asignar";
    mapaSucursales[sucNombre] = (mapaSucursales[sucNombre] || 0) + 1;

    // Agrupar Categorías
    const catNombre = p.categoria_nombre || (p.categoria && p.categoria.nombre) || getNombreObj(p.categoria) || "Otros";
    mapaCategorias[catNombre] = (mapaCategorias[catNombre] || 0) + 1;
  });

  // CÁLCULO: Cantidad de categorías únicas encontradas
  resumen.totalCategorias = Object.keys(mapaCategorias).length;

  // Arrays ordenados
  dashboardData.sucursales = Object.entries(mapaSucursales)
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total); 

  dashboardData.categorias = Object.entries(mapaCategorias)
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

function getNombreObj(obj) {
    if (!obj) return null;
    return typeof obj === 'object' ? obj.nombre : null;
}

function procesarNotificaciones(notifs) {
  if (!notifs) return;
  dashboardData.actividades = notifs.slice(0, 6).map((n) => ({
    usuario: (n.usuario && (n.usuario.username || n.usuario_nombre)) || "Sistema",
    descripcion: n.mensaje || n.titulo || "Evento registrado",
    tiempo: n.fecha_creacion ? new Date(n.fecha_creacion).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit'}) : "",
    icono: determinarIconoNotificacion(n.categoria || ""),
    color: n.leido ? "text-secondary" : "text-primary",
  }));
}

function determinarIconoNotificacion(cat) {
  if (cat.includes("mant")) return "bi-tools";
  if (cat.includes("garan")) return "bi-shield-exclamation";
  return "bi-bell-fill";
}

// =============================
//  RENDERIZADO UI
// =============================

function renderizarTodo() {
  const r = dashboardData.resumen;

  // 1. Tarjetas Superiores
  // CAMBIO: Ahora mostramos el número de categorías en lugar del dinero
  updateText("statTotalValor", r.totalCategorias);
  
  // Intento opcional de actualizar la etiqueta HTML (si tiene ID lblTotalValor)
  // Si no, recuerda cambiar el HTML manualmente de "Valor Total" a "Categorías"
  const lblValor = document.getElementById("lblTotalValor");
  if(lblValor) lblValor.textContent = "Categorías";

  updateText("statActivos", r.totalActivos);
  updateText("statEnUso", r.enUso);
  updateText("statMantencion", r.mantencion);
  updateText("statGarantia", r.garantiaVigente);
  
  const badgeVencer = document.getElementById("badgePorVencer");
  if(badgeVencer) {
      badgeVencer.textContent = r.porVencer > 0 ? `${r.porVencer} Equipos` : "0";
      badgeVencer.className = r.porVencer > 0 ? "badge bg-danger animate-pulse" : "badge bg-secondary";
  }

  // 2. Barra de Progreso Global
  const usoPct = r.totalActivos > 0 ? Math.round((r.enUso / r.totalActivos) * 100) : 0;
  updateBar("usageBar", usoPct, `${usoPct}% Asignado`);

  // 3. Listas
  renderListaProgreso("listaSucursales", dashboardData.sucursales, r.totalActivos, "bg-info");
  renderListaProgreso("listaCategorias", dashboardData.categorias, r.totalActivos, "bg-success");

  // 4. Actividades
  renderActividades();
}

function renderListaProgreso(elementId, data, maxTotal, colorClass) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = "";

  if (data.length === 0) {
    container.innerHTML = `<div class="text-muted small text-center py-2">Sin datos disponibles</div>`;
    return;
  }

  const maxVal = Math.max(...data.map(d => d.total));

  data.forEach(item => {
    const visualPct = (item.total / maxVal) * 100; 
    const realPct = maxTotal > 0 ? Math.round((item.total / maxTotal) * 100) : 0;

    container.innerHTML += `
      <div class="mb-3">
        <div class="d-flex justify-content-between small mb-1">
          <span class="fw-semibold">${item.nombre}</span>
          <span class="text-muted">${item.total} (${realPct}%)</span>
        </div>
        <div class="progress" style="height: 6px;">
          <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${visualPct}%"></div>
        </div>
      </div>
    `;
  });
}

function renderActividades() {
  const container = document.getElementById("activityFeed");
  if (!container) return;
  container.innerHTML = "";

  if (dashboardData.actividades.length === 0) {
    container.innerHTML = `<div class="text-center text-muted p-3"><small>Sin actividad reciente</small></div>`;
    return;
  }

  dashboardData.actividades.forEach(act => {
    container.innerHTML += `
      <div class="d-flex align-items-start border-bottom py-2">
        <div class="me-3 mt-1">
          <i class="bi ${act.icono} ${act.color} fs-5"></i>
        </div>
        <div class="flex-grow-1">
          <p class="mb-0 small fw-bold">${act.usuario}</p>
          <p class="mb-0 small text-muted text-truncate" style="max-width: 250px;">${act.descripcion}</p>
        </div>
        <small class="text-muted ms-2" style="font-size: 0.75rem;">${act.tiempo}</small>
      </div>
    `;
  });
}

// Helpers DOM
function updateText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function updateBar(id, pct, text) {
  const el = document.getElementById(id);
  const lbl = document.getElementById(id + "Label");
  if (el) { el.style.width = `${pct}%`; el.setAttribute("aria-valuenow", pct); }
  if (lbl) lbl.textContent = text;
}

function mostrarErrorUI(msg) {
    const container = document.querySelector(".container-fluid");
    if(container) {
        container.insertAdjacentHTML('afterbegin', 
            `<div class="alert alert-danger alert-dismissible fade show m-3" role="alert">
                <strong>Error de carga:</strong> ${msg}. Verifique que el servidor backend esté corriendo y la DB actualizada.
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>`
        );
    }
}

// =============================
//  INIT
// =============================
document.addEventListener("DOMContentLoaded", () => {
    // Validar permisos
    const isStaff = localStorage.getItem("is_staff") === "1";
    
    // Fecha actual
    const fechaEl = document.getElementById("fechaActual");
    if(fechaEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        fechaEl.textContent = new Date().toLocaleDateString('es-ES', options);
    }

    cargarDatosDashboard();
});