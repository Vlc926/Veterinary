// controlador/add_cliente.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { requireLogin, initRoleUI, isVet } from '../controlador/seguridad.js';
//                         👆 sube una carpeta y entra a controlador

const usuario = requireLogin(['Administrador', 'Recepcionista', 'Veterinario']);
initRoleUI(usuario);

const esSoloLectura = isVet(usuario);  // Vet solo ve

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);

const form        = $('#frmCliente');
const inpTelOrig  = $('#tel_original');
const inpNombre   = $('#nombre');
const inpTelefono = $('#telefono');
const inpEmail    = $('#email');
const inpPaterno  = $('#paterno');
const inpMaterno  = $('#materno');

function aplicarPermisosFormulario() {
  if (esSoloLectura) {
    // Vet: deshabilitar todo y ocultar Guardar
    [inpNombre, inpTelefono, inpEmail, inpPaterno, inpMaterno].forEach(el => el && (el.disabled = true));
    const btn = form?.querySelector('button[type="submit"]');
    if (btn) btn.style.display = 'none';

    const aviso = document.createElement('p');
    aviso.textContent = 'Solo puedes consultar los datos del cliente. No tienes permisos para editar.';
    aviso.style.fontStyle = 'italic';
    aviso.style.color = '#555';
    form?.appendChild(aviso);
  }
}

// Cargar datos para edición, si viene ?tel= en la URL
async function tryPrefill() {
  const qs = new URLSearchParams(window.location.search);
  const tel = qs.get('tel');    // 👈 Debe coincidir con clientes.js

  console.log('URL:', window.location.href);
  console.log('Param tel =', tel);

  if (!tel) return; // modo "nuevo"

  const { data, error } = await sb
    .from('clientes')
    .select('nombre, telefono, email, paterno, materno')
    .eq('telefono', tel)
    .maybeSingle();

  console.log('Resultado Supabase:', { data, error });

  if (error) {
    console.error('Error cargando cliente:', error);
    alert('No se pudo cargar el cliente para edición.');
    return;
  }
  if (!data) {
    alert('No se encontró el cliente con ese teléfono.');
    return;
  }

  // Guardamos el teléfono original por si el usuario lo modifica
  if (inpTelOrig)  inpTelOrig.value  = data.telefono;
  if (inpNombre)   inpNombre.value   = data.nombre   ?? '';
  if (inpTelefono) inpTelefono.value = data.telefono ?? '';
  if (inpEmail)    inpEmail.value    = data.email    ?? '';
  if (inpPaterno)  inpPaterno.value  = data.paterno  ?? '';
  if (inpMaterno)  inpMaterno.value  = data.materno  ?? '';
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (esSoloLectura) {
    alert('No tienes permisos para guardar cambios.');
    return;
  }

  const nombre   = inpNombre.value.trim();
  const telefono = inpTelefono.value.trim();
  const email    = inpEmail.value.trim() || null;
  const paterno  = inpPaterno.value.trim() || null;
  const materno  = inpMaterno.value.trim() || null;

  if (!nombre || !telefono) {
    alert('Nombre y teléfono son obligatorios.');
    return;
  }

  const payload = { nombre, telefono, email, paterno, materno };
  let error;

  if (inpTelOrig && inpTelOrig.value) {
    // Modo edición
    const telOriginal = inpTelOrig.value;
    ({ error } = await sb
      .from('clientes')
      .update(payload)
      .eq('telefono', telOriginal));
  } else {
    // Modo nuevo
    ({ error } = await sb
      .from('clientes')
      .insert(payload));
  }

  if (error) {
    alert('No se pudo guardar: ' + error.message);
    console.error(error);
    return;
  }

  alert('Cliente guardado correctamente.');
  window.location.href = 'clientes.html';
});

document.addEventListener('DOMContentLoaded', async () => {
  await tryPrefill();
  aplicarPermisosFormulario();
});
