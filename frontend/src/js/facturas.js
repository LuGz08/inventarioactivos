import { API } from "/src/js/api.js";

function normalizarLista(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.results)) return res.results;
  return [];
}

function setMsg(html, isError = false) {
  const el = document.getElementById("msgForm");
  if (!el) return;
  el.innerHTML = `<div class="${isError ? "text-danger" : "text-success"}">${html}</div>`;
}

async function cargarProveedores() {
  const sel = document.getElementById("fProveedor");
  if (!sel) return;
  try {
    const res = await API.get("proveedores/");
    const arr = normalizarLista(res);
    arr.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.nombre ?? `Proveedor #${p.id}`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.warn("No se pudieron cargar proveedores", e);
  }
}

let productosCache = [];

async function cargarProductos() {
  const sel = document.getElementById("fProductos");
  if (!sel) return;

  sel.innerHTML = "";
  try {
    const res = await API.get("productos/");
    productosCache = normalizarLista(res);
    renderProductos(productosCache);
  } catch (e) {
    console.error(e);
    sel.innerHTML = "";
  }
}

function renderProductos(lista) {
  const sel = document.getElementById("fProductos");
  if (!sel) return;
  sel.innerHTML = "";

  lista.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.nro_serie ?? "—"} (ID ${p.id})`;
    sel.appendChild(opt);
  });
}

function filtrarProductosPorTexto(texto) {
  texto = (texto || "").toLowerCase().trim();
  if (!texto) return productosCache;
  return productosCache.filter((p) =>
    String(p.nro_serie || "").toLowerCase().includes(texto)
  );
}

async function guardarFactura(e) {
  e.preventDefault();
  setMsg("");

  const numero = document.getElementById("fNumero")?.value.trim();
  const fecha = document.getElementById("fFecha")?.value;
  const proveedor = document.getElementById("fProveedor")?.value;
  const monto = document.getElementById("fMonto")?.value;
  const desc = document.getElementById("fDesc")?.value || "";
  const archivo = document.getElementById("fArchivo")?.files?.[0];
  const productosSel = Array.from(document.getElementById("fProductos")?.selectedOptions || []).map(o => o.value);

  if (!numero || !fecha || !archivo || productosSel.length === 0) {
    setMsg("Completa número, fecha, archivo y al menos 1 producto.", true);
    return;
  }

  try {
    const fd = new FormData();
    fd.append("numero", numero);
    fd.append("fecha", fecha);
    if (proveedor) fd.append("proveedor", proveedor);
    if (monto) fd.append("monto_total", monto);
    fd.append("descripcion", desc);
    fd.append("archivo", archivo);

    // ManyToMany: se envía repetido
    productosSel.forEach((id) => fd.append("productos", id));

    // OJO: aquí usamos fetch directo para FormData (API.post probablemente manda JSON)
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("access") ||
      localStorage.getItem("token") ||
      "";

    const res = await fetch("/api/facturas/", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `HTTP ${res.status}`);
    }

    setMsg("Factura subida y asociada correctamente ✅");
    document.getElementById("formFactura").reset();
    await listarFacturas(); // refrescar lista
  } catch (e) {
    console.error(e);
    setMsg("No se pudo subir la factura (revisa datos / permisos).", true);
  }
}

function renderFacturas(lista) {
  const cont = document.getElementById("listaFacturas");
  if (!cont) return;

  if (!lista.length) {
    cont.innerHTML = `<div class="text-muted">No hay facturas.</div>`;
    return;
  }

  cont.innerHTML = `
    <div class="d-flex flex-column gap-2">
      ${lista.map((f) => {
        const archivoUrl = f.archivo || "";
        return `
          <div class="border rounded p-3">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="fw-bold">Factura ${f.numero}</div>
                <div class="small text-muted">Fecha: ${f.fecha || "—"} | Monto: ${f.monto_total ?? "—"}</div>
                <div class="small text-muted">Productos: ${(f.productos || []).join(", ")}</div>
              </div>
              ${archivoUrl ? `<a class="btn btn-sm btn-outline-primary" href="${archivoUrl}" target="_blank">
                <i class="bi bi-file-earmark-arrow-down"></i> Ver
              </a>` : ""}
            </div>
            ${f.descripcion ? `<div class="small mt-2">${f.descripcion}</div>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

async function listarFacturas(productoId = "") {
  const cont = document.getElementById("listaFacturas");
  if (cont) cont.innerHTML = "Cargando...";

  try {
    const q = productoId ? `?producto=${encodeURIComponent(productoId)}` : "";
    const res = await API.get(`facturas/${q}`);
    const arr = normalizarLista(res);
    renderFacturas(arr);
  } catch (e) {
    console.error(e);
    if (cont) cont.innerHTML = `<div class="text-danger">No se pudieron cargar facturas.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarProveedores();
  await cargarProductos();
  await listarFacturas();

  document.getElementById("formFactura")?.addEventListener("submit", guardarFactura);

  document.getElementById("buscadorProductos")?.addEventListener("input", (e) => {
    renderProductos(filtrarProductosPorTexto(e.target.value));
  });

  document.getElementById("btnFiltrar")?.addEventListener("click", () => {
    const pid = document.getElementById("filtroProductoId")?.value.trim();
    listarFacturas(pid);
  });

  document.getElementById("btnLimpiar")?.addEventListener("click", () => {
    const el = document.getElementById("filtroProductoId");
    if (el) el.value = "";
    listarFacturas("");
  });
});
