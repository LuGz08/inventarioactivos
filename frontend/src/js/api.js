// src/js/api.js
// Helper global para consumir la API Django protegida con JWT

// Ajusta si tu backend corre en otra URL o puerto
const API_BASE_URL = "http://127.0.0.1:8000";

// Prefijo de las vistas del router:
// Proyecto: path('api/', include('app_inventario.urls'))
// App:      path('api/', include(router.urls))
// → /api/api/<recurso>/
const API_PREFIX = "/api/api";
function buildApiUrl(resource) {
  const clean = String(resource || "").replace(/^\/+/, "");
  return `${API_PREFIX}/${clean}`;
}

// -------------------- Helpers de tokens -------------------- //

function getAccessToken() {
  // AHORA usa las mismas keys que login.js
  return localStorage.getItem("access");
}

function getRefreshToken() {
  return localStorage.getItem("refresh");
}

function setTokens({ access, refresh }) {
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
}

function clearTokens() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("userLogin");
  localStorage.removeItem("username");
  localStorage.removeItem("is_staff");
}

function forceLogout() {
  clearTokens();
  // Ruta real de tu login
  window.location.href = "/paginas/login/login.html";
}

// -------------------- Refresh de token -------------------- //

async function tryRefreshToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data.access) {
      localStorage.setItem("access", data.access);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error al refrescar token:", error);
    return false;
  }
}
// -------------------- Fetch con JWT -------------------- //

async function fetchWithAuth(urlPath, options = {}, { skipAuth = false } = {}) {
  const headers = options.headers ? { ...options.headers } : {};

  if (!skipAuth) {
    const token = getAccessToken();
    if (!token) {
      forceLogout();
      throw new Error("No hay token de acceso, debes iniciar sesión.");
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    options.body = JSON.stringify(options.body);
  }

  // ✅ SI urlPath YA ES ABSOLUTA, NO le pegues API_BASE_URL
  const finalUrl =
    typeof urlPath === "string" && /^https?:\/\//i.test(urlPath)
      ? urlPath
      : `${API_BASE_URL}${urlPath}`;

  const response = await fetch(finalUrl, {
    ...options,
    headers,
  });

  if (response.status === 401 && !skipAuth) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return fetchWithAuth(urlPath, options, { skipAuth });
    forceLogout();
    throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
  }

  if (response.status === 204) return null;

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const isJson =
    contentType.includes("application/json") ||
    contentType.includes("application/problem+json");

  if (!response.ok) {
    if (isJson) {
      const errorData = await response.json().catch(() => null);
      const detail =
        errorData?.detail ||
        errorData?.message ||
        (errorData ? JSON.stringify(errorData) : null);
      throw new Error(detail || `Error HTTP ${response.status}`);
    }

    const text = await response.text().catch(() => "");
    throw new Error(
      `Error HTTP ${response.status} (respuesta no JSON). ` +
        `URL final: ${response.url}. ` +
        `Respuesta: ${(text || "").slice(0, 500)}`
    );
  }

  if (!isJson) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Respuesta inesperada (no JSON). URL final: ${response.url}. ` +
        `Respuesta: ${(text || "").slice(0, 500)}`
    );
  }

  return response.json();
}


// -------------------- Métodos genéricos -------------------- //

async function apiGet(resource, options = {}) {
  return fetchWithAuth(buildApiUrl(resource), { method: "GET", ...options });
}

async function apiPost(resource, body, options = {}) {
  return fetchWithAuth(buildApiUrl(resource), {
    method: "POST",
    body,
    ...options,
  });
}

async function apiPut(resource, body, options = {}) {
  return fetchWithAuth(buildApiUrl(resource), {
    method: "PUT",
    body,
    ...options,
  });
}

async function apiPatch(resource, body, options = {}) {
  return fetchWithAuth(buildApiUrl(resource), {
    method: "PATCH",
    body,
    ...options,
  });
}

async function apiDelete(resource, options = {}) {
  return fetchWithAuth(buildApiUrl(resource), {
    method: "DELETE",
    ...options,
  });
}

// -------------------- Login (sin JWT previo) -------------------- //
// (Opcional, por si en algún lado quisieras loguear con esta API en vez de login.js)

async function login(username, password) {
  const res = await fetch(`${API_BASE_URL}/api/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    let msg = "No se pudo iniciar sesión";
    try {
      const data = await res.json();
      msg = data.detail || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await res.json();

  // Guardamos tokens si vienen
  if (data.access || data.refresh) {
    setTokens({ access: data.access, refresh: data.refresh });
  }
  // Guarda info de usuario si la mandas en el backend
  if (data.user) {
    localStorage.setItem("userLogin", JSON.stringify(data.user));
  }

  return data;
}

// -------------------- Objeto público API -------------------- //

export const API = {
  // Auth
  login,
  forceLogout,

  // Genéricos
  get: apiGet,
  post: apiPost,
  put: apiPut,
  patch: apiPatch,
  delete: apiDelete,

  // Conveniencia: productos
  getProductos: () => apiGet("productos/"),
  getProducto: (id) => apiGet(`productos/${id}/`),
  crearProducto: (payload) => apiPost("productos/", payload),
  actualizarProducto: (id, payload) => apiPut(`productos/${id}/`, payload),
  eliminarProducto: (id) => apiDelete(`productos/${id}/`),

  // Conveniencia: catálogos
  getSucursales: () => apiGet("sucursales/"),
  getCategorias: () => apiGet("categorias/"),
  getEstados: () => apiGet("estados/"),
  getModelos: () => apiGet("modelos/"),
  getProveedores: () => apiGet("proveedores/"),
};

// (Opcional) Exponer también en window para otros scripts no-módulo
if (typeof window !== "undefined") {
  window.API = API;
}
