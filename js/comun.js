/* =========================================================
   FUNCIONES COMUNES: base de datos local, sesión, cálculos,
   ventanas (modales), avisos y adaptación de pantalla.
   Se usa en todas las páginas (públicas y panel).
   ========================================================= */

var CLAVE_BD = 'otb_villa_esperanza_bd';
var CLAVE_SESION = 'otb_villa_esperanza_sesion';

var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
             'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

var ROLES = {
    cobrador:   'Cobrador',
    admin:      'Administrador',
    superadmin: 'Super Admin'
};

/* ---------------- Utilidades ---------------- */

function esc(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizar(texto) {
    return String(texto || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim();
}

function bs(monto) {
    return (Math.round((+monto || 0) * 100) / 100).toFixed(2);
}

function nombrePeriodo(p) {            // '2026-05' -> 'Mayo 2026'
    return MESES[+p.slice(5, 7) - 1] + ' ' + p.slice(0, 4);
}

function periodoCorto(p) {             // '2026-05' -> 'MAY-2026'
    return MESES[+p.slice(5, 7) - 1].slice(0, 3).toUpperCase() + '-' + p.slice(0, 4);
}

function vencimientoPeriodo(p) {       // último día del mes siguiente
    var anio = +p.slice(0, 4), mes = +p.slice(5, 7);
    var d = new Date(anio, mes + 1, 0);
    return fechaCorta(d);
}

function siguientePeriodo(p) {
    var anio = +p.slice(0, 4), mes = +p.slice(5, 7) + 1;
    if (mes > 12) { mes = 1; anio++; }
    return anio + '-' + String(mes).padStart(2, '0');
}

function fechaCorta(fecha) {
    var d = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(d)) return '—';
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function fechaHora(fecha) {
    var d = new Date(fecha);
    if (isNaN(d)) return '—';
    return fechaCorta(d) + ' ' + String(d.getHours()).padStart(2, '0') + ':' +
           String(d.getMinutes()).padStart(2, '0');
}

// Cifrado simple de contraseñas (hash). OJO: al no haber servidor,
// esto solo evita que las claves se lean a simple vista.
function hashClave(usuario, clave) {
    var str = 'otb-ve|' + normalizar(usuario) + '|' + clave;
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
        var ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/* ---------------- Base de datos (localStorage) ---------------- */

var BD = {
    _cache: null,

    cargar: function () {
        if (this._cache) return this._cache;
        var datos = null;
        try { datos = JSON.parse(localStorage.getItem(CLAVE_BD)); } catch (e) { datos = null; }
        if (!datos || !datos.socios) datos = this.datosIniciales();
        // Datos guardados antes de ordenar las carpetas: el QR ahora está en img/
        if (datos.cuentaQR && datos.cuentaQR.imagen === 'qr.JPG') datos.cuentaQR.imagen = 'img/qr.JPG';
        this._cache = datos;
        return datos;
    },

    guardar: function () {
        try {
            localStorage.setItem(CLAVE_BD, JSON.stringify(this._cache));
            return true;
        } catch (e) {
            aviso('No se pudo guardar: el almacenamiento del navegador está lleno. ' +
                  'Borra comprobantes antiguos o exporta un respaldo.', 'error');
            return false;
        }
    },

    datosIniciales: function () {
        var d = JSON.parse(JSON.stringify(DATOS_INICIALES));
        d.usuarios = d.usuariosIniciales.map(function (u) {
            return { usuario: u.usuario, nombre: u.nombre, rol: u.rol,
                     hash: hashClave(u.usuario, u.clave), activo: true };
        });
        delete d.usuariosIniciales;
        this._cache = d;
        try { localStorage.setItem(CLAVE_BD, JSON.stringify(d)); } catch (e) {}
        return d;
    },

    restablecer: function () {
        this._cache = null;
        localStorage.removeItem(CLAVE_BD);
        return this.datosIniciales();
    }
};

// Si otra pestaña cambia los datos, recargarlos
window.addEventListener('storage', function (e) {
    if (e.key === CLAVE_BD) BD._cache = null;
});

/* ---------------- Cálculos de cuentas ---------------- */

function calcularMonto(m3) {
    var tarifas = BD.cargar().tarifas;
    for (var i = 0; i < tarifas.length; i++) {
        var t = tarifas[i];
        if (t.hasta === null || t.hasta === '' || m3 <= t.hasta) {
            return Math.round(m3 * t.precio * 100) / 100;
        }
    }
    return 0;
}

function buscarSocioPorId(id) {
    return BD.cargar().socios.find(function (s) { return s.id === +id; }) || null;
}

/* Devuelve el estado de cada periodo de un socio:
   'pagado' | 'verificacion' | 'debe'  */
function estadoCuenta(socio) {
    var db = BD.cargar();
    var pagosSocio = db.pagos.filter(function (p) { return p.socioId === socio.id; });
    var periodos = db.periodos.filter(function (p) { return socio.lecturas[p]; });

    var detalle = periodos.map(function (p) {
        var lectura = socio.lecturas[p];
        var confirmado = pagosSocio.find(function (pg) {
            return pg.estado === 'confirmado' && pg.periodos.indexOf(p) !== -1;
        });
        var pendiente = pagosSocio.find(function (pg) {
            return pg.estado === 'pendiente' && pg.periodos.indexOf(p) !== -1;
        });
        var estado = confirmado ? 'pagado' : (pendiente ? 'verificacion' : 'debe');
        var pago = confirmado || pendiente || null;
        return {
            periodo: p,
            m3: lectura.m3,
            monto: lectura.monto,
            estado: estado,
            fechaPago: pago ? pago.fecha : null,
            pago: pago
        };
    });

    var debe = detalle.filter(function (d) { return d.estado === 'debe'; });
    var verif = detalle.filter(function (d) { return d.estado === 'verificacion'; });
    var ultimo = detalle[detalle.length - 1] || null;

    return {
        detalle: detalle,
        periodosDebe: debe,
        periodosVerificacion: verif,
        deuda: debe.reduce(function (s, d) { return s + d.monto; }, 0),
        enVerificacion: verif.reduce(function (s, d) { return s + d.monto; }, 0),
        ultimo: ultimo
    };
}

function textoEstado(cuenta) {
    var n = cuenta.periodosDebe.length;
    if (n === 0 && cuenta.periodosVerificacion.length) return 'En verificación';
    if (n === 0) return 'Al día';
    return 'Debe ' + n + (n === 1 ? ' mes' : ' meses');
}

/* Búsqueda por CI, código de socio o nombre (sin importar tildes/mayúsculas) */
function buscarSocios(texto) {
    var q = normalizar(texto);
    if (!q) return [];
    var socios = BD.cargar().socios;
    var soloNumeros = q.replace(/[\s.-]/g, '');

    if (/^\d+$/.test(soloNumeros)) {
        var exactos = socios.filter(function (s) {
            return s.ci === soloNumeros || s.codigo === soloNumeros;
        });
        if (exactos.length) return exactos;
        if (soloNumeros.length >= 3) {
            return socios.filter(function (s) { return s.ci.indexOf(soloNumeros) === 0; });
        }
        return [];
    }

    var palabras = q.split(' ');
    return socios.filter(function (s) {
        var nombre = normalizar(s.nombre);
        return palabras.every(function (w) { return nombre.indexOf(w) !== -1; });
    });
}

/* ---------------- Sesión y roles ---------------- */

var Sesion = {
    actual: function () {
        try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION)); } catch (e) { return null; }
    },
    iniciar: function (usuario, clave) {
        var db = BD.cargar();
        var u = db.usuarios.find(function (x) {
            return normalizar(x.usuario) === normalizar(usuario);
        });
        if (!u || u.hash !== hashClave(u.usuario, clave)) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
        if (!u.activo) return { ok: false, error: 'Este usuario está desactivado.' };
        var s = { usuario: u.usuario, nombre: u.nombre, rol: u.rol, desde: new Date().toISOString() };
        sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s));
        return { ok: true, sesion: s };
    },
    cerrar: function () { sessionStorage.removeItem(CLAVE_SESION); },
    tieneRol: function (rolMinimo) {
        var orden = { cobrador: 1, admin: 2, superadmin: 3 };
        var s = this.actual();
        return !!s && orden[s.rol] >= orden[rolMinimo];
    }
};

