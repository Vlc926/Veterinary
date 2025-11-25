// controlador/mis_mascotas.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { requireLogin, initRoleUI, wireLogout } from './seguridad.js';

// SOLO veterinarios pueden ver "Mis mascotas"
const usuario = requireLogin(['Veterinario']);
initRoleUI(usuario);
wireLogout();

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $  = (s) => document.querySelector(s);

const tabla     = document.querySelector('#tablaMascotas');
const tbody     = tabla ? tabla.querySelector('tbody') : null;
const txtBuscar = $('#txtBuscarTel');

let MIS_MASCOTAS = [];

// =============== CARGAR MASCOTAS DEL VET =================
async function cargarMisMascotas() {
  if (!tbody) return;

  // 1) Traer todas las citas del veterinario actual
  const { data: citas, error: errCitas } = await sb
    .from('citas')
    .select('id, fecha, mascotas_id, cli_tel')
    .eq('veterinario_id', usuario.id)
    .order('fecha', { ascending: true });

  if (errCitas) {
    console.error(errCitas);
    alert('No se pudieron cargar las citas del veterinario: ' + errCitas.message);
    tbody.innerHTML = `
      <tr><td colspan="8" class="text-center">Error cargando datos.</td></tr>
    `;
    return;
  }

  if (!citas || !citas.length) {
    MIS_MASCOTAS = [];
    renderTabla(MIS_MASCOTAS);
    return;
  }

  // 2) IDs de mascotas y teléfono desde las citas
  const idsMascotasSet = new Set();
  const telPorMascota  = new Map();

  for (const c of citas) {
    if (!c.mascotas_id) continue;
    idsMascotasSet.add(c.mascotas_id);
    if (c.cli_tel) telPorMascota.set(c.mascotas_id, c.cli_tel);
  }

  const idsMascotas = [...idsMascotasSet];
  if (!idsMascotas.length) {
    MIS_MASCOTAS = [];
    renderTabla(MIS_MASCOTAS);
    return;
  }

  // 3) Traer datos de esas mascotas
  const { data: mascotas, error: errMasc } = await sb
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
    .in('id', idsMascotas);

  if (errMasc) {
    console.error(errMasc);
    alert('No se pudieron cargar las mascotas: ' + errMasc.message);
    tbody.innerHTML = `
      <tr><td colspan="8" class="text-center">Error cargando mascotas.</td></tr>
    `;
    return;
  }

  // 4) Armar arreglo final
  MIS_MASCOTAS = (mascotas || []).map(m => {
    const telCita = telPorMascota.get(m.id);
    return {
      id:           m.id,
      nombre:       m.nombre,
      especie:      '',          // de momento vacío (podemos ligarlo a Razas después)
      raza:         '',
      edad_anios:   m.edad_anios,
      edad_meses:   m.edad_meses,
      peso_kg:      m.peso_kg,
      color:        m.color,
      foto_url:     m.foto_url,
      cli_tel:      m.cli_tel || telCita || '',
      diagnostico:  m.diagnostico || '',
      tratamiento:  m.tratamiento || ''
    };
  });

  renderTabla(MIS_MASCOTAS);
}

// =============== RENDER TABLA =================
function renderTabla(lista) {
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center">
          No hay mascotas asociadas a tus citas.
        </td>
      </tr>
    `;
    return;
  }

  for (const m of lista) {
    const tr = document.createElement('tr');

    const edadStr = (m.edad_anios || m.edad_meses)
      ? `${m.edad_anios ?? 0} años ${m.edad_meses ?? 0} meses`
      : '-';

    tr.innerHTML = `
      <td>
        ${
          m.foto_url
            ? `<img src="${m.foto_url}" alt="${m.nombre}" class="foto-tabla">`
            : '-'
        }
      </td>
      <td>${m.nombre || '-'}</td>
      <td>${m.especie || '-'}</td>
      <td>${m.raza || '-'}</td>
      <td>${edadStr}</td>
      <td>${m.peso_kg ?? '-'}</td>
      <td>${m.cli_tel || '-'}</td>
      <td>
        <button class="btn-secundario btn-detalle" data-id="${m.id}">
          <i class="fa-solid fa-eye"></i> Ver detalles
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  }

  // Click en "Ver detalles" → ir a detalle_mascota.html
  tbody.querySelectorAll('.btn-detalle').forEach(btn => {
    btn.addEventListener('click', () => {
      const idMascota = btn.dataset.id;
      window.location.href = `detalle_mascota.html?id=${idMascota}`;
    });
  });
}

// =============== BUSCADOR =================
txtBuscar?.addEventListener('input', () => {
  const q = txtBuscar.value.trim().toLowerCase();
  if (!q) {
    renderTabla(MIS_MASCOTAS);
    return;
  }

  const filtradas = MIS_MASCOTAS.filter(m => {
    const tel  = (m.cli_tel || '').toLowerCase();
    const nom  = (m.nombre || '').toLowerCase();
    return tel.includes(q) || nom.includes(q);
  });

  renderTabla(filtradas);
});

// =============== INIT =================
document.addEventListener('DOMContentLoaded', () => {
  cargarMisMascotas();
});
