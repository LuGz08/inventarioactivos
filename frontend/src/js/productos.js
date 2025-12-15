// src/js/productos.js
// Frontend CRUD para Productos (lista, filtro, detalle, crear, editar, eliminar)
// Requiere: /src/js/api.js que exporta { API } y JWT válido en localStorage.

import { API } from "/src/js/api.js";

// -----------------------------------------------------------
// Utilidades generales
// -----------------------------------------------------------

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function nombreProducto(prod) {
  if (!prod) return "";
  // Asumimos que el serializer expone modelo_nombre + nro_serie
  return `${prod.modelo_nombre} - ${prod.nro_serie}`;
}

let productosCache = []; // lista completa desde la API
let productoActualDetalle = null; // producto cargado en detalle para cambio de estado

// -----------------------------------------------------------
// DETECCIÓN DE PÁGINA
// -----------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  if (path.endsWith("listar.html")) {
    initListar();
  } else if (path.endsWith("detalle.html")) {
    initDetalle();
  } else if (path.endsWith("agregar.html")) {
    initAgregar();
  } else if (path.endsWith("editar.html")) {
    initEditar();
  } else if (path.endsWith("eliminar.html")) {
    initEliminar();
  }
});

// -----------------------------------------------------------
// LISTAR (listar.html)
// -----------------------------------------------------------

function initListar() {
  const btnTabla = document.getElementById("btnTabla");
  const btnTarjetas = document.getElementById("btnTarjetas");
  const vistaTabla = document.getElementById("vistaTabla");
  const vistaTarjetas = document.getElementById("vistaTarjetas");
  const vistaTablaComponentes = document.getElementById("vistaTablaComponentes");

  // Toggle tabla/tarjetas (modificar para incluir tabla de componentes)
  if (btnTabla && btnTarjetas && vistaTabla && vistaTarjetas && vistaTablaComponentes) {
    btnTabla.addEventListener("click", () => {
      btnTabla.classList.add("active");
      btnTarjetas.classList.remove("active");
      
      const mostrarComponentes = document.getElementById("btnFiltroComponentes").classList.contains("active");
      
      if (mostrarComponentes) {
        vistaTablaComponentes.classList.remove("d-none");
        vistaTabla.classList.add("d-none");
      } else {
        vistaTabla.classList.remove("d-none");
        vistaTablaComponentes.classList.add("d-none");
      }
      vistaTarjetas.classList.add("d-none");
    });

    btnTarjetas.addEventListener("click", () => {
      btnTarjetas.classList.add("active");
      btnTabla.classList.remove("active");
      vistaTabla.classList.add("d-none");
      vistaTablaComponentes.classList.add("d-none");
      vistaTarjetas.classList.remove("d-none");
    });
  }

  const inputBuscar = document.getElementById("inputBuscar");
  const filtroCategoria = document.getElementById("filtroCategoria");
  const filtroSucursal = document.getElementById("filtroSucursal");
  const filtroEstado = document.getElementById("filtroEstado");

  // ✅ Nuevos filtros de componentes
  const filtroCPU = document.getElementById("filtroCPU");
  const filtroGPU = document.getElementById("filtroGPU");
  const filtroRAMMin = document.getElementById("filtroRAMMin");
  const filtroAlmMin = document.getElementById("filtroAlmMin");
  const btnFiltroComponentes = document.getElementById("btnFiltroComponentes");
  const btnLimpiarFiltrosComp = document.getElementById("btnLimpiarFiltrosComp");


  const reCargar = () => aplicarFiltrosYRender();

  if (inputBuscar) inputBuscar.addEventListener("input", reCargar);
  if (filtroCategoria) filtroCategoria.addEventListener("change", reCargar);
  if (filtroSucursal) filtroSucursal.addEventListener("change", reCargar);
  if (filtroEstado) filtroEstado.addEventListener("change", reCargar);

  // ✅ Listeners de filtros de componentes
  if (filtroCPU) filtroCPU.addEventListener("change", reCargar);
  if (filtroGPU) filtroGPU.addEventListener("change", reCargar);
  if (filtroRAMMin) filtroRAMMin.addEventListener("input", reCargar);
  if (filtroAlmMin) filtroAlmMin.addEventListener("input", reCargar);
  
  // ✅ Toggle de vista de componentes
  if (btnFiltroComponentes) {
    btnFiltroComponentes.addEventListener("click", () => {
      const filtrosDiv = document.getElementById("filtrosComponentes");
      
      // Alternar el estado activo del botón
      btnFiltroComponentes.classList.toggle("active");
      
      // Alternar la visibilidad del panel de filtros
      if (btnFiltroComponentes.classList.contains("active")) {
        filtrosDiv.classList.add("show");
      } else {
        filtrosDiv.classList.remove("show");
      }
      
      // Cambiar entre tabla normal y tabla con componentes
      const vistaTabla = document.getElementById("vistaTabla");
      const vistaTablaComponentes = document.getElementById("vistaTablaComponentes");
      const vistaTarjetas = document.getElementById("vistaTarjetas");
      
      if (btnFiltroComponentes.classList.contains("active")) {
        vistaTabla.classList.add("d-none");
        vistaTablaComponentes.classList.remove("d-none");
        vistaTarjetas.classList.add("d-none");
        
        // Asegurar que el botón tabla esté activo
        document.getElementById("btnTabla")?.classList.add("active");
        document.getElementById("btnTarjetas")?.classList.remove("active");
      } else {
        vistaTablaComponentes.classList.add("d-none");
        vistaTabla.classList.remove("d-none");
      }
      
      reCargar();
    });
  }
  // ✅ Limpiar filtros de componentes
  if (btnLimpiarFiltrosComp) {
    btnLimpiarFiltrosComp.addEventListener("click", () => {
      if (filtroCPU) filtroCPU.value = "";
      if (filtroGPU) filtroGPU.value = "";
      if (filtroRAMMin) filtroRAMMin.value = "";
      if (filtroAlmMin) filtroAlmMin.value = "";
      reCargar();
    });
  }

  cargarProductosLista();
}


