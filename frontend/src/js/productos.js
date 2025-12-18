// src/js/productos.js
import { API } from "/src/js/api.js";

// ==========================================
// 0. UTILIDADES GENERALES
// ==========================================

const getParam = (name) => new URLSearchParams(window.location.search).get(name);

const nombreProducto = (prod) => {
  if (!prod) return "";
  const modelo = prod.modelo_nombre || (prod.modelo ? prod.modelo.nombre : "");
  return modelo ? `${modelo} - ${prod.nro_serie}` : prod.nro_serie;
};

// Helper para extraer texto de campos que pueden ser objeto o string/null
const getNombreCampo = (campo, fallback = "—") => {
  if (campo === null || campo === undefined) return fallback;
  if (typeof campo === "object") {
    return campo.nombre || campo.nombre_categoria || campo.nombre_sucursal || campo.nombre_estado || JSON.stringify(campo);
  }
  return campo;
};

// Helper para obtener ID de campos que pueden ser objeto o ID directo
const getId = (campo) => {
  if (!campo) return "";
  return typeof campo === "object" ? campo.id : campo;
};

let productosCache = [];
let productoActualDetalle = null;

// ==========================================
// DETECCIÓN DE PÁGINA (ROUTER)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  if (path.includes("listar.html")) initListar();
  else if (path.includes("detalle.html")) initDetalle();
  else if (path.includes("agregar.html")) initAgregar(); // Usa lógica compartida
  else if (path.includes("editar.html")) initEditar();   // Usa lógica compartida + carga de datos
  else if (path.includes("eliminar.html")) initEliminar();
});

// ==========================================
// 1. LISTAR (listar.html)
// ==========================================

function initListar() {
  const elementos = {
    btnTabla: document.getElementById("btnTabla"),
    btnTarjetas: document.getElementById("btnTarjetas"),
    vistaTabla: document.getElementById("vistaTabla"),
    vistaTarjetas: document.getElementById("vistaTarjetas"),
    vistaTablaComp: document.getElementById("vistaTablaComponentes"),
    btnFiltroComp: document.getElementById("btnFiltroComponentes"),
    filtrosComp: document.getElementById("filtrosComponentes"),
    inputBuscar: document.getElementById("inputBuscar"),
    filtros: [
      "filtroCategoria", "filtroSucursal", "filtroEstado",
      "filtroCPU", "filtroGPU", "filtroRAMMin", "filtroAlmMin"
    ].map(id => document.getElementById(id))
  };

  // Toggle Vistas
  const toggleVista = (modo) => {
    const mostrarComp = elementos.btnFiltroComp?.classList.contains("active");
    
    if (modo === 'tabla') {
      elementos.btnTabla.classList.add("active");
      elementos.btnTarjetas.classList.remove("active");
      elementos.vistaTarjetas.classList.add("d-none");
      
      if (mostrarComp) {
        elementos.vistaTablaComp.classList.remove("d-none");
        elementos.vistaTabla.classList.add("d-none");
      } else {
        elementos.vistaTabla.classList.remove("d-none");
        elementos.vistaTablaComp.classList.add("d-none");
      }
    } else {
      elementos.btnTarjetas.classList.add("active");
      elementos.btnTabla.classList.remove("active");
      elementos.vistaTabla.classList.add("d-none");
      elementos.vistaTablaComp.classList.add("d-none");
      elementos.vistaTarjetas.classList.remove("d-none");
    }
  };

  if (elementos.btnTabla) elementos.btnTabla.addEventListener("click", () => toggleVista('tabla'));
  if (elementos.btnTarjetas) elementos.btnTarjetas.addEventListener("click", () => toggleVista('tarjetas'));

  // Toggle Filtros Componentes
  if (elementos.btnFiltroComp) {
    elementos.btnFiltroComp.addEventListener("click", () => {
      elementos.btnFiltroComp.classList.toggle("active");
      const isActive = elementos.btnFiltroComp.classList.contains("active");
      
      if (isActive) elementos.filtrosComp.classList.add("show");
      else elementos.filtrosComp.classList.remove("show");

      if (isActive && elementos.btnTabla.classList.contains("active")) toggleVista('tabla');
      else if (!isActive && elementos.btnTabla.classList.contains("active")) toggleVista('tabla');
      
      aplicarFiltrosYRender();
    });
  }

  // Listeners de filtros
  const reCargar = () => aplicarFiltrosYRender();
  if (elementos.inputBuscar) elementos.inputBuscar.addEventListener("input", reCargar);
  elementos.filtros.forEach(el => { if(el) el.addEventListener("change", reCargar); });

  document.getElementById("btnLimpiarFiltrosComp")?.addEventListener("click", () => {
    ["filtroCPU", "filtroGPU", "filtroRAMMin", "filtroAlmMin"].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = "";
    });
    reCargar();
  });

  cargarProductosLista();
}

