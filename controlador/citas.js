// controlador/citas.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { requireLogin, initRoleUI, puedeProgramarCitas } from './seguridad.js';

// Solo Admin, Vet y Recepcionista pueden entrar a este módulo
const usuario = requireLogin(['Administrador', 'Veterinario', 'Recepcionista']);
if (!usuario || !puedeProgramarCitas(usuario)) {
  alert('No tienes permiso para programar o administrar citas.');
  window.location.href = 'index.html';
}

initRoleUI(usuario);

const sb  = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $   = (s) => document.querySelector(s);
const tbody      = $('#tablaCitas tbody');
const btnMenu    = document.querySelector('.menu-toggle');
const inpBuscar  = $('#busquedaCitas');   // ⬅️ input de búsqueda

// Guardamos todas las citas para poder filtrar en memoria
let todasLasCitas = [];

function render(rows = []) {
  tbody.innerHTML = '';

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7">No hay citas.</td></tr>';
    return;
  }

  for (const c of rows) {
    const fecha = new Date(c.fecha);
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${fecha.toLocaleString('es-MX')}</td>
      <td>${c.cliente?.nombre ?? ''}</td>
      <td>${c.mascota?.nombre ?? ''}</td>
      <td>${c.servicio?.nombre ?? ''}</td>
      <td>${c.estado ?? ''}</td>
      <td>${c.cli_tel ?? ''}</td>
      <td>
        <button class="btn-editar" data-id="${c.id}">
          <i class="fa-solid fa-pen-to-square"></i> Editar
        </button>
        <button class="btn-eliminar" data-id="${c.id}">
          <i class="fa-solid fa-trash"></i> Eliminar
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  }

  // <<<<< Botones EDITAR >>>>>
  tbody.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      window.location.href = `add_cita.html?id=${id}`;
    });
  });

  // <<<<< Botones ELIMINAR >>>>>
  tbody.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const ok = confirm('¿Seguro que deseas eliminar esta cita?');
      if (!ok) return;

      const { error } = await sb
        .from('citas')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(error);
        alert('No se pudo eliminar la cita: ' + error.message);
        return;
      }

      alert('Cita eliminada correctamente.');
      cargar(); // recargar la tabla
    });
  });
}

// 🔍 Filtrar citas por nombre de cliente
function filtrarPorCliente(texto) {
  const termino = texto.trim().toLowerCase();

  if (!termino) {
    // Si no hay texto, mostramos todas las citas
    render(todasLasCitas);
    return;
  }

  const filtradas = todasLasCitas.filter(cita => {
    const nombreCliente = (cita.cliente?.nombre ?? '').toLowerCase();
    return nombreCliente.includes(termino);
  });

  render(filtradas);
}

async function cargar() {
  const { data, error } = await sb
    .from('citas')
    .select(`
      id,
      fecha,
      estado,
      cli_tel,
      cliente:clientes(nombre),
      mascota:mascotas(nombre),
      servicio:servicios(nombre)
    `)
    .order('fecha', { ascending: true });

  if (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="7">Error al cargar citas</td></tr>';
    return;
  }

  // Guardamos todas las citas en memoria para poder filtrar
  todasLasCitas = data || [];
  render(todasLasCitas);
}

// Toggle menú lateral
btnMenu?.addEventListener('click', () => {
  const sidebar = document.querySelector('.sidebar');
  const visible = getComputedStyle(sidebar).display !== 'none';
  sidebar.style.display = visible ? 'none' : 'flex';
});

// Evento de búsqueda (se dispara en cada tecla)
inpBuscar?.addEventListener('input', (e) => {
  filtrarPorCliente(e.target.value);
});

document.addEventListener('DOMContentLoaded', cargar);