// ✅ Agregar función para poblar filtros de componentes
function poblarFiltrosComponentes() {
  const filtroCPU = document.getElementById("filtroCPU");
  const filtroGPU = document.getElementById("filtroGPU");
  
  if (!productosCache.length) return;
  
  // Extraer CPUs únicas
  const cpus = new Map();
  const gpus = new Map();
  
  productosCache.forEach(p => {
    if (p.componentes) {
      if (p.componentes.cpu) {
        const cpu = p.componentes.cpu;
        cpus.set(cpu.id, `${cpu.marca} ${cpu.modelo}`);
      }
      if (p.componentes.gpu) {
        const gpu = p.componentes.gpu;
        gpus.set(gpu.id, `${gpu.marca} ${gpu.modelo}`);
      }
    }
  });
  
  // Poblar select de CPUs
  if (filtroCPU) {
    filtroCPU.innerHTML = `<option value="">Todas las CPUs</option>`;
    cpus.forEach((nombre, id) => {
      filtroCPU.innerHTML += `<option value="${id}">${nombre}</option>`;
    });
  }
  
  // Poblar select de GPUs
  if (filtroGPU) {
    filtroGPU.innerHTML = `<option value="">Todas las GPUs</option>`;
    gpus.forEach((nombre, id) => {
      filtroGPU.innerHTML += `<option value="${id}">${nombre}</option>`;
    });
  }
}


