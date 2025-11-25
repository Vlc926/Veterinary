// controlador/mascotas.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { requireLogin, initRoleUI } from './seguridad.js';

// Admin, Recepcionista (y opcionalmente Veterinario) pueden entrar
const usuario = requireLogin(['Administrador', 'Recepcionista', 'Veterinario']);
initRoleUI(usuario);

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// Helpers
const $        = (s) => document.querySelector(s);
const tbody    = $('#tablaMascotas tbody');
const btnMenu  = document.querySelector('.menu-toggle');
const inpBuscar = $('#q');

let RAZAS = []; // catálogo de razas

// Mapea especie_id -> etiqueta si tu tabla Razas no trae el texto
const especieIdToText = (id) => ({ 1: 'Perro', 2: 'Gato' })[Number(id)] ?? '';

// Limpia teléfono para búsquedas
const cleanPhone = (s) => (s || '').replace(/[^\d+]/g, '');

// ---------- Carga Razas ----------
async function cargarRazas() {
  let res = await sb.from('Razas').select('id, nombre, especie, especie_id');
  if (res.error) res = await sb.from('razas').select('id, nombre, especie, especie_id');
  if (res.error) {
    console.error(res.error);
    alert('No se pudieron cargar las razas: ' + res.error.message);
    RAZAS = [];
    return;
  }
  RAZAS = res.data || [];
}

// ---------- Utilidades de render ----------
const razaById = (id) => RAZAS.find(r => String(r.id) === String(id));

const formatEdad = (anios, meses) => {
  if (anios == null && meses == null) return '-';
  const a = anios ?? 0;
  const m = meses ?? 0;
  if (m === 0) return `${a} año${a === 1 ? '' : 's'}`;
  return `${a} año${a === 1 ? '' : 's'} ${m} mes${m === 1 ? '' : 'es'}`;
};

function renderTabla(rows) {
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!rows?.length) {
    tbody.innerHTML = '<tr><td colspan="8">No hay mascotas registradas.</td></tr>';
    return;
  }

  for (const m of rows) {
    const r          = razaById(m.raza_id);
    const especieTxt = (r?.especie) ?? especieIdToText(r?.especie_id);
    const razaTxt    = r?.nombre || '-';
    const edadTxt    = formatEdad(m.edad_anios, m.edad_meses);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        ${
          m.foto_url
            ? `<img src="${m.foto_url}" alt="${m.nombre}" class="foto-tabla">`
            : '-'
        }
      </td>
      <td>${m.nombre || '-'}</td>
      <td>${especieTxt || '-'}</td>
      <td>${razaTxt}</td>
      <td>${edadTxt}</td>
      <td>${m.peso_kg ?? '-'}</td>
      <td>${m.cli_tel || '-'}</td>
      <td>
        <button class="btn-secundario btn-detalle" data-id="${m.id}">
          <i class="fa-solid fa-eye"></i> Ver detalles
        </button>
        <button class="btn-primario btn-editar" data-id="${m.id}">
          <i class="fa-solid fa-pen"></i> Editar
        </button>
        <button class="btn-peligro btn-eliminar" data-id="${m.id}">
          <i class="fa-solid fa-trash"></i> Eliminar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

// ---------- Listado completo ----------
async function cargarMascotas() {
  const { data, error } = await sb
    .from('mascotas')
    .select(`
      id,
      nombre,
      edad_anios,
      edad_meses,
      peso_kg,
      color,
      cli_tel,
      raza_id,
      foto_url,
      diagnostico,
      tratamiento
    `)
    .order('id', { ascending: true });

  if (error) {
    console.error(error);
    alert('No se pudieron cargar las mascotas: ' + error.message);
    return;
  }
  renderTabla(data);
}

// ---------- Búsqueda por teléfono ----------
async function buscarPorTelefono(term) {
  const t = cleanPhone(term);
  if (!t) return cargarMascotas();

  const { data, error } = await sb
    .from('mascotas')
    .select(`
      id,
      nombre,
      edad_anios,
      edad_meses,
      peso_kg,
      color,
      cli_tel,
      raza_id,
      foto_url,
      diagnostico,
      tratamiento
    `)
    .ilike('cli_tel', `%${t}%`)
    .order('id', { ascending: true })
    .limit(500);

  if (error) {
    console.error(error);
    alert('No se pudo buscar: ' + error.message);
    return;
  }

  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="8">Sin resultados.</td></tr>';
    return;
  }
  renderTabla(data);
}

// ---------- Acciones Ver detalle / Editar / Eliminar (delegadas) ----------
tbody?.addEventListener('click', async (e) => {
  const btnDetalle = e.target.closest('.btn-detalle');
  const btnEdit    = e.target.closest('.btn-editar');
  const btnDel     = e.target.closest('.btn-eliminar');

  if (btnDetalle) {
    const id = btnDetalle.dataset.id;
    if (id) {
      window.location.href = `detalle_mascota.html?id=${id}`;
    }
    return;
  }

if (btnEdit) {
  const id = btnEdit.dataset.id;
  if (id) {
    location.href = `add_mascota.html?id=${id}`; // mismo nombre que el archivo
  }
  return;
}


if (btnDel) {
  const id = Number(btnDel.dataset.id);
  if (!id) return;
  if (!confirm('¿Eliminar esta mascota?')) return;

  const { error } = await sb.from('mascotas').delete().eq('id', id);

  if (error) {
    console.error(error);

    if (error.code === '23503') {
      alert(
        'No se puede eliminar la mascota porque tiene citas registradas.\n' +
        'Primero elimina o re-asigna esas citas.'
      );
    } else {
      alert('No se pudo eliminar la mascota: ' + error.message);
    }
    return;
  }

  await cargarMascotas();
}

});

// ---------- Toggle del menú lateral ----------
btnMenu?.addEventListener('click', () => {
  const sidebar = document.querySelector('.sidebar');
  const visible = getComputedStyle(sidebar).display !== 'none';
  sidebar.style.display = visible ? 'none' : 'flex';
});

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  await cargarRazas();
  await cargarMascotas();
});

// ---------- Debounce del buscador ----------
let searchTimer = null;
inpBuscar?.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => buscarPorTelefono(inpBuscar.value), 250);
});
