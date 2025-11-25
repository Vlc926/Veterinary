// controlador/seguridad.js

// ---- Sesión ----
export function getUsuarioActual() {
  try {
    const raw = localStorage.getItem('veterinaryUser');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Error leyendo usuario de localStorage', e);
    return null;
  }
}

function normalizarRol(rol) {
  return (rol || '').trim().toLowerCase();
}

/**
 * Verifica sesión y rol.
 * - Si no hay sesión -> login.html
 * - Si el rol NO está permitido -> alerta y manda a index.html
 */
export function requireLogin(rolesPermitidos = null) {
  const user = getUsuarioActual();

  if (!user) {
    window.location.href = 'login.html';
    return null;
  }

  const rolUser = normalizarRol(user.rolNombre);

  if (rolesPermitidos && rolesPermitidos.length) {
    const permitidos = rolesPermitidos.map(normalizarRol);
    if (!permitidos.includes(rolUser)) {
      alert('Acceso restringido.');
      window.location.href = 'index.html';
      return null;
    }
  }

  return user;
}

// Helpers
export function isAdmin(user) {
  return normalizarRol(user?.rolNombre) === 'administrador';
}
export function isVet(user) {
  return normalizarRol(user?.rolNombre) === 'veterinario';
}
export function isRecep(user) {
  return normalizarRol(user?.rolNombre) === 'recepcionista';
}

// ---- Permisos de alto nivel ----
// Aquí definimos claramente qué puede hacer cada tipo de usuario.

export function puedeVerCuentas(user) {
  // Solo el administrador puede ver el módulo de cuentas
  return isAdmin(user);
}

export function puedeEditarCuentas(user) {
  // Solo el administrador puede crear / editar / borrar cuentas
  return isAdmin(user);
}

/**
 * Quién puede programar / administrar citas en el módulo "Citas":
 *  - Administrador
 *  - Recepcionista
 */
export function puedeProgramarCitas(user) {
  const rol = normalizarRol(user?.rolNombre);
  return rol === 'administrador' || rol === 'recepcionista';
}

/**
 * Quién puede usar el módulo "Mis Citas" (vista del veterinario)
 */
export function puedeVerMisCitas(user) {
  return isVet(user);
}


// ---- Logout ----
export function logout() {
  localStorage.removeItem('veterinaryUser');
  window.location.href = 'login.html';
}

export function wireLogout(selector = '.btn-logout') {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(selector).forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
    });
  });
}

// ---- UI por rol (chip + menú) ----
export function initRoleUI(userParam = null) {
  const user = userParam || getUsuarioActual();
  if (!user) return;

  const rolOriginal = user.rolNombre || 'Sin rol';
  const rolLower    = normalizarRol(user.rolNombre);
  const correo      = user.user || user.correo || '';

  document.addEventListener('DOMContentLoaded', () => {
    // chip arriba a la derecha
    const indicator = document.querySelector('[data-user-indicator]');
    if (indicator) {
      indicator.textContent = `${rolOriginal} | ${correo}`;
    }

    // menú lateral filtrado por rol usando data-roles
    document.querySelectorAll('[data-roles]').forEach(link => {
      const rolesStr = link.getAttribute('data-roles') || '';
      const roles = rolesStr
        .split(',')
        .map(r => normalizarRol(r))
        .filter(Boolean);

      if (roles.length && !roles.includes(rolLower)) {
        link.style.display = 'none';
      } else {
        link.style.display = '';
      }
    });

    // >>> Ajuste ESPECIAL del enlace "Mascotas" según el rol
    const linkMascotas = document.querySelector('#linkMascotas');
    if (linkMascotas) {
      if (isVet(user)) {
        // Si es veterinario: ver solo sus mascotas
        linkMascotas.href = 'mis_mascotas.html';
        linkMascotas.innerHTML = `
          <i class="fa-solid fa-dog"></i>
          <span class="nav-text">Mis mascotas</span>
        `;
      } else {
        // Admin / Recepción: ver todas las mascotas
        linkMascotas.href = 'mascotas.html';
        linkMascotas.innerHTML = `
          <i class="fa-solid fa-dog"></i>
          <span class="nav-text">Mascotas</span>
        `;
      }
    }
    // <<< fin ajuste especial
  });
}