// Modificar cargarProductosLista para incluir filtros de componentes:
async function cargarProductosLista() {
  const tbody = document.getElementById("tbodyProductos");
  const cardsCont = document.getElementById("cardsProductos");

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9">Cargando productos...</td></tr>`;
  }
  if (cardsCont) {
    cardsCont.innerHTML = `<p>Cargando productos...</p>`;
  }

  try {
    const res = await API.get("productos/");
    productosCache = Array.isArray(res) ? res : (res.results || []);

    poblarFiltrosDesdeProductos();
    poblarFiltrosComponentes(); // ✅ Agregar esta línea
    aplicarFiltrosYRender();
    aplicarFiltroDesdeURL();

  } catch (err) {
    console.error("Error al cargar productos:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9">Error al cargar productos</td></tr>`;
    }
    if (cardsCont) {
      cardsCont.innerHTML = `<p>Error al cargar productos</p>`;
    }
  }
}

function poblarFiltrosDesdeProductos() {
  function getNombreCampo(campo, fallback = "—") {
    if (campo === null || campo === undefined) return fallback;
    if (typeof campo === "object") {
      if (campo.nombre) return campo.nombre;
      if (campo.nombre_categoria) return campo.nombre_categoria;
      if (campo.nombre_sucursal) return campo.nombre_sucursal;
      if (campo.nombre_estado) return campo.nombre_estado;
      if (campo.garantia_meses) return campo.garantia_meses;
      return JSON.stringify(campo);
    }
    return campo;
  }

  if (!productosCache.length) return;

  const filtroCategoria = document.getElementById("filtroCategoria");
  const filtroSucursal = document.getElementById("filtroSucursal");
  const filtroEstado = document.getElementById("filtroEstado");

  const cats = [...new Set(
    productosCache.map(p =>
      p.categoria_nombre || getNombreCampo(p.categoria, null)
    ).filter(Boolean)
  )];

  const sucs = [...new Set(
    productosCache.map(p =>
      p.sucursal_nombre || getNombreCampo(p.sucursal, null)
    ).filter(Boolean)
  )];

  const ests = [...new Set(
    productosCache.map(p =>
      p.estado_nombre || getNombreCampo(p.estado, null)
    ).filter(Boolean)
  )];

  if (filtroCategoria) {
    filtroCategoria.innerHTML = `<option value="">Categoría: Todas</option>` +
      cats.map(c => `<option value="${c}">${c}</option>`).join("");
  }

  if (filtroSucursal) {
    filtroSucursal.innerHTML = `<option value="">Sucursal: Todas</option>` +
      sucs.map(s => `<option value="${s}">${s}</option>`).join("");
  }

  if (filtroEstado) {
    filtroEstado.innerHTML = `<option value="">Estado: Todos</option>` +
      ests.map(e => `<option value="${e}">${e}</option>`).join("");
  }
}

function aplicarFiltroDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const categoriaId = params.get("categoria_id");
  const categoriaNombre = params.get("categoria");

  const selectCat = document.getElementById("filtroCategoria");
  if (!selectCat) return;

  let aplicado = false;

  // 1) Intentar por ID (value del option)
  if (categoriaId) {
    for (const opt of selectCat.options) {
      if (opt.value === categoriaId) {
        selectCat.value = categoriaId;
        aplicado = true;
        break;
      }
    }
  }

  // 2) Si no se encontró por ID, intentamos por nombre de categoría
  if (!aplicado && categoriaNombre) {
    for (const opt of selectCat.options) {
      if (opt.text.toLowerCase() === categoriaNombre.toLowerCase()) {
        selectCat.value = opt.value;
        aplicado = true;
        break;
      }
    }
  }

  // Volvemos a filtrar con la función real
  if (aplicado) {
    aplicarFiltrosYRender();
  }
}

// ✅ Modificar aplicarFiltrosYRender para incluir filtros de componentes
function aplicarFiltrosYRender() {
  function getNombreCampo(campo, fallback = "—") {
    if (campo === null || campo === undefined) return fallback;
    if (typeof campo === "object") {
      if (campo.nombre) return campo.nombre;
      if (campo.nombre_categoria) return campo.nombre_categoria;
      if (campo.nombre_sucursal) return campo.nombre_sucursal;
      if (campo.nombre_estado) return campo.nombre_estado;
      return JSON.stringify(campo);
    }
    return campo;
  }

  const inputBuscar = document.getElementById("inputBuscar");
  const filtroCategoria = document.getElementById("filtroCategoria");
  const filtroSucursal = document.getElementById("filtroSucursal");
  const filtroEstado = document.getElementById("filtroEstado");
  
  // ✅ Filtros de componentes
  const filtroCPU = document.getElementById("filtroCPU");
  const filtroGPU = document.getElementById("filtroGPU");
  const filtroRAMMin = document.getElementById("filtroRAMMin");
  const filtroAlmMin = document.getElementById("filtroAlmMin");

  const texto = (inputBuscar?.value || "").toLowerCase();
  const cat = filtroCategoria?.value || "";
  const suc = filtroSucursal?.value || "";
  const est = filtroEstado?.value || "";
  
  // ✅ Valores de filtros de componentes
  const cpuId = filtroCPU?.value || "";
  const gpuId = filtroGPU?.value || "";
  const ramMin = filtroRAMMin?.value ? parseInt(filtroRAMMin.value) : null;
  const almMin = filtroAlmMin?.value ? parseInt(filtroAlmMin.value) : null;

  const filtrados = productosCache.filter(p => {
    const t = texto.trim();

    const categoriaTexto = p.categoria_nombre || getNombreCampo(p.categoria, "");
    const sucursalTexto = p.sucursal_nombre || getNombreCampo(p.sucursal, "");
    const estadoTexto = p.estado_nombre || getNombreCampo(p.estado, "");

    const coincideTexto =
      !t ||
      (p.nro_serie || "").toLowerCase().includes(t) ||
      nombreProducto(p).toLowerCase().includes(t) ||
      categoriaTexto.toLowerCase().includes(t) ||
      sucursalTexto.toLowerCase().includes(t);

    const coincideCat = !cat || categoriaTexto === cat;
    const coincideSuc = !suc || sucursalTexto === suc;
    const coincideEst = !est || estadoTexto === est;
    
    // ✅ Filtros de componentes
    let coincideComponentes = true;
    
    if (cpuId || gpuId || ramMin || almMin) {
      const comp = p.componentes;
      
      if (!comp) {
        coincideComponentes = false;
      } else {
        if (cpuId && (!comp.cpu || comp.cpu.id != cpuId)) {
          coincideComponentes = false;
        }
        if (gpuId && (!comp.gpu || comp.gpu.id != gpuId)) {
          coincideComponentes = false;
        }
        if (ramMin && (!comp.ram_gb || comp.ram_gb < ramMin)) {
          coincideComponentes = false;
        }
        if (almMin && (!comp.almacenamiento_gb || comp.almacenamiento_gb < almMin)) {
          coincideComponentes = false;
        }
      }
    }

    return coincideTexto && coincideCat && coincideSuc && coincideEst && coincideComponentes;
  });

  const btnFiltroComponentes = document.getElementById("btnFiltroComponentes");
  const modoComponentes = btnFiltroComponentes.classList.contains("active");

  const vistaTabla = document.getElementById("vistaTabla");
  const vistaTablaComponentes = document.getElementById("vistaTablaComponentes");

  if (modoComponentes) {
    // Mostrar tabla de componentes
    vistaTabla.classList.add("d-none");
    vistaTablaComponentes.classList.remove("d-none");

    renderTablaProductosConComponentes(filtrados);

  } else {
    // Mostrar tabla normal
    vistaTabla.classList.remove("d-none");
    vistaTablaComponentes.classList.add("d-none");

    renderTablaProductos(filtrados);
  }

  // Tarjetas siempre se renderizan
  renderTarjetasProductos(filtrados);
}

function renderTablaProductos(lista) {
  const tbody = document.getElementById("tbodyProductos");
  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="9">No hay productos que coincidan con el filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  lista.forEach(p => {
    const tr = document.createElement("tr");

    const sucursalTexto =
      p.sucursal_nombre || getNombreCampo(p.sucursal, "—");
    const estadoTexto =
      p.estado_nombre || getNombreCampo(p.estado, "—");

    const garantiaValor = p.garantia_meses ?? p.garantia ?? null;
    const garantiaTexto =
      garantiaValor === null || garantiaValor === "" ? "—" : `${garantiaValor} meses`;

    tr.innerHTML = `
      <td><input type="checkbox"></td>
      <td>${p.nro_serie}</td>
      <td>${nombreProducto(p)}</td>
      <td>${sucursalTexto}</td>
      <td>${p.documento_factura || "—"}</td>
      <td>${garantiaTexto}</td>
      <td>${estadoTexto}</td>
      <td class="d-flex gap-1">
        <a href="detalle.html?id=${p.id}" class="btn btn-sm btn-primary">
          <i class="bi bi-eye"></i>
        </a>
        <a href="editar.html?id=${p.id}" class="btn btn-sm btn-warning">
          <i class="bi bi-pencil"></i>
        </a>
        <a href="eliminar.html?id=${p.id}" class="btn btn-sm btn-danger">
          <i class="bi bi-trash"></i>
        </a>
      </td>
    `;

    tbody.appendChild(tr);
  });
}


// ✅ Nueva función para renderizar tabla con componentes
function renderTablaProductosConComponentes(lista) {
  const tbody = document.getElementById("tbodyProductosComponentes");
  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="10">No hay productos que coincidan con el filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  lista.forEach(p => {
    const tr = document.createElement("tr");

    const sucursalTexto = p.sucursal_nombre || getNombreCampo(p.sucursal, "—");
    const estadoTexto = p.estado_nombre || getNombreCampo(p.estado, "—");

    // Extraer datos de componentes
    let cpuTexto = "—";
    let gpuTexto = "—";
    let ramTexto = "—";
    let almTexto = "—";

    if (p.componentes) {
      const c = p.componentes;
      
      if (c.cpu) {
        cpuTexto = `${c.cpu.marca} ${c.cpu.modelo}`;
      }
      
      if (c.gpu) {
        gpuTexto = `${c.gpu.marca} ${c.gpu.modelo}`;
      }
      
      if (c.ram_gb) {
        ramTexto = `${c.ram_gb} GB`;
      }
      
      if (c.almacenamiento_gb) {
        almTexto = `${c.almacenamiento_gb} GB`;
      }
    }

    tr.innerHTML = `
      <td><input type="checkbox"></td>
      <td>${p.nro_serie}</td>
      <td>${nombreProducto(p)}</td>
      <td class="componentes-col" title="${cpuTexto}">
        <small>${cpuTexto}</small>
      </td>
      <td class="componentes-col" title="${gpuTexto}">
        <small>${gpuTexto}</small>
      </td>
      <td class="componentes-col">
        <small>${ramTexto}</small>
      </td>
      <td class="componentes-col">
        <small>${almTexto}</small>
      </td>
      <td>${sucursalTexto}</td>
      <td>${estadoTexto}</td>
      <td class="d-flex gap-1">
        <a href="detalle.html?id=${p.id}" class="btn btn-sm btn-primary">
          <i class="bi bi-eye"></i>
        </a>
        <a href="editar.html?id=${p.id}" class="btn btn-sm btn-warning">
          <i class="bi bi-pencil"></i>
        </a>
        <a href="eliminar.html?id=${p.id}" class="btn btn-sm btn-danger">
          <i class="bi bi-trash"></i>
        </a>
      </td>
    `;

    tbody.appendChild(tr);
  });
}


// ✅ Actualizar renderTarjetasProductos para mostrar componentes
function renderTarjetasProductos(lista) {
  function getNombreCampo(campo, fallback = "—") {
    if (campo === null || campo === undefined) return fallback;
    if (typeof campo === "object") {
      if (campo.nombre) return campo.nombre;
      if (campo.nombre_categoria) return campo.nombre_categoria;
      if (campo.nombre_sucursal) return campo.nombre_sucursal;
      if (campo.nombre_estado) return campo.nombre_estado;
      return JSON.stringify(campo);
    }
    return campo;
  }

  const cont = document.getElementById("cardsProductos");
  if (!cont) return;

  if (!lista.length) {
    cont.innerHTML = `<p class="text-muted">No hay productos que coincidan con el filtro.</p>`;
    return;
  }

  cont.innerHTML = "";

  lista.forEach(p => {
    const col = document.createElement("div");
    col.className = "col-md-4 col-lg-3 mb-3";

    const garantiaValor = p.garantia_meses ?? p.garantia ?? null;
    const garantiaTexto =
      garantiaValor === null || garantiaValor === "" ? "—" : `${garantiaValor} meses`;
    const categoriaTexto = p.categoria_nombre || getNombreCampo(p.categoria, "—");
    const sucursalTexto = p.sucursal_nombre || getNombreCampo(p.sucursal, "Sin sucursal");
    const estadoTexto = p.estado_nombre || getNombreCampo(p.estado, "—");

    // ✅ Agregar información de componentes en las tarjetas
    let componentesHTML = "";
    if (p.componentes) {
      const c = p.componentes;
      componentesHTML = `
        <hr class="my-2">
        <div class="text-start small text-muted">
          ${c.cpu ? `<div><i class="bi bi-cpu"></i> ${c.cpu.marca} ${c.cpu.modelo}</div>` : ""}
          ${c.gpu ? `<div><i class="bi bi-gpu-card"></i> ${c.gpu.marca} ${c.gpu.modelo}</div>` : ""}
          ${c.ram_gb ? `<div><i class="bi bi-memory"></i> RAM: ${c.ram_gb} GB</div>` : ""}
          ${c.almacenamiento_gb ? `<div><i class="bi bi-hdd"></i> ${c.almacenamiento_gb} GB</div>` : ""}
        </div>
      `;
    }

    col.innerHTML = `
      <div class="card p-3 h-100 text-center">
        <h6 class="fw-bold mb-1">${nombreProducto(p)}</h6>
        <small class="text-muted d-block mb-1">${categoriaTexto}</small>
        <span class="badge bg-light text-dark mb-1">${sucursalTexto}</span>
        <p class="small mb-1"><strong>Estado:</strong> ${estadoTexto}</p>
        <p class="small mb-1"><strong>Garantía:</strong> ${garantiaTexto}</p>
        
        ${componentesHTML}

        <div class="d-flex justify-content-center gap-1 mt-2">
          <a href="detalle.html?id=${p.id}" class="btn btn-sm btn-primary">
            <i class="bi bi-eye"></i>
          </a>
          <a href="editar.html?id=${p.id}" class="btn btn-sm btn-warning">
            <i class="bi bi-pencil"></i>
          </a>
          <a href="eliminar.html?id=${p.id}" class="btn btn-sm btn-danger">
            <i class="bi bi-trash"></i>
          </a>
        </div>
      </div>
    `;

    cont.appendChild(col);
  });
}
// -----------------------------------------------------------
// DETALLE (detalle.html)
// -----------------------------------------------------------

function initDetalle() {
  const id = getParam("id");
  if (!id) return;

  cargarDetalleProducto(id);

  const btnImprimir = document.getElementById("btn-imprimir-qr");
  if (btnImprimir) {
    btnImprimir.addEventListener("click", imprimirQRProducto);
  }

  // --- Cambio de estado (botón + modal) ---
  const btnCambiarEstado = document.getElementById("btnCambiarEstado");
  const btnGuardarCambioEstado = document.getElementById("btnGuardarCambioEstado");
  const modalEl = document.getElementById("modalCambiarEstado");
  let modalCambio = null;

  if (modalEl && window.bootstrap && window.bootstrap.Modal) {
    modalCambio = new window.bootstrap.Modal(modalEl);
  }

  if (btnCambiarEstado && modalCambio) {
    btnCambiarEstado.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!productoActualDetalle) return;

      const estadoActualTextoInput = document.getElementById("estadoActualTexto");
      if (estadoActualTextoInput) {
        const estadoTexto =
          productoActualDetalle.estado_nombre ||
          getNombreCampo(productoActualDetalle.estado, "—");
        estadoActualTextoInput.value = estadoTexto;
      }

      await cargarEstadosParaCambioEstado();

      const comentario = document.getElementById("comentarioEstado");
      if (comentario) comentario.value = "";

      const selectNuevoEstado = document.getElementById("nuevoEstado");
      if (selectNuevoEstado) {
        selectNuevoEstado.value = "";
      }

      modalCambio.show();
    });
  }

  if (btnGuardarCambioEstado && modalCambio) {
    btnGuardarCambioEstado.addEventListener("click", async () => {
      if (!productoActualDetalle) return;

      const selectNuevoEstado = document.getElementById("nuevoEstado");
      const comentario = document.getElementById("comentarioEstado");
      const estadoActualTextoInput = document.getElementById("estadoActualTexto");

      if (!selectNuevoEstado) return;

      const nuevoEstadoId = selectNuevoEstado.value;
      const nuevoEstadoNombre =
        selectNuevoEstado.options[selectNuevoEstado.selectedIndex]?.text || "";

      if (!nuevoEstadoId) {
        alert("Selecciona un nuevo estado.");
        return;
      }

      const estadoActualTexto = estadoActualTextoInput?.value || "";
      const comentarioExtra = comentario?.value || "";

      try {
        await guardarCambioEstadoProducto(
          nuevoEstadoId,
          nuevoEstadoNombre,
          estadoActualTexto,
          comentarioExtra
        );
        modalCambio.hide();
      } catch (err) {
        console.error("Error al cambiar estado:", err);
        alert("No se pudo cambiar el estado del producto.");
      }
    });
  }
}

// Helpers para leer nombres de campos que pueden venir como string u objeto
function getNombreCampo(campo, fallback = "—") {
  if (campo === null || campo === undefined) return fallback;
  if (typeof campo === "object") {
    if (campo.nombre) return campo.nombre;
    if (campo.nombre_categoria) return campo.nombre_categoria;
    if (campo.nombre_sucursal) return campo.nombre_sucursal;
    if (campo.nombre_estado) return campo.nombre_estado;
    // Si no hay nada más útil, devolvemos JSON serializado
    return JSON.stringify(campo);
  }
  // Si es string o número directo
  return campo;
}

function imprimirQRProducto() {
  const qrImg = document.getElementById("qr-img");
  if (!qrImg || !qrImg.src) {
    alert("No hay código QR disponible para este producto.");
    return;
  }

  const nombre = document.getElementById("nombreProd")?.textContent || "";
  const codigo = document.getElementById("codigoProd")?.textContent || "";

  // Abrimos una ventana nueva solo con el QR y datos básicos
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) {
    alert("No se pudo abrir la ventana de impresión (revisa el bloqueador de pop-ups).");
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>QR ${codigo}</title>
      <style>
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: center;
          margin: 0;
          padding: 20px;
        }
        h1 {
          font-size: 18px;
          margin: 0 0 4px 0;
        }
        h2 {
          font-size: 14px;
          margin: 0 0 16px 0;
        }
        img {
          max-width: 100%;
          height: auto;
        }
      </style>
    </head>
    <body>
      <h1>${nombre}</h1>
      <h2>${codigo}</h2>
      <img src="${qrImg.src}" alt="QR ${codigo}">
      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);
  win.document.close();
}

async function cargarDetalleProducto(id) {
  try {
    const p = await API.get(`productos/${id}/`); // GET /api/api/productos/<id>/
    productoActualDetalle = p; // guardamos para cambio de estado

    // ----------------------
    //   MOSTRAR COMPONENTES
    // ----------------------
    const comp = p.componentes;   // viene anidado desde DRF

    const lista = document.getElementById("componentesProd");
    lista.innerHTML = ""; // limpiar

    if (!comp) {
        lista.innerHTML = `<li class="text-muted">Este producto no tiene componentes registrados.</li>`;
    } else {
        lista.innerHTML += `<li><strong>RAM:</strong> ${comp.ram_gb ?? "—"} GB</li>`;
        lista.innerHTML += `<li><strong>Almacenamiento:</strong> ${comp.almacenamiento_gb ?? "—"} GB</li>`;

        if (comp.cpu) {
            lista.innerHTML += `<li><strong>CPU:</strong> ${comp.cpu.marca} ${comp.cpu.modelo}</li>`;
        } else {
            lista.innerHTML += `<li><strong>CPU:</strong> —</li>`;
        }

        if (comp.gpu) {
            lista.innerHTML += `<li><strong>GPU:</strong> ${comp.gpu.marca} ${comp.gpu.modelo}</li>`;
        } else {
            lista.innerHTML += `<li><strong>GPU:</strong> —</li>`;
        }
    }

    const elNombre = document.getElementById("nombreProd");
    const elCodigo = document.getElementById("codigoProd");
    const elCategoria = document.getElementById("categoriaProd");
    const elSucursal = document.getElementById("sucursalProd");
    const elEstado = document.getElementById("estadoProd");
    const elPrecio = document.getElementById("precioProd");
    const elFecha = document.getElementById("fechaProd");
    const elGarantia = document.getElementById("garantiaProd");
    const elFactura = document.getElementById("facturaProd");
    const elComponentes = document.getElementById("componentesProd");
    const elHistorial = document.getElementById("historialProd");
    const elBtnEditar = document.getElementById("btnEditar");

    // Nombre principal (modelo + nro_serie si existen, si no, cae en nro_serie)
    const nombreVisible =
      (p.modelo_nombre ? `${p.modelo_nombre} - ${p.nro_serie}` : null) ||
      `${p.nro_serie}`;

    if (elNombre) elNombre.textContent = nombreVisible;
    if (elCodigo) elCodigo.textContent = p.nro_serie || "—";

    const categoriaTexto =
      p.categoria_nombre || getNombreCampo(p.categoria) || "—";
    const sucursalTexto =
      p.sucursal_nombre || getNombreCampo(p.sucursal) || "—";
    const estadoTexto =
      p.estado_nombre || getNombreCampo(p.estado) || "—";

    if (elCategoria) elCategoria.textContent = categoriaTexto;
    if (elSucursal) elSucursal.textContent = sucursalTexto;
    if (elEstado) elEstado.textContent = estadoTexto;

    if (elFactura) elFactura.textContent = p.documento_factura || "—";
    if (elPrecio) elPrecio.textContent = p.documento_factura || "—";
    if (elFecha) elFecha.textContent = p.fecha_compra || "—";
    if (elGarantia) elGarantia.textContent =
      (p.garantia_meses ?? "") !== "" ? `${p.garantia_meses} meses` : "—";

    

    // Historial de estados
    if (elHistorial) {
      elHistorial.innerHTML = "";
      const historial =
        p.historial_estados || p.historial || p.historialEstados || [];
      if (Array.isArray(historial) && historial.length) {
        historial.forEach(h => {
          const li = document.createElement("li");
          li.className = "list-group-item";
          const estadoH = h.estado_nombre || getNombreCampo(h.estado) || "";
          const fechaH = h.fecha_cambio || h.fecha || "";
          li.innerHTML = `<strong>${estadoH}</strong> — ${fechaH}`;
          elHistorial.appendChild(li);
        });
      } else {
        elHistorial.innerHTML =
          `<li class="list-group-item text-muted">Sin historial registrado.</li>`;
      }
    }

    // Botón editar
    if (elBtnEditar) {
      elBtnEditar.href = `editar.html?id=${p.id}`;
    }

    // Mostrar QR generado por Django
    const qrImg = document.getElementById("qr-img");
    if (qrImg && p.codigo_qr) {
      const qrUrl = p.codigo_qr.imagen_qr_url || p.codigo_qr.imagen_qr;

      if (qrUrl) {
        if (qrUrl.startsWith("/media/")) {
          qrImg.src = `http://127.0.0.1:8000${qrUrl}`;
        } else {
          qrImg.src = qrUrl;
        }
        console.log("URL del QR:", qrImg.src);
      } else {
        console.log("No hay imagen QR disponible para este producto");
      }
    }

    if (p.nro_serie) {
      cargarMovimientosProducto(p.nro_serie);
    }

  } catch (err) {
    console.error("Error al cargar detalle:", err);
    alert("No se pudo cargar el producto.");
  }
}