async function cargarProductosLista() {
  const tbody = document.getElementById("tbodyProductos");
  if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center">Cargando productos...</td></tr>`;

  try {
    const res = await API.get("productos/");
    productosCache = Array.isArray(res) ? res : (res.results || []);

    poblarFiltrosSelects();
    poblarFiltrosComponentes();
    aplicarFiltrosYRender();
  } catch (err) {
    console.error("Error loading products:", err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-danger text-center">Error al cargar productos</td></tr>`;
  }
}

function poblarFiltrosSelects() {
  const uniqueItems = (key, mapFn) => [...new Set(productosCache.map(mapFn).filter(Boolean))];
  
  const cats = uniqueItems("categoria", p => p.categoria_nombre || getNombreCampo(p.categoria, null));
  const sucs = uniqueItems("sucursal", p => p.sucursal_nombre || getNombreCampo(p.sucursal, null));
  const ests = uniqueItems("estado", p => p.estado_nombre || getNombreCampo(p.estado, null));

  const fillSelect = (id, label, items) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">${label}</option>` + items.map(i => `<option value="${i}">${i}</option>`).join("");
  };

  fillSelect("filtroCategoria", "Categoría: Todas", cats);
  fillSelect("filtroSucursal", "Sucursal: Todas", sucs);
  fillSelect("filtroEstado", "Estado: Todos", ests);
}

function poblarFiltrosComponentes() {
  const cpus = new Map();
  const gpus = new Map();

  productosCache.forEach(p => {
    if (p.componentes) {
      if (p.componentes.cpu) cpus.set(p.componentes.cpu.id, `${p.componentes.cpu.marca} ${p.componentes.cpu.modelo}`);
      if (p.componentes.gpu) gpus.set(p.componentes.gpu.id, `${p.componentes.gpu.marca} ${p.componentes.gpu.modelo}`);
    }
  });

  const fillComp = (id, label, map) => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `<option value="">${label}</option>`;
      map.forEach((val, key) => el.innerHTML += `<option value="${key}">${val}</option>`);
    }
  };
  fillComp("filtroCPU", "Todas las CPUs", cpus);
  fillComp("filtroGPU", "Todas las GPUs", gpus);
}

function aplicarFiltrosYRender() {
  const getVal = (id) => document.getElementById(id)?.value?.toLowerCase() || "";
  
  const texto = getVal("inputBuscar");
  const cat = getVal("filtroCategoria");
  const suc = getVal("filtroSucursal");
  const est = getVal("filtroEstado");
  const cpuId = getVal("filtroCPU");
  const gpuId = getVal("filtroGPU");
  const ramMin = parseFloat(document.getElementById("filtroRAMMin")?.value) || 0;
  const almMin = parseFloat(document.getElementById("filtroAlmMin")?.value) || 0;

  const filtrados = productosCache.filter(p => {
    const matchTexto = !texto || [p.nro_serie, nombreProducto(p), getNombreCampo(p.categoria), getNombreCampo(p.sucursal)].some(field => String(field).toLowerCase().includes(texto));
    const matchCat = !cat || String(p.categoria_nombre || getNombreCampo(p.categoria)).toLowerCase() === cat;
    const matchSuc = !suc || String(p.sucursal_nombre || getNombreCampo(p.sucursal)).toLowerCase() === suc;
    const matchEst = !est || String(p.estado_nombre || getNombreCampo(p.estado)).toLowerCase() === est;

    let matchComp = true;
    const c = p.componentes || {};
    if (cpuId && (!c.cpu || String(c.cpu.id) !== cpuId)) matchComp = false;
    if (gpuId && (!c.gpu || String(c.gpu.id) !== gpuId)) matchComp = false;
    if (ramMin && (!c.ram_gb || c.ram_gb < ramMin)) matchComp = false;
    if (almMin && (!c.almacenamiento_gb || c.almacenamiento_gb < almMin)) matchComp = false;

    return matchTexto && matchCat && matchSuc && matchEst && matchComp;
  });

  const modoComp = document.getElementById("btnFiltroComponentes")?.classList.contains("active");
  if (modoComp) renderTablaProductosConComponentes(filtrados);
  else renderTablaProductos(filtrados);
  renderTarjetasProductos(filtrados);
}