/* ---------------- Ventanas (modales) y avisos ---------------- */

var Modal = {
    abrir: function (opciones) {
        this.cerrar();
        var fondo = document.createElement('div');
        fondo.className = 'otb-modal-fondo';
        fondo.innerHTML =
            '<div class="otb-modal' + (opciones.ancho ? ' otb-modal-' + opciones.ancho : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opciones.titulo || '') + '">' +
                '<div class="otb-modal-cabecera">' +
                    '<h2>' + esc(opciones.titulo || '') + '</h2>' +
                    '<button type="button" class="otb-modal-cerrar" aria-label="Cerrar">&times;</button>' +
                '</div>' +
                '<div class="otb-modal-cuerpo">' + (opciones.html || '') + '</div>' +
            '</div>';
        document.body.appendChild(fondo);
        document.body.classList.add('otb-sin-scroll');
        fondo.querySelector('.otb-modal-cerrar').onclick = function () { Modal.cerrar(); };
        fondo.addEventListener('mousedown', function (e) { if (e.target === fondo) Modal.cerrar(); });
        this._esc = function (e) { if (e.key === 'Escape') Modal.cerrar(); };
        document.addEventListener('keydown', this._esc);
        var primero = fondo.querySelector('input, select, textarea');
        if (primero && opciones.enfocar !== false) setTimeout(function () { primero.focus(); }, 50);
        return fondo.querySelector('.otb-modal-cuerpo');
    },
    cerrar: function () {
        var f = document.querySelector('.otb-modal-fondo');
        if (f) f.remove();
        document.body.classList.remove('otb-sin-scroll');
        if (this._esc) document.removeEventListener('keydown', this._esc);
    },
    confirmar: function (titulo, mensaje, textoBoton, alAceptar, peligro) {
        var c = this.abrir({ titulo: titulo, ancho: 'chico', enfocar: false, html:
            '<p class="otb-texto">' + mensaje + '</p>' +
            '<div class="otb-acciones">' +
                '<button type="button" class="otb-btn otb-btn-sec" data-no>Cancelar</button>' +
                '<button type="button" class="otb-btn ' + (peligro ? 'otb-btn-peligro' : 'otb-btn-ok') + '" data-si>' + esc(textoBoton) + '</button>' +
            '</div>' });
        c.querySelector('[data-no]').onclick = function () { Modal.cerrar(); };
        c.querySelector('[data-si]').onclick = function () { Modal.cerrar(); alAceptar(); };
    }
};

