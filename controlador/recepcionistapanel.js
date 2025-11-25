// controlador/recepcionpanel.js
import { requireLogin, initRoleUI, wireLogout } from './seguridad.js';

// SOLO pueden entrar Recepcionista y Administrador
const usuario = requireLogin(['Recepcionista', 'Administrador']);
initRoleUI(usuario);         
wireLogout('.btn-logout');   

document.addEventListener('DOMContentLoaded', () => {
  const btnMenu = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');

  // Menú hamburguesa (para pantallas pequeñas)
  if (btnMenu && sidebar) {
    btnMenu.addEventListener('click', () => {
      const visible = getComputedStyle(sidebar).display !== 'none';
      sidebar.style.display = visible ? 'none' : 'flex';
    });
  }
});
