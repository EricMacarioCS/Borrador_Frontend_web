# Borrador_Frontend_web

Borrador del sistema web de Cinépolis basado en los prototipos de alta fidelidad: sitio público para consultar cartelera, comprar boletos con asientos en tiempo real y pedir dulcería.

Es solo el **frontend**. Mientras no exista el backend, la aplicación trae un **backend simulado** que corre en el navegador y responde exactamente el contrato JSON acordado; al conectar el API real se cambia una línea de configuración, no el código.

> Proyecto académico, sin relación comercial con Cinépolis. No usa imágenes ni videos: los carteles son arte generado con degradados.

## Requisitos

- Node.js 24 (ver `.nvmrc`) y npm.
- Docker solo si se quiere construir la imagen de despliegue.

## Uso

```bash
npm ci
npm run dev        # http://localhost:5173 con el backend simulado
npm run check      # lint + tipos + pruebas + compilación (lo mismo que corre CI)
```

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Revisa tipos y compila a `dist/`. |
| `npm run preview` | Sirve `dist/` para revisar la compilación. |
| `npm test` / `npm run test:watch` | Pruebas con Vitest. |
| `npm run lint` / `npm run lint:fix` | ESLint (Vue + TypeScript con reglas de tipos). |
| `npm run typecheck` | `vue-tsc` sobre la app, las pruebas y la configuración. |

En modo simulado aparece una franja amarilla: los cobros son ficticios. El método de pago permite **aprobar** o **rechazar** el pago para probar ambos caminos, y el código de acceso a "Mi cuenta" se muestra en pantalla.

## Arquitectura

```
src/
  app/          Arranque, rutas, consultas (TanStack Query), stores (Pinia), layout
  domain/       Modelos y puertos: lo único que conocen las vistas
  adapters/
    http/       Cliente REST: esquemas zod del contrato, conversores y adaptadores
    realtime/   Canal de asientos con SignalR
  mocks/        Backend simulado (solo se descarga en modo mock)
  features/     Pantallas por flujo: home, billboard, seats, checkout, food, account, content
  shared/       Utilidades (dinero, fechas, HTTP, QR, almacenamiento) y componentes base
```

Decisiones que facilitan conectar el backend:

1. **Puertos y adaptadores.** Las vistas solo usan las interfaces de `src/domain/ports.ts`. El adaptador HTTP valida cada respuesta con zod y la convierte a tipos del dominio; si el backend cambia un nombre, se corrige en `adapters/http` y nada más.
2. **El simulador habla el mismo contrato.** `src/mocks` es un `fetch` falso que responde los mismos JSON que el API real. Los dos modos pasan por los mismos adaptadores y conversores, así que lo que funciona simulado ya ejercita el código de producción.
3. **El servidor manda.** El navegador propone (asientos, tipos de boleto, promoción, productos) y el servidor aparta, cotiza y cobra. Ningún precio calculado en el navegador se envía como importe a cobrar.
4. **Configuración en tiempo de ejecución.** `/config.json` se lee al arrancar; la misma compilación se promueve entre ambientes.

Más detalle para backend y base de datos:

- [docs/contrato-api.md](docs/contrato-api.md): endpoints, formas JSON, errores, idempotencia y tiempo real.
- [docs/mapeo-bd.md](docs/mapeo-bd.md): de dónde sale cada dato en las tablas del diagrama ER y qué columnas faltan.
- [docs/contexto-proyecto.md](docs/contexto-proyecto.md): historia completa, decisiones, errores corregidos y pendientes, para continuar en otro chat o con otro agente.

## Conectar el API real

Durante el desarrollo, crea `.env.local` a partir de `.env.example`:

```bash
VITE_API_MODE=http
VITE_PROXY_TARGET=http://localhost:5080   # backend local; el servidor de Vite reenvía /api y /hubs
```

En un ambiente desplegado no se recompila: el contenedor genera `/config.json` con variables de entorno (`API_MODE=http`, `API_BASE_URL`, `HUB_URL`, etc.).

