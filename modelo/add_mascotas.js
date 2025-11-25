// modelo/add_mascotas.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { requireLogin, isRecep } from '../controlador/seguridad.js';

const usuario = requireLogin(['Administrador', 'Recepcionista', 'Veterinario']);
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const $ = (s) => document.querySelector(s);

// refs del formulario
const form            = $('#frmMascota');
const inpId           = $('#id');
const inpNom          = $('#nombre');
const inpEdadAnios    = $('#edad_anios');
const inpEdadMeses    = $('#edad_meses');
const selEsp          = $('#especie');
const selRaza         = $('#raza');
const inpTel          = $('#duenio_tel');
const txtObs          = $('#observaciones');
const inpTratamiento  = $('#tratamiento');
const inpPeso         = $('#peso_kg');
const inpColor        = $('#color');
const inpFoto         = $('#foto');
const imgPrev         = $('#prevFoto');

let RAZAS = [];
let OBS_FIELD = 'observaciones';

// detecta si la columna se llama observaciones u observacionesM
async function detectObsField() {
  let r = await sb.from('mascotas').select('id,observaciones').limit(1);
  if (!r.error) { OBS_FIELD = 'observaciones'; return; }
  r = await sb.from('mascotas').select('id,observacionesM').limit(1);
  if (!r.error) { OBS_FIELD = 'observacionesM'; return; }
  OBS_FIELD = 'observacionesM'; // por defecto
}

// cargar razas
async function loadRazas() {
  let res = await sb.from('Razas').select('id, nombre, especie, especie_id').order('id');
  if (res.error) res = await sb.from('razas').select('id, nombre, especie, especie_id').order('id');
  if (res.error) { alert('No se pudieron cargar razas'); RAZAS = []; return; }
  RAZAS = res.data || [];
}

// llenar razas según especie seleccionada
function fillRazas() {
  const filtro = (selEsp.value || '').toLowerCase();
  selRaza.innerHTML = '';
  selRaza.appendChild(new Option('Selecciona raza', ''));

  const mapIdToName = { 1: 'perro', 2: 'gato' };
  const lista = RAZAS.filter(r => {
    if (!filtro) return true;
    const espTxt   = (r.especie || '').toLowerCase();
    const espIdTxt = mapIdToName[r.especie_id] || '';
    return espTxt === filtro || espIdTxt === filtro;
  });

  for (const r of lista) {
    selRaza.appendChild(new Option(r.nombre ?? `#${r.id}`, r.id));
  }
  selRaza.disabled = selRaza.options.length <= 1;
}

// vista previa de imagen
inpFoto?.addEventListener('change', () => {
  const f = inpFoto.files?.[0];
  if (!f) {
    imgPrev.style.display = 'none';
    imgPrev.src = '';
    return;
  }
  const url = URL.createObjectURL(f);
  imgPrev.src = url;
  imgPrev.style.display = 'block';
});

// intenta precargar datos para edición
async function tryPrefillFromQuery() {
  const qsId = new URLSearchParams(location.search).get('id');
  if (!qsId) return;

  const idNum = Number(qsId);
  const filter = Number.isFinite(idNum) ? idNum : qsId;

  // añadimos tratamiento al select
  const cols = `
    id,
    nombre,
    edad_anios,
    edad_meses,
    peso_kg,
    color,
    cli_tel,
    raza_id,
    foto_url,
    ${OBS_FIELD},
    tratamiento
  `;
  const { data, error } = await sb
    .from('mascotas')
    .select(cols.replace(/\s+/g, '')) // limpiar espacios y saltos
    .eq('id', filter)
    .maybeSingle();

  if (error) {
    console.error('Error cargando mascota:', error);
    alert('No se pudo cargar la mascota: ' + (error.message || ''));
    return;
  }
  if (!data) {
    alert(`No existe la mascota con id=${qsId}`);
    return;
  }

  inpId.value        = data.id ?? '';
  inpNom.value       = data.nombre ?? '';
  inpEdadAnios.value = data.edad_anios ?? 0;
  inpEdadMeses.value = data.edad_meses ?? '';
  inpPeso.value      = data.peso_kg ?? '';
  inpColor.value     = data.color ?? '';
  inpTel.value       = data.cli_tel ?? '';
  txtObs.value       = data[OBS_FIELD] ?? '';
  if (inpTratamiento) inpTratamiento.value = data.tratamiento ?? '';

  const r = RAZAS.find(x => String(x.id) === String(data.raza_id));
  if (r) selEsp.value = (r.especie ?? ({ 1: 'Perro', 2: 'Gato' }[r.especie_id])) || '';
  fillRazas();
  if (data.raza_id != null) selRaza.value = String(data.raza_id);

  if (data.foto_url) {
    imgPrev.src = data.foto_url;
    imgPrev.style.display = 'block';
  }
}