function renderTablaProductos(lista) {
  const tbody = document.getElementById("tbodyProductos");
  if (!tbody) return;
  if (!lista.length) return tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No hay coincidencias.</td></tr>`;

  tbody.innerHTML = lista.map(p => `
    <tr>
      <td><input type="checkbox"></td>
      <td>${p.nro_serie}</td>
      <td>${nombreProducto(p)}</td>
      <td>${getNombreCampo(p.sucursal)}</td>
      <td>${(p.facturas_info && p.facturas_info.length) ? p.facturas_info[0].numero : "—"}</td>
      <td>${p.garantia_meses ? p.garantia_meses + " meses" : "—"}</td>
      <td>${getNombreCampo(p.estado)}</td>
      <td class="d-flex gap-1">
        <a href="detalle.html?id=${p.id}" class="btn btn-sm btn-primary"><i class="bi bi-eye"></i></a>
        <a href="editar.html?id=${p.id}" class="btn btn-sm btn-warning"><i class="bi bi-pencil"></i></a>
        <a href="eliminar.html?id=${p.id}" class="btn btn-sm btn-danger"><i class="bi bi-trash"></i></a>
      </td>
    </tr>
  `).join("");
}

function renderTablaProductosConComponentes(lista) {
  const tbody = document.getElementById("tbodyProductosComponentes");
  if (!tbody) return;
  if (!lista.length) return tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No hay coincidencias.</td></tr>`;

  tbody.innerHTML = lista.map(p => {
    const c = p.componentes || {};
    return `
    <tr>
      <td><input type="checkbox"></td>
      <td>${p.nro_serie}</td>
      <td>${nombreProducto(p)}</td>
      <td class="componentes-col"><small>${c.cpu ? `${c.cpu.marca} ${c.cpu.modelo}` : "—"}</small></td>
      <td class="componentes-col"><small>${c.gpu ? `${c.gpu.marca} ${c.gpu.modelo}` : "—"}</small></td>
      <td class="componentes-col"><small>${c.ram_gb ? c.ram_gb + " GB" : "—"}</small></td>
      <td class="componentes-col"><small>${c.almacenamiento_gb ? c.almacenamiento_gb + " GB" : "—"}</small></td>
      <td>${getNombreCampo(p.sucursal)}</td>
      <td>${getNombreCampo(p.estado)}</td>
      <td class="d-flex gap-1">
        <a href="detalle.html?id=${p.id}" class="btn btn-sm btn-primary"><i class="bi bi-eye"></i></a>
        <a href="editar.html?id=${p.id}" class="btn btn-sm btn-warning"><i class="bi bi-pencil"></i></a>
        <a href="eliminar.html?id=${p.id}" class="btn btn-sm btn-danger"><i class="bi bi-trash"></i></a>
      </td>
    </tr>
  `}).join("");
}

function renderTarjetasProductos(lista) {
  const cont = document.getElementById("cardsProductos");
  if (!cont) return;
  if (!lista.length) return cont.innerHTML = `<p class="text-muted text-center w-100">No hay productos que coincidan.</p>`;

  cont.innerHTML = lista.map(p => {
    const c = p.componentes || {};
    const compHtml = p.componentes ? `
      <hr class="my-2">
      <div class="text-start small text-muted">
        ${c.cpu ? `<div><i class="bi bi-cpu"></i> ${c.cpu.marca} ${c.cpu.modelo}</div>` : ""}
        ${c.gpu ? `<div><i class="bi bi-gpu-card"></i> ${c.gpu.marca} ${c.gpu.modelo}</div>` : ""}
        ${c.ram_gb ? `<div><i class="bi bi-memory"></i> ${c.ram_gb} GB</div>` : ""}
      </div>
    ` : "";

    return `
    <div class="col-md-4 col-lg-3 mb-3">
      <div class="card p-3 h-100 text-center shadow-sm">
        <h6 class="fw-bold mb-1 text-truncate">${nombreProducto(p)}</h6>
        <small class="text-muted d-block mb-1">${getNombreCampo(p.categoria)}</small>
        <span class="badge bg-light text-dark mb-1 border">${getNombreCampo(p.sucursal)}</span>
        <p class="small mb-1"><strong>Estado:</strong> ${getNombreCampo(p.estado)}</p>
        ${compHtml}
        <div class="mt-auto pt-3 d-flex justify-content-center gap-1">
          <a href="detalle.html?id=${p.id}" class="btn btn-sm btn-outline-primary"><i class="bi bi-eye"></i></a>
          <a href="editar.html?id=${p.id}" class="btn btn-sm btn-outline-warning"><i class="bi bi-pencil"></i></a>
          <a href="eliminar.html?id=${p.id}" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></a>
        </div>
      </div>
    </div>
  `}).join("");
}

