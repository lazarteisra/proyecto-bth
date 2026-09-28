/* =========================================================
   PANEL DE GESTIÓN
   - Cobrador:    verificar pagos QR, registrar cobros, ver deudores e historial
   - Admin:       lo anterior + socios, lecturas, tarifas, contenido y mensajes
   - Super Admin: lo anterior + usuarios y respaldo de datos
   ========================================================= */

var SECCIONES = [
    { id: 'resumen',   texto: 'Resumen',          rol: 'cobrador',   dibujar: verResumen },
    { id: 'verificar', texto: 'Verificar pagos',  rol: 'cobrador',   dibujar: verVerificar },
    { id: 'cobrar',    texto: 'Registrar cobro',  rol: 'cobrador',   dibujar: verCobrar },
    { id: 'deudores',  texto: 'Deudores',         rol: 'cobrador',   dibujar: verDeudores },
    { id: 'pagos',     texto: 'Historial de pagos', rol: 'cobrador', dibujar: verPagos },
    { id: 'socios',    texto: 'Socios',           rol: 'admin',      dibujar: verSocios },
    { id: 'lecturas',  texto: 'Lecturas',         rol: 'admin',      dibujar: verLecturas },
    { id: 'contenido', texto: 'Tarifas y contenido', rol: 'admin',   dibujar: verContenido },
    { id: 'mensajes',  texto: 'Mensajes',         rol: 'admin',      dibujar: verMensajes },
    { id: 'usuarios',  texto: 'Usuarios',         rol: 'superadmin', dibujar: verUsuarios },
    { id: 'datos',     texto: 'Respaldo',         rol: 'superadmin', dibujar: verDatos },
    { id: 'cuenta',    texto: 'Mi cuenta',        rol: 'cobrador',   dibujar: verCuenta }
];

var contenido;

document.addEventListener('DOMContentLoaded', function () {
    contenido = document.getElementById('p-contenido');
    document.getElementById('p-salir').onclick = function () {
        Sesion.cerrar();
        location.href = 'otb.html';
    };
    window.addEventListener('hashchange', dibujar);
    dibujar();
});

function sesionValida() {
    var s = Sesion.actual();
    if (!s) return null;
    // Si el usuario fue eliminado o desactivado, se cierra su sesión
    var u = BD.cargar().usuarios.find(function (x) { return x.usuario === s.usuario; });
    if (!u || !u.activo) { Sesion.cerrar(); return null; }
    if (u.rol !== s.rol || u.nombre !== s.nombre) {
        s.rol = u.rol; s.nombre = u.nombre;
        sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s));
    }
    return s;
}

