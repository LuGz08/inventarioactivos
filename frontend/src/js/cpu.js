// src/js/cpu.js
// CRUD frontend para CPUs
// Requiere: /src/js/api.js y JWT válido en localStorage

import { API } from "/src/js/api.js";

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function alertSuccess(msg) {
  if (window.Swal) {
    Swal.fire({
      icon: "success",
      title: "Éxito",
      text: msg,
      timer: 1600,
      showConfirmButton: false,
    });
  } else {
    alert(msg);
  }
}

function alertError(msg) {
  if (window.Swal) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: msg,
    });
  } else {
    alert(msg);
  }
}

let cpusCache = [];

// Detectar en qué página estamos
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  if (path.includes("/cpu/") && path.endsWith("listar.html")) {
    initListarCPUs();
  } else if (path.includes("/cpu/") && path.endsWith("agregar.html")) {
    initAgregarCPU();
  } else if (path.includes("/cpu/") && path.endsWith("editar.html")) {
    initEditarCPU();
  } else if (path.includes("/cpu/") && path.endsWith("eliminar.html")) {
    initEliminarCPU();
  }
});

// LISTAR ----------------------------------------------------

function initListarCPUs() {
  const inputBuscar = document.getElementById("inputBuscarCPU");
  const btnLimpiar = document.getElementById("btnLimpiarFiltrosCPU");

  if (inputBuscar) {
    inputBuscar.addEventListener("input", aplicarFiltrosYRender);
  }
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      if (inputBuscar) inputBuscar.value = "";
      aplicarFiltrosYRender();
    });
  }

  cargarCPUsLista();
}

async function cargarCPUsLista() {
  const tbody = document.getElementById("tbodyCPUs");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center">Cargando CPUs...</td></tr>`;
  }

  try {
    const res = await API.get("cpu/");
    const lista = Array.isArray(res) ? res : res.results || [];
    cpusCache = lista;

    aplicarFiltrosYRender();
  } catch (err) {
    console.error("Error al cargar CPUs:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-danger text-center">Error al cargar CPUs</td></tr>`;
    }
  }
}

function aplicarFiltrosYRender() {
  const inputBuscar = document.getElementById("inputBuscarCPU");
  const texto = (inputBuscar?.value || "").toLowerCase().trim();

  const filtradas = cpusCache.filter((cpu) => {
    const marca = (cpu.marca || "").toLowerCase();
    const modelo = (cpu.modelo || "").toLowerCase();
    return !texto || marca.includes(texto) || modelo.includes(texto);
  });

  renderTablaCPUs(filtradas);
}

function renderTablaCPUs(lista) {
  const tbody = document.getElementById("tbodyCPUs");
  const spanTotal = document.getElementById("totalCPUs");
  if (!tbody) return;

  if (spanTotal) spanTotal.textContent = lista.length;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-center">No hay CPUs que coincidan con el filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  lista.forEach((cpu) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cpu.marca || "Sin marca"}</td>
      <td>${cpu.modelo || "Sin modelo"}</td>
      <td class="text-end">
        <a href="editar.html?id=${cpu.id}" class="btn btn-sm btn-outline-primary me-1">
          <i class="bi bi-pencil"></i>
        </a>
        <a href="eliminar.html?id=${cpu.id}" class="btn btn-sm btn-outline-danger">
          <i class="bi bi-trash"></i>
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// AGREGAR ---------------------------------------------------

function initAgregarCPU() {
  const form = document.getElementById("formCPU");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const marca = document.getElementById("marca")?.value.trim() || "";
    const modelo = document.getElementById("modelo")?.value.trim() || "";

    if (!marca) {
      alertError("La marca es obligatoria.");
      return;
    }
    if (!modelo) {
      alertError("El modelo es obligatorio.");
      return;
    }

    const payload = { marca, modelo };

    try {
      await API.post("cpu/", payload);
      alertSuccess("CPU creado correctamente.");
      window.location.href = "listar.html";
    } catch (err) {
      console.error("Error al crear CPU:", err);
      alertError("No se pudo crear el CPU.");
    }
  });
}

// EDITAR ----------------------------------------------------

async function initEditarCPU() {
  const form = document.getElementById("formEditarCPU");
  if (!form) return;

  const id = getParam("id");
  if (!id) {
    alertError("Falta el ID del CPU.");
    window.location.href = "listar.html";
    return;
  }

  // Cargar datos actuales
  try {
    const cpu = await API.get(`cpu/${id}/`);
    const marca = document.getElementById("marca");
    const modelo = document.getElementById("modelo");
    if (marca) marca.value = cpu.marca || "";
    if (modelo) modelo.value = cpu.modelo || "";
  } catch (err) {
    console.error("Error al cargar CPU:", err);
    alertError("No se pudo cargar el CPU.");
  }

  // Guardar cambios
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const marca = document.getElementById("marca")?.value.trim() || "";
    const modelo = document.getElementById("modelo")?.value.trim() || "";
    
    if (!marca) {
      alertError("La marca es obligatoria.");
      return;
    }
    if (!modelo) {
      alertError("El modelo es obligatorio.");
      return;
    }

    const payload = { marca, modelo };

    try {
      await API.put(`cpu/${id}/`, payload);
      alertSuccess("CPU actualizado correctamente.");
      window.location.href = "listar.html";
    } catch (err) {
      console.error("Error al actualizar CPU:", err);
      alertError("No se pudo actualizar el CPU.");
    }
  });
}

// ELIMINAR --------------------------------------------------

async function initEliminarCPU() {
  const form = document.getElementById("formEliminarCPU");
  const infoDiv = document.getElementById("cpu-eliminar-info");
  if (!form) return;

  const id = getParam("id");
  if (!id) {
    alertError("Falta el ID del CPU.");
    window.location.href = "listar.html";
    return;
  }

  try {
    const cpu = await API.get(`cpu/${id}/`);
    if (infoDiv) {
      infoDiv.innerHTML = `
        <p>¿Seguro que deseas eliminar el CPU <strong>${cpu.marca} ${cpu.modelo}</strong>?</p>
        <p class="text-muted">Esta acción no se puede deshacer.</p>
      `;
    }
  } catch (err) {
    console.error("Error al cargar CPU:", err);
    if (infoDiv) {
      infoDiv.innerHTML =
        '<p class="text-danger">No se pudo cargar el CPU.</p>';
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!confirm("¿Eliminar este CPU?")) return;

    try {
      await API.delete(`cpu/${id}/`);
      alertSuccess("CPU eliminado correctamente.");
      window.location.href = "listar.html";
    } catch (err) {
      console.error("Error al eliminar CPU:", err);
      alertError("No se pudo eliminar el CPU.");
    }
  });
}