// SUBIR FOTO: devuelve publicUrl o null
async function uploadPhotoIfAny(existingUrl = '') {
  const file = inpFoto.files?.[0];
  if (!file) return existingUrl || null;

  const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `mascotas/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await sb.storage.from('mascotas').upload(
    path,
    file,
    { cacheControl: '3600', upsert: false }
  );
  if (upErr) {
    alert('No se pudo subir la foto: ' + upErr.message);
    return existingUrl || null;
  }

  const { data } = sb.storage.from('mascotas').getPublicUrl(path);
  return data?.publicUrl ?? existingUrl ?? null;
}

// eventos
selEsp?.addEventListener('change', fillRazas);

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Si es Recepcionista y NO hay id, no debe crear mascotas nuevas
  if (isRecep(usuario) && !inpId.value) {
    alert('El recepcionista solo puede actualizar peso y fotografía de mascotas ya registradas.');
    return;
  }

  // sube foto primero
  const currentUrl = imgPrev?.src?.startsWith('blob:') ? '' : (imgPrev?.src || '');
  const fotoUrl = await uploadPhotoIfAny(currentUrl);

  const edadAniosNum = Number(inpEdadAnios.value);
  const edadMesesNum = inpEdadMeses.value === '' ? null : Number(inpEdadMeses.value);
  const pesoNum      = inpPeso.value === '' ? null : Number(inpPeso.value);

  // Validaciones básicas siempre
  if (!inpNom.value.trim() || !Number.isFinite(edadAniosNum) || !inpTel.value.trim() || !selRaza.value) {
    if (!isRecep(usuario)) {
      // Para admin/vet sí pedimos todo
      return alert('Completa nombre, edad (años), teléfono y raza.');
    }
    // Para recepcionista no bloqueamos por nombre/edad/raza porque no puede cambiarlos
  }

  if (edadMesesNum != null && (!Number.isFinite(edadMesesNum) || edadMesesNum < 0 || edadMesesNum > 11)) {
    if (!isRecep(usuario)) {
      return alert('La edad en meses debe estar entre 0 y 11.');
    }
  }

  if (pesoNum != null && (!Number.isFinite(pesoNum) || pesoNum < 0)) {
    return alert('El peso debe ser un número positivo.');
  }

  let payload;

  if (isRecep(usuario)) {
    //Recepcionista: solo puede modificar peso y foto
    payload = {
      peso_kg:  pesoNum,
      foto_url: fotoUrl
    };
    // NO cambia observaciones, tratamiento ni otros campos
  } else {
    //Administrador / Veterinario: pueden modificar todos los datos
    payload = {
      nombre:     inpNom.value.trim(),
      edad_anios: edadAniosNum,
      edad_meses: edadMesesNum,
      peso_kg:    pesoNum,
      color:      inpColor.value.trim() || null,
      cli_tel:    inpTel.value.trim(),
      raza_id:    Number(selRaza.value || 0),
      foto_url:   fotoUrl
    };
    payload[OBS_FIELD] = txtObs.value.trim() || null;
    if (inpTratamiento) {
      payload.tratamiento = inpTratamiento.value.trim() || null;
    }
  }

  let error;
  if (inpId.value) {
    ({ error } = await sb.from('mascotas').update(payload).eq('id', Number(inpId.value)));
  } else {
    ({ error } = await sb.from('mascotas').insert(payload));
  }

  if (error) return alert('No se pudo guardar: ' + error.message);
  alert('Mascota guardada');
  location.href = 'mascotas.html';
});

document.addEventListener('DOMContentLoaded', async () => {
  await detectObsField();
  await loadRazas();
  fillRazas();
  await tryPrefillFromQuery();

  // 🔹 Al cargar: si es recepcionista, deshabilitar todos los campos
  // excepto peso y foto (y el id hidden)
  if (isRecep(usuario) && form) {
    form.querySelectorAll('input, textarea, select').forEach(el => {
      if (
        el === inpPeso ||
        el === inpFoto ||
        el === inpId    // hidden, necesario para saber qué mascota es
      ) {
        el.disabled = false;
      } else {
        el.disabled = true;
      }
    });
  }
});
