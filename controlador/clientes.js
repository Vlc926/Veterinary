import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { requireLogin, initRoleUI, isVet } from './seguridad.js';

// SOLO Administrador y Veterinario pueden entrar a Clientes
const usuario = requireLogin(['Administrador','Recepcionista','Veterinario']);
initRoleUI(usuario);

const esSoloLectura = isVet(usuario); // si quieres que Vet sea solo lectura

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const $ = sel => document.querySelector(sel);

const tbody      = $('#tablaClientes tbody');
const btnAgregar = document.querySelector('.btn-agregar');
const inpBuscar  = $('#buscarEmail');

if (esSoloLectura && btnAgregar) {
  btnAgregar.style.display = 'none';
}

async function cargarClientes(filtroEmail = '') {
  let query = sb.from('clientes')
    .select('nombre, telefono, email, paterno, materno');

  if (filtroEmail.trim()) {
    query = query.ilike('email', `%${filtroEmail.trim()}%`);
  }

  const { data, error } = await query.order('nombre', { ascending: true });

  if (error) {
    console.error('Error cargando clientes:', error);
    alert('No se pudieron cargar los clientes.');
    return;
  }

  renderClientes(data || []);
}

function renderClientes(clientes) {
  tbody.innerHTML = '';

  if (!clientes.length) {
    const colspan = esSoloLectura ? 3 : 4;
    tbody.innerHTML = `<tr><td colspan="${colspan}">No hay clientes.</td></tr>`;
    return;
  }

  for (const c of clientes) {
    const tr = document.createElement('tr');

    if (esSoloLectura) {
      // Vet: sólo lectura, sin columna Acciones
      tr.innerHTML = `
        <td>${c.nombre}</td>
        <td>${c.telefono}</td>
        <td>${c.email ?? ''}</td>
      `;
    } else {
      // Admin / Recepcionista: con Acciones
      tr.innerHTML = `
        <td>${c.nombre}</td>
        <td>${c.telefono}</td>
        <td>${c.email ?? ''}</td>
        <td>
          <button class="btn-editar" data-tel="${c.telefono}">
            <i class="fa-solid fa-pen-to-square"></i> Editar
          </button>
          <button class="btn-eliminar" data-tel="${c.telefono}">
            <i class="fa-solid fa-trash"></i> Eliminar
          </button>
        </td>
      `;
    }

    tbody.appendChild(tr);
  }

  if (!esSoloLectura) {
    // EDITAR: manda ?tel= en la URL
    tbody.querySelectorAll('.btn-editar').forEach(btn => {
      btn.addEventListener('click', () => {
        const tel = btn.dataset.tel;
        window.location.href = `add_cliente.html?tel=${encodeURIComponent(tel)}`;
      });
    });

    // ELIMINAR
    tbody.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tel = btn.dataset.tel;
        if (!confirm('¿Eliminar este cliente?')) return;
        const { error } = await sb.from('clientes').delete().eq('telefono', tel);
        if (error) {
          alert('No se pudo eliminar: ' + error.message);
          console.error(error);
          return;
        }
        alert('Cliente eliminado');
        cargarClientes(inpBuscar?.value || '');
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  cargarClientes();

  inpBuscar?.addEventListener('input', () => {
    cargarClientes(inpBuscar.value || '');
  });
});
