// src/js/gpu.js
// CRUD frontend para GPUs
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

let gpusCache = [];

// Detectar en qué página estamos
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  if (path.includes("/gpu/") && path.endsWith("listar.html")) {
    initListarGPUs();
  } else if (path.includes("/gpu/") && path.endsWith("agregar.html")) {
    initAgregarGPU();
  } else if (path.includes("/gpu/") && path.endsWith("editar.html")) {
    initEditarGPU();
  } else if (path.includes("/gpu/") && path.endsWith("eliminar.html")) {
    initEliminarGPU();
  }
});

// LISTAR ----------------------------------------------------

function initListarGPUs() {
  const inputBuscar = document.getElementById("inputBuscarGPU");
  const btnLimpiar = document.getElementById("btnLimpiarFiltrosGPU");

  if (inputBuscar) {
    inputBuscar.addEventListener("input", aplicarFiltrosYRender);
  }
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      if (inputBuscar) inputBuscar.value = "";
      aplicarFiltrosYRender();
    });
  }

  cargarGPUsLista();
}

async function cargarGPUsLista() {
  const tbody = document.getElementById("tbodyGPUs");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center">Cargando GPUs...</td></tr>`;
  }

  try {
    const res = await API.get("gpu/");
    const lista = Array.isArray(res) ? res : res.results || [];
    gpusCache = lista;

    aplicarFiltrosYRender();
  } catch (err) {
    console.error("Error al cargar GPUs:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-danger text-center">Error al cargar GPUs</td></tr>`;
    }
  }
}

function aplicarFiltrosYRender() {
  const inputBuscar = document.getElementById("inputBuscarGPU");
  const texto = (inputBuscar?.value || "").toLowerCase().trim();

  const filtradas = gpusCache.filter((gpu) => {
    const marca = (gpu.marca || "").toLowerCase();
    const modelo = (gpu.modelo || "").toLowerCase();
    return !texto || marca.includes(texto) || modelo.includes(texto);
  });

  renderTablaGPUs(filtradas);
}

function renderTablaGPUs(lista) {
  const tbody = document.getElementById("tbodyGPUs");
  const spanTotal = document.getElementById("totalGPUs");
  if (!tbody) return;

  if (spanTotal) spanTotal.textContent = lista.length;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-center">No hay GPUs que coincidan con el filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  lista.forEach((gpu) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${gpu.marca || "Sin marca"}</td>
      <td>${gpu.modelo || "Sin modelo"}</td>
      <td class="text-end">
        <a href="editar.html?id=${gpu.id}" class="btn btn-sm btn-outline-primary me-1">
          <i class="bi bi-pencil"></i>
        </a>
        <a href="eliminar.html?id=${gpu.id}" class="btn btn-sm btn-outline-danger">
          <i class="bi bi-trash"></i>
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// AGREGAR ---------------------------------------------------

function initAgregarGPU() {
  const form = document.getElementById("formGPU");
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
      await API.post("gpu/", payload);
      alertSuccess("GPU creada correctamente.");
      window.location.href = "listar.html";
    } catch (err) {
      console.error("Error al crear GPU:", err);
      alertError("No se pudo crear la GPU.");
    }
  });
}

// EDITAR ----------------------------------------------------

async function initEditarGPU() {
  const form = document.getElementById("formEditarGPU");
  if (!form) return;

  const id = getParam("id");
  if (!id) {
    alertError("Falta el ID de la GPU.");
    window.location.href = "listar.html";
    return;
  }

  // Cargar datos actuales
  try {
    const gpu = await API.get(`gpu/${id}/`);
    const marca = document.getElementById("marca");
    const modelo = document.getElementById("modelo");
    if (marca) marca.value = gpu.marca || "";
    if (modelo) modelo.value = gpu.modelo || "";
  } catch (err) {
    console.error("Error al cargar GPU:", err);
    alertError("No se pudo cargar la GPU.");
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
      await API.put(`gpu/${id}/`, payload);
      alertSuccess("GPU actualizada correctamente.");
      window.location.href = "listar.html";
    } catch (err) {
      console.error("Error al actualizar GPU:", err);
      alertError("No se pudo actualizar la GPU.");
    }
  });
}

// ELIMINAR --------------------------------------------------

async function initEliminarGPU() {
  const form = document.getElementById("formEliminarGPU");
  const infoDiv = document.getElementById("gpu-eliminar-info");
  if (!form) return;

  const id = getParam("id");
  if (!id) {
    alertError("Falta el ID de la GPU.");
    window.location.href = "listar.html";
    return;
  }

  try {
    const gpu = await API.get(`gpu/${id}/`);
    if (infoDiv) {
      infoDiv.innerHTML = `
        <p>¿Seguro que deseas eliminar la GPU <strong>${gpu.marca} ${gpu.modelo}</strong>?</p>
        <p class="text-muted">Esta acción no se puede deshacer.</p>
      `;
    }
  } catch (err) {
    console.error("Error al cargar GPU:", err);
    if (infoDiv) {
      infoDiv.innerHTML =
        '<p class="text-danger">No se pudo cargar la GPU.</p>';
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!confirm("¿Eliminar esta GPU?")) return;

    try {
      await API.delete(`gpu/${id}/`);
      alertSuccess("GPU eliminada correctamente.");
      window.location.href = "listar.html";
    } catch (err) {
      console.error("Error al eliminar GPU:", err);
      alertError("No se pudo eliminar la GPU.");
    }
  });
}