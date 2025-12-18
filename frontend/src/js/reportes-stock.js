import { API } from "/src/js/api.js";

/* ---------------------------
   Helpers de Auth/Descarga
----------------------------*/
function getAccessToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function fetchBlobWithAuth(url) {
  const token = getAccessToken();
  const res = await fetch(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();

  // intentamos sacar nombre archivo
  const cd = res.headers.get("content-disposition") || "";
  let filename = "reporte";
  const m = cd.match(/filename="([^"]+)"/i);
  if (m?.[1]) filename = m[1];

  return { blob, filename };
}

function descargarBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") sp.set(k, v);
  });
  return sp.toString();
}

/* ---------------------------
   Carga de selects
----------------------------*/
async function llenarSelect(endpoint, selectEl, label = "nombre") {
  if (!selectEl) return;
  try {
    const res = await API.get(endpoint);
    const arr = Array.isArray(res) ? res : (res?.results || []);
    arr.forEach((it) => {
      const opt = document.createElement("option");
      opt.value = it.id;
      opt.textContent = it[label] ?? it.nombre ?? `#${it.id}`;
      selectEl.appendChild(opt);
    });
  } catch (e) {
    // si falla, no rompemos la página
    console.warn("No se pudo cargar select", endpoint, e);
  }
}

/* ---------------------------
   Reporte
----------------------------*/
function leerFiltros() {
  return {
    texto: document.getElementById("fTexto")?.value || "",
    categoria: document.getElementById("fCategoria")?.value || "",
    estado: document.getElementById("fEstado")?.value || "",
    sucursal: document.getElementById("fSucursal")?.value || "",
    proveedor: document.getElementById("fProveedor")?.value || "",
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
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No hay resultados con esos filtros.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  lista.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id ?? ""}</td>
      <td>${p.nro_serie ?? "—"}</td>
      <td>${p.categoria ?? "—"}</td>
      <td>${p.modelo ?? "—"}</td>
      <td>${p.sucursal ?? "—"}</td>
      <td>${p.proveedor ?? "—"}</td>
      <td>${p.estado ?? "—"}</td>
      <td>
        <span class="badge ${
          p.estado_garantia === "VIGENTE"
            ? "text-bg-success"
            : p.estado_garantia === "VENCIDA"
              ? "text-bg-danger"
              : "text-bg-secondary"
        }">${p.estado_garantia ?? "—"}</span>
        <div class="small text-muted">${p.fecha_venc_garantia ?? ""}</div>
      </td>
      <td>${p.documento_factura ?? "—"}</td>
      <td>${p.fecha_compra ?? "—"}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function cargarReporte() {
  setEstado("Cargando reporte...");
  try {
    const filtros = leerFiltros();
    const data = await API.get(`reportes/stock/?${qs(filtros)}`);
    renderTabla(Array.isArray(data) ? data : (data?.results || []));
    setEstado("");
  } catch (e) {
    console.error(e);
    setEstado("Error cargando reporte.");
    const tbody = document.getElementById("tbodyResultados");
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Error al cargar datos.</td></tr>`;
  }
}

async function exportar(formato) {
  try {
    const filtros = leerFiltros();
    const url = `/api/reportes/stock/exportar/?${qs({ ...filtros, formato })}`;
    const { blob, filename } = await fetchBlobWithAuth(url);
    descargarBlob(blob, filename);
  } catch (e) {
    console.error(e);
    alert("No se pudo exportar el reporte.");
  }
}

/* ---------------------------
   Init
----------------------------*/
document.addEventListener("DOMContentLoaded", async () => {
  await llenarSelect("categorias/", document.getElementById("fCategoria"));
  await llenarSelect("estados/", document.getElementById("fEstado"));
  await llenarSelect("sucursales/", document.getElementById("fSucursal"));
  await llenarSelect("proveedores/", document.getElementById("fProveedor"));

  document.getElementById("formFiltros")?.addEventListener("submit", (e) => {
    e.preventDefault();
    cargarReporte();
  });

  document.getElementById("btnLimpiar")?.addEventListener("click", () => {
    ["fTexto","fCategoria","fEstado","fSucursal","fProveedor","fDesde","fHasta"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    cargarReporte();
  });

  document.getElementById("btnExportExcel")?.addEventListener("click", () => exportar("excel"));
  document.getElementById("btnExportPDF")?.addEventListener("click", () => exportar("pdf"));

  cargarReporte();
});
