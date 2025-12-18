// src/js/categorias.js
// CRUD de Categorías usando la API Django + JWT + imagen opcional

import { API } from "/src/js/api.js";

let categoriasCache = [];
let modoEdicion = false; // Estado global para mostrar/ocultar botones

// ----------------------------
// Helpers
// ----------------------------
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function normalizarRespuestaLista(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.results)) return res.results;
  return [];
}

// Construye URL de imagen de categoría
function getCategoriaImagen(cat) {
  const img =
    cat.imagen_absoluta ||
    cat.imagen_url ||
    cat.imagen ||
    "";

  if (!img) {
    return "/src/img/categoria-default.png";
  }

  // Si el backend ya entrega URL absoluta, usarla tal cual
  if (img.startsWith("http://") || img.startsWith("https://")) {
    return img;
  }

  // Si entrega un path tipo "/media/xxx", intenta usarlo directo
  // En producción, lo normal es que /media/ apunte al backend por nginx
  return img;
}

// ----------------------------
// Detectar página
// ----------------------------
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  if (path.endsWith("listar.html")) {
    initListarCategorias();
  } else if (path.endsWith("agregar.html")) {
    initAgregarCategoria();
  } else if (path.endsWith("editar.html")) {
    initEditarCategoria();
  } else if (path.endsWith("eliminar.html")) {
    initEliminarCategoria();
  }
});

// ============================================================
// LISTAR (listar.html)
// ============================================================
function initListarCategorias() {
  cargarCategoriasLista();

  const inputNombre = document.getElementById("filtroNombre");
  const selectTipo = document.getElementById("filtroTipo");
  const btnLimpiar = document.getElementById("btnLimpiarFiltros");
  const btnToggleEdicion = document.getElementById("btnToggleEdicion");

  const aplicar = () => aplicarFiltrosCategorias();

  if (inputNombre) inputNombre.addEventListener("input", aplicar);
  if (selectTipo) selectTipo.addEventListener("change", aplicar);
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      if (inputNombre) inputNombre.value = "";
      if (selectTipo) selectTipo.value = "";
      aplicarFiltrosCategorias();
    });
  }

  // Botón para toggle modo edición
  if (btnToggleEdicion) {
    btnToggleEdicion.addEventListener("click", () => {
      modoEdicion = !modoEdicion;
      
      // Cambiar texto e ícono del botón
      const icono = btnToggleEdicion.querySelector("i");
      const texto = btnToggleEdicion.querySelector("span");
      
      if (modoEdicion) {
        icono.className = "bi bi-x-circle";
        texto.textContent = " Cancelar";
        btnToggleEdicion.classList.remove("btn-outline-warning");
        btnToggleEdicion.classList.add("btn-warning");
      } else {
        icono.className = "bi bi-pencil-square";
        texto.textContent = " Editar";
        btnToggleEdicion.classList.remove("btn-warning");
        btnToggleEdicion.classList.add("btn-outline-warning");
      }
      
      // Re-renderizar las categorías con/sin botones
      aplicarFiltrosCategorias();
    });
  }
}

async function cargarCategoriasLista() {
  const contenedor = document.getElementById("lista-categorias");
  if (contenedor) {
    contenedor.innerHTML = `<p class="text-muted">Cargando categorías...</p>`;
  }

  try {
    const res = await API.get("categorias/"); // GET /api/api/categorias/
    categoriasCache = normalizarRespuestaLista(res);
    aplicarFiltrosCategorias();
  } catch (err) {
    console.error("Error al cargar categorías:", err);
    if (contenedor) {
      contenedor.innerHTML =
        `<p class="text-danger">No se pudieron cargar las categorías.</p>`;
    }
  }
}

function aplicarFiltrosCategorias() {
  const texto = (document.getElementById("filtroNombre")?.value || "")
    .toLowerCase();
  const tipo = document.getElementById("filtroTipo")?.value || "";

  const filtradas = categoriasCache.filter(cat => {
    const nombre = (cat.nombre || "").toLowerCase();
    const tipoVisual = (cat.nombre || "").toLowerCase();

    const coincideTexto =
      !texto || nombre.includes(texto) || tipoVisual.includes(texto);

    const coincideTipo =
      !tipo || cat.nombre === tipo || tipoVisual === tipo.toLowerCase();

    return coincideTexto && coincideTipo;
  });

  renderCategorias(filtradas);
}

