# OTB Villa Esperanza — Sistema de Cobro de Agua

Abrir `index.html` (u `otb.html`) en el navegador. No necesita instalar nada.

## Usuarios iniciales (cambiar las contraseñas desde "Mi cuenta")

| Usuario      | Contraseña | Rol            | Puede |
|--------------|------------|----------------|-------|
| `cobrador`   | `cobro123` | Cobrador       | Verificar pagos QR, registrar cobros en efectivo, ver deudores e historial |
| `admin`      | `admin123` | Administrador  | Lo anterior + socios, lecturas, tarifas, contacto, QR y mensajes |
| `superadmin` | `super123` | Super Admin    | Lo anterior + crear/editar usuarios y respaldos |

## Estructura

```
├── index.html          → redirige a otb.html
├── otb.html            → Inicio
├── index1.html         → Consulta de deuda y pago con QR
├── index2.html         → Información (tarifas, horarios, formas de pago)
├── index3.html         → Contacto
├── panel.html          → Panel de cobradores y administradores
├── css/
│   ├── estilos.css     → estilos del sitio (laptop, tablet y celular)
│   ├── sistema.css     → ventanas, avisos y estados
│   └── panel.css       → estilos del panel
├── js/
│   ├── datos.js        → 10 socios de ejemplo, tarifas y usuarios iniciales
│   ├── comun.js        → base de datos del navegador, sesión, búsqueda, ventanas
│   ├── publico.js      → búsqueda, consulta, pago con QR, tarifas y contacto
│   └── panel.js        → panel por roles
├── img/                → imágenes del diseño y QR de cobro (qr.JPG)
└── diseno-original/    → CSS originales del diseño (ya no se usan, solo referencia)
```

## Cómo funciona el pago

1. El vecino busca su CI o nombre, ve su deuda y presiona **Pagar ahora**.
2. Se muestra el QR (`img/qr.JPG`), el monto exacto y una referencia para la glosa.
3. El vecino paga desde su app del banco y presiona **Ya realicé el pago**
   (puede adjuntar la captura del comprobante). Queda **En verificación**.
4. El cobrador revisa en la app del banco que el dinero llegó y lo
   **confirma** o **rechaza** en el panel.

## Importante (versión solo JavaScript, sin servidor)

- Los datos se guardan **en el navegador de cada equipo** (localStorage).
  Lo que registra un cobrador en su celular no aparece en otra computadora.
  Para pasar los datos entre equipos: Super Admin → **Respaldo**.
- Cualquier persona con conocimientos puede ver el código y los datos
  (CI, nombres, deudas). El login evita el uso casual, pero **no es seguridad real**.
  Para uso en producción se recomienda un servidor o Firebase.
