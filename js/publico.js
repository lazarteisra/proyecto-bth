/* =========================================================
   PÁGINAS PÚBLICAS: búsqueda de socios, consulta de deuda,
   pago con QR, tarifas y formulario de contacto.
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {
    var pagina = document.body.getAttribute('data-pagina');
    prepararBuscador(pagina);

    if (pagina === 'inicio') {
        var pagarEjemplo = document.querySelector('.pagar');
        if (pagarEjemplo) pagarEjemplo.onclick = function () { location.href = 'index1.html'; };
    }
    if (pagina === 'consulta') iniciarConsulta();
    if (pagina === 'informacion') mostrarTarifas();
    if (pagina === 'contacto') iniciarContacto();
});

/* ---------------- Buscador (Inicio y Consulta) ---------------- */

function prepararBuscador(pagina) {
    var caja = document.querySelector('.caja');
    var boton = document.querySelector('.pepe');
    if (!caja || !boton) return;

    caja.placeholder = 'Ej: 4827163 o Juan Pérez';
    caja.setAttribute('aria-label', 'Carnet de identidad o nombre');
    caja.setAttribute('autocomplete', 'off');

    function buscar() {
        var texto = caja.value.trim();
        if (!texto) {
            aviso('Escribe tu número de carnet (CI) o tu nombre.', 'error');
            caja.focus();
            return;
        }
        var resultados = buscarSocios(texto);
        if (!resultados.length) {
            Modal.abrir({ titulo: 'Sin resultados', ancho: 'chico', html:
                '<p class="otb-texto">No encontramos a ningún socio con <b>' + esc(texto) + '</b>.</p>' +
                '<p class="otb-texto otb-suave">Revisa que el número de carnet esté bien escrito, o busca por nombre y apellido. ' +
                'Si el problema continúa, comunícate con la OTB.</p>' });
            return;
        }
        if (resultados.length === 1) return elegir(resultados[0]);

        var c = Modal.abrir({ titulo: 'Se encontraron ' + resultados.length + ' personas', enfocar: false, html:
            '<p class="otb-texto otb-suave">Elige tu nombre:</p>' +
            '<div class="otb-lista">' + resultados.map(function (s) {
                return '<button type="button" class="otb-lista-item" data-id="' + s.id + '">' +
                    '<b>' + esc(s.nombre) + '</b>' +
                    '<span>CI ' + esc(ocultarCI(s.ci)) + ' · ' + esc(s.direccion) + '</span></button>';
            }).join('') + '</div>' });
        c.querySelectorAll('.otb-lista-item').forEach(function (b) {
            b.onclick = function () { Modal.cerrar(); elegir(buscarSocioPorId(b.dataset.id)); };
        });
    }

    function elegir(socio) {
        if (pagina === 'consulta') {
            mostrarSocio(socio);
            history.replaceState(null, '', 'index1.html?socio=' + socio.id);
        } else {
            location.href = 'index1.html?socio=' + socio.id;
        }
    }

    boton.onclick = buscar;
    caja.addEventListener('keydown', function (e) { if (e.key === 'Enter') buscar(); });
}

// En la lista de varios resultados se muestran solo los últimos dígitos
function ocultarCI(ci) {
    return ci.length > 3 ? '•••' + ci.slice(-3) : ci;
}

/* ---------------- Página Consulta ---------------- */

var socioActual = null;

function iniciarConsulta() {
    var id = new URLSearchParams(location.search).get('socio');
    var socio = id ? buscarSocioPorId(id) : null;
    if (socio) mostrarSocio(socio);

    var pagar = document.querySelector('.pagar');
    if (pagar) pagar.onclick = function () {
        if (!socioActual) {
            aviso('Primero busca tu carnet o nombre para ver tu deuda.', 'error');
            document.querySelector('.caja').focus();
            return;
        }
        abrirPago(socioActual);
    };
}