function renderCategorias(lista) {
  const contenedor = document.getElementById("lista-categorias");
  if (!contenedor) return;

  if (!lista.length) {
    contenedor.innerHTML =
      `<p class="text-muted">No hay categorías que coincidan con el filtro.</p>`;
    return;
  }

  contenedor.innerHTML = "";

  lista.forEach(cat => {
    const card = document.createElement("div");
    card.className = "col-md-4";

    const nombre = cat.nombre || "Sin nombre";
    const imagen = getCategoriaImagen(cat);

    // Botones solo se muestran si modoEdicion está activo
    const botonesHTML = modoEdicion ? `
      <div class="mt-3 d-flex gap-1 botones-edicion">
        <a href="editar.html?id=${cat.id}" class="btn btn-warning btn-sm">
          <i class="bi bi-pencil-fill"></i> Editar
        </a>
        <a href="eliminar.html?id=${cat.id}" class="btn btn-danger btn-sm">
          <i class="bi bi-trash-fill"></i> Eliminar
        </a>
      </div>
    ` : '';

    card.innerHTML = `
      <div class="card shadow-sm p-3 category-card h-100">
        <img src="${imagen}" 
             alt="Imagen de ${nombre}"
             class="img-fluid rounded mb-3 w-100" 
             style="height:160px;object-fit:cover;">

        <h5 class="fw-bold text-center">${nombre}</h5>
        
        ${botonesHTML}
      </div>
    `;

    const innerCard = card.querySelector(".category-card");

    // 👉 Hacer clic en el card lleva a productos filtrados (solo si NO está en modo edición)
    if (!modoEdicion) {
      innerCard.style.cursor = "pointer";
      innerCard.addEventListener("click", (event) => {
        // Si el click fue en un botón o link, NO redirigimos
        if (event.target.closest("a, button")) return;

        const url = `/paginas/productos/listar.html?categoria_id=${encodeURIComponent(
          cat.id
        )}&categoria=${encodeURIComponent(nombre)}`;

        window.location.href = url;
      });
    } else {
      innerCard.style.cursor = "default";
    }

    contenedor.appendChild(card);
  });
}

// ============================================================
// AGREGAR (agregar.html)
// ============================================================
function initAgregarCategoria() {
  const form = document.getElementById("formAgregarCategoria");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const nombre = document.getElementById("nombre")?.value.trim();
    const inputImagen = document.getElementById("imagen");
    const archivo = inputImagen?.files?.[0] || null;

    if (!nombre) {
      alert("El nombre de la categoría es obligatorio.");
      return;
    }

    const formData = new FormData();
    formData.append("nombre", nombre);
    if (archivo) {
      formData.append("imagen", archivo);
    }

    try {
      await API.post("categorias/", formData);
      alert("Categoría creada correctamente.");
      window.location.href = "listar.html";
    } catch (err) {
      console.error("Error al crear categoría:", err);
      alert("No se pudo crear la categoría.");
    }
  });
}

// ============================================================
// EDITAR (editar.html)
// ============================================================
function initEditarCategoria() {
  const form = document.getElementById("formEditarCategoria");
  if (!form) return;

  const id = getParam("id");
  if (!id) {
    alert("Falta el ID de la categoría.");
    window.location.href = "listar.html";
    return;
  }

  cargarDatosCategoriaEdicion(id);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const nombre = document.getElementById("nombre")?.value.trim();
    const inputImagen = document.getElementById("imagen");
    const archivo = inputImagen?.files?.[0] || null;

    if (!nombre) {
      alert("El nombre de la categoría es obligatorio.");
      return;
    }

    const formData = new FormData();
    formData.append("nombre", nombre);
    // Si el usuario subió una nueva imagen, se envía.
    if (archivo) {
      formData.append("imagen", archivo);
    }

    try {
      await API.patch(`categorias/${id}/`, formData);
      alert("Categoría actualizada correctamente.");
      window.location.href = "listar.html";
    } catch (err) {
      console.error("Error al actualizar categoría:", err);
      alert("No se pudo actualizar la categoría.");
    }
  });
}

async function cargarDatosCategoriaEdicion(id) {
  try {
    const cat = await API.get(`categorias/${id}/`);

    const inputNombre = document.getElementById("nombre");
    const inputId = document.getElementById("idCategoria");
    const imgPreview = document.getElementById("imagenPreview");

    if (inputId) inputId.value = cat.id;
    if (inputNombre) inputNombre.value = cat.nombre || "";

    if (imgPreview) {
      imgPreview.src = getCategoriaImagen(cat);
    }
  } catch (err) {
    console.error("Error al cargar categoría:", err);
    alert("No se pudo cargar la categoría.");
  }
}

// ============================================================
// ELIMINAR (eliminar.html)
// ============================================================
function initEliminarCategoria() {
  const form = document.getElementById("formEliminarCategoria");
  const infoDiv = document.getElementById("categoriaInfo");
  if (!form || !infoDiv) return;

  const id = getParam("id");
  if (!id) {
    alert("Falta el ID de la categoría.");
    window.location.href = "listar.html";
    return;
  }

  // Mostrar datos de la categoría
  API.get(`categorias/${id}/`)
    .then(cat => {
      infoDiv.innerHTML = `
        <strong>${cat.nombre || "Sin nombre"}</strong><br>
        ID: ${cat.id}
      `;
      const hidden = document.getElementById("idCategoria");
      if (hidden) hidden.value = cat.id;
    })
    .catch(err => {
      console.error("Error al cargar categoría:", err);
      infoDiv.textContent = "No se pudo cargar la categoría.";
    });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!confirm("¿Seguro que deseas eliminar esta categoría?")) return;

    try {
      await API.delete(`categorias/${id}/`);
      alert("Categoría eliminada correctamente.");
      window.location.href = "listar.html";
    } catch (err) {
      console.error("Error al eliminar categoría:", err);
      alert("No se pudo eliminar la categoría.");
    }
  });
}