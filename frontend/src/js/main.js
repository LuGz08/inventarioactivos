// src/js/main.js

// ===================== VERIFICAR SESIÓN =====================
function verificarSesion() {
  const accessToken = localStorage.getItem("accessToken");
  const estaEnLogin = window.location.pathname.includes("login.html");

  // Si NO hay sesión → redirigimos al login
  if (!accessToken && !estaEnLogin) {
    window.location.href = "/paginas/login/login.html";
  }

  // Si ya hay sesión y está en login → enviar al dashboard
  if (accessToken && estaEnLogin) {
    window.location.href = "/index.html";
  }
}

// ===================== CARGAR UI =====================
function cargarUI() {
  verificarSesion();
  cargarTopbar();
  cargarSidebar();
  marcarNavActivo();
  configurarMenuMovil();
  configurarTema();
}

// ===================== TOPBAR =====================
function cargarTopbar() {
  const topbar = document.getElementById("app-topbar");
  if (!topbar) return;

  const usuarioLog = localStorage.getItem("userLogin") || "Usuario";
  const currentPath = window.location.pathname;

  // Botones extras sólo en productos (listar, agregar, editar)
  let accionesProductos = "";
  const esPaginaRelevante =
    currentPath.includes("/paginas/productos/") ||
    currentPath.includes("/paginas/marcas/") ||
    currentPath.includes("/paginas/modelos/") ||
    currentPath.includes("/paginas/cpu/") ||
    currentPath.includes("/paginas/gpu/");

  if (esPaginaRelevante) {
    const activeMarcas = currentPath.includes("/paginas/marcas/") ? "active" : "";
    const activeModelos = currentPath.includes("/paginas/modelos/") ? "active" : "";
    const activeCpu = currentPath.includes("/paginas/cpu/") ? "active" : "";
    const activeGpu = currentPath.includes("/paginas/gpu/") ? "active" : "";

    accionesProductos = `
      <div class="d-none d-md-flex align-items-center gap-2 me-3">
        <a href="/paginas/marcas/listar.html" class="btn btn-outline-light btn-sm ${activeMarcas}">
          <i class="bi bi-tags"></i> Gestionar marcas
        </a>
        <a href="/paginas/modelos/listar.html" class="btn btn-outline-light btn-sm ${activeModelos}">
          <i class="bi bi-diagram-3"></i> Gestionar modelos
        </a>
        <a href="/paginas/cpu/listar.html" class="btn btn-outline-light btn-sm ${activeCpu}">
          <i class="bi bi-cpu"></i> Gestionar CPUs
        </a>
        <a href="/paginas/gpu/listar.html" class="btn btn-outline-light btn-sm ${activeGpu}">
          <i class="bi bi-tags"></i> Gestionar GPUs
        </a>
      </div>
    `;
  }

  topbar.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <button class="btn btn-link text-white d-lg-none p-0 me-2 menu-toggle" type="button">
        <i class="bi bi-list fs-3"></i>
      </button>
    </div>

    ${accionesProductos}

    <div class="d-flex align-items-center gap-3">

      <!-- Notificaciones -->
      <a href="/paginas/notificaciones/listar.html" class="text-white position-relative">
        <i class="bi bi-bell-fill fs-4"></i>
        <span id="badgeNoti"
          class="badge bg-danger position-absolute top-0 start-100 translate-middle p-1 rounded-circle"
          style="display:none;"></span>
      </a>

      <!-- Tema -->
      <span id="btn-dark-toggle" class="toggle-dark" role="button">
        <i class="bi bi-moon-stars-fill" id="dark-icon"></i>
      </span>

      <!-- Usuario -->
      <div class="dropdown">
        <button class="btn btn-sm btn-outline-light dropdown-toggle user-area"
                type="button" data-bs-toggle="dropdown">
          ${usuarioLog}
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><a class="dropdown-item" href="/paginas/ajustes/ajustes.html">Ajustes</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" onclick="cerrarSesion()">Cerrar sesión</a></li>
        </ul>
      </div>

    </div>
  `;
}

// ===================== SIDEBAR =====================
function cargarSidebar() {
  const sidebar = document.getElementById("app-sidebar");
  if (!sidebar) return;

  sidebar.innerHTML = `
<img src="/src/img/logo-coyahue.png" alt="Logo Coyahue" class="logo" />
<nav>
  <a class="nav-link" href="/index.html"><i class="bi bi-grid-fill"></i> Dashboard</a>
  <a class="nav-link" href="/paginas/productos/listar.html"><i class="bi bi-box-seam"></i> Productos</a>
  <a class="nav-link" href="/paginas/categorias/listar.html"><i class="bi bi-tags"></i> Categorías</a>
  <a class="nav-link" href="/paginas/proveedores/listar.html"><i class="bi bi-truck"></i> Proveedores</a>
  <a class="nav-link" href="/paginas/sucursal/listar.html"><i class="bi bi-geo-alt"></i> Sucursales</a>
  <a class="nav-link" href="/paginas/stock/listar.html"><i class="bi bi-collection"></i> Stock</a>
  <a class="nav-link" href="/paginas/reportes/listar.html"><i class="bi bi-graph-up"></i> Reportes</a>
  <a class="nav-link" href="/paginas/notificaciones/listar.html"><i class="bi bi-bell-fill"></i> Notificaciones</a>
  <a class="nav-link" href="/paginas/ajustes/ajustes.html"><i class="bi bi-gear"></i> Ajustes</a>
  <a class="nav-link" href="/paginas/usuarios/listar.html"><i class="bi bi-people-fill"></i> Usuarios</a>
</nav>
`;
}

// ===================== CERRAR SESIÓN =====================
function cerrarSesion() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userLogin");
  window.location.href = "/paginas/login/login.html";
}

// ===================== MARCAR NAV ACTIVO =====================
function marcarNavActivo() {
  const links = document.querySelectorAll(".sidebar nav a");
  const currentPath = window.location.pathname;

  links.forEach(link => {
    const href = link.getAttribute("href");
    if (!href) return;

    if (currentPath.includes(href.replace("/", ""))) {
      link.classList.add("active");
    }
  });
}

// ===================== MENU MOVIL =====================
function configurarMenuMovil() {
  const btnMenu = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  if (!btnMenu || !sidebar) return;

  btnMenu.addEventListener("click", () => sidebar.classList.toggle("open"));
}

// ===================== MODO OSCURO =====================
function configurarTema() {
  const body = document.body;
  const toggle = document.getElementById("btn-dark-toggle");
  const icon = document.getElementById("dark-icon");
  if (!toggle || !icon) return;

  const temaGuardado = localStorage.getItem("theme") || "light";
  if (temaGuardado === "dark") {
    body.classList.add("dark-mode");
    icon.classList.replace("bi-moon-stars-fill", "bi-brightness-high-fill");
  }

  toggle.addEventListener("click", () => {
    const esDark = body.classList.toggle("dark-mode");
    icon.classList.toggle("bi-moon-stars-fill", !esDark);
    icon.classList.toggle("bi-brightness-high-fill", esDark);
    localStorage.setItem("theme", esDark ? "dark" : "light");
  });
}

// ===================== INICIO =====================
document.addEventListener("DOMContentLoaded", cargarUI);