function dibujar() {
    Modal.cerrar();
    var s = sesionValida();
    var nav = document.getElementById('p-pestanas');

    if (!s) {
        document.getElementById('p-usuario').hidden = true;
        nav.innerHTML = '';
        verLogin();
        return;
    }

    document.getElementById('p-usuario').hidden = false;
    document.getElementById('p-nombre').textContent = s.nombre;
    var rol = document.getElementById('p-rol');
    rol.textContent = ROLES[s.rol];
    rol.className = 'p-rol p-rol-' + s.rol;

    var permitidas = SECCIONES.filter(function (sec) { return Sesion.tieneRol(sec.rol); });
    var actual = location.hash.slice(1);
    var seccion = permitidas.find(function (sec) { return sec.id === actual; }) || permitidas[0];

    var pendientes = BD.cargar().pagos.filter(function (p) { return p.estado === 'pendiente'; }).length;
    var noLeidos = BD.cargar().mensajes.filter(function (m) { return !m.leido; }).length;

    nav.innerHTML = permitidas.map(function (sec) {
        var n = sec.id === 'verificar' ? pendientes : sec.id === 'mensajes' ? noLeidos : 0;
        return '<a class="p-pestana' + (sec === seccion ? ' activa' : '') + '" href="#' + sec.id + '">' +
            esc(sec.texto) + (n ? ' <span class="p-contador">' + n + '</span>' : '') + '</a>';
    }).join('');
    nav.querySelectorAll('.p-pestana').forEach(function (a) { a.style.textDecoration = 'none'; });

    seccion.dibujar();
    var activa = nav.querySelector('.activa');
    if (activa && activa.scrollIntoView) activa.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function refrescar() { dibujar(); }

function cabecera(titulo, descripcion) {
    return '<h1 class="p-titulo">' + esc(titulo) + '</h1>' +
           (descripcion ? '<p class="p-descripcion">' + descripcion + '</p>' : '');
}

function etiqueta(estado) {
    var textos = { confirmado: 'Confirmado', pendiente: 'Por verificar', rechazado: 'Rechazado',
                   pagado: 'Pagado', verificacion: 'En verificación', debe: 'Pendiente' };
    return '<span class="p-etiqueta ' + estado + '">' + (textos[estado] || estado) + '</span>';
}

function metodoTexto(m) {
    return { qr: 'QR', efectivo: 'Efectivo', deposito: 'Depósito' }[m] || m;
}

function listaPeriodos(periodos) {
    if (periodos.length <= 2) return periodos.map(nombrePeriodo).join(', ');
    return nombrePeriodo(periodos[0]) + ' a ' + nombrePeriodo(periodos[periodos.length - 1]) +
           ' (' + periodos.length + ' meses)';
}

/* ================= LOGIN ================= */

function verLogin() {
    contenido.innerHTML =
        '<div class="p-login p-tarjeta">' +
            cabecera('Iniciar sesión', 'Acceso para cobradores y administradores de la OTB.') +
            '<form class="otb-form" id="p-form-login">' +
                '<label>Usuario<input name="usuario" required autocomplete="username"></label>' +
                '<label>Contraseña<input name="clave" type="password" required autocomplete="current-password"></label>' +
                '<p class="otb-error" hidden></p>' +
                '<button class="otb-btn otb-btn-pri otb-btn-bloque" type="submit">Ingresar</button>' +
            '</form>' +
        '</div>';
    var f = document.getElementById('p-form-login');
    f.usuario.focus();
    f.onsubmit = function (e) {
        e.preventDefault();
        var r = Sesion.iniciar(f.usuario.value.trim(), f.clave.value);
        if (!r.ok) {
            var err = f.querySelector('.otb-error');
            err.textContent = r.error; err.hidden = false;
            return;
        }
        location.hash = '';
        dibujar();
    };
}

/* ================= RESUMEN ================= */

function verResumen() {
    var db = BD.cargar();
    var s = Sesion.actual();
    var pendientes = db.pagos.filter(function (p) { return p.estado === 'pendiente'; });
    var hoy = new Date();
    var mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
    var recaudadoMes = db.pagos.filter(function (p) {
        return p.estado === 'confirmado' && (p.fechaVerificacion || p.fecha).slice(0, 7) === mesActual;
    }).reduce(function (t, p) { return t + p.monto; }, 0);

    var deudaTotal = 0, conDeuda = 0;
    db.socios.forEach(function (so) {
        var c = estadoCuenta(so);
        deudaTotal += c.deuda;
        if (c.deuda > 0) conDeuda++;
    });

    contenido.innerHTML =
        cabecera('Hola, ' + s.nombre, 'Rol: <b>' + ROLES[s.rol] + '</b>. Este es el estado actual del cobro de agua.') +
        '<div class="p-indicadores">' +
            '<div class="p-indicador alerta"><span>Pagos por verificar</span><b>' + pendientes.length + '</b></div>' +
            '<div class="p-indicador verde"><span>Recaudado en ' + MESES[hoy.getMonth()].toLowerCase() + '</span><b>Bs. ' + bs(recaudadoMes) + '</b></div>' +
            '<div class="p-indicador rojo"><span>Deuda total de socios</span><b>Bs. ' + bs(deudaTotal) + '</b></div>' +
            '<div class="p-indicador"><span>Socios con deuda</span><b>' + conDeuda + ' de ' + db.socios.length + '</b></div>' +
        '</div>' +
        (pendientes.length
            ? '<div class="p-nota">Tienes <b>' + pendientes.length + '</b> pago(s) QR esperando verificación. ' +
              '<a href="#verificar">Ir a verificar →</a></div>'
            : '') +
        '<div class="p-tarjeta"><h3>Últimos pagos confirmados</h3>' + tablaPagos(
            db.pagos.filter(function (p) { return p.estado === 'confirmado'; })
                .sort(function (a, b) { return (b.fechaVerificacion || b.fecha).localeCompare(a.fechaVerificacion || a.fecha); })
                .slice(0, 6), false) + '</div>';
}

/* ================= VERIFICAR PAGOS QR ================= */

function verVerificar() {
    var db = BD.cargar();
    var pendientes = db.pagos.filter(function (p) { return p.estado === 'pendiente'; })
        .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });

    var html = cabecera('Verificar pagos por QR',
        'Antes de confirmar, revisa en la app del banco (cuenta <b>' + esc(db.cuentaQR.cuenta) + '</b>) ' +
        'que el dinero haya llegado: <b>monto</b>, <b>fecha</b> y <b>glosa</b> deben coincidir.');

    if (!pendientes.length) {
        contenido.innerHTML = html + '<div class="p-tarjeta p-vacio">✓ No hay pagos pendientes de verificación.</div>';
        return;
    }

    html += pendientes.map(function (p) {
        var so = buscarSocioPorId(p.socioId);
        return '<div class="p-tarjeta p-verificar">' +
            '<div>' +
                '<dl>' +
                    '<dt>Socio</dt><dd>' + esc(so ? so.nombre : '(eliminado)') + '</dd>' +
                    '<dt>CI</dt><dd>' + esc(so ? so.ci : '—') + '</dd>' +
                    '<dt>Meses</dt><dd>' + esc(listaPeriodos(p.periodos)) + '</dd>' +
                    '<dt>Monto</dt><dd class="p-monto">Bs. ' + bs(p.monto) + '</dd>' +
                    '<dt>Enviado</dt><dd>' + fechaHora(p.fecha) + '</dd>' +
                    '<dt>N° transacción</dt><dd>' + esc(p.nroTransaccion || '—') + '</dd>' +
                    '<dt>Glosa esperada</dt><dd>' + esc(p.glosa || ('AGUA CI ' + (so ? so.ci : ''))) + '</dd>' +
                '</dl>' +
                '<div class="p-botones">' +
                    '<button class="otb-btn otb-btn-ok" data-confirmar="' + p.id + '">✓ Confirmar: el dinero llegó</button>' +
                    '<button class="otb-btn otb-btn-sec" data-rechazar="' + p.id + '">✕ Rechazar</button>' +
                '</div>' +
            '</div>' +
            (p.comprobante
                ? '<img class="p-comprobante" src="' + p.comprobante + '" alt="Comprobante" data-ver="' + p.id + '">'
                : '<div class="p-sin-comprobante">El vecino no adjuntó comprobante</div>') +
        '</div>';
    }).join('');

    contenido.innerHTML = html;

    contenido.querySelectorAll('[data-ver]').forEach(function (img) {
        img.onclick = function () {
            Modal.abrir({ titulo: 'Comprobante', ancho: 'grande', html: '<img class="p-comprobante-grande" src="' + img.src + '" alt="Comprobante">' });
        };
    });
    contenido.querySelectorAll('[data-confirmar]').forEach(function (b) {
        b.onclick = function () {
            var p = db.pagos.find(function (x) { return x.id === +b.dataset.confirmar; });
            Modal.confirmar('Confirmar pago', '¿Verificaste en el banco que llegaron <b>Bs. ' + bs(p.monto) + '</b>?', 'Sí, confirmar', function () {
                p.estado = 'confirmado';
                p.verificadoPor = Sesion.actual().usuario;
                p.fechaVerificacion = new Date().toISOString();
                BD.guardar();
                aviso('Pago confirmado.');
                refrescar();
            });
        };
    });
    contenido.querySelectorAll('[data-rechazar]').forEach(function (b) {
        b.onclick = function () {
            var p = db.pagos.find(function (x) { return x.id === +b.dataset.rechazar; });
            var c = Modal.abrir({ titulo: 'Rechazar pago', ancho: 'chico', html:
                '<form class="otb-form">' +
                    '<label>Motivo<select name="motivo">' +
                        '<option>El dinero no llegó a la cuenta</option>' +
                        '<option>El monto no coincide</option>' +
                        '<option>Comprobante no válido</option>' +
                        '<option>Pago duplicado</option>' +
                    '</select></label>' +
                    '<p class="otb-suave otb-mini">Los meses volverán a figurar como pendientes para el vecino.</p>' +
                    '<button class="otb-btn otb-btn-peligro otb-btn-bloque" type="submit">Rechazar pago</button>' +
                '</form>' });
            c.querySelector('form').onsubmit = function (e) {
                e.preventDefault();
                p.estado = 'rechazado';
                p.motivoRechazo = this.motivo.value;
                p.verificadoPor = Sesion.actual().usuario;
                p.fechaVerificacion = new Date().toISOString();
                BD.guardar();
                Modal.cerrar();
                aviso('Pago rechazado.', 'error');
                refrescar();
            };
        };
    });
}

/* ================= REGISTRAR COBRO (efectivo / ventanilla) ================= */

var cobroPendiente = null;

