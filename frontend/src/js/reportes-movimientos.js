import { API } from "/src/js/api.js";

function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") sp.set(k, v);
  });
  return sp.toString();
}

function leerFiltros() {
  return {
    tipo: document.getElementById("fTipo")?.value || "",
    usuario: document.getElementById("fUsuario")?.value || "",
    texto: document.getElementById("fTexto")?.value || "",
    fecha_desde: document.getElementById("fDesde")?.value || "",
    fecha_hasta: document.getElementById("fHasta")?.value || "",
  };
}

function setEstado(msg) {
  const el = document.getElementById("estadoCarga");
  if (el) el.textContent = msg || "";
}

function renderTabla(lista) {
  const tbody = document.getElementById("tbodyResultados");
  const total = document.getElementById("totalResultados");
  if (total) total.textContent = String(lista.length);

  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No hay movimientos con esos filtros.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  lista.forEach((m) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.fecha ?? "—"}</td>
      <td><span class="badge text-bg-secondary">${m.tipo ?? "—"}</span></td>
      <td>${m.sku ?? "—"}</td>
      <td>${m.cantidad ?? "—"}</td>
      <td>${m.proveedor ?? "—"}</td>
      <td>${m.referencia ?? "—"}</td>
      <td>${m.usuario_username ?? "—"}</td>
      <td class="text-truncate" style="max-width: 320px;" title="${(m.comentarios || "").replaceAll('"', "'")}">
        ${m.comentarios ?? "—"}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function cargarReporte() {
  setEstado("Cargando movimientos...");
  try {
    const filtros = leerFiltros();
    const data = await API.get(`reportes/movimientos/?${qs(filtros)}`);
    renderTabla(Array.isArray(data) ? data : (data?.results || []));
    setEstado("");
  } catch (e) {
    console.error(e);
    setEstado("Error cargando reporte.");
    const tbody = document.getElementById("tbodyResultados");
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error al cargar datos.</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("formFiltros")?.addEventListener("submit", (e) => {
    e.preventDefault();
    cargarReporte();
  });

  document.getElementById("btnLimpiar")?.addEventListener("click", () => {
    ["fTipo","fUsuario","fTexto","fDesde","fHasta"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    cargarReporte();
  });

  cargarReporte();
});