// ==========================================
// 2. DETALLE (detalle.html)
// ==========================================

function initDetalle() {
  const id = getParam("id");
  if (!id) return;
  
  cargarDetalleProducto(id);
  document.getElementById("btn-imprimir-qr")?.addEventListener("click", imprimirQRProducto);
  
  const btnGuardarEstado = document.getElementById("btnGuardarCambioEstado");
  if (btnGuardarEstado) {
    btnGuardarEstado.addEventListener("click", handleCambioEstado);
    document.getElementById("btnCambiarEstado")?.addEventListener("click", () => {
      document.getElementById("estadoActualTexto").value = getNombreCampo(productoActualDetalle?.estado);
      cargarSelectGeneric("nuevoEstado", "estados/", false);
    });
  }
}

async function cargarDetalleProducto(id) {
  try {
    const p = await API.get(`productos/${id}/`);
    productoActualDetalle = p;

    const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    
    setText("nombreProd", nombreProducto(p));
    setText("codigoProd", p.nro_serie);
    setText("categoriaProd", getNombreCampo(p.categoria));
    setText("sucursalProd", getNombreCampo(p.sucursal));
    setText("estadoProd", getNombreCampo(p.estado));
    setText("fechaProd", p.fecha_compra || "—");
    setText("garantiaProd", p.garantia_meses ? `${p.garantia_meses} meses` : "—");
    setText("precioProd", (p.valor_compra !== null) ? `$${p.valor_compra}` : "—");

    const listaComp = document.getElementById("componentesProd");
    if(listaComp) {
      const c = p.componentes;
      if (!c) listaComp.innerHTML = `<li class="text-muted">Sin componentes registrados.</li>`;
      else {
        listaComp.innerHTML = `
          <li><strong>CPU:</strong> ${c.cpu ? `${c.cpu.marca} ${c.cpu.modelo}` : "—"}</li>
          <li><strong>GPU:</strong> ${c.gpu ? `${c.gpu.marca} ${c.gpu.modelo}` : "—"}</li>
          <li><strong>RAM:</strong> ${c.ram_gb || "—"} GB</li>
          <li><strong>Almacenamiento:</strong> ${c.almacenamiento_gb || "—"} GB</li>
        `;
      }
    }

    const elFactura = document.getElementById("facturaProd");
    const btnDescarga = document.getElementById("btnDescargarFactura");
    
    const facturas = p.facturas || [];
    if (facturas.length > 0) {
      const f = facturas[0];
      if (elFactura) elFactura.textContent = `Factura N° ${f.numero_factura || f.numero}`;
      if (f.archivo_url || f.archivo) {
        btnDescarga.href = f.archivo_url || f.archivo;
        btnDescarga.classList.remove("d-none");
      }
    } else {
      if (elFactura) elFactura.textContent = "No asociada";
      if (btnDescarga) btnDescarga.classList.add("d-none");
    }

    const imgQr = document.getElementById("qr-img");
    if (imgQr && p.codigo_qr) {
      imgQr.src = p.codigo_qr.imagen_qr_url || p.codigo_qr.imagen_qr;
    }

    cargarMovimientosProducto(p.nro_serie);

  } catch (err) {
    console.error(err);
    alert("Error al cargar detalle del producto.");
  }
}

async function cargarMovimientosProducto(sku) {
  const tbody = document.getElementById("historialMovimientosProd");
  if (!tbody) return;
  try {
    const res = await API.get(`movimientos/?sku=${encodeURIComponent(sku)}`);
    const lista = Array.isArray(res) ? res : res.results;
    
    if(!lista.length) return tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Sin movimientos.</td></tr>`;
    
    tbody.innerHTML = lista.map(m => `
      <tr>
        <td>${m.fecha ? new Date(m.fecha).toLocaleDateString() : ""}</td>
        <td>${m.tipo}</td>
        <td>${m.cantidad}</td>
        <td>${m.comentarios || m.referencia || "—"}</td>
      </tr>
    `).join("");
  } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="text-danger">Error cargando historial.</td></tr>`; }
}

