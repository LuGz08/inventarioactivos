// src/js/login.js
// Login real contra Django + SimpleJWT
// Distingue entre staff y no staff para redirigir a panel correspondiente.

const API_BASE_URL = "/api/";
const LOGIN_URL = API_BASE_URL + "auth/token/";

// Ajusta estas rutas a tu gusto:
const ADMIN_DASHBOARD_URL = "/index.html";
const USER_DASHBOARD_URL = "/paginas/usuario/panel.html";

// --- Helpers de UI ---

function showError(msg) {
  if (window.Swal) {
    Swal.fire({
      icon: "error",
      title: "Error al iniciar sesión",
      text: msg || "Revisa tus credenciales.",
    });
  } else {
    alert("Error: " + msg);
  }
}

function showSuccess(msg) {
  if (window.Swal) {
    Swal.fire({
      icon: "success",
      title: msg || "Inicio de sesión correcto",
      showConfirmButton: false,
      timer: 1200,
    });
  }
}

// --- Decodificar JWT (para sacar is_staff y username) ---

function decodeJwt(token) {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    // base64url -> base64
    let base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    // padding
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    const json = atob(base64);
    return JSON.parse(json);
  } catch (e) {
    console.error("No se pudo decodificar el token:", e);
    return null;
  }
}

// --- Llamada al backend para login ---

async function loginDjango(username, password) {
  const resp = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  if (!resp.ok) {
    let msg = "Credenciales inválidas.";
    try {
      const data = await resp.json();
      if (data.detail) msg = data.detail;
    } catch (e) {
      // ignoramos si no viene JSON legible
    }
    throw new Error(msg);
  }

  // data: { access, refresh }
  const data = await resp.json();
  return data;
}

// --- Manejo del formulario ---

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const inputUsuario = document.getElementById("usuario");
  const inputPass = document.getElementById("contrasena");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = inputUsuario?.value.trim();
    const password = inputPass?.value.trim();

    if (!username || !password) {
      showError("Debes ingresar usuario y contraseña.");
      return;
    }

    const btn = form.querySelector("button[type='submit']");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Ingresando...';
    }

    try {
      const tokens = await loginDjango(username, password);
      const { access, refresh } = tokens;

      // Decodificar token para saber si es staff
      const payload = decodeJwt(access) || {};
      const isStaff = !!payload.is_staff;
      const tokenUsername = payload.username || username;

      // Guardar en localStorage para uso del resto de la app

      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      localStorage.setItem("username", tokenUsername);
      localStorage.setItem("is_staff", isStaff ? "1" : "0");
      localStorage.setItem("accessToken", access);   
      localStorage.setItem("refreshToken", refresh);

      showSuccess(
        isStaff
          ? "Bienvenido al panel de administración"
          : "Bienvenido al panel de usuario"
      );

      // Redirigir según el tipo de usuario
      setTimeout(() => {
        if (isStaff) {
          window.location.href = ADMIN_DASHBOARD_URL;
        } else {
          window.location.href = USER_DASHBOARD_URL;
        }
      }, 800);
    } catch (err) {
      console.error("Error de login:", err);
      showError(err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "Ingresar";
      }
    }
  });
});
