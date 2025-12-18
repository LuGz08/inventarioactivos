function getAccessToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    localStorage.getItem("token") ||
    ""
  );
}

function descargarTexto(nombre, contenido) {
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderResultado(elId, json) {
  const el = document.getElementById(elId);
  if (!el) return;

  const creados = json.creados ?? 0;
  const errores = json.errores ?? [];

  el.innerHTML = `
    <div class="text-success">Importación completada ✅ Creados: <strong>${creados}</strong></div>
    ${
      errores.length
        ? `<div class="mt-2 text-danger">
            <div class="fw-bold">Errores (${errores.length}):</div>
            <ul class="mb-0">${errores.map(e => `<li>${e}</li>`).join("")}</ul>
          </div>`
        : `<div class="text-muted mt-2">Sin errores.</div>`
    }
  `;
}

async function subirCSV(url, fileInputId, outId) {
  const file = document.getElementById(fileInputId)?.files?.[0];
  if (!file) return alert("Selecciona un archivo CSV.");

  const token = getAccessToken();
  const fd = new FormData();
  fd.append("archivo", file);

  const out = document.getElementById(outId);
  if (out) out.innerHTML = "Subiendo y procesando...";

  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { detail: text }; }

  if (!res.ok) {
    console.error(json);
    if (out) out.innerHTML = `<div class="text-danger">Error: ${json.detail || text || res.status}</div>`;
    return;
  }

  renderResultado(outId, json);
}

document.addEventListener("DOMContentLoaded", () => {
  // Templates
  document.getElementById("btnTemplateProductos")?.addEventListener("click", () => {
    const csv =
`nro_serie,fecha_compra,proveedor,marca,modelo,categoria,estado,sucursal,documento_factura,garantia_meses
ABC123,2025-01-10,Proveedor X,HP,EliteBook 840,Computadores,Operativo,Sucursal Centro,FAC-001,12
`;
    descargarTexto("template_productos.csv", csv);
  });

  document.getElementById("btnTemplateUsuarios")?.addEventListener("click", () => {
    const csv =
`username,email,first_name,last_name,rol,is_staff,password
jlopez,jlopez@correo.cl,Jaime,López,ADMIN,true,Admin1234
`;
    descargarTexto("template_usuarios.csv", csv);
  });

  // Subidas
  document.getElementById("formImportProductos")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await subirCSV("/api/importar/productos/", "fileProductos", "outProductos");
  });

  document.getElementById("formImportUsuarios")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await subirCSV("/api/importar/usuarios/", "fileUsuarios", "outUsuarios");
  });
});
