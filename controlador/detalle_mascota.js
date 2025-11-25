// controlador/detalle_mascota.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { requireLogin, initRoleUI, wireLogout, isVet, isAdmin } from './seguridad.js';

// Veterinario, Recepcionista y Admin pueden ver el detalle
const usuario       = requireLogin(['Veterinario', 'Recepcionista', 'Administrador']);
// Vet o Admin pueden editar datos clínicos
const puedeEditarClinico = isVet(usuario) || isAdmin(usuario);

initRoleUI(usuario);
wireLogout();

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $  = (s) => document.querySelector(s);

const contFoto  = $('#fotoMascota');
const lblNombre = $('#nombreMascota');
const lblEdad   = $('#edadMascota');
const lblColor  = $('#colorMascota');
const lblTel    = $('#telDuenio');

const form      = $('#frmDetalleMascota');
const inpId     = $('#idMascota');
const inpPeso   = $('#pesoMascota');
const txtDiag   = $('#diagnostico');
const txtTrat   = $('#tratamiento');

// ================== HELPERS ==================
function getMascotaIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const idStr  = params.get('id');
  const idNum  = idStr ? Number(idStr) : null;
  return Number.isFinite(idNum) ? idNum : null;
}

// ================== CARGAR DETALLE ==================
async function cargarDetalleMascota() {
  if (!form) return;

  const idMascota = getMascotaIdFromQuery();

  if (!idMascota) {
    form.innerHTML = `
      <p class="error">No se recibió el identificador de la mascota.</p>
    `;
    return;
  }

  const { data, error } = await sb
    .from('mascotas')
    .select(`
      id,
      nombre,
      edad_anios,
      edad_meses,
      peso_kg,
      color,
      foto_url,
      cli_tel,
      diagnostico,
      tratamiento
    `)
    .eq('id', idMascota)
    .maybeSingle();

  if (error) {
    console.error(error);
    form.innerHTML = `
      <p class="error">No se pudo cargar la mascota: ${error.message}</p>
    `;
    return;
  }

  if (!data) {
    form.innerHTML = `
      <p class="error">No se encontró la mascota con id=${idMascota}.</p>
    `;
    return;
  }

  const m = data;

  inpId.value       = m.id;
  lblNombre.textContent = m.nombre || 'Mascota';

  const edadStr = (m.edad_anios ?? m.edad_meses) != null
    ? `${m.edad_anios ?? 0} años ${m.edad_meses ?? 0} meses`
    : 'No especificada';

  lblEdad.textContent  = edadStr;
  inpPeso.value        = m.peso_kg ?? '';
  lblColor.textContent = m.color || '-';
  lblTel.textContent   = m.cli_tel || '-';

  contFoto.innerHTML = m.foto_url
    ? `<img src="${m.foto_url}" alt="${m.nombre}" class="detalle-img">`
    : '<div class="foto-placeholder">Sin foto</div>';

  txtDiag.value = m.diagnostico || '';
  txtTrat.value = m.tratamiento || '';

  // 🔒 Si NO puede editar (no es vet ni admin): solo lectura y SIN botón
  if (!puedeEditarClinico) {
    inpPeso.disabled = true;
    txtDiag.disabled = true;
    txtTrat.disabled = true;

    const btnGuardar = form.querySelector('button[type="submit"]');
    if (btnGuardar) {
      // lo quitamos del DOM para que ni se vea
      btnGuardar.remove();
    }
  }
}

// ================== GUARDAR CAMBIOS (solo vet / admin) ==================
form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Por seguridad extra, si alguien forzara el submit vía consola:
  if (!puedeEditarClinico) {
    alert('No tienes permiso para modificar los datos clínicos de la mascota.');
    return;
  }

  const idMascota = Number(inpId.value);
  if (!idMascota) {
    alert('No se encontró el ID de la mascota.');
    return;
  }

  const pesoVal = inpPeso.value.trim();
  const pesoNum = pesoVal === '' ? null : Number(pesoVal);

  if (pesoVal !== '' && !Number.isFinite(pesoNum)) {
    alert('El peso debe ser un número válido.');
    inpPeso.focus();
    return;
  }

  const diagnostico = txtDiag.value.trim();
  const tratamiento = txtTrat.value.trim();

  const { error } = await sb
    .from('mascotas')
    .update({
      peso_kg:      pesoNum,
      diagnostico:  diagnostico || null,
      tratamiento:  tratamiento || null,
    })
    .eq('id', idMascota);

  if (error) {
    console.error(error);
    alert('No se pudieron guardar los cambios: ' + error.message);
    return;
  }

  alert('Datos de la mascota actualizados correctamente.');
});

// ================== INIT ==================
document.addEventListener('DOMContentLoaded', () => {
  cargarDetalleMascota();
});