async function handleCambioEstado() {
  if (!productoActualDetalle) return;
  
  const nuevoEstadoId = document.getElementById("nuevoEstado").value;
  const comentario = document.getElementById("comentarioEstado").value;
  
  if (!nuevoEstadoId) return alert("Seleccione un estado.");

  try {
    await API.put(`productos/${productoActualDetalle.id}/`, {
      ...productoActualDetalle,
      estado: parseInt(nuevoEstadoId),
      proveedor: getId(productoActualDetalle.proveedor),
      modelo: getId(productoActualDetalle.modelo),
      categoria: getId(productoActualDetalle.categoria),
      sucursal: getId(productoActualDetalle.sucursal),
      facturas_ids: (productoActualDetalle.facturas || []).map(f => f.id)
    });

    await API.post("movimientos/", {
      tipo: "ajuste",
      sku: productoActualDetalle.nro_serie,
      cantidad: 1,
      referencia: "Cambio de Estado Manual",
      comentarios: comentario || "Cambio de estado desde detalle"
    });

    alert("Estado actualizado.");
    location.reload();
  } catch (err) {
    console.error(err);
    alert("Error al actualizar estado.");
  }
}

function imprimirQRProducto() {
  const img = document.getElementById("qr-img");
  if (!img || !img.src) return alert("No hay QR para imprimir.");
  
  const win = window.open("", "_blank", "width=400,height=500");
  win.document.write(`
    <html><body style="text-align:center; font-family:sans-serif; padding:20px;">
      <h2>${document.getElementById("nombreProd").textContent}</h2>
      <h3>${document.getElementById("codigoProd").textContent}</h3>
      <img src="${img.src}" style="max-width:100%">
      <script>window.onload=()=>{window.print();} //\x3c/script>
    </body></html>
  `);
}

// ==========================================
// 3. AGREGAR (agregar.html)
// ==========================================

function initAgregar() {
  const form = document.getElementById("formProducto");
  if (!form) return;

  // Cargar selects iniciales y configurar UI
  cargarSelectsComunes().then(() => {
    initFacturaUI();
    initComponentesModales();
  });

  // Listener para cascada Marca -> Modelo
  document.getElementById("marca")?.addEventListener("change", cargarModelosPorMarca);

  // Submit en modo Creación (sin ID)
  form.addEventListener("submit", (e) => onSubmitGuardarProducto(e, null));
}


// ==========================================
// 4. EDITAR (editar.html)
// ==========================================

function initEditar() {
  const id = getParam("id");
  if (!id) return window.location.href = "listar.html";

  const form = document.getElementById("formEditarProducto");
  if (!form) return;

  // 1. Cargar selects comunes (esperar a que terminen)
  cargarSelectsComunes().then(async () => {
    // 2. Inicializar lógica de Facturas y Modales
    initFacturaUI();
    initComponentesModales();

    // 3. Listener Marca -> Modelo (para cambios manuales)
    document.getElementById("marca")?.addEventListener("change", cargarModelosPorMarca);

    // 4. Cargar datos del producto y llenar el form
    await cargarDatosEdicion(id);
  });

  // Submit en modo Edición (con ID)
  form.addEventListener("submit", (e) => onSubmitGuardarProducto(e, id));
}

