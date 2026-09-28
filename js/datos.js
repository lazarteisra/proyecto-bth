/* =========================================================
   DATOS INICIALES DEL SISTEMA (OTB Villa Esperanza)
   ---------------------------------------------------------
   Estos datos se copian al navegador (localStorage) la
   primera vez que se abre la página. Después, todos los
   cambios (pagos, socios, lecturas, usuarios) se guardan
   en el navegador. Para volver a estos datos: Panel >
   Super Admin > "Restablecer datos de demostración".
   ========================================================= */

var DATOS_INICIALES = (function () {

    // Tarifas por m³ según rango de consumo (igual a la tabla de Información)
    var tarifas = [
        { desde: 0,  hasta: 10,   precio: 5.00 },
        { desde: 11, hasta: 20,   precio: 6.50 },
        { desde: 21, hasta: 30,   precio: 7.50 },
        { desde: 31, hasta: null, precio: 8.50 }
    ];

    // Periodos facturados (año-mes)
    var periodos = ['2026-01', '2026-02', '2026-03', '2026-04',
                    '2026-05', '2026-06', '2026-07', '2026-08'];

    // 10 viviendas de la OTB
    // consumos: m³ de cada periodo (mismo orden que "periodos")
    // pagados: cuántos meses (desde enero) ya tiene pagados
    var viviendas = [
        { ci: '4827163', nombre: 'Juan Pérez García',     direccion: 'Av. Manantial #12',     consumos: [11, 10, 9, 13, 12, 10, 11, 12], pagados: 8 },
        { ci: '5930214', nombre: 'María Quispe Mamani',   direccion: 'Av. Manantial #25',     consumos: [8, 9, 7, 8, 10, 9, 8, 9],       pagados: 7 },
        { ci: '6214587', nombre: 'Carlos Rojas Vargas',   direccion: 'Calle Los Pinos #8',    consumos: [18, 20, 17, 19, 22, 21, 19, 20], pagados: 5 },
        { ci: '7045839', nombre: 'Ana Flores Choque',     direccion: 'Calle Los Pinos #17',   consumos: [6, 7, 6, 5, 7, 6, 8, 7],        pagados: 8 },
        { ci: '3398712', nombre: 'Luis Mendoza Rocha',    direccion: 'Calle Illimani #4',     consumos: [25, 28, 24, 26, 31, 29, 27, 30], pagados: 3 },
        { ci: '8120456', nombre: 'Rosa Condori Huanca',   direccion: 'Calle Illimani #19',    consumos: [12, 11, 13, 12, 14, 13, 12, 11], pagados: 7 },
        { ci: '4561290', nombre: 'Pedro Gutiérrez Soliz', direccion: 'Pasaje Esperanza #3',   consumos: [9, 10, 11, 10, 9, 12, 11, 10],  pagados: 8 },
        { ci: '9087341', nombre: 'Carmen Vargas Lima',    direccion: 'Pasaje Esperanza #11',  consumos: [15, 14, 16, 15, 17, 16, 15, 18], pagados: 6 },
        { ci: '5672908', nombre: 'Jorge Mamani Ticona',   direccion: 'Av. Villa Esperanza #30', consumos: [34, 32, 35, 33, 36, 34, 33, 35], pagados: 8 },
        { ci: '6781025', nombre: 'Lucía Torrez Arce',     direccion: 'Av. Villa Esperanza #42', consumos: [10, 9, 10, 11, 10, 9, 10, 11],  pagados: 7 }
    ];

    function calcularMonto(m3) {
        for (var i = 0; i < tarifas.length; i++) {
            var t = tarifas[i];
            if (t.hasta === null || m3 <= t.hasta) {
                return Math.round(m3 * t.precio * 100) / 100;
            }
        }
        return 0;
    }

    var socios = [];
    var pagos = [];
    var idPago = 1;

    viviendas.forEach(function (v, i) {
        var id = 10001 + i;
        var lecturas = {};
        periodos.forEach(function (p, j) {
            lecturas[p] = { m3: v.consumos[j], monto: calcularMonto(v.consumos[j]) };
        });
        socios.push({
            id: id,
            codigo: String(id),
            ci: v.ci,
            nombre: v.nombre,
            direccion: v.direccion,
            medidor: 'A-' + String(123 + i * 7).padStart(6, '0'),
            lecturas: lecturas
        });

        // Un pago confirmado por cada mes pagado
        for (var k = 0; k < v.pagados; k++) {
            var p = periodos[k];
            var anio = +p.slice(0, 4), mes = +p.slice(5, 7);
            // pagado entre el 20 y el 28 del mes siguiente
            var dia = 20 + ((i + k) % 9);
            var fecha = new Date(anio, mes, dia, 10, 30).toISOString();
            pagos.push({
                id: idPago++,
                socioId: id,
                periodos: [p],
                monto: lecturas[p].monto,
                metodo: (i + k) % 3 === 0 ? 'efectivo' : 'qr',
                estado: 'confirmado',
                fecha: fecha,
                nroTransaccion: '',
                comprobante: '',
                registradoPor: 'sistema',
                verificadoPor: 'sistema',
                fechaVerificacion: fecha
            });
        }
    });

    // Ejemplo: María Quispe ya pagó agosto por QR y espera verificación
    pagos.push({
        id: idPago++,
        socioId: 10002,
        periodos: ['2026-08'],
        monto: socios[1].lecturas['2026-08'].monto,
        metodo: 'qr',
        estado: 'pendiente',
        fecha: new Date(2026, 8, 25, 18, 12).toISOString(),
        nroTransaccion: '84512397',
        comprobante: '',
        registradoPor: 'vecino',
        verificadoPor: '',
        fechaVerificacion: ''
    });

    return {
        version: 1,
        tarifas: tarifas,
        periodos: periodos,
        socios: socios,
        pagos: pagos,
        siguienteIdPago: idPago,
        mensajes: [],
        contacto: {
            direccion: 'Avenida Manantial, OTB Villa Esperanza',
            telefono: '69475009',
            correo: 'otbvillaesperanza@gmail.com'
        },
        cuentaQR: {
            imagen: 'img/qr.JPG',
            cuenta: '2805593-000-001',
            banco: 'Altoke',
            validoHasta: '14/09/2028'
        },
        // Contraseñas iniciales (se guardan cifradas). ¡Cambiarlas desde el panel!
        usuariosIniciales: [
            { usuario: 'superadmin', nombre: 'Super Administrador', rol: 'superadmin', clave: 'super123' },
            { usuario: 'admin',      nombre: 'Administrador',       rol: 'admin',      clave: 'admin123' },
            { usuario: 'cobrador',   nombre: 'Cobrador OTB',        rol: 'cobrador',   clave: 'cobro123' }
        ]
    };
})();
