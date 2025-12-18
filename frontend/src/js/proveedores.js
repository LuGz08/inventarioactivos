// src/js/proveedores.js
// Frontend CRUD para Proveedores
import { API } from "/src/js/api.js";

// --- Utilidades ---
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function normalizarProveedor(p) {
  if (!p || typeof p !== "object") return {};
  return {
    id: p.id,
    nombre: p.nombre || p.nombre_fantasia || "",
    rut: p.rut || p.rut_empresa || "",
    contacto: p.contacto || p.nombre_contacto || "",
    telefono: p.telefono || p.fono || "",
    // Normalizamos para leer: acepta email o correo según venga del backend
    email: p.email || p.correo || p.correo_electronico || "",
    ubicacion: p.ubicacion || p.direccion || "",
  };
}

let proveedoresCache = [];

// --- Detección de página ---
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  if (path.includes("listar.html")) initListarProveedores();
  else if (path.includes("agregar.html")) initAgregarProveedor();
  else if (path.includes("editar.html")) initEditarProveedor();
  else if (path.includes("eliminar.html")) initEliminarProveedor();
  else if (path.includes("detalle.html")) initDetalleProveedor();
});

// -----------------------------------------------------------
// 1. LISTAR
// -----------------------------------------------------------
function initListarProveedores() {
  const inputBuscar = document.getElementById("inputBuscarProveedor");
  const filtroEmail = document.getElementById("filtroEmailProveedor");
  const filtroTelefono = document.getElementById("filtroTelefonoProveedor");
  const btnLimpiar = document.getElementById("btnLimpiarFiltrosProveedor");

  const recargar = () => aplicarFiltrosYRender();

  if (inputBuscar) inputBuscar.addEventListener("input", recargar);
  if (filtroEmail) filtroEmail.addEventListener("input", recargar);
  if (filtroTelefono) filtroTelefono.addEventListener("input", recargar);
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      if (inputBuscar) inputBuscar.value = "";
      if (filtroEmail) filtroEmail.value = "";
      if (filtroTelefono) filtroTelefono.value = "";
      aplicarFiltrosYRender();
    });
  }
  cargarProveedoresLista();
}