async function cargarDatosEdicion(id) {
  try {
    const p = await API.get(`productos/${id}/`);
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

    // Campos básicos
    setVal("codigo", p.nro_serie);
    setVal("proveedor", getId(p.proveedor));
    setVal("categoria", getId(p.categoria));
    setVal("sucursal", getId(p.sucursal));
    setVal("estado", getId(p.estado));
    setVal("fechaCompra", p.fecha_compra);
    setVal("mesesGarantia", p.garantia_meses);
    setVal("valorCompra", p.valor_compra);

    // --- MARCA Y MODELO (Cascada) ---
    // El serializer de detalle devuelve el objeto modelo completo {id, nombre, marca: ID}
    // OJO: Si tu ModelosSerializer anidado devuelve 'marca' como objeto, usa getId(p.modelo.marca)
    const modeloInfo = p.modelo; 
    if (modeloInfo) {
       // Obtenemos el ID de la marca. 
       // Si modeloInfo.marca es un objeto (por ModelosSerializer), usamos .id. Si es int, directo.
       const marcaId = typeof modeloInfo.marca === 'object' ? modeloInfo.marca.id : modeloInfo.marca;
       
       if (marcaId) {
         setVal("marca", marcaId);
         // Importante: Esperar a que carguen los modelos de esa marca
         await cargarModelosPorMarca(); 
         // Ahora sí, seleccionar el modelo
         setVal("modelo", modeloInfo.id);
       }
    }

    // --- FACTURAS ---
    if (p.facturas && p.facturas.length > 0) {
      // Seleccionar la primera
      setVal("facturaSelect", p.facturas[0].id);
    }

    // --- COMPONENTES ---
    if (p.componentes) {
      if (p.componentes.cpu) setVal("cpu", p.componentes.cpu.id);
      if (p.componentes.gpu) setVal("gpu", p.componentes.gpu.id);
      setVal("ram", p.componentes.ram_gb);
      setVal("almacenamiento", p.componentes.almacenamiento_gb);
    }

  } catch (err) {
    console.error("Error al cargar datos de edición:", err);
    alert("No se pudo cargar la información del producto.");
  }
}


// ==========================================
// 5. ELIMINAR (eliminar.html)
// ==========================================

function initEliminar() {
    const id = getParam("id");
    if(!id) return;
    
    API.get(`productos/${id}/`).then(p => {
        document.getElementById("producto-eliminar-info").innerHTML = `
            <p><strong>${nombreProducto(p)}</strong></p>
            <p class="text-muted">Serie: ${p.nro_serie}</p>
        `;
    });

    document.getElementById("formEliminarProducto")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if(confirm("¿Seguro que deseas eliminar permanentemente?")) {
            try {
                await API.delete(`productos/${id}/`);
                alert("Eliminado.");
                window.location.href = "listar.html";
            } catch(err) {
                alert("Error al eliminar.");
            }
        }
    });
}


// ==========================================
// HELPERS COMPARTIDOS (LOGICA AGREGAR/EDITAR)
// ==========================================

async function cargarSelectsComunes() {
  // Carga paralela de selects independientes
  await Promise.all([
    cargarSelectGeneric("proveedor", "proveedores/"),
    cargarSelectGeneric("categoria", "categorias/"),
    cargarSelectGeneric("estado", "estados/"),
    cargarSelectGeneric("sucursal", "sucursales/"),
    cargarSelectGeneric("cpu", "cpu/"),
    cargarSelectGeneric("gpu", "gpu/"),
    cargarSelectGeneric("marca", "marcas/"),
    // El select de proveedor dentro de "Nueva Factura"
    cargarSelectGeneric("facturaProveedor", "proveedores/") 
  ]);
}

async function cargarSelectGeneric(id, endpoint, allowEmpty=true) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    const res = await API.get(endpoint);
    const data = Array.isArray(res) ? res : res.results;
    
    const labelFn = (item) => {
        if(item.marca && item.modelo) return `${item.marca} ${item.modelo}`; 
        if(item.nombre) return item.nombre;
        return "Item " + item.id;
    };

    // Mantenemos opción vacía o __new__ si ya existe
    const hasNew = el.querySelector('option[value="__new__"]');
    el.innerHTML = allowEmpty ? `<option value="">Seleccione...</option>` : "";
    if (hasNew) el.innerHTML += `<option value="__new__">➕ Agregar nueva factura</option>`;

    data.forEach(i => el.innerHTML += `<option value="${i.id}">${labelFn(i)}</option>`);
  } catch (err) {
    console.warn(`Fallo al cargar ${endpoint}`, err);
  }
}

async function cargarModelosPorMarca() {
    const marcaId = document.getElementById("marca").value;
    const modeloSel = document.getElementById("modelo");
    if(!modeloSel) return;
    
    modeloSel.innerHTML = '<option value="">Cargando...</option>';
    if(!marcaId) return modeloSel.innerHTML = '<option value="">Selecciona marca primero...</option>';

    try {
        const res = await API.get("modelos/");
        const todosModelos = (Array.isArray(res) ? res : res.results);
        
        // Filtrado en cliente (simple)
        const modelosFiltrados = todosModelos.filter(m => String(m.marca) === String(marcaId));
        
        modeloSel.innerHTML = `<option value="">Seleccione modelo...</option>` + 
            modelosFiltrados.map(m => `<option value="${m.id}">${m.nombre}</option>`).join("");
    } catch(e) {
        console.error(e);
        modeloSel.innerHTML = '<option value="">Error cargando modelos</option>';
    }
}

