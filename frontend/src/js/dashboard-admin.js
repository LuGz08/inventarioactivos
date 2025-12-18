import { API } from "/src/js/api.js";

function renderListaConBarra(items, labelKey, valueKey) {
  if (!items?.length) return `<div class="text-muted">Sin datos.</div>`;

  const max = Math.max(...items.map(x => x[valueKey] || 0), 1);

  return `
    <div class="d-flex flex-column gap-2">
      ${items.map((x) => {
        const label = x[labelKey] ?? "Sin dato";
        const val = x[valueKey] ?? 0;
        const pct = Math.round((val / max) * 100);
        return `
          <div>
            <div class="d-flex justify-content-between">
              <span>${label}</span>
              <strong>${val}</strong>
            </div>
            <div class="progress" style="height: 8px;">
              <div class="progress-bar" role="progressbar" style="width:${pct}%"></div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

async function cargarDashboard() {
  try {
    const data = await API.get("reportes/dashboard/admin/");

    const k = data.kpis || {};
    document.getElementById("kpiTotal").textContent = k.total_productos ?? 0;
    document.getElementById("kpiVigentes").textContent = k.garantias_vigentes ?? 0;
    document.getElementById("kpiVencidas").textContent = k.garantias_vencidas ?? 0;
    document.getElementById("kpiMovMes").textContent = k.movimientos_mes ?? 0;

    document.getElementById("tablaCategoria").innerHTML =
      renderListaConBarra(data.por_categoria, "categoria__nombre", "total");

    document.getElementById("tablaSucursal").innerHTML =
      renderListaConBarra(data.por_sucursal, "sucursal__nombre", "total");

    document.getElementById("tablaMovTipo").innerHTML =
      renderListaConBarra(data.movimientos_por_tipo, "tipo", "total");
  } catch (e) {
    console.error(e);
    ["tablaCategoria","tablaSucursal","tablaMovTipo"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<div class="text-danger">No se pudo cargar el dashboard.</div>`;
    });
  }
}

document.addEventListener("DOMContentLoaded", cargarDashboard);
