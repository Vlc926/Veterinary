// modelo/add_cita.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { requireLogin, initRoleUI } from '../controlador/seguridad.js';

// Admin y Recepcionista pueden usar este formulario
const usuario = requireLogin(['Administrador', 'Recepcionista']);
initRoleUI(usuario);

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $  = (s) => document.querySelector(s);

const form        = $('#frmCita');
const inpId       = $('#id');
const selMascota  = $('#mascota_id');
const selServicio = $('#servicio_id');
const selVet      = $('#veterinario_id');
const inpFecha    = $('#fecha');
const selEstado   = $('#estado');

let MASCOTAS     = [];
let SERVICIOS    = [];
let VETERINARIOS = [];

// ================== CARGAR MASCOTAS ==================
async function cargarMascotas() {
  const { data, error } = await sb
    .from('mascotas')
    .select('id,nombre,cli_tel')
    .order('nombre', { ascending: true });

  if (error) {
    console.error(error);
    alert('No se pudieron cargar las mascotas');
    return;
  }

  MASCOTAS = data || [];
  selMascota.innerHTML = '<option value="">Seleccione...</option>';

  MASCOTAS.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.nombre} (${m.cli_tel})`;
    selMascota.appendChild(opt);
  });
}

// ================== CARGAR SERVICIOS ==================
async function cargarServicios() {
  const { data, error } = await sb
    .from('servicios')
    .select('id,nombre')
    .order('nombre', { ascending: true });

  if (error) {
    console.error(error);
    alert('No se pudieron cargar los servicios');
    return;
  }

  SERVICIOS = data || [];
  selServicio.innerHTML = '<option value="">Seleccione...</option>';

  SERVICIOS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.nombre;
    selServicio.appendChild(opt);
  });
}

// ================== CARGAR VETERINARIOS ==================
async function cargarVeterinarios() {
  const { data, error } = await sb
    .from('usuarios')
    .select('id,nombre,telefono,rol_id,roles:roles(nombre)')
    .order('nombre', { ascending: true });

  if (error) {
    console.error(error);
    alert('No se pudieron cargar los veterinarios');
    return;
  }

  // Filtramos solo los que tengan rol "Veterinario"
  VETERINARIOS = (data || []).filter(u => {
    const rolNombre = (u.roles?.nombre || '').toLowerCase();
    return rolNombre === 'veterinario';
  });

  selVet.innerHTML = '<option value="">Seleccione...</option>';

  VETERINARIOS.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.nombre} (${v.telefono ?? ''})`;
    selVet.appendChild(opt);
  });
}

// helper para formatear timestamptz -> value de datetime-local
function toInputDateTimeValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm   = pad(d.getMonth() + 1);
  const dd   = pad(d.getDate());
  const hh   = pad(d.getHours());
  const mi   = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// ================== PREFILL SI VIENE ?id= ==================
async function tryPrefillFromQuery() {
  const qsId = new URLSearchParams(location.search).get('id');
  if (!qsId) return;

  const idNum  = Number(qsId);
  const filter = Number.isFinite(idNum) ? idNum : qsId;

  const { data, error } = await sb
    .from('citas')
    .select(`
      id,
      fecha,
      estado,
      servicios_id,
      mascotas_id,
      veterinario_id
    `)
    .eq('id', filter)
    .maybeSingle();

  if (error) {
    console.error(error);
    alert('No se pudo cargar la cita: ' + error.message);
    return;
  }
  if (!data) {
    alert(`No existe la cita con id=${qsId}`);
    return;
  }

  inpId.value    = data.id;
  inpFecha.value = toInputDateTimeValue(data.fecha);
  if (selEstado) selEstado.value = data.estado || '';

  if (data.mascotas_id)    selMascota.value  = String(data.mascotas_id);
  if (data.servicios_id)   selServicio.value = String(data.servicios_id);
  if (data.veterinario_id) selVet.value      = String(data.veterinario_id);
}

// ================== SUBMIT ==================
form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const idCita      = inpId.value ? Number(inpId.value) : null;
  const mascota_id  = selMascota.value  ? Number(selMascota.value)  : null;
  const servicio_id = selServicio.value ? Number(selServicio.value) : null;
const vet_id = selVet.value || null;
  const fechaStr    = inpFecha.value; // "YYYY-MM-DDTHH:MM"
  const estado      = selEstado ? (selEstado.value || null) : null;

  if (!fechaStr) {
    alert('La fecha y hora son obligatorias');
    return;
  }
  if (!mascota_id || !servicio_id) {
    alert('Selecciona mascota y servicio');
    return;
  }
  if (!vet_id) {
    alert('Selecciona el veterinario');
    return;
  }

  // Obtener teléfono del cliente a partir de la mascota
  const mascota = MASCOTAS.find(m => m.id === mascota_id);
  if (!mascota) {
    alert('No se encontró la mascota seleccionada');
    return;
  }
  const cli_tel = mascota.cli_tel;

  const payload = {
    fecha:          fechaStr,
    estado:         estado || 'PENDIENTE',
    servicios_id:   servicio_id,
    mascotas_id:    mascota_id,
    veterinario_id: vet_id,
    cli_tel
  };

  let error;
  if (idCita) {
    ({ error } = await sb.from('citas').update(payload).eq('id', idCita));
  } else {
    ({ error } = await sb.from('citas').insert(payload));
  }

  if (error) {
    console.error(error);
    alert('No se pudo guardar la cita: ' + error.message);
    return;
  }

  alert('Cita guardada');
  location.href = 'citas.html';
});

// ================== INIT ==================
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    cargarMascotas(),
    cargarServicios(),
    cargarVeterinarios()
  ]);
  await tryPrefillFromQuery();
});