function mostrarSocio(socio) {
    socioActual = socio;
    var cuenta = estadoCuenta(socio);
    var ultimo = cuenta.ultimo;

    // Datos del usuario (se respeta la misma estructura del diseño)
    var datos = document.querySelector('.datos .socio');
    datos.innerHTML = [
        esc(socio.codigo), esc(socio.nombre), esc(socio.direccion), esc(socio.medidor),
        '<b class="otb-estado-txt otb-estado-' + claseEstado(cuenta) + '">' + esc(textoEstado(cuenta)) + '</b>'
    ].join(' <br> <br>');

    // Resumen de cuenta
    var resumen = document.querySelector('.resumen .socio1');
    resumen.innerHTML = [
        'Bs. ' + bs(cuenta.deuda),
        ultimo ? ultimo.m3 + ' m³' : '—',
        ultimo ? nombrePeriodo(ultimo.periodo) : '—',
        cuenta.periodosDebe.length ? vencimientoPeriodo(cuenta.periodosDebe[0].periodo) : (ultimo ? vencimientoPeriodo(ultimo.periodo) : '—')
    ].join(' <br> <br>') + ' <br>';

    var pagar = document.querySelector('.pagar');
    if (cuenta.deuda > 0) {
        pagar.textContent = 'Pagar ahora · Bs. ' + bs(cuenta.deuda);
        pagar.classList.remove('otb-pagar-inactivo');
    } else {
        pagar.textContent = cuenta.periodosVerificacion.length ? 'Pago en verificación' : 'Estás al día ✓';
        pagar.classList.add('otb-pagar-inactivo');
    }

    // Historial: últimos 4 periodos (igual que el diseño)
    var tbody = document.querySelector('.historial tbody');
    var filas = cuenta.detalle.slice(-4).reverse();
    tbody.innerHTML = filas.map(function (d) {
        var etiqueta = { pagado: 'Pagado', verificacion: 'En verificación', debe: 'Pendiente' }[d.estado];
        return '<tr>' +
            '<td>' + (d.estado === 'debe' ? '—' : fechaCorta(d.fechaPago)) + '</td>' +
            '<td>' + nombrePeriodo(d.periodo) + '</td>' +
            '<td>' + d.m3 + '</td>' +
            '<td>' + bs(d.monto) + '</td>' +
            '<td><span class="estado' + (d.estado !== 'pagado' ? ' otb-estado-' + d.estado : '') + '">' + etiqueta + '</span></td>' +
        '</tr>';
    }).join('');

    var caja = document.querySelector('.caja');
    if (caja && !caja.value) caja.value = socio.ci;
}

function claseEstado(cuenta) {
    if (cuenta.periodosDebe.length) return 'debe';
    if (cuenta.periodosVerificacion.length) return 'verificacion';
    return 'pagado';
}

/* ---------------- Pago con QR ---------------- */

