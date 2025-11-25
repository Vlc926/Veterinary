// controlador/login.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// Formulario e inputs
const form =
  document.querySelector('#frmLogin') ||
  document.querySelector('#loginForm');

const inpCorreo =
  document.querySelector('#correo') ||
  document.querySelector('#email');

const inpPass =
  document.querySelector('#contrasena') ||
  document.querySelector('#password');

const btnSubmit = form?.querySelector('button[type="submit"]');

if (!form || !inpCorreo || !inpPass) {
  console.error('login.js: No se encontraron los elementos del formulario de login.');
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const correo = (inpCorreo.value || '').trim();
  const pass   = inpPass.value || '';

  if (!correo || !pass) {
    alert('Ingresa correo y contraseña.');
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Ingresando...';
  }

  try {
    // 1) Traer usuario + rol + cuenta en UNA sola consulta
    const { data: usuario, error: errUser } = await sb
      .from('usuarios')
      .select(`
        id,
        nombre,
        correo,
        telefono,
        rol_id,
        roles:roles ( nombre ),
        cuenta:cuenta ( contraseña )
      `)
      .ilike('correo', correo)    // case-insensitive por si hay mayúsculas en la BD
      .maybeSingle();

    if (errUser) {
      console.error('Error consultando usuario/rol/cuenta:', errUser);
      alert('Error al verificar tus datos. Intenta más tarde.');
      return;
    }

    if (!usuario) {
      alert('No se encontró un usuario con ese correo.');
      return;
    }

    console.log('Usuario completo desde Supabase:', usuario);

    // 2) Extraer contraseña real desde la relación "cuenta"
    let passReal = null;

    if (Array.isArray(usuario.cuenta)) {
      // Cuando Supabase devuelve un array (relación 1:N)
      passReal = usuario.cuenta[0]?.contraseña ?? null;
    } else if (usuario.cuenta) {
      // Por si fuera un objeto directo
      passReal = usuario.cuenta.contraseña ?? null;
    }

    if (!passReal) {
      alert('Esta cuenta no tiene contraseña configurada.');
      return;
    }

    // 3) Comparar contraseñas (texto plano por ahora)
    if (pass !== passReal) {
      alert('Contraseña incorrecta.');
      return;
    }

    // 4) Obtener el nombre de rol desde la relación "roles"
    const rolNombre = (usuario.roles?.nombre || 'Sin rol').trim();
    console.log('Login OK. Rol detectado:', rolNombre);

    // 5) Guardar info en localStorage para seguridad.js
    const usuarioSesion = {
      id:        usuario.id,
      user:      usuario.correo,
      nombre:    usuario.nombre,
      telefono:  usuario.telefono,
      rolId:     usuario.rol_id,
      rolNombre: rolNombre
    };

    localStorage.setItem('veterinaryUser', JSON.stringify(usuarioSesion));

    // 6) Redirigir según rol
    const rolLower = rolNombre.toLowerCase();

    if (rolLower === 'administrador') {
      window.location.href = 'index.html';
    } else if (rolLower === 'recepcionista') {
      window.location.href = 'recepcionpanel.html';
    } else if (rolLower === 'veterinario') {
      window.location.href = 'mis_citas.html';
    } else {
      window.location.href = 'index.html';
    }

  } catch (err) {
    console.error('Error inesperado en login:', err);
    alert('Ocurrió un error al iniciar sesión.');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Iniciar sesión';
    }
  }
});