function aviso(mensaje, tipo) {
    var cont = document.querySelector('.otb-avisos');
    if (!cont) {
        cont = document.createElement('div');
        cont.className = 'otb-avisos';
        cont.setAttribute('aria-live', 'polite');
        document.body.appendChild(cont);
    }
    var a = document.createElement('div');
    a.className = 'otb-aviso otb-aviso-' + (tipo || 'ok');
    a.textContent = mensaje;
    cont.appendChild(a);
    setTimeout(function () { a.classList.add('otb-aviso-sale'); }, 3500);
    setTimeout(function () { a.remove(); }, 4000);
}

/* ---------------- Ventana de inicio de sesión ---------------- */

function abrirLogin() {
    var c = Modal.abrir({ titulo: 'Iniciar sesión', ancho: 'chico', html:
        '<p class="otb-texto otb-suave">Acceso para cobradores y administradores de la OTB.</p>' +
        '<form class="otb-form" id="otb-form-login" autocomplete="on">' +
            '<label>Usuario<input name="usuario" required autocomplete="username"></label>' +
            '<label>Contraseña<input name="clave" type="password" required autocomplete="current-password"></label>' +
            '<p class="otb-error" hidden></p>' +
            '<button class="otb-btn otb-btn-pri otb-btn-bloque" type="submit">Ingresar</button>' +
        '</form>' });
    c.querySelector('form').onsubmit = function (e) {
        e.preventDefault();
        var r = Sesion.iniciar(this.usuario.value.trim(), this.clave.value);
        if (!r.ok) {
            var err = c.querySelector('.otb-error');
            err.textContent = r.error; err.hidden = false;
            return;
        }
        window.location.href = 'panel.html';
    };
}

/* ---------------- Cabecera ---------------- */

function prepararCabecera() {
    var arriba = document.querySelector('.arriba');
    var menu = document.querySelector('.fofo');
    if (!arriba || !menu) return;

    // Botón hamburguesa (solo visible en tablet/celular)
    var hamb = document.createElement('button');
    hamb.type = 'button';
    hamb.className = 'otb-hamburguesa';
    hamb.setAttribute('aria-label', 'Abrir menú');
    hamb.setAttribute('aria-expanded', 'false');
    hamb.innerHTML = '<span></span><span></span><span></span>';
    hamb.onclick = function () {
        var abierto = arriba.classList.toggle('otb-menu-abierto');
        hamb.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    };
    arriba.appendChild(hamb);

    // Marcar la página actual en el menú
    var actual = location.pathname.split('/').pop() || 'otb.html';
    menu.querySelectorAll('a').forEach(function (a) {
        if (a.getAttribute('href') === actual) a.classList.add('otb-actual');
    });

    // Botón "Iniciar sesión"
    var btn = menu.querySelector('.iniciar');
    if (btn) {
        var s = Sesion.actual();
        if (s) btn.querySelector('.sesion').textContent = 'Mi panel';
        btn.onclick = function () {
            if (Sesion.actual()) window.location.href = 'panel.html';
            else abrirLogin();
        };
    }
}

document.addEventListener('DOMContentLoaded', function () {
    BD.cargar();
    if (document.body.hasAttribute('data-pagina')) {
        prepararCabecera();
    }
});