function verCobrar() {
    contenido.innerHTML =
        cabecera('Registrar cobro', 'Para pagos en efectivo en oficina o en el punto de cobro. El pago queda confirmado al instante.') +
        '<div class="p-tarjeta">' +
            '<form class="otb-form" id="p-buscar-socio">' +
                '<label>Buscar socio por CI, código o nombre' +
                    '<input name="q" placeholder="Ej: 6214587 o Carlos Rojas" autocomplete="off"></label>' +
            '</form>' +
            '<div id="p-resultados"></div>' +
        '</div>' +
        '<div id="p-cobro"></div>';

    var f = document.getElementById('p-buscar-socio');
    var res = document.getElementById('p-resultados');
    f.q.focus();

    function buscar() {
        var lista = buscarSocios(f.q.value);
        if (!f.q.value.trim()) { res.innerHTML = ''; return; }
        if (!lista.length) { res.innerHTML = '<p class="p-vacio">Sin resultados.</p>'; return; }
        res.innerHTML = '<div class="otb-lista">' + lista.slice(0, 8).map(function (so) {
            var c = estadoCuenta(so);
            return '<button type="button" class="otb-lista-item" data-id="' + so.id + '"><b>' + esc(so.nombre) + '</b>' +
                '<span>CI ' + esc(so.ci) + ' · ' + esc(so.direccion) + ' · ' +
                (c.deuda > 0 ? 'Debe Bs. ' + bs(c.deuda) : 'Al día') + '</span></button>';
        }).join('') + '</div>';
        res.querySelectorAll('[data-id]').forEach(function (b) {
            b.onclick = function () { formularioCobro(buscarSocioPorId(b.dataset.id)); };
        });
    }
    f.q.oninput = buscar;
    f.onsubmit = function (e) {
        e.preventDefault();
        var lista = buscarSocios(f.q.value);
        if (lista.length === 1) formularioCobro(lista[0]);
    };

    if (cobroPendiente) {
        var socio = buscarSocioPorId(cobroPendiente);
        cobroPendiente = null;
        if (socio) formularioCobro(socio);
    }
}

function formularioCobro(socio) {
    var caja = document.getElementById('p-cobro');
    var cuenta = estadoCuenta(socio);

    if (!cuenta.periodosDebe.length) {
        caja.innerHTML = '<div class="p-tarjeta"><h3>' + esc(socio.nombre) + '</h3>' +
            '<p>✓ No tiene deudas pendientes' + (cuenta.periodosVerificacion.length ? ' (tiene un pago QR por verificar).' : '.') + '</p></div>';
        return;
    }

    caja.innerHTML = '<div class="p-tarjeta">' +
        '<h3>' + esc(socio.nombre) + ' <span class="otb-suave" style="font-weight:400">· CI ' + esc(socio.ci) + ' · ' + esc(socio.direccion) + '</span></h3>' +
        cuenta.periodosDebe.map(function (d, i) {
            return '<label class="p-mes"><input type="checkbox" data-i="' + i + '" checked>' +
                '<span>' + nombrePeriodo(d.periodo) + ' <small class="otb-suave">(' + d.m3 + ' m³)</small></span>' +
                '<b>Bs. ' + bs(d.monto) + '</b></label>';
        }).join('') +
        '<form class="otb-form" id="p-form-cobro" style="margin-top:12px">' +
            '<div class="p-rejilla">' +
                '<label>Método<select name="metodo">' +
                    '<option value="efectivo">Efectivo</option>' +
                    '<option value="qr">QR (verificado en ventanilla)</option>' +
                    '<option value="deposito">Depósito bancario</option>' +
                '</select></label>' +
                '<label>N° de comprobante / recibo <input name="nro" placeholder="Opcional"></label>' +
            '</div>' +
            '<div class="otb-total"><span>Total a cobrar</span><b id="p-total">Bs. 0.00</b></div>' +
            '<button class="otb-btn otb-btn-ok otb-btn-bloque" type="submit">Registrar cobro</button>' +
        '</form></div>';

    var checks = caja.querySelectorAll('.p-mes input');
    function sel() {
        var l = [];
        checks.forEach(function (ch) { if (ch.checked) l.push(cuenta.periodosDebe[+ch.dataset.i]); });
        return l;
    }
    function total() {
        var t = sel().reduce(function (s, d) { return s + d.monto; }, 0);
        document.getElementById('p-total').textContent = 'Bs. ' + bs(t);
        caja.querySelector('button[type=submit]').disabled = !sel().length;
    }
    checks.forEach(function (ch) {
        ch.onchange = function () {
            var i = +ch.dataset.i;
            checks.forEach(function (o) {
                if (ch.checked && +o.dataset.i < i) o.checked = true;
                if (!ch.checked && +o.dataset.i > i) o.checked = false;
            });
            total();
        };
    });
    total();
    caja.scrollIntoView({ behavior: 'smooth', block: 'start' });

    document.getElementById('p-form-cobro').onsubmit = function (e) {
        e.preventDefault();
        var periodos = sel();
        var monto = Math.round(periodos.reduce(function (s, d) { return s + d.monto; }, 0) * 100) / 100;
        var f = this;
        Modal.confirmar('Registrar cobro', 'Registrar <b>Bs. ' + bs(monto) + '</b> de ' + esc(socio.nombre) +
            ' por ' + esc(listaPeriodos(periodos.map(function (d) { return d.periodo; }))) + '.', 'Registrar', function () {
            var db = BD.cargar();
            var ahora = new Date().toISOString();
            var pago = {
                id: db.siguienteIdPago++,
                socioId: socio.id,
                periodos: periodos.map(function (d) { return d.periodo; }),
                monto: monto,
                metodo: f.metodo.value,
                estado: 'confirmado',
                fecha: ahora,
                nroTransaccion: f.nro.value.trim(),
                comprobante: '',
                registradoPor: Sesion.actual().usuario,
                verificadoPor: Sesion.actual().usuario,
                fechaVerificacion: ahora
            };
            db.pagos.push(pago);
            if (!BD.guardar()) return;
            aviso('Cobro registrado.');
            formularioCobro(socio);
            imprimirRecibo(pago);
        });
    };
}

function imprimirRecibo(pago) {
    var so = buscarSocioPorId(pago.socioId);
    var c = Modal.abrir({ titulo: 'Recibo N° ' + pago.id, ancho: 'chico', enfocar: false, html:
        '<div id="p-recibo">' +
            '<p class="otb-texto"><b>OTB VILLA ESPERANZA</b><br>Sistema de Cobro de Agua</p>' +
            '<p class="otb-texto">Recibo N° <b>' + pago.id + '</b><br>' + fechaHora(pago.fechaVerificacion || pago.fecha) + '</p>' +
            '<p class="otb-texto">Socio: <b>' + esc(so ? so.nombre : '') + '</b><br>CI: ' + esc(so ? so.ci : '') +
            '<br>Medidor: ' + esc(so ? so.medidor : '') + '</p>' +
            '<p class="otb-texto">Meses: ' + esc(pago.periodos.map(nombrePeriodo).join(', ')) + '<br>' +
            'Método: ' + metodoTexto(pago.metodo) + '</p>' +
            '<div class="otb-total"><span>Total pagado</span><b>Bs. ' + bs(pago.monto) + '</b></div>' +
            '<p class="otb-suave otb-mini">Registrado por: ' + esc(pago.verificadoPor || pago.registradoPor) + '</p>' +
        '</div>' +
        '<button type="button" class="otb-btn otb-btn-pri otb-btn-bloque" id="p-imprimir">🖨 Imprimir recibo</button>' });
    c.querySelector('#p-imprimir').onclick = function () {
        var v = window.open('', '_blank', 'width=420,height=600');
        if (!v) { aviso('El navegador bloqueó la ventana de impresión.', 'error'); return; }
        v.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Recibo ' + pago.id + '</title>' +
            '<style>body{font-family:Arial,sans-serif;padding:20px;color:#111}p{margin:0 0 12px;line-height:1.5}' +
            '.otb-total{display:flex;justify-content:space-between;border-top:2px solid #111;border-bottom:2px solid #111;padding:10px 0;margin:10px 0;font-size:18px}' +
            '.otb-suave{color:#555;font-size:12px}</style></head><body>' +
            document.getElementById('p-recibo').innerHTML + '</body></html>');
        v.document.close();
        v.focus();
        v.print();
    };
}

