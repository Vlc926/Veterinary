// controlador/servicios.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { requireLogin, initRoleUI } from './seguridad.js';

// Solo Administrador / Recepcionista pueden gestionar servicios:
const usuario = requireLogin(['Administrador', 'Recepcionista']);

// Inicializar perfil + menú por rol
initRoleUI(usuario);

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $  = (s) => document.querySelector(s);

const tbody       = $('#tablaServicios tbody');
const inputBuscar = $('#buscarNombre');
const btnMenu     = document.querySelector('.menu-toggle');

let SERVICIOS = [];

// Render de la tabla
function render(lista) {
  tbody.innerHTML = '';

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="5">No hay servicios.</td></tr>';
    return;
  }

  lista.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.nombre}</td>
      <td>${s.descripcion ?? ''}</td>
      <td>${s.costo != null ? `$${s.costo}` : ''}</td>
      <td>${s.duracion ?? ''}</td>
      <td>
        <button class="btn-agendar" data-id="${s.id}">
          <i class="fa-solid fa-calendar-plus"></i> Agendar cita
        </button>

        <button class="btn-editar" data-id="${s.id}">
          <i class="fa-solid fa-pen-to-square"></i> Editar
        </button>

        <button class="btn-eliminar" data-id="${s.id}">
          <i class="fa-solid fa-trash"></i> Eliminar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Eventos de Agendar Cita
  tbody.querySelectorAll('.btn-agendar').forEach(btn => {
    btn.addEventListener('click', () => {
      const idServicio = btn.dataset.id;
      window.location.href = `add_cita.html?servicio_id=${idServicio}`;
    });
  });

  // Eventos de Editar
  tbody.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => {
      const idServicio = btn.dataset.id;
      window.location.href = `add_servicio.html?id=${idServicio}`;
    });
  });

  // Eventos de Eliminar (revisando primero si hay citas ligadas)
  tbody.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idServicio = btn.dataset.id;
      const ok = confirm('¿Seguro que deseas eliminar este servicio?');
      if (!ok) return;

      // 1. Verificar si existen citas que usen este servicio
      const { data: citas, error: errCitas } = await sb
        .from('citas')
        .select('id')
        .eq('servicios_id', idServicio)
        .limit(1); // solo se necesita saber si hay al menos una

      if (errCitas) {
        console.error(errCitas);
        alert('Error al revisar si el servicio tiene citas: ' + errCitas.message);
        return;
      }

      if (citas && citas.length > 0) {
        alert(
          'No se puede eliminar el servicio porque tiene citas registradas.\n' +
          'Primero elimina o reprograma esas citas.'
        );
        return;
      }

      // 2. Si no hay citas vinculadas, ahora sí se elimina
      const { error } = await sb
        .from('servicios')
        .delete()
        .eq('id', idServicio);

      if (error) {
        console.error(error);
        alert('No se pudo eliminar el servicio: ' + error.message);
        return;
      }

      alert('Servicio eliminado');
      cargarServicios(); // recargar lista
    });
  });
}

// Cargar servicios desde Supabase
async function cargarServicios() {
  const { data, error } = await sb
    .from('servicios')
    .select('id, nombre, descripcion, costo, duracion')
    .order('nombre', { ascending: true });

  if (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="5">Error al cargar servicios.</td></tr>';
    return;
  }

  SERVICIOS = data || [];
  aplicarFiltro();
}

// Filtro por nombre (inputBuscar)
function aplicarFiltro() {
  const term = (inputBuscar?.value || '').toLowerCase().trim();

  if (!term) {
    render(SERVICIOS);
    return;
  }

  const filtrados = SERVICIOS.filter(s =>
    (s.nombre || '').toLowerCase().includes(term)
  );

  render(filtrados);
}

// Evento de búsqueda
inputBuscar?.addEventListener('input', () => {
  aplicarFiltro();
});

// Toggle del menú lateral en pantallas pequeñas
btnMenu?.addEventListener('click', () => {
  const sidebar = document.querySelector('.sidebar');
  const visible = getComputedStyle(sidebar).display !== 'none';
  sidebar.style.display = visible ? 'none' : 'flex';
});

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  cargarServicios();
});