async function cargarProveedoresLista() {
  const tbody = document.getElementById("tbodyProveedores");
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center">Cargando proveedores...</td></tr>`;

  try {
    const res = await API.get("proveedores/");
    const lista = Array.isArray(res) ? res : (res.results || []);
    proveedoresCache = lista.map(normalizarProveedor);
    aplicarFiltrosYRender();
  } catch (err) {
    console.error(err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Error al cargar datos</td></tr>`;
  }
}

function aplicarFiltrosYRender() {
  const inputBuscar = document.getElementById("inputBuscarProveedor");
  const filtroEmail = document.getElementById("filtroEmailProveedor");
  const filtroTelefono = document.getElementById("filtroTelefonoProveedor");

  const texto = (inputBuscar?.value || "").toLowerCase().trim();
  const emailFiltro = (filtroEmail?.value || "").toLowerCase().trim();
  const telFiltro = (filtroTelefono?.value || "").toLowerCase().trim();

  const filtrados = proveedoresCache.filter((p) => {
    const dataStr = `${p.nombre} ${p.rut} ${p.contacto}`.toLowerCase();
    const email = (p.email || "").toLowerCase();
    const tel = (p.telefono || "").toLowerCase();

    return (
      (!texto || dataStr.includes(texto)) &&
      (!emailFiltro || email.includes(emailFiltro)) &&
      (!telFiltro || tel.includes(telFiltro))
    );
  });

  renderTablaProveedores(filtrados);
}

function renderTablaProveedores(lista) {
  const tbody = document.getElementById("tbodyProveedores");
  const spanTotal = document.getElementById("totalProveedores");
  if (!tbody) return;

  if (spanTotal) spanTotal.textContent = lista.length;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center py-3">No hay coincidencias.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(p => `
    <tr>
      <td><strong>${p.nombre}</strong></td>
      <td>${p.rut}</td>
      <td>${p.contacto}</td>
      <td>${p.telefono}</td>
      <td>${p.email}</td>
      <td class="text-end">
        <a href="detalle.html?id=${p.id}" class="btn btn-sm btn-outline-info me-1" title="Ver detalle"><i class="bi bi-eye"></i></a>
        <a href="editar.html?id=${p.id}" class="btn btn-sm btn-outline-primary me-1" title="Editar"><i class="bi bi-pencil"></i></a>
        <a href="eliminar.html?id=${p.id}" class="btn btn-sm btn-outline-danger" title="Eliminar"><i class="bi bi-trash"></i></a>
      </td>
    </tr>
  `).join("");
}

// -----------------------------------------------------------
// 2. AGREGAR
// -----------------------------------------------------------
function initAgregarProveedor() {
  const form = document.getElementById("formAgregarProveedor"); 
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // CORRECCIÓN: "correo" es la llave que espera el backend
    const payload = {
      nombre: document.getElementById("nombre")?.value.trim(),
      rut: document.getElementById("rut")?.value.trim(),
      contacto: document.getElementById("contacto")?.value.trim(),
      telefono: document.getElementById("telefono")?.value.trim(),
      correo: document.getElementById("email")?.value.trim(), // <--- CAMBIO IMPORTANTE: key 'correo'
      ubicacion: document.getElementById("ubicacion")?.value.trim() || ""
    };

    try {
      await API.post("proveedores/", payload);
      alert("Proveedor creado exitosamente.");
      window.location.href = "listar.html";
    } catch (err) {
      console.error(err);
      alert("Error al crear: Verifique los datos obligatorios.");
    }
  });
}

// -----------------------------------------------------------
// 3. EDITAR
// -----------------------------------------------------------
async function initEditarProveedor() {
  const form = document.getElementById("formEditarProveedor");
  if (!form) return;

  const id = getParam("id");
  if (!id) { window.location.href = "listar.html"; return; }

  try {
    const p = await API.get(`proveedores/${id}/`);
    const n = normalizarProveedor(p);

    // Llenar campos del formulario
    if(document.getElementById("nombre")) document.getElementById("nombre").value = n.nombre;
    if(document.getElementById("rut")) document.getElementById("rut").value = n.rut;
    if(document.getElementById("contacto")) document.getElementById("contacto").value = n.contacto;
    if(document.getElementById("telefono")) document.getElementById("telefono").value = n.telefono;
    if(document.getElementById("email")) document.getElementById("email").value = n.email;
    if(document.getElementById("ubicacion")) document.getElementById("ubicacion").value = n.ubicacion;

  } catch (err) {
    alert("Error al cargar proveedor.");
    window.location.href = "listar.html";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // CORRECCIÓN: "correo" es la llave que espera el backend
    const payload = {
      nombre: document.getElementById("nombre").value.trim(),
      rut: document.getElementById("rut").value.trim(),
      contacto: document.getElementById("contacto").value.trim(),
      telefono: document.getElementById("telefono").value.trim(),
      correo: document.getElementById("email").value.trim(), // <--- CAMBIO IMPORTANTE: key 'correo'
      ubicacion: document.getElementById("ubicacion")?.value.trim() || ""
    };

    try {
      await API.put(`proveedores/${id}/`, payload);
      alert("Proveedor actualizado.");
      window.location.href = "listar.html";
    } catch (err) {
      console.error(err);
      alert("Error al guardar cambios.");
    }
  });
}

// -----------------------------------------------------------
// 4. ELIMINAR
// -----------------------------------------------------------
function initEliminarProveedor() {
  const form = document.getElementById("formEliminarProveedor");
  const infoDiv = document.getElementById("proveedor-eliminar-info"); 
  const id = getParam("id");

  if (!form || !id) return;

  API.get(`proveedores/${id}/`).then(p => {
    const n = normalizarProveedor(p);
    if (infoDiv) {
      infoDiv.innerHTML = `
        <ul class="list-unstyled mb-0 text-start">
          <li><strong>Nombre:</strong> ${n.nombre}</li>
          <li><strong>RUT:</strong> ${n.rut}</li>
          <li><strong>Contacto:</strong> ${n.contacto}</li>
        </ul>
      `;
    }
  }).catch(() => {
    if(infoDiv) infoDiv.innerHTML = "<span class='text-danger'>Error al cargar datos.</span>";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await API.delete(`proveedores/${id}/`);
      alert("Proveedor eliminado.");
      window.location.href = "listar.html";
    } catch (err) {
      alert("No se pudo eliminar (posiblemente tenga productos asociados).");
    }
  });
}

// -----------------------------------------------------------
// 5. DETALLE
// -----------------------------------------------------------
async function initDetalleProveedor() {
  const id = getParam("id");
  if (!id) return;

  try {
    const p = await API.get(`proveedores/${id}/`);
    const n = normalizarProveedor(p);

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if(el) el.textContent = val || "—";
    };

    setText("det-id", n.id);
    setText("det-nombre", n.nombre);
    setText("det-rut", n.rut);
    setText("det-contacto", n.contacto);
    setText("det-ubicacion", n.ubicacion);
    setText("det-telefono", n.telefono);
    setText("det-email", n.email);

    const btnEditar = document.getElementById("btn-editar-proveedor");
    if (btnEditar) btnEditar.href = `editar.html?id=${n.id}`;

  } catch (err) {
    console.error(err);
  }
}