/* ================= DEUDORES ================= */

function verDeudores() {
    var db = BD.cargar();
    var filas = db.socios.map(function (so) { return { so: so, c: estadoCuenta(so) }; })
        .filter(function (x) { return x.c.deuda > 0; })
        .sort(function (a, b) { return b.c.deuda - a.c.deuda; });
    var total = filas.reduce(function (t, x) { return t + x.c.deuda; }, 0);

    contenido.innerHTML = cabecera('Deudores',
        filas.length + ' socio(s) con deuda · Total: <b>Bs. ' + bs(total) + '</b>') +
        (filas.length ? '<div class="p-tabla-caja"><table class="p-tabla"><thead><tr>' +
            '<th>Socio</th><th>CI</th><th>Dirección</th><th>Meses</th><th class="num">Deuda (Bs.)</th><th></th>' +
        '</tr></thead><tbody>' + filas.map(function (x) {
            return '<tr><td><b>' + esc(x.so.nombre) + '</b></td><td>' + esc(x.so.ci) + '</td><td>' + esc(x.so.direccion) + '</td>' +
                '<td>' + etiqueta('debe').replace('Pendiente', x.c.periodosDebe.length + (x.c.periodosDebe.length === 1 ? ' mes' : ' meses')) + '</td>' +
                '<td class="num"><b>' + bs(x.c.deuda) + '</b></td>' +
                '<td class="p-acciones"><button class="otb-btn otb-btn-sec otb-btn-chico" data-cobrar="' + x.so.id + '">Cobrar</button></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="p-tarjeta p-vacio">✓ Todos los socios están al día.</div>');

    contenido.querySelectorAll('[data-cobrar]').forEach(function (b) {
        b.onclick = function () {
            cobroPendiente = +b.dataset.cobrar;
            location.hash = 'cobrar';
        };
    });
}

/* ================= HISTORIAL DE PAGOS ================= */

function tablaPagos(pagos, conAcciones) {
    if (!pagos.length) return '<p class="p-vacio">No hay pagos para mostrar.</p>';
    return '<div class="p-tabla-caja"><table class="p-tabla"><thead><tr>' +
        '<th>N°</th><th>Fecha</th><th>Socio</th><th>Meses</th><th>Método</th><th class="num">Monto (Bs.)</th><th>Estado</th><th>Verificó</th>' +
        (conAcciones ? '<th></th>' : '') +
    '</tr></thead><tbody>' + pagos.map(function (p) {
        var so = buscarSocioPorId(p.socioId);
        return '<tr><td>' + p.id + '</td><td>' + fechaCorta(p.fecha) + '</td>' +
            '<td>' + esc(so ? so.nombre : '(eliminado)') + '</td>' +
            '<td>' + esc(listaPeriodos(p.periodos)) + '</td>' +
            '<td>' + metodoTexto(p.metodo) + '</td>' +
            '<td class="num">' + bs(p.monto) + '</td>' +
            '<td>' + etiqueta(p.estado) + (p.motivoRechazo ? '<br><small class="otb-suave">' + esc(p.motivoRechazo) + '</small>' : '') + '</td>' +
            '<td>' + esc(p.verificadoPor || '—') + '</td>' +
            (conAcciones ? '<td class="p-acciones">' + (p.estado === 'confirmado'
                ? '<button class="otb-btn otb-btn-sec otb-btn-chico" data-recibo="' + p.id + '">Recibo</button>' : '') + '</td>' : '') +
        '</tr>';
    }).join('') + '</tbody></table></div>';
}

function verPagos() {
    contenido.innerHTML = cabecera('Historial de pagos', 'Todos los pagos registrados, del más reciente al más antiguo.') +
        '<div class="p-fila otb-form" style="flex-direction:row">' +
            '<label class="p-crece">Buscar socio<input id="p-f-texto" placeholder="Nombre o CI"></label>' +
            '<label>Estado<select id="p-f-estado">' +
                '<option value="">Todos</option><option value="confirmado">Confirmados</option>' +
                '<option value="pendiente">Por verificar</option><option value="rechazado">Rechazados</option>' +
            '</select></label>' +
            '<label>Método<select id="p-f-metodo">' +
                '<option value="">Todos</option><option value="qr">QR</option><option value="efectivo">Efectivo</option><option value="deposito">Depósito</option>' +
            '</select></label>' +
        '</div>' +
        '<div id="p-lista-pagos"></div>';

    function filtrar() {
        var db = BD.cargar();
        var texto = document.getElementById('p-f-texto').value;
        var estado = document.getElementById('p-f-estado').value;
        var metodo = document.getElementById('p-f-metodo').value;
        var ids = texto.trim() ? buscarSocios(texto).map(function (s) { return s.id; }) : null;
        var lista = db.pagos.filter(function (p) {
            return (!estado || p.estado === estado) && (!metodo || p.metodo === metodo) &&
                   (!ids || ids.indexOf(p.socioId) !== -1);
        }).sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
        var total = lista.filter(function (p) { return p.estado === 'confirmado'; })
            .reduce(function (t, p) { return t + p.monto; }, 0);
        var caja = document.getElementById('p-lista-pagos');
        caja.innerHTML = '<p class="otb-suave" style="margin:0 0 8px">' + lista.length + ' pago(s) · Confirmado: <b>Bs. ' + bs(total) + '</b></p>' +
            tablaPagos(lista, true);
        caja.querySelectorAll('[data-recibo]').forEach(function (b) {
            b.onclick = function () {
                imprimirRecibo(BD.cargar().pagos.find(function (p) { return p.id === +b.dataset.recibo; }));
            };
        });
    }
    ['p-f-texto', 'p-f-estado', 'p-f-metodo'].forEach(function (id) {
        document.getElementById(id).addEventListener('input', filtrar);
    });
    filtrar();
}

/* ================= SOCIOS (admin) ================= */

function verSocios() {
    contenido.innerHTML = cabecera('Socios y viviendas', 'Registra, edita o elimina a los socios de la OTB.') +
        '<div class="p-fila otb-form" style="flex-direction:row">' +
            '<label class="p-crece">Buscar<input id="p-s-buscar" placeholder="Nombre, CI o código"></label>' +
            '<button class="otb-btn otb-btn-pri" id="p-s-nuevo">+ Nuevo socio</button>' +
        '</div>' +
        '<div id="p-s-lista"></div>';

    function listar() {
        var db = BD.cargar();
        var q = document.getElementById('p-s-buscar').value;
        var lista = q.trim() ? buscarSocios(q) : db.socios.slice();
        document.getElementById('p-s-lista').innerHTML = lista.length
            ? '<div class="p-tabla-caja"><table class="p-tabla"><thead><tr>' +
                '<th>Código</th><th>Nombre</th><th>CI</th><th>Dirección</th><th>Medidor</th><th>Estado</th><th></th>' +
              '</tr></thead><tbody>' + lista.map(function (so) {
                var c = estadoCuenta(so);
                return '<tr><td>' + esc(so.codigo) + '</td><td><b>' + esc(so.nombre) + '</b></td><td>' + esc(so.ci) + '</td>' +
                    '<td>' + esc(so.direccion) + '</td><td>' + esc(so.medidor) + '</td>' +
                    '<td>' + (c.deuda > 0 ? etiqueta('debe').replace('Pendiente', 'Bs. ' + bs(c.deuda)) : etiqueta('pagado').replace('Pagado', 'Al día')) + '</td>' +
                    '<td class="p-acciones"><button class="otb-btn otb-btn-sec otb-btn-chico" data-editar="' + so.id + '">Editar</button>' +
                    '<button class="otb-btn otb-btn-sec otb-btn-chico" data-borrar="' + so.id + '">Eliminar</button></td></tr>';
              }).join('') + '</tbody></table></div>'
            : '<p class="p-vacio">Sin resultados.</p>';

        contenido.querySelectorAll('[data-editar]').forEach(function (b) {
            b.onclick = function () { formularioSocio(buscarSocioPorId(b.dataset.editar), listar); };
        });
        contenido.querySelectorAll('[data-borrar]').forEach(function (b) {
            b.onclick = function () {
                var so = buscarSocioPorId(b.dataset.borrar);
                Modal.confirmar('Eliminar socio', '¿Eliminar a <b>' + esc(so.nombre) + '</b>? Se borrarán también sus lecturas y pagos. ' +
                    'Esta acción no se puede deshacer.', 'Eliminar', function () {
                    var db = BD.cargar();
                    db.socios = db.socios.filter(function (x) { return x.id !== so.id; });
                    db.pagos = db.pagos.filter(function (p) { return p.socioId !== so.id; });
                    BD.guardar();
                    aviso('Socio eliminado.');
                    listar();
                }, true);
            };
        });
    }
    document.getElementById('p-s-buscar').oninput = listar;
    document.getElementById('p-s-nuevo').onclick = function () { formularioSocio(null, listar); };
    listar();
}

function formularioSocio(socio, alGuardar) {
    var db = BD.cargar();
    var siguienteMedidor = 'A-' + String(db.socios.length ? 123 + db.socios.length * 7 : 123).padStart(6, '0');
    var c = Modal.abrir({ titulo: socio ? 'Editar socio' : 'Nuevo socio', html:
        '<form class="otb-form">' +
            '<label>Nombre completo<input name="nombre" required maxlength="40" value="' + esc(socio ? socio.nombre : '') + '"></label>' +
            '<label>Carnet de identidad (CI)<input name="ci" required inputmode="numeric" pattern="[0-9]{5,10}" title="Solo números (5 a 10 dígitos)" value="' + esc(socio ? socio.ci : '') + '"></label>' +
            '<label>Dirección de la vivienda<input name="direccion" required maxlength="40" placeholder="Ej: Calle Los Pinos #20" value="' + esc(socio ? socio.direccion : '') + '"></label>' +
            '<label>Número de medidor<input name="medidor" required maxlength="15" value="' + esc(socio ? socio.medidor : siguienteMedidor) + '"></label>' +
            '<p class="otb-error" hidden></p>' +
            '<button class="otb-btn otb-btn-pri otb-btn-bloque" type="submit">' + (socio ? 'Guardar cambios' : 'Registrar socio') + '</button>' +
        '</form>' });
    c.querySelector('form').onsubmit = function (e) {
        e.preventDefault();
        var f = this, err = f.querySelector('.otb-error');
        var ci = f.ci.value.trim();
        var repetido = db.socios.find(function (x) { return x.ci === ci && (!socio || x.id !== socio.id); });
        if (repetido) { err.textContent = 'Ya existe un socio con ese CI (' + repetido.nombre + ').'; err.hidden = false; return; }
        var datos = { nombre: f.nombre.value.trim(), ci: ci, direccion: f.direccion.value.trim(), medidor: f.medidor.value.trim() };
        if (socio) {
            Object.assign(socio, datos);
        } else {
            var id = db.socios.reduce(function (m, x) { return Math.max(m, x.id); }, 10000) + 1;
            db.socios.push(Object.assign({ id: id, codigo: String(id), lecturas: {} }, datos));
        }
        BD.guardar();
        Modal.cerrar();
        aviso(socio ? 'Datos actualizados.' : 'Socio registrado. Registra su lectura en "Lecturas".');
        alGuardar();
    };
}

/* ================= LECTURAS (admin) ================= */

function verLecturas() {
    var db = BD.cargar();
    var ultimo = db.periodos[db.periodos.length - 1];
    var nuevo = siguientePeriodo(ultimo);

    contenido.innerHTML = cabecera('Lecturas de medidores',
        'Registra los m³ consumidos por cada vivienda. El monto se calcula con las tarifas vigentes. ' +
        'Los meses ya pagados no se pueden modificar.') +
        '<div class="p-fila otb-form" style="flex-direction:row">' +
            '<label>Periodo<select id="p-l-periodo">' +
                '<option value="' + nuevo + '">➕ ' + nombrePeriodo(nuevo) + ' (nuevo)</option>' +
                db.periodos.slice().reverse().map(function (p) {
                    return '<option value="' + p + '">' + nombrePeriodo(p) + '</option>';
                }).join('') +
            '</select></label>' +
        '</div>' +
        '<div id="p-l-tabla"></div>';

    var sel = document.getElementById('p-l-periodo');
    sel.value = ultimo;

    function mostrar() {
        var p = sel.value;
        var esNuevo = db.periodos.indexOf(p) === -1;
        var caja = document.getElementById('p-l-tabla');
        caja.innerHTML = '<div class="p-tabla-caja"><table class="p-tabla"><thead><tr>' +
            '<th>Socio</th><th>Medidor</th><th class="num">Consumo (m³)</th><th class="num">Monto (Bs.)</th><th>Estado</th>' +
        '</tr></thead><tbody>' + db.socios.map(function (so) {
            var l = so.lecturas[p];
            var est = 'debe';
            if (l) {
                var d = estadoCuenta(so).detalle.find(function (x) { return x.periodo === p; });
                est = d ? d.estado : 'debe';
            }
            var bloqueado = l && est !== 'debe';
            return '<tr><td><b>' + esc(so.nombre) + '</b><br><small class="otb-suave">' + esc(so.direccion) + '</small></td>' +
                '<td>' + esc(so.medidor) + '</td>' +
                '<td class="num"><input type="number" min="0" max="999" step="1" data-socio="' + so.id + '" value="' + (l ? l.m3 : '') + '"' + (bloqueado ? ' disabled' : '') + ' aria-label="Consumo de ' + esc(so.nombre) + '"></td>' +
                '<td class="num" data-monto="' + so.id + '">' + (l ? bs(l.monto) : '—') + '</td>' +
                '<td>' + (l ? etiqueta(est) : '<span class="otb-suave">Sin lectura</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="otb-acciones"><button class="otb-btn otb-btn-ok" id="p-l-guardar">' +
            (esNuevo ? 'Crear periodo ' + nombrePeriodo(p) : 'Guardar lecturas') + '</button></div>';

        caja.querySelectorAll('input[data-socio]').forEach(function (inp) {
            inp.oninput = function () {
                var v = inp.value === '' ? null : Math.max(0, Math.round(+inp.value));
                caja.querySelector('[data-monto="' + inp.dataset.socio + '"]').textContent = v === null ? '—' : bs(calcularMonto(v));
            };
        });

        document.getElementById('p-l-guardar').onclick = function () {
            var inputs = caja.querySelectorAll('input[data-socio]:not(:disabled)');
            var vacios = 0, cambios = 0;
            inputs.forEach(function (inp) {
                var so = buscarSocioPorId(inp.dataset.socio);
                if (inp.value === '') { vacios++; return; }
                var m3 = Math.max(0, Math.round(+inp.value));
                so.lecturas[p] = { m3: m3, monto: calcularMonto(m3) };
                cambios++;
            });
            if (!cambios) { aviso('Ingresa al menos una lectura.', 'error'); return; }
            if (esNuevo) db.periodos.push(p);
            BD.guardar();
            aviso('Lecturas guardadas' + (vacios ? ' (' + vacios + ' sin lectura)' : '') + '.');
            verLecturas();
            document.getElementById('p-l-periodo').value = p;
            document.getElementById('p-l-periodo').onchange();
        };
    }
    sel.onchange = mostrar;
    mostrar();
}

/* ================= TARIFAS Y CONTENIDO (admin) ================= */

function verContenido() {
    var db = BD.cargar();
    contenido.innerHTML = cabecera('Tarifas y contenido', 'Estos datos se muestran en las páginas públicas (Información, Contacto y Pago).') +
        '<div class="p-rejilla">' +
            '<div class="p-tarjeta"><h3>💧 Tarifas por m³</h3>' +
                '<p class="otb-suave otb-mini">Los cambios se aplican a las lecturas nuevas. Los meses ya registrados mantienen su monto.</p>' +
                '<form class="otb-form" id="p-f-tarifas"><div class="p-tabla-caja"><table class="p-tabla"><thead><tr><th>Rango (m³)</th><th class="num">Hasta</th><th class="num">Bs. por m³</th></tr></thead><tbody>' +
                db.tarifas.map(function (t, i) {
                    var ultimo = i === db.tarifas.length - 1;
                    return '<tr><td>' + (ultimo ? 'Más de ' + (t.desde - 1) : 'Desde ' + t.desde) + '</td>' +
                        '<td class="num">' + (ultimo ? '—' : '<input type="number" min="1" name="hasta' + i + '" value="' + t.hasta + '">') + '</td>' +
                        '<td class="num"><input type="number" min="0" step="0.01" name="precio' + i + '" value="' + t.precio.toFixed(2) + '" required></td></tr>';
                }).join('') + '</tbody></table></div>' +
                '<button class="otb-btn otb-btn-pri" type="submit">Guardar tarifas</button></form>' +
            '</div>' +
            '<div class="p-tarjeta"><h3>📞 Datos de contacto</h3>' +
                '<form class="otb-form" id="p-f-contacto">' +
                    '<label>Dirección<input name="direccion" required value="' + esc(db.contacto.direccion) + '"></label>' +
                    '<label>Teléfono<input name="telefono" required value="' + esc(db.contacto.telefono) + '"></label>' +
                    '<label>Correo<input name="correo" type="email" required value="' + esc(db.contacto.correo) + '"></label>' +
                    '<button class="otb-btn otb-btn-pri" type="submit">Guardar contacto</button>' +
                '</form>' +
            '</div>' +
            '<div class="p-tarjeta"><h3>🔳 Código QR de cobro</h3>' +
                '<form class="otb-form" id="p-f-qr">' +
                    '<img src="' + esc(db.cuentaQR.imagen) + '" alt="QR actual" style="max-width:180px;border-radius:8px;border:1px solid #c9dceb;align-self:center">' +
                    '<label>Cambiar imagen del QR<input name="imagen" type="file" accept="image/*"></label>' +
                    '<label>Número de cuenta<input name="cuenta" required value="' + esc(db.cuentaQR.cuenta) + '"></label>' +
                    '<label>Banco / billetera<input name="banco" required value="' + esc(db.cuentaQR.banco) + '"></label>' +
                    '<button class="otb-btn otb-btn-pri" type="submit">Guardar QR</button>' +
                    (db.cuentaQR.imagen !== 'img/qr.JPG' ? '<button class="otb-btn otb-btn-sec" type="button" id="p-qr-original">Volver al QR original</button>' : '') +
                '</form>' +
            '</div>' +
        '</div>';

    document.getElementById('p-f-tarifas').onsubmit = function (e) {
        e.preventDefault();
        var f = this, nuevas = [], desde = 0;
        for (var i = 0; i < db.tarifas.length; i++) {
            var ultimo = i === db.tarifas.length - 1;
            var hasta = ultimo ? null : Math.round(+f['hasta' + i].value);
            if (!ultimo && hasta < desde) { aviso('Los rangos deben ir de menor a mayor.', 'error'); return; }
            nuevas.push({ desde: desde, hasta: hasta, precio: Math.round(+f['precio' + i].value * 100) / 100 });
            desde = hasta + 1;
        }
        db.tarifas = nuevas;
        BD.guardar();
        aviso('Tarifas guardadas.');
        verContenido();
    };
    document.getElementById('p-f-contacto').onsubmit = function (e) {
        e.preventDefault();
        db.contacto = { direccion: this.direccion.value.trim(), telefono: this.telefono.value.trim(), correo: this.correo.value.trim() };
        BD.guardar();
        aviso('Datos de contacto guardados.');
    };
    var fqr = document.getElementById('p-f-qr');
    var nuevaImagen = null;
    fqr.imagen.onchange = function () {
        var archivo = this.files[0];
        if (!archivo) return;
        var lector = new FileReader();
        lector.onload = function () {
            var img = new Image();
            img.onload = function () {
                var escala = Math.min(1, 1000 / Math.max(img.width, img.height));
                var cv = document.createElement('canvas');
                cv.width = Math.round(img.width * escala); cv.height = Math.round(img.height * escala);
                cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                nuevaImagen = cv.toDataURL('image/jpeg', 0.92);
                fqr.querySelector('img').src = nuevaImagen;
            };
            img.src = lector.result;
        };
        lector.readAsDataURL(archivo);
    };
    fqr.onsubmit = function (e) {
        e.preventDefault();
        if (nuevaImagen) db.cuentaQR.imagen = nuevaImagen;
        db.cuentaQR.cuenta = this.cuenta.value.trim();
        db.cuentaQR.banco = this.banco.value.trim();
        if (BD.guardar()) { aviso('QR guardado.'); verContenido(); }
    };
    var orig = document.getElementById('p-qr-original');
    if (orig) orig.onclick = function () {
        db.cuentaQR.imagen = 'img/qr.JPG';
        BD.guardar(); aviso('Se restauró el QR original.'); verContenido();
    };
}

/* ================= MENSAJES (admin) ================= */

function verMensajes() {
    var db = BD.cargar();
    var lista = db.mensajes.slice().sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
    contenido.innerHTML = cabecera('Mensajes de contacto', 'Mensajes enviados desde la página de Contacto.') +
        (lista.length ? lista.map(function (m) {
            return '<div class="p-tarjeta p-mensaje' + (m.leido ? ' leido' : '') + '">' +
                '<div class="p-mensaje-cab"><b>' + esc(m.asunto === 'Selecciona un asunto' ? 'Sin asunto' : m.asunto) + '</b>' +
                '<span class="otb-suave">' + fechaHora(m.fecha) + '</span></div>' +
                '<div>' + esc(m.nombre) + (m.correo ? ' · <a href="mailto:' + esc(m.correo) + '">' + esc(m.correo) + '</a>' : '') + '</div>' +
                '<p>' + esc(m.mensaje) + '</p>' +
                '<div class="p-botones">' +
                    (m.leido ? '' : '<button class="otb-btn otb-btn-sec otb-btn-chico" data-leido="' + m.id + '">Marcar como leído</button>') +
                    '<button class="otb-btn otb-btn-sec otb-btn-chico" data-borrar="' + m.id + '">Eliminar</button>' +
                '</div></div>';
        }).join('') : '<div class="p-tarjeta p-vacio">No hay mensajes.</div>');

    contenido.querySelectorAll('[data-leido]').forEach(function (b) {
        b.onclick = function () {
            db.mensajes.find(function (m) { return m.id === +b.dataset.leido; }).leido = true;
            BD.guardar(); refrescar();
        };
    });
    contenido.querySelectorAll('[data-borrar]').forEach(function (b) {
        b.onclick = function () {
            db.mensajes = db.mensajes.filter(function (m) { return m.id !== +b.dataset.borrar; });
            BD.guardar(); refrescar();
        };
    });
}

/* ================= USUARIOS (super admin) ================= */

function verUsuarios() {
    var db = BD.cargar();
    var yo = Sesion.actual().usuario;
    contenido.innerHTML = cabecera('Usuarios del sistema',
        '<b>Cobrador</b>: verifica y registra pagos. <b>Administrador</b>: además gestiona socios, lecturas, tarifas y contenido. ' +
        '<b>Super Admin</b>: además gestiona usuarios y respaldos.') +
        '<div class="otb-acciones" style="margin:0 0 12px"><button class="otb-btn otb-btn-pri" id="p-u-nuevo">+ Nuevo usuario</button></div>' +
        '<div class="p-tabla-caja"><table class="p-tabla"><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>' +
        db.usuarios.map(function (u, i) {
            return '<tr><td><b>' + esc(u.usuario) + '</b>' + (u.usuario === yo ? ' <small class="otb-suave">(tú)</small>' : '') + '</td>' +
                '<td>' + esc(u.nombre) + '</td><td><span class="p-rol p-rol-' + u.rol + '">' + ROLES[u.rol] + '</span></td>' +
                '<td>' + (u.activo ? etiqueta('confirmado').replace('Confirmado', 'Activo') : etiqueta('inactivo').replace('inactivo<', 'Inactivo<')) + '</td>' +
                '<td class="p-acciones"><button class="otb-btn otb-btn-sec otb-btn-chico" data-editar="' + i + '">Editar</button>' +
                (u.usuario !== yo ? '<button class="otb-btn otb-btn-sec otb-btn-chico" data-borrar="' + i + '">Eliminar</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';

    document.getElementById('p-u-nuevo').onclick = function () { formularioUsuario(null); };
    contenido.querySelectorAll('[data-editar]').forEach(function (b) {
        b.onclick = function () { formularioUsuario(db.usuarios[+b.dataset.editar]); };
    });
    contenido.querySelectorAll('[data-borrar]').forEach(function (b) {
        b.onclick = function () {
            var u = db.usuarios[+b.dataset.borrar];
            if (u.rol === 'superadmin' && superadminsActivos(u) === 0) {
                aviso('Debe quedar al menos un Super Admin activo.', 'error'); return;
            }
            Modal.confirmar('Eliminar usuario', '¿Eliminar al usuario <b>' + esc(u.usuario) + '</b>?', 'Eliminar', function () {
                db.usuarios.splice(db.usuarios.indexOf(u), 1);
                BD.guardar(); aviso('Usuario eliminado.'); refrescar();
            }, true);
        };
    });
}

function superadminsActivos(excepto) {
    return BD.cargar().usuarios.filter(function (u) { return u !== excepto && u.rol === 'superadmin' && u.activo; }).length;
}

function formularioUsuario(u) {
    var db = BD.cargar();
    var yo = Sesion.actual().usuario;
    var c = Modal.abrir({ titulo: u ? 'Editar usuario' : 'Nuevo usuario', html:
        '<form class="otb-form">' +
            '<label>Usuario (para ingresar)<input name="usuario" required pattern="[a-zA-Z0-9._-]{3,20}" title="3 a 20 letras o números, sin espacios" value="' + esc(u ? u.usuario : '') + '"' + (u ? ' disabled' : '') + '></label>' +
            '<label>Nombre<input name="nombre" required maxlength="40" value="' + esc(u ? u.nombre : '') + '"></label>' +
            '<label>Rol<select name="rol">' +
                Object.keys(ROLES).map(function (r) {
                    return '<option value="' + r + '"' + (u && u.rol === r ? ' selected' : '') + '>' + ROLES[r] + '</option>';
                }).join('') +
            '</select></label>' +
            (u ? '<label style="flex-direction:row;align-items:center"><input name="activo" type="checkbox" style="width:20px;min-height:20px"' + (u.activo ? ' checked' : '') + (u.usuario === yo ? ' disabled' : '') + '> Usuario activo</label>' : '') +
            '<label>' + (u ? 'Nueva contraseña <span class="otb-suave">(dejar vacío para no cambiar)</span>' : 'Contraseña') +
                '<input name="clave" type="password" minlength="6" autocomplete="new-password"' + (u ? '' : ' required') + '></label>' +
            '<p class="otb-error" hidden></p>' +
            '<button class="otb-btn otb-btn-pri otb-btn-bloque" type="submit">' + (u ? 'Guardar' : 'Crear usuario') + '</button>' +
        '</form>' });
    c.querySelector('form').onsubmit = function (e) {
        e.preventDefault();
        var f = this, err = f.querySelector('.otb-error');
        function error(t) { err.textContent = t; err.hidden = false; }
        if (!u) {
            var nombreUsuario = f.usuario.value.trim();
            if (db.usuarios.some(function (x) { return normalizar(x.usuario) === normalizar(nombreUsuario); })) return error('Ese usuario ya existe.');
            db.usuarios.push({ usuario: nombreUsuario, nombre: f.nombre.value.trim(), rol: f.rol.value,
                               hash: hashClave(nombreUsuario, f.clave.value), activo: true });
        } else {
            var activo = f.activo ? f.activo.checked : true;
            if (u.rol === 'superadmin' && (f.rol.value !== 'superadmin' || !activo) && superadminsActivos(u) === 0) {
                return error('Debe quedar al menos un Super Admin activo.');
            }
            if (u.usuario === yo && f.rol.value !== u.rol) return error('No puedes cambiar tu propio rol.');
            u.nombre = f.nombre.value.trim();
            u.rol = f.rol.value;
            if (u.usuario !== yo) u.activo = activo;
            if (f.clave.value) u.hash = hashClave(u.usuario, f.clave.value);
        }
        BD.guardar();
        Modal.cerrar();
        aviso(u ? 'Usuario actualizado.' : 'Usuario creado.');
        refrescar();
    };
}

/* ================= RESPALDO (super admin) ================= */

function verDatos() {
    var db = BD.cargar();
    var tamano = 0;
    try { tamano = (localStorage.getItem(CLAVE_BD) || '').length; } catch (e) {}

    contenido.innerHTML = cabecera('Respaldo de datos',
        'Los datos se guardan <b>en este navegador</b>. Para pasarlos a otra computadora o celular, descarga un respaldo aquí y cárgalo en el otro equipo.') +
        '<div class="p-nota">⚠️ Si se borra el historial o los datos del navegador, se pierde la información que no esté respaldada. Descarga un respaldo con frecuencia.</div>' +
        '<div class="p-indicadores">' +
            '<div class="p-indicador"><span>Socios</span><b>' + db.socios.length + '</b></div>' +
            '<div class="p-indicador"><span>Pagos</span><b>' + db.pagos.length + '</b></div>' +
            '<div class="p-indicador"><span>Periodos</span><b>' + db.periodos.length + '</b></div>' +
            '<div class="p-indicador"><span>Espacio usado</span><b>' + (tamano / 1024 / 1024 * 2).toFixed(2) + ' MB</b></div>' +
        '</div>' +
        '<div class="p-rejilla">' +
            '<div class="p-tarjeta"><h3>⬇ Descargar respaldo</h3><p class="otb-suave otb-mini">Guarda un archivo .json con todos los datos.</p>' +
                '<button class="otb-btn otb-btn-pri" id="p-exportar">Descargar respaldo</button></div>' +
            '<div class="p-tarjeta"><h3>⬆ Cargar respaldo</h3><p class="otb-suave otb-mini">Reemplaza TODOS los datos actuales por los del archivo.</p>' +
                '<form class="otb-form"><input type="file" accept=".json,application/json" id="p-importar"></form></div>' +
            '<div class="p-tarjeta"><h3>↺ Datos de demostración</h3><p class="otb-suave otb-mini">Borra todo y vuelve a los 10 socios de ejemplo y usuarios iniciales.</p>' +
                '<button class="otb-btn otb-btn-peligro" id="p-reset">Restablecer datos</button></div>' +
        '</div>';

    document.getElementById('p-exportar').onclick = function () {
        var blob = new Blob([JSON.stringify(BD.cargar(), null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        var hoy = new Date();
        a.href = URL.createObjectURL(blob);
        a.download = 'respaldo-otb-' + hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0') + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    document.getElementById('p-importar').onchange = function () {
        var archivo = this.files[0];
        if (!archivo) return;
        var lector = new FileReader();
        lector.onload = function () {
            var datos;
            try { datos = JSON.parse(lector.result); } catch (e) { aviso('El archivo no es un respaldo válido.', 'error'); return; }
            if (!datos || !Array.isArray(datos.socios) || !Array.isArray(datos.pagos) || !Array.isArray(datos.usuarios) || !Array.isArray(datos.periodos)) {
                aviso('El archivo no es un respaldo válido.', 'error'); return;
            }
            Modal.confirmar('Cargar respaldo', 'Se reemplazarán todos los datos actuales por los del archivo <b>' + esc(archivo.name) + '</b>.', 'Cargar', function () {
                BD._cache = datos;
                if (BD.guardar()) { aviso('Respaldo cargado.'); dibujar(); }
            }, true);
        };
        lector.readAsText(archivo);
    };
    document.getElementById('p-reset').onclick = function () {
        Modal.confirmar('Restablecer datos', 'Se borrarán <b>todos</b> los pagos, socios, usuarios y mensajes, y se cargarán los datos de ejemplo. ¿Continuar?', 'Sí, restablecer', function () {
            BD.restablecer();
            Sesion.cerrar();
            aviso('Datos restablecidos. Vuelve a iniciar sesión.');
            dibujar();
        }, true);
    };
}

/* ================= MI CUENTA ================= */

function verCuenta() {
    var s = Sesion.actual();
    contenido.innerHTML = cabecera('Mi cuenta', 'Usuario: <b>' + esc(s.usuario) + '</b> · Rol: <b>' + ROLES[s.rol] + '</b>') +
        '<div class="p-tarjeta" style="max-width:460px"><h3>Cambiar contraseña</h3>' +
        '<form class="otb-form" id="p-f-clave">' +
            '<label>Contraseña actual<input name="actual" type="password" required autocomplete="current-password"></label>' +
            '<label>Nueva contraseña<input name="nueva" type="password" required minlength="6" autocomplete="new-password"></label>' +
            '<label>Repite la nueva contraseña<input name="repite" type="password" required minlength="6" autocomplete="new-password"></label>' +
            '<p class="otb-error" hidden></p>' +
            '<button class="otb-btn otb-btn-pri" type="submit">Cambiar contraseña</button>' +
        '</form></div>';
    document.getElementById('p-f-clave').onsubmit = function (e) {
        e.preventDefault();
        var f = this, err = f.querySelector('.otb-error');
        var u = BD.cargar().usuarios.find(function (x) { return x.usuario === s.usuario; });
        if (u.hash !== hashClave(u.usuario, f.actual.value)) { err.textContent = 'La contraseña actual no es correcta.'; err.hidden = false; return; }
        if (f.nueva.value !== f.repite.value) { err.textContent = 'Las contraseñas nuevas no coinciden.'; err.hidden = false; return; }
        u.hash = hashClave(u.usuario, f.nueva.value);
        BD.guardar();
        f.reset(); err.hidden = true;
        aviso('Contraseña actualizada.');
    };
}