async function cargarMovimientosProducto(sku) {
  const tbody = document.getElementById("historialMovimientosProd");
  if (!tbody || !sku) return;

  // Mensaje mientras carga
  tbody.innerHTML = `
    <tr>
      <td colspan="4" class="text-muted">Cargando movimientos...</td>
    </tr>
  `;

  try {
    const res = await API.get(`movimientos/?sku=${encodeURIComponent(sku)}`);
    const lista = Array.isArray(res) ? res : (res.results || []);

    if (!lista.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-muted">
            Sin movimientos registrados para este producto.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = "";

    lista.forEach((m) => {
      const fecha = m.fecha || m.fecha_movimiento || m.created_at || "";
      const tipo = m.tipo || "";
      const cantidad = m.cantidad ?? "";
      const detalle = m.comentarios || m.referencia || "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fecha}</td>
        <td>${tipo}</td>
        <td>${cantidad}</td>
        <td>${detalle}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error al cargar movimientos del producto:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-danger">
          No se pudieron cargar los movimientos.
        </td>
      </tr>
    `;
  }
}

// Cargar estados en el select del modal de cambio de estado
async function cargarEstadosParaCambioEstado() {
  const select = document.getElementById("nuevoEstado");
  if (!select) return;

  try {
    const res = await API.get("estados/");
    const estados = Array.isArray(res) ? res : (res.results || []);

    select.innerHTML = `<option value="">Seleccione estado...</option>`;
    estados.forEach((e) => {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.nombre;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Error al cargar estados para cambio de estado:", err);
    select.innerHTML = `<option value="">Error al cargar estados</option>`;
  }
}

// Actualizar producto + registrar movimiento de cambio de estado
async function guardarCambioEstadoProducto(
  nuevoEstadoId,
  nuevoEstadoNombre,
  estadoActualTexto,
  comentarioAdicional
) {
  if (!productoActualDetalle) return;

  // Helper para obtener el ID desde un campo que puede ser número u objeto
  const proveedorId = getId(productoActualDetalle.proveedor);
  const modeloId = getId(productoActualDetalle.modelo);
  const categoriaId = getId(productoActualDetalle.categoria);
  const sucursalId = productoActualDetalle.sucursal
    ? getId(productoActualDetalle.sucursal)
    : null;

  const payload = {
    nro_serie: productoActualDetalle.nro_serie,
    proveedor: proveedorId ? parseInt(proveedorId) : null,
    modelo: modeloId ? parseInt(modeloId) : null,
    categoria: categoriaId ? parseInt(categoriaId) : null,
    sucursal: sucursalId ? parseInt(sucursalId) : null,
    estado: parseInt(nuevoEstadoId),
    fecha_compra: productoActualDetalle.fecha_compra,
    garantia_meses: productoActualDetalle.garantia_meses,
    documento_factura: productoActualDetalle.documento_factura,
  };

  await API.put(`productos/${productoActualDetalle.id}/`, payload);

  const baseTexto =
    `Cambio de estado: ${estadoActualTexto || "(sin estado)"} → ${nuevoEstadoNombre}`;
  const comentariosMovimiento = comentarioAdicional
    ? `${baseTexto}. ${comentarioAdicional}`
    : baseTexto;

  const payloadMov = {
    tipo: "ajuste",
    sku: productoActualDetalle.nro_serie,
    cantidad: 1,
    proveedor: "",
    referencia: baseTexto,
    comentarios: comentariosMovimiento,
  };

  await API.post("movimientos/", payloadMov);

  alert("Estado actualizado y movimiento registrado.");
  await cargarDetalleProducto(productoActualDetalle.id);
}

// -----------------------------------------------------------
// AGREGAR (agregar.html)
// -----------------------------------------------------------

function initAgregar() {
  const form = document.getElementById("formProducto");
  if (!form) return;

  // Carga de selects desde la API (incluye CPU/GPU ahora)
  cargarSelectsProducto().then(() => {
    // Si viene un código desde escáner QR
    const codigoParam = getParam("codigo");
    if (codigoParam) {
      const inputCodigo = document.getElementById("codigo");
      if (inputCodigo) inputCodigo.value = codigoParam;
    }
  });

  // Init modals (si existen)
  initComponentesModales();

  form.addEventListener("submit", onSubmitNuevoProducto);
}

async function onSubmitNuevoProducto(e) {
  e.preventDefault();

  const codigo = document.getElementById("codigo")?.value?.trim();
  const proveedor = document.getElementById("proveedor")?.value;
  const modelo = document.getElementById("modelo")?.value;
  const categoria = document.getElementById("categoria")?.value;
  const sucursal = document.getElementById("sucursal")?.value;
  const estado = document.getElementById("estado")?.value;
  const fechaCompra = document.getElementById("fechaCompra")?.value;
  const mesesGarantia = document.getElementById("mesesGarantia")?.value;
  const factura = document.getElementById("factura")?.value;

  // Componentes
  const cpu = document.getElementById("cpu")?.value;
  const gpu = document.getElementById("gpu")?.value;
  const ram = document.getElementById("ram")?.value;
  const almacenamiento = document.getElementById("almacenamiento")?.value;

  if (
    !codigo ||
    !proveedor ||
    !modelo ||
    !categoria ||
    !estado ||
    !fechaCompra ||
    !mesesGarantia ||
    !factura
  ) {
    alert("Completa todos los campos obligatorios del producto.");
    return;
  }

  // Validar componentes (según tu HTML estaban marcados como required)
  if (!cpu || !gpu || !ram || !almacenamiento) {
    if (!confirm("No completaste todos los campos de componentes. ¿Deseas continuar sin componentes?")) {
      return;
    }
  }

  const payload = {
    nro_serie: codigo,
    proveedor: parseInt(proveedor),
    modelo: parseInt(modelo),
    categoria: parseInt(categoria),
    sucursal: sucursal ? parseInt(sucursal) : null,
    estado: parseInt(estado),
    fecha_compra: fechaCompra,
    garantia_meses: parseInt(mesesGarantia),
    documento_factura: factura,
    // Enviamos componentes como objeto anidado (backend ya lo maneja)
    componentes: {
      ram_gb: ram ? parseInt(ram) : null,
      almacenamiento_gb: almacenamiento ? parseInt(almacenamiento) : null,
      cpu_id: cpu ? parseInt(cpu) : null,
      gpu_id: gpu ? parseInt(gpu) : null
    }
  };

  try {
    await API.post("productos/", payload);
    alert("Producto creado correctamente.");
    window.location.href = "listar.html";
  } catch (err) {
    console.error("Error al crear producto:", err);
    // Intentar mostrar mensaje de error si viene del backend
    const msg = err?.message || "No se pudo crear el producto. Revisa los datos.";
    alert(msg);
  }
}

// -----------------------------------------------------------
// EDITAR (editar.html)
// -----------------------------------------------------------

function initEditar() {
  const form = document.getElementById("formEditarProducto");
  if (!form) return;

  const id = getParam("id");
  if (!id) {
    alert("Falta el ID del producto");
    window.location.href = "listar.html";
    return;
  }

  cargarSelectsProducto().then(() => {
    cargarDatosEdicion(id);
  });

  // ✅ AGREGAR ESTA LÍNEA para inicializar los modales de CPU/GPU
  initComponentesModales();

  form.addEventListener("submit", e => onSubmitEditarProducto(e, id));
}

// Helper para obtener el ID desde un campo que puede ser número u objeto
function getId(field) {
  if (field === null || field === undefined) return "";
  if (typeof field === "object") {
    return field.id ?? "";
  }
  return field; // ya es un número o string
}

async function cargarDatosEdicion(id) {
  try {
    const p = await API.get(`productos/${id}/`);

    const cod = document.getElementById("codigo");
    const proveedor = document.getElementById("proveedor");
    const modelo = document.getElementById("modelo");
    const categoria = document.getElementById("categoria");
    const sucursal = document.getElementById("sucursal");
    const estado = document.getElementById("estado");
    const fechaCompra = document.getElementById("fechaCompra");
    const mesesGarantia = document.getElementById("mesesGarantia");
    const factura = document.getElementById("factura");

    if (cod) cod.value = p.nro_serie;

    if (proveedor) proveedor.value = getId(p.proveedor);
    if (modelo) modelo.value = getId(p.modelo);
    if (categoria) categoria.value = getId(p.categoria);
    if (sucursal) sucursal.value = getId(p.sucursal);
    if (estado) estado.value = getId(p.estado);

    if (fechaCompra) fechaCompra.value = p.fecha_compra;
    if (mesesGarantia) mesesGarantia.value = p.garantia_meses;
    if (factura) factura.value = p.documento_factura;

    // Si hay componentes en la respuesta, poblarlos en el form de edición
    if (p.componentes) {
      const c = p.componentes;
      const cpuSelect = document.getElementById("cpu");
      const gpuSelect = document.getElementById("gpu");
      const ramInput = document.getElementById("ram");
      const almInput = document.getElementById("almacenamiento");

      if (cpuSelect && c.cpu) {
        // si el option no existe todavía lo añadimos
        if (!Array.from(cpuSelect.options).some(o => o.value == c.cpu.id)) {
          cpuSelect.innerHTML += `<option value="${c.cpu.id}">${c.cpu.marca} ${c.cpu.modelo}</option>`;
        }
        cpuSelect.value = c.cpu.id;
      }
      if (gpuSelect && c.gpu) {
        if (!Array.from(gpuSelect.options).some(o => o.value == c.gpu.id)) {
          gpuSelect.innerHTML += `<option value="${c.gpu.id}">${c.gpu.marca} ${c.gpu.modelo}</option>`;
        }
        gpuSelect.value = c.gpu.id;
      }
      if (ramInput) ramInput.value = c.ram_gb ?? "";
      if (almInput) almInput.value = c.almacenamiento_gb ?? "";
    }

  } catch (err) {
    console.error("Error al cargar producto para editar:", err);
    alert("No se pudo cargar el producto.");
  }
}

async function onSubmitEditarProducto(e, id) {
  e.preventDefault();

  const codigo = document.getElementById("codigo")?.value?.trim();
  const proveedor = document.getElementById("proveedor")?.value;
  const modelo = document.getElementById("modelo")?.value;
  const categoria = document.getElementById("categoria")?.value;
  const sucursal = document.getElementById("sucursal")?.value;
  const estado = document.getElementById("estado")?.value;
  const fechaCompra = document.getElementById("fechaCompra")?.value;
  const mesesGarantia = document.getElementById("mesesGarantia")?.value;
  const factura = document.getElementById("factura")?.value;

  // Componentes
  const cpu = document.getElementById("cpu")?.value;
  const gpu = document.getElementById("gpu")?.value;
  const ram = document.getElementById("ram")?.value;
  const almacenamiento = document.getElementById("almacenamiento")?.value;

  if (
    !codigo ||
    !proveedor ||
    !modelo ||
    !categoria ||
    !estado ||
    !fechaCompra ||
    !mesesGarantia ||
    !factura
  ) {
    alert("Completa todos los campos obligatorios.");
    return;
  }

  const payload = {
    nro_serie: codigo,
    proveedor: parseInt(proveedor),
    modelo: parseInt(modelo),
    categoria: parseInt(categoria),
    sucursal: sucursal ? parseInt(sucursal) : null,
    estado: parseInt(estado),
    fecha_compra: fechaCompra,
    garantia_meses: parseInt(mesesGarantia),
    documento_factura: factura,
    componentes: {
      ram_gb: ram ? parseInt(ram) : null,
      almacenamiento_gb: almacenamiento ? parseInt(almacenamiento) : null,
      cpu_id: cpu ? parseInt(cpu) : null,
      gpu_id: gpu ? parseInt(gpu) : null
    }
  };

  try {
    await API.put(`productos/${id}/`, payload);
    alert("Producto actualizado correctamente.");
    window.location.href = "listar.html";
  } catch (err) {
    console.error("Error al actualizar producto:", err);
    alert("No se pudo actualizar el producto.");
  }
}

// -----------------------------------------------------------
// ELIMINAR (eliminar.html)
// -----------------------------------------------------------

function initEliminar() {
  function getNombreCampo(campo, fallback = "—") {
    if (campo === null || campo === undefined) return fallback;
    if (typeof campo === "object") {
      if (campo.nombre) return campo.nombre;
      if (campo.nombre_categoria) return campo.nombre_categoria;
      if (campo.nombre_sucursal) return campo.nombre_sucursal;
      if (campo.nombre_estado) return campo.nombre_estado;
      return JSON.stringify(campo);
    }
    return campo; // string o número
  }

  const id = getParam("id");
  if (!id) {
    alert("Falta el ID del producto");
    window.location.href = "listar.html";
    return;
  }

  const form = document.getElementById("formEliminarProducto");
  const infoDiv = document.getElementById("producto-eliminar-info");

  // Mostrar resumen del producto
  API.get(`productos/${id}/`)
    .then(p => {
      if (infoDiv) {
        const categoriaTexto =
          p.categoria_nombre || getNombreCampo(p.categoria) || "—";
        const sucursalTexto =
          p.sucursal_nombre || getNombreCampo(p.sucursal) || "—";
        const estadoTexto =
          p.estado_nombre || getNombreCampo(p.estado) || "—";

        infoDiv.innerHTML = `
          <p><strong>${nombreProducto(p)}</strong></p>
          <p>Categoría: ${categoriaTexto}</p>
          <p>Sucursal: ${sucursalTexto}</p>
          <p>Estado: ${estadoTexto}</p>
        `;
      }
    })
    .catch(err => {
      console.error("Error al cargar producto a eliminar:", err);
      if (infoDiv) {
        infoDiv.textContent = "No se pudo cargar el producto.";
      }
    });

  if (form) {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (!confirm("¿Seguro que quieres eliminar este producto?")) return;

      try {
        await API.delete(`productos/${id}/`);
        alert("Producto eliminado correctamente.");
        window.location.href = "listar.html";
      } catch (err) {
        console.error("Error al eliminar producto:", err);
        alert("No se pudo eliminar el producto.");
      }
    });
  }
}

// -----------------------------------------------------------
// Carga de selects (proveedor, modelo, categoria, sucursal, estado)
// para agregar/editar (ahora incluye cpu/gpu)
// -----------------------------------------------------------

async function cargarSelectsProducto() {
  try {
    await Promise.all([
      cargarSelect("proveedor", "proveedores/"),
      cargarSelect("modelo", "modelos/"),
      cargarSelect("categoria", "categorias/"),
      cargarSelect("sucursal", "sucursales/", true), // opcional
      cargarSelect("estado", "estados/"),
      cargarSelectCPU(), // cpu
      cargarSelectGPU(), // gpu
    ]);
  } catch (err) {
    console.error("Error al cargar selects de producto:", err);
    alert("No se pudieron cargar los datos de soporte (sucursales, categorías, etc.).");
  }
}

async function cargarSelect(elementId, endpoint, allowEmpty = false) {
  const select = document.getElementById(elementId);
  if (!select) return;

  let data = await API.get(endpoint); // p.ej. "categorias/"

  data = Array.isArray(data) ? data : (data.results || []);

  select.innerHTML = allowEmpty
    ? `<option value="">(Ninguna)</option>`
    : `<option value="">Seleccione...</option>`;

  data.forEach(item => {
    select.innerHTML += `<option value="${item.id}">${item.nombre}</option>`;
  });
}

// -----------------------------------------------------------
// CPU / GPU helpers (cargar selects y crear desde modal)
// -----------------------------------------------------------

async function cargarSelectCPU() {
  const select = document.getElementById("cpu");
  if (!select) return;

  try {
    let data = await API.get("cpu/");
    data = Array.isArray(data) ? data : (data.results || []);
    select.innerHTML = `<option value="">Seleccione CPU...</option>`;
    data.forEach(item => {
      select.innerHTML += `<option value="${item.id}">${item.marca} ${item.modelo}</option>`;
    });
  } catch (err) {
    console.error("Error al cargar CPUs:", err);
    select.innerHTML = `<option value="">Error al cargar CPUs</option>`;
  }
}

async function cargarSelectGPU() {
  const select = document.getElementById("gpu");
  if (!select) return;

  try {
    let data = await API.get("gpu/");
    data = Array.isArray(data) ? data : (data.results || []);
    select.innerHTML = `<option value="">Seleccione GPU...</option>`;
    data.forEach(item => {
      select.innerHTML += `<option value="${item.id}">${item.marca} ${item.modelo}</option>`;
    });
  } catch (err) {
    console.error("Error al cargar GPUs:", err);
    select.innerHTML = `<option value="">Error al cargar GPUs</option>`;
  }
}

// -----------------------------------------------------------
// Modales de componentes (crear CPU/GPU desde el formulario)
// -----------------------------------------------------------

function initComponentesModales() {
  // CPU modal
  const btnNuevaCPU = document.getElementById("btnNuevaCPU");
  const modalCPUEl = document.getElementById("modalNuevaCPU");
  const btnGuardarCPU = document.getElementById("btnGuardarCPU");

  // GPU modal
  const btnNuevaGPU = document.getElementById("btnNuevaGPU");
  const modalGPUEl = document.getElementById("modalNuevaGPU");
  const btnGuardarGPU = document.getElementById("btnGuardarGPU");

  let modalCPU = null;
  let modalGPU = null;

  if (modalCPUEl && window.bootstrap && window.bootstrap.Modal) {
    modalCPU = new window.bootstrap.Modal(modalCPUEl);
  }
  if (modalGPUEl && window.bootstrap && window.bootstrap.Modal) {
    modalGPU = new window.bootstrap.Modal(modalGPUEl);
  }

  if (btnNuevaCPU && modalCPU) {
    btnNuevaCPU.addEventListener("click", () => {
      // limpiar formulario
      const f = document.getElementById("formNuevaCPU");
      if (f) f.reset();
      modalCPU.show();
    });
  }

  if (btnNuevaGPU && modalGPU) {
    btnNuevaGPU.addEventListener("click", () => {
      const f = document.getElementById("formNuevaGPU");
      if (f) f.reset();
      modalGPU.show();
    });
  }

  if (btnGuardarCPU) {
    btnGuardarCPU.addEventListener("click", async () => {
      try {
        // leer inputs del modal
        const cpuNombre = document.getElementById("cpuNombre")?.value?.trim();
        const cpuGeneracion = document.getElementById("cpuGeneracion")?.value?.trim();
        const cpuVelocidad = document.getElementById("cpuVelocidad")?.value?.trim();

        if (!cpuNombre) {
          alert("Ingresa al menos la marca/nombre de la CPU.");
          return;
        }

        // mapear a {marca, modelo} según tu modelo backend
        const payload = {
          marca: cpuNombre,
          modelo: `${cpuGeneracion || ""} ${cpuVelocidad ? cpuVelocidad + "GHz" : ""}`.trim()
        };

        const nuevo = await API.post("cpu/", payload);

        // cerrar modal y refrescar select
        modalCPU.hide();
        await cargarSelectCPU();

        // seleccionar la nueva opción si viene el id
        if (nuevo && nuevo.id) {
          const selectCPU = document.getElementById("cpu");
          if (selectCPU) selectCPU.value = nuevo.id;
        }

        alert("CPU creada correctamente.");
      } catch (err) {
        console.error("Error al crear CPU:", err);
        alert("No se pudo crear la CPU.");
      }
    });
  }

  if (btnGuardarGPU) {
    btnGuardarGPU.addEventListener("click", async () => {
      try {
        const gpuNombre = document.getElementById("gpuNombre")?.value?.trim();
        const gpuMemoria = document.getElementById("gpuMemoria")?.value?.trim();
        const gpuTipo = document.getElementById("gpuTipo")?.value?.trim();

        if (!gpuNombre) {
          alert("Ingresa al menos la marca/nombre de la GPU.");
          return;
        }

        const payload = {
          marca: gpuNombre,
          modelo: `${gpuTipo || ""} ${gpuMemoria ? gpuMemoria + "GB" : ""}`.trim()
        };

        const nuevo = await API.post("gpu/", payload);

        modalGPU.hide();
        await cargarSelectGPU();

        if (nuevo && nuevo.id) {
          const selectGPU = document.getElementById("gpu");
          if (selectGPU) selectGPU.value = nuevo.id;
        }

        alert("GPU creada correctamente.");
      } catch (err) {
        console.error("Error al crear GPU:", err);
        alert("No se pudo crear la GPU.");
      }
    });
  }
}

// -----------------------------------------------------------
// Helpers reutilizables
// -----------------------------------------------------------

// (Ya definido antes: getId)

// -----------------------------------------------------------
// FIN
// -----------------------------------------------------------

export {
  // exporto si quieres reutilizar funciones en otros módulos
};