async function onSubmitGuardarProducto(e, idEdicion = null) {
  e.preventDefault();
  
  const getVal = (id) => document.getElementById(id)?.value || null;
  const facturaSelect = document.getElementById("facturaSelect");

  // 1. Manejo de Factura (Nueva o Existente)
  let facturas_ids = [];
  if (facturaSelect && facturaSelect.value === "__new__") {
    try {
      const nuevaFactura = await crearFacturaDesdeUI();
      facturas_ids.push(nuevaFactura.id);
    } catch (err) {
      return alert("Error creando la factura: " + err.message);
    }
  } else if (facturaSelect && facturaSelect.value) {
    facturas_ids.push(parseInt(facturaSelect.value));
  }

  // 2. Construir Payload
  const payload = {
    nro_serie: getVal("codigo"),
    proveedor: getVal("proveedor"),
    modelo: getVal("modelo"),
    categoria: getVal("categoria"),
    sucursal: getVal("sucursal"),
    estado: getVal("estado"),
    fecha_compra: getVal("fechaCompra"),
    garantia_meses: getVal("mesesGarantia"),
    valor_compra: getVal("valorCompra"),
    facturas_ids: facturas_ids,
    componentes: {}
  };

  // Componentes (IDs)
  const cpu = getVal("cpu");
  const gpu = getVal("gpu");
  const ram = getVal("ram");
  const alm = getVal("almacenamiento");

  if (cpu) payload.componentes.cpu_id = parseInt(cpu);
  if (gpu) payload.componentes.gpu_id = parseInt(gpu);
  if (ram) payload.componentes.ram_gb = parseInt(ram);
  if (alm) payload.componentes.almacenamiento_gb = parseInt(alm);

  if (Object.keys(payload.componentes).length === 0) delete payload.componentes;

  // 3. Enviar (POST o PUT)
  try {
    if (idEdicion) {
      // Editar
      await API.put(`productos/${idEdicion}/`, payload);
      alert("Producto actualizado exitosamente.");
    } else {
      // Crear
      await API.post("productos/", payload);
      alert("Producto guardado exitosamente.");
    }
    window.location.href = "listar.html";
  } catch (err) {
    console.error("Error guardando producto:", err);
    alert("Error al guardar. Revise los datos obligatorios.");
  }
}


// ==========================================
// LOGICA DE FACTURAS Y MODALES
// ==========================================

async function cargarFacturasEnSelect() {
    const sel = document.getElementById("facturaSelect");
    if(!sel) return;
    
    // Preservar opción __new__
    const hasNew = sel.querySelector('option[value="__new__"]');
    
    try {
        const res = await API.get("facturas/");
        const lista = Array.isArray(res) ? res : res.results;
        
        sel.innerHTML = `<option value="">Seleccione factura...</option>`;
        if(hasNew) sel.innerHTML += `<option value="__new__">➕ Agregar nueva factura</option>`;
        
        lista.forEach(f => {
            sel.innerHTML += `<option value="${f.id}">${f.numero_factura} (${f.proveedor ? f.proveedor.nombre : 'Sin Prov.'})</option>`;
        });
    } catch(e) { console.error(e); }
}

function initFacturaUI() {
    const sel = document.getElementById("facturaSelect");
    const box = document.getElementById("facturaNuevaBox");
    const provProd = document.getElementById("proveedor");
    const provFact = document.getElementById("facturaProveedor");
    
    // Cargar opciones iniciales
    if(sel) cargarFacturasEnSelect();

    if(sel && box) {
        sel.addEventListener("change", () => {
            const isNew = sel.value === "__new__";
            box.classList.toggle("d-none", !isNew);
            
            // Si elige nueva factura, intentar copiar el proveedor seleccionado en el producto
            if(isNew && provProd && provFact) {
                if (provProd.value) provFact.value = provProd.value; 
            }
        });
    }

    // Botón "Guardar Factura Independiente"
    document.getElementById("btnGuardarFactura")?.addEventListener("click", async () => {
        try {
            const nueva = await crearFacturaDesdeUI();
            alert("Factura creada.");
            await cargarFacturasEnSelect(); // recargar lista
            sel.value = nueva.id; // autoseleccionar
            box.classList.add("d-none"); // ocultar formulario
        } catch(e) {
            alert(e.message);
        }
    });
}

