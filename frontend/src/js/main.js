// src/js/main.js

// ===================== VERIFICAR SESIÓN =====================
function verificarSesion() {
  const accessToken = localStorage.getItem("accessToken");
  const estaEnLogin = window.location.pathname.includes("login.html");

  if (!accessToken && !estaEnLogin) {
    window.location.href = "/paginas/login/login.html";
  }
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

// ===================== TOPBAR GENERATOR =====================
function cargarTopbar() {
  const topbar = document.getElementById("app-topbar");
  if (!topbar) return;

  const usuarioLog = localStorage.getItem("userLogin") || "Usuario";
  const currentPath = window.location.pathname;

  // Botones de acción rápida para productos
  let accionesProductos = "";
  const esPaginaRelevante = 
    currentPath.includes("/paginas/productos/") || 
    currentPath.includes("/paginas/marcas/") || 
    currentPath.includes("/paginas/modelos/") || 
    currentPath.includes("/paginas/cpu/") || 
    currentPath.includes("/paginas/gpu/");

  if (esPaginaRelevante) {
    // Detectar activo para estilo (opcional)
    const btnClass = "btn btn-sm btn-outline-light border-0";
    accionesProductos = `
      <div class="d-none d-lg-flex align-items-center gap-1 me-3">
        <a href="/paginas/marcas/listar.html" class="${btnClass}"><i class="bi bi-tags"></i> Marcas</a>
        <a href="/paginas/modelos/listar.html" class="${btnClass}"><i class="bi bi-diagram-3"></i> Modelos</a>
        <div class="vr bg-light mx-2" style="opacity:0.3"></div>
      </div>
    `;
  }

  topbar.innerHTML = `
    <div class="d-flex align-items-center">
      <button class="menu-toggle me-3" id="menuToggle">
        <i class="bi bi-list"></i>
      </button>
      
      <span class="fw-bold text-white d-lg-none">Inventario</span>
    </div>

    <div class="topbar-right">
      ${accionesProductos}

      <a href="/paginas/notificaciones/listar.html" class="text-white position-relative" title="Notificaciones">
        <i class="bi bi-bell fs-5"></i>
        <span id="badgeNoti" class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle" style="display:none;"></span>
      </a>

      <div class="toggle-dark" id="btn-dark-toggle" title="Cambiar tema">
        <i class="bi bi-moon-stars" id="dark-icon"></i>
      </div>

      <div class="dropdown">
        <a href="#" class="d-flex align-items-center text-decoration-none dropdown-toggle user-area" data-bs-toggle="dropdown">
          <div class="bg-white text-primary rounded-circle d-flex align-items-center justify-content-center me-2" style="width:32px; height:32px; font-weight:bold;">
            ${usuarioLog.charAt(0).toUpperCase()}
          </div>
          <span class="d-none d-md-block">${usuarioLog}</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2">
          <li><h6 class="dropdown-header">Mi Cuenta</h6></li>
          <li><a class="dropdown-item" href="/paginas/ajustes/ajustes.html"><i class="bi bi-gear me-2"></i>Ajustes</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="#" onclick="cerrarSesion()"><i class="bi bi-box-arrow-right me-2"></i>Cerrar sesión</a></li>
        </ul>
      </div>
    </div>
  `;
}

// ===================== SIDEBAR GENERATOR =====================
function cargarSidebar() {
  const sidebar = document.getElementById("app-sidebar");
  if (!sidebar) return;

  // Insertar Overlay para móviles si no existe
  if (!document.getElementById('sidebarOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  sidebar.innerHTML = `
    <div class="logo-container">
      <img src="/src/img/logo-coyahue.png" alt="Logo" class="logo" />
    </div>
    
    <nav class="nav flex-column">
      <small class="ps-3 mb-2">Principal</small>
      <a class="nav-link" href="/index.html"><i class="bi bi-speedometer2"></i> <span>Dashboard</span></a>
      
      <small class="ps-3 mb-2 mt-2">Gestión</small>
      <a class="nav-link" href="/paginas/productos/listar.html"><i class="bi bi-box-seam"></i> <span>Productos</span></a>
      <a class="nav-link" href="/paginas/stock/listar.html"><i class="bi bi-boxes"></i> <span>Stock / Movimientos</span></a>
      <a class="nav-link" href="/paginas/categorias/listar.html"><i class="bi bi-tags"></i> <span>Categorías</span></a>
      <a class="nav-link" href="/paginas/proveedores/listar.html"><i class="bi bi-truck"></i> <span>Proveedores</span></a>
      <a class="nav-link" href="/paginas/sucursal/listar.html"><i class="bi bi-geo-alt"></i> <span>Sucursales</span></a>
      
      <small class="ps-3 mb-2 mt-2">Administración</small>
      <a class="nav-link" href="/paginas/reportes/listar.html"><i class="bi bi-graph-up-arrow"></i> <span>Reportes</span></a>

      <a class="nav-link" href="/paginas/usuarios/listar.html"><i class="bi bi-people"></i> <span>Usuarios</span></a>
      <a class="nav-link" href="/paginas/notificaciones/listar.html"><i class="bi bi-bell"></i> <span>Notificaciones</span></a>
    </nav>
  `;
}

// ===================== LOGOUT =====================
window.cerrarSesion = function() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userLogin");
  window.location.href = "/paginas/login/login.html";
};

// ===================== ACTIVE LINK =====================
function marcarNavActivo() {
  const links = document.querySelectorAll(".sidebar nav a");
  const currentPath = window.location.pathname;

  links.forEach(link => {
    const href = link.getAttribute("href");
    if (!href) return;
    
    // Lógica para marcar activo incluso en subpáginas
    const pathClean = currentPath.split('/').slice(0, 3).join('/'); // /paginas/productos
    const hrefClean = href.split('/').slice(0, 3).join('/'); 

    if (currentPath === href || (href !== "/index.html" && currentPath.includes(hrefClean))) {
      link.classList.add("active");
    }
  });
}

// ===================== MOBILE MENU & OVERLAY =====================
function configurarMenuMovil() {
  const btnToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("app-sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (!btnToggle || !sidebar || !overlay) return;

  function toggleMenu() {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("active");
  }

  // Abrir/Cerrar con botón
  btnToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Cerrar al dar click fuera (en el overlay)
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  });
}

// ===================== MODO OSCURO (PERSISTENTE) =====================
function configurarTema() {
  const body = document.body;
  const toggleBtn = document.getElementById("btn-dark-toggle");
  const icon = document.getElementById("dark-icon");

  if (!toggleBtn || !icon) return;

  const temaGuardado = localStorage.getItem("theme") || "light";
  
  // Aplicar tema inicial
  if (temaGuardado === "dark") {
    body.classList.add("dark-mode");
    icon.classList.replace("bi-moon-stars", "bi-brightness-high");
  }

  toggleBtn.addEventListener("click", () => {
    const esDark = body.classList.toggle("dark-mode");
    
    if (esDark) {
      icon.classList.replace("bi-moon-stars", "bi-brightness-high");
      localStorage.setItem("theme", "dark");
    } else {
      icon.classList.replace("bi-brightness-high", "bi-moon-stars");
      localStorage.setItem("theme", "light");
    }
  });
}

// ===================== INICIO =====================
document.addEventListener("DOMContentLoaded", cargarUI);