function abrirPago(socio) {
    var cuenta = estadoCuenta(socio);
    var db = BD.cargar();
    var qr = db.cuentaQR;

    if (!cuenta.periodosDebe.length) {
        Modal.abrir({ titulo: 'No tienes deuda', ancho: 'chico', html:
            cuenta.periodosVerificacion.length
                ? '<p class="otb-texto">Tu pago de <b>Bs. ' + bs(cuenta.enVerificacion) + '</b> está <b>en verificación</b>. ' +
                  'Un cobrador de la OTB lo confirmará pronto.</p>'
                : '<p class="otb-texto">¡Estás al día con tus pagos! Gracias por cumplir. 💧</p>' });
        return;
    }

    var c = Modal.abrir({ titulo: 'Pagar con QR', ancho: 'grande', enfocar: false, html:
        '<div class="otb-pago">' +
            '<div class="otb-pago-izq">' +
                '<p class="otb-texto"><b>' + esc(socio.nombre) + '</b><br><span class="otb-suave">Código de socio ' + esc(socio.codigo) + '</span></p>' +
                '<p class="otb-subtitulo">Meses a pagar</p>' +
                '<div class="otb-meses">' + cuenta.periodosDebe.map(function (d, i) {
                    return '<label class="otb-mes"><input type="checkbox" data-i="' + i + '" checked> ' +
                        '<span>' + nombrePeriodo(d.periodo) + ' <small>(' + d.m3 + ' m³)</small></span>' +
                        '<b>Bs. ' + bs(d.monto) + '</b></label>';
                }).join('') + '</div>' +
                '<p class="otb-suave otb-mini">Se pagan desde el mes más antiguo.</p>' +
                '<div class="otb-total"><span>Total a pagar</span><b id="otb-total">Bs. 0.00</b></div>' +
                '<p class="otb-subtitulo">Referencia / glosa</p>' +
                '<div class="otb-copiar"><code id="otb-glosa"></code><button type="button" class="otb-btn otb-btn-sec otb-btn-chico" id="otb-copiar">Copiar</button></div>' +
            '</div>' +
            '<div class="otb-pago-der">' +
                '<img class="otb-qr" src="' + esc(qr.imagen) + '" alt="Código QR de pago de la OTB Villa Esperanza">' +
                '<a class="otb-btn otb-btn-sec otb-btn-bloque" href="' + esc(qr.imagen) + '" download="QR-OTB-Villa-Esperanza.jpg">⬇ Descargar QR</a>' +
                '<p class="otb-suave otb-mini">Cuenta ' + esc(qr.cuenta) + ' · ' + esc(qr.banco) + '</p>' +
            '</div>' +
        '</div>' +
        '<ol class="otb-pasos">' +
            '<li>Escanea el QR con la app de tu banco. <span class="otb-suave">Si estás en el celular, descarga el QR y súbelo desde tu app.</span></li>' +
            '<li>Escribe el <b>monto exacto</b> y la <b>referencia</b> en la glosa.</li>' +
            '<li>Cuando termines, presiona <b>“Ya realicé el pago”</b> para que un cobrador lo verifique.</li>' +
        '</ol>' +
        '<button type="button" class="otb-btn otb-btn-ok otb-btn-bloque" id="otb-ya-pague">Ya realicé el pago</button>' });

    var checks = c.querySelectorAll('.otb-meses input');

    function seleccionados() {
        var lista = [];
        checks.forEach(function (ch) { if (ch.checked) lista.push(cuenta.periodosDebe[+ch.dataset.i]); });
        return lista;
    }

    function actualizar() {
        var sel = seleccionados();
        var total = sel.reduce(function (s, d) { return s + d.monto; }, 0);
        c.querySelector('#otb-total').textContent = 'Bs. ' + bs(total);
        var glosa = 'AGUA CI ' + socio.ci + ' ' + (sel.length === 1
            ? periodoCorto(sel[0].periodo)
            : sel.length ? periodoCorto(sel[0].periodo) + ' A ' + periodoCorto(sel[sel.length - 1].periodo) : '');
        c.querySelector('#otb-glosa').textContent = glosa.trim();
        c.querySelector('#otb-ya-pague').disabled = !sel.length;
    }

    // Los meses se pagan en orden: marcar uno marca los anteriores,
    // desmarcar uno desmarca los posteriores.
    checks.forEach(function (ch) {
        ch.onchange = function () {
            var i = +ch.dataset.i;
            checks.forEach(function (otro) {
                var j = +otro.dataset.i;
                if (ch.checked && j < i) otro.checked = true;
                if (!ch.checked && j > i) otro.checked = false;
            });
            actualizar();
        };
    });

    c.querySelector('#otb-copiar').onclick = function () {
        var texto = c.querySelector('#otb-glosa').textContent;
        var ok = function () { aviso('Referencia copiada.'); };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(texto).then(ok, function () { copiarRespaldo(texto); ok(); });
        } else { copiarRespaldo(texto); ok(); }
    };

    c.querySelector('#otb-ya-pague').onclick = function () {
        var sel = seleccionados();
        confirmarPago(socio, sel, c.querySelector('#otb-glosa').textContent);
    };

    actualizar();
}

function copiarRespaldo(texto) {
    var t = document.createElement('textarea');
    t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) {}
    t.remove();
}

function confirmarPago(socio, periodos, glosa) {
    var total = periodos.reduce(function (s, d) { return s + d.monto; }, 0);
    var c = Modal.abrir({ titulo: 'Confirmar pago', enfocar: false, html:
        '<p class="otb-texto">Pagaste <b>Bs. ' + bs(total) + '</b> por ' + periodos.length +
        (periodos.length === 1 ? ' mes' : ' meses') + ' (' + periodos.map(function (d) { return nombrePeriodo(d.periodo); }).join(', ') + ').</p>' +
        '<form class="otb-form" id="otb-form-pago">' +
            '<label>Número de transacción <span class="otb-suave">(opcional)</span>' +
                '<input name="nro" inputmode="numeric" maxlength="30" placeholder="Aparece en tu comprobante"></label>' +
            '<label>Foto o captura del comprobante <span class="otb-suave">(recomendado)</span>' +
                '<input name="foto" type="file" accept="image/*"></label>' +
            '<img class="otb-vista-previa" alt="Vista previa del comprobante" hidden>' +
            '<p class="otb-suave otb-mini">El cobrador revisará que el dinero haya llegado a la cuenta de la OTB y confirmará tu pago.</p>' +
            '<button class="otb-btn otb-btn-ok otb-btn-bloque" type="submit">Enviar para verificación</button>' +
        '</form>' });

    var comprobante = '';
    var form = c.querySelector('form');
    form.foto.onchange = function () {
        var archivo = this.files[0];
        if (!archivo) return;
        reducirImagen(archivo, 900, function (dataUrl) {
            comprobante = dataUrl;
            var img = c.querySelector('.otb-vista-previa');
            img.src = dataUrl; img.hidden = false;
        });
    };

    form.onsubmit = function (e) {
        e.preventDefault();
        var db = BD.cargar();
        db.pagos.push({
            id: db.siguienteIdPago++,
            socioId: socio.id,
            periodos: periodos.map(function (d) { return d.periodo; }),
            monto: Math.round(total * 100) / 100,
            metodo: 'qr',
            estado: 'pendiente',
            fecha: new Date().toISOString(),
            nroTransaccion: form.nro.value.trim(),
            glosa: glosa,
            comprobante: comprobante,
            registradoPor: 'vecino',
            verificadoPor: '',
            fechaVerificacion: ''
        });
        if (!BD.guardar()) { db.pagos.pop(); db.siguienteIdPago--; return; }
        Modal.abrir({ titulo: '¡Pago enviado!', ancho: 'chico', html:
            '<p class="otb-texto">Tu pago de <b>Bs. ' + bs(total) + '</b> quedó <b>en verificación</b>.</p>' +
            '<p class="otb-texto otb-suave">Cuando el cobrador confirme que el dinero llegó, aparecerá como <b>Pagado</b> en tu historial.</p>' });
        mostrarSocio(socio);
    };
}

// Achica la foto del comprobante para que no ocupe mucho espacio
function reducirImagen(archivo, maximo, listo) {
    var lector = new FileReader();
    lector.onload = function () {
        var img = new Image();
        img.onload = function () {
            var escala = Math.min(1, maximo / Math.max(img.width, img.height));
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * escala);
            canvas.height = Math.round(img.height * escala);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            listo(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = function () { aviso('No se pudo leer la imagen.', 'error'); };
        img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
}

/* ---------------- Información: tarifas ---------------- */

function mostrarTarifas() {
    var tbody = document.querySelector('.tarifa tbody');
    if (!tbody) return;
    tbody.innerHTML = BD.cargar().tarifas.map(function (t) {
        var rango = (t.hasta === null || t.hasta === '') ? 'Más de ' + (t.desde - 1) + ' m³' : t.desde + ' - ' + t.hasta + ' m³';
        return '<tr><td>' + rango + '</td><td>' + bs(t.precio) + '</td></tr>';
    }).join('');
}

/* ---------------- Contacto ---------------- */

function iniciarContacto() {
    var db = BD.cargar();
    var datos = document.querySelectorAll('.info .avenida');
    if (datos.length >= 3) {
        datos[0].textContent = db.contacto.direccion;
        datos[1].textContent = db.contacto.telefono;
        datos[2].textContent = db.contacto.correo;
    }

    var caja = document.querySelector('.envianos');
    if (!caja) return;
    var campos = caja.querySelectorAll('input');
    var nombre = campos[0], correo = campos[1], mensaje = caja.querySelector('.tu');
    var asunto = caja.querySelector('#asunto');
    correo.type = 'email';

    caja.querySelector('.enviar').onclick = function () {
        if (!nombre.value.trim() || !mensaje.value.trim()) {
            aviso('Completa tu nombre y el mensaje.', 'error'); return;
        }
        if (correo.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.value.trim())) {
            aviso('El correo electrónico no es válido.', 'error'); return;
        }
        db = BD.cargar();
        db.mensajes.push({
            id: Date.now(),
            nombre: nombre.value.trim(),
            correo: correo.value.trim(),
            asunto: asunto.options[asunto.selectedIndex].text,
            mensaje: mensaje.value.trim(),
            fecha: new Date().toISOString(),
            leido: false
        });
        if (!BD.guardar()) return;
        nombre.value = correo.value = mensaje.value = '';
        asunto.selectedIndex = 0;
        aviso('¡Mensaje enviado! La OTB se comunicará contigo.');
    };
}