Al conectar, las pruebas de `src/mocks/contract.test.ts` sirven como lista de comportamientos que el backend debe cumplir: apartado atómico, vencimiento sin renovación, cotización del servidor, compra idempotente, folio solo tras pago confirmado y ventana de cancelación.

## Despliegue

```bash
docker build -t cinepolis-web .
docker run -p 8080:8080 -e ENVIRONMENT_NAME=staging cinepolis-web
```

- Compila con Node 24 y sirve con `nginx-unprivileged` (usuario sin privilegios, puerto 8080).
- `deploy/docker-entrypoint.d/40-runtime-config.sh` escribe `/config.json` al arrancar y rechaza valores inválidos.
- `deploy/nginx/default.conf`: rutas del historial hacia `index.html`, caché de un año para `/assets/*` (con huella), `no-cache` para `index.html` y `no-store` para `config.json`, compresión y `/healthz`.
- `deploy/nginx/security-headers.conf`: CSP, `nosniff`, `frame-ancestors 'none'`, `Referrer-Policy` y `Permissions-Policy`. HSTS lo agrega Kong, que termina TLS.
- Kong enruta `/api/*` y `/hubs/*` al backend y el resto a este contenedor. Al estar en el mismo dominio no hace falta CORS y la cookie de sesión funciona.
- Los mapas de fuentes se generan ocultos y se eliminan de la imagen.

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `API_MODE` | `http` | `http` o `mock` (demostraciones sin backend). |
| `API_BASE_URL` | `/api/v1` | Prefijo del API REST. |
| `HUB_URL` | `/hubs/seats` | Hub de SignalR para asientos. |
| `ENVIRONMENT_NAME` | `production` | Nombre visible en registros. |
| `SUPPORT_EMAIL` | vacío | Correo de soporte, opcional. |
| `FEATURE_REALTIME_SEATS` | `true` | Sin tiempo real, el mapa se consulta cada 10 s. |
| `FEATURE_ONLINE_PAYMENTS` | `true` | En `false` suspende los pagos en línea con un aviso. |
| `FEATURE_ACCOUNTS` | `true` | En `false` oculta el acceso por correo. |

CI (`.github/workflows/ci.yml`) corre lint, tipos, pruebas y compilación en cada PR y valida que la imagen compile. Publicar la imagen en un registro queda para el equipo de infraestructura.

## Estado del borrador

Hecho y probado en navegador:

- Inicio con la cartelera de tus cines y barra de fechas; cartelera con fechas, categorías y filtros de selección múltiple (tipo de sala, proyección, idioma, horario) en una columna lateral; película con ficha técnica.
- Buscador en el encabezado: películas, cines (ciudad, nombre y formatos) y formatos; sin texto muestra las 5 más populares y los formatos de todos los complejos.
- Selección de cines de una misma ciudad, cada uno en su burbuja, con buscador por cine o ciudad. Se puede no tener cine: al abrir una película se pide elegirlo.
- Compra completa: mapa con disponibilidad en vivo entre pestañas, apartado con tiempo límite, tipos de boleto, promociones con motivo cuando no aplican, alimentos, pago aprobado o rechazado, reintento, boleto con QR, cancelación con reembolso.
- Dulcería con folio validado automáticamente, carrito por complejo y pago. El mismo catálogo se usa en el paso de alimentos de la compra de boletos.
- Mi cuenta con código de un solo uso, ayuda, páginas legales y 404.
- Diseño adaptable (barra de acción fija en celular), navegación por teclado del mapa y modales accesibles.

Pendiente o fuera de alcance de este borrador:

- Pasarela de pago real: el contrato ya contempla una redirección (`payment.kind = "redirect"`).
- Textos legales definitivos, contenido real y carteles con imagen (los campos `posterUrl` ya existen).
- Monitoreo de errores en producción y analítica.
- La imagen de Docker no se ha construido en esta máquina (no hay Docker instalado); CI la valida.