async function crearFacturaDesdeUI(fileId="facturaArchivo", dateId="facturaFecha", amountId="facturaMonto", numId="facturaNumero") {
    const num = document.getElementById(numId)?.value;
    const fecha = document.getElementById(dateId)?.value;
    const monto = document.getElementById(amountId)?.value;
    const file = document.getElementById(fileId)?.files[0];
    
    let provId = document.getElementById("facturaProveedor")?.value;
    // Fallback al proveedor del producto si no se seleccionó uno específico
    if(!provId) provId = document.getElementById("proveedor")?.value;

    if(!num || !fecha || !monto || !provId) throw new Error("Faltan datos obligatorios para la factura (Número, Fecha, Monto, Proveedor).");
    if(!file) throw new Error("Debes adjuntar el archivo de la factura.");

    const fd = new FormData();
    fd.append("numero_factura", num);
    fd.append("fecha_emision", fecha);
    fd.append("monto_total", monto);
    fd.append("proveedor", provId);
    fd.append("archivo", file);
    
    return await API.post("facturas/", fd);
}

function initComponentesModales() {
    // Configura los modales para limpiar campos al abrir y guardar al hacer click

    // MARCA
    document.getElementById("btnGuardarMarca")?.addEventListener("click", async () => {
        const nombre = document.getElementById("nuevaMarcaNombre").value;
        if(!nombre) return alert("Escriba el nombre");
        try {
            const res = await API.post("marcas/", { nombre });
            // Recargar select de marcas
            await cargarSelectGeneric("marca", "marcas/");
            document.getElementById("marca").value = res.id;
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById("modalNuevaMarca"));
            modal.hide();
            
            // Disparar evento change para cargar modelos (vacío)
            document.getElementById("marca").dispatchEvent(new Event('change'));
        } catch(e) { alert("Error al guardar Marca"); }
    });

    // MODELO
    // Al abrir modal modelo, cargar marcas en su select interno
    const modalModeloEl = document.getElementById("modalNuevoModelo");
    if (modalModeloEl) {
        modalModeloEl.addEventListener('show.bs.modal', () => {
            cargarSelectGeneric("nuevoModeloMarca", "marcas/", false);
            // Pre-seleccionar la marca actual del formulario principal si existe
            const marcaActual = document.getElementById("marca").value;
            if(marcaActual) setTimeout(() => document.getElementById("nuevoModeloMarca").value = marcaActual, 500);
        });
    }

    document.getElementById("btnGuardarModelo")?.addEventListener("click", async () => {
        const marca = document.getElementById("nuevoModeloMarca").value;
        const nombre = document.getElementById("nuevoModeloNombre").value;
        if(!marca || !nombre) return alert("Faltan datos");
        
        try {
            const res = await API.post("modelos/", { marca, nombre });
            
            // Si la marca del nuevo modelo coincide con la seleccionada en el form principal, recargar
            const marcaPrincipal = document.getElementById("marca").value;
            if (String(marcaPrincipal) === String(marca)) {
                await cargarModelosPorMarca();
                document.getElementById("modelo").value = res.id;
            } else {
                alert("Modelo creado (cambia la marca para verlo).");
            }
            
            const modal = bootstrap.Modal.getInstance(document.getElementById("modalNuevoModelo"));
            modal.hide();
        } catch(e) { alert("Error al guardar Modelo"); }
    });

    // CPU y GPU
    const handleCompSave = async (type, payload, modalId) => {
         try {
            const res = await API.post(type + "/", payload);
            await cargarSelectGeneric(type, type + "/");
            document.getElementById(type).value = res.id;
            
            const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
            modal.hide();
         } catch(e) { alert("Error al guardar componente"); }
    };

    document.getElementById("btnGuardarCPU")?.addEventListener("click", () => {
        const marca = document.getElementById("cpuNombre").value; 
        const modelo = document.getElementById("cpuGeneracion").value; // Reutilizando IDs del html original
        if(!marca) return alert("Falta marca");
        handleCompSave("cpu", { marca, modelo: modelo || "Genérica" }, "modalNuevaCPU");
    });

    document.getElementById("btnGuardarGPU")?.addEventListener("click", () => {
        const marca = document.getElementById("gpuNombre").value;
        const modelo = document.getElementById("gpuMemoria").value;
        if(!marca) return alert("Falta marca");
        handleCompSave("gpu", { marca, modelo: modelo || "Genérica" }, "modalNuevaGPU");
    });
}