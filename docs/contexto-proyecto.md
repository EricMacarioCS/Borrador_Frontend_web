# Contexto del proyecto Cinépolis Remake

Resumen de todo el trabajo hecho hasta el 23 de noviembre de 2026, para continuar en otro chat o con otro agente de IA. Léelo completo antes de tocar código: incluye reglas de trabajo, decisiones ya tomadas (no volver a discutirlas) y errores que no deben repetirse.

---

## 1. Qué es el proyecto

Remake académico de Cinépolis, sin relación comercial con la empresa. Son **dos sistemas distintos que comparten una misma base de datos**:

1. **Sitio web público**: cartelera, compra de boletos con asientos en tiempo real, dulcería, cuenta del cliente.
2. **Sistema de gestión (administración)**: uso interno de un administrador general de toda la cadena (películas, funciones, salas, tarifas, promociones, dulcería, inventario, pedidos, contenido web, empleados, reportes).

**Responsabilidad del usuario: solo el frontend** de ambos sistemas. El backend y la base de datos los hacen otros integrantes del equipo. No hay diagramas formales ni seguimiento del avance de esos equipos, así que el frontend debe poder adaptarse al backend con pocos cambios (y viceversa).

**Stack definido por el equipo**

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite (la web; la gestión sigue en Vue) |
| API Gateway | Kong Gateway |
| Backend | C# ASP.NET Core Web API + SignalR (mapa de asientos) + Dapper |
| Base de datos | PostgreSQL |

Recomendación ya comunicada: .NET 8 y 9 perdieron soporte el 10 de noviembre de 2026; conviene iniciar en **.NET 10 LTS**. PostgreSQL 18 recomendado (el diagrama usa `NULLS NOT DISTINCT`, que exige 15 o posterior).

---

## 2. Reglas de trabajo con el usuario

- **Idioma:** todo en español (respuestas, textos de la interfaz, documentación, comentarios de código).
- **Git:** no hacer commit ni push sin que el usuario lo pida. El usuario subió el borrador a `main` (commit `9c9e4`, "Primera versión del sistema"). Los cambios de diseño de la fase 9 están en la rama `Actualización_diseño`, sin commit.
- **No tocar archivos del usuario:** los originales en `C:\Users\Derem\Downloads` (`App(1).tsx`, `index(1).css`, el `.pgerd`), la carpeta `Prototipo_cinepolis\entrega-web\Nueva carpeta` (la creó el usuario) y los datos guardados en `localStorage` de los prototipos (nunca renombrar sus claves). En Downloads hay otros archivos (SQL, documentos): no abrirlos salvo que el usuario lo pida.
- **Sin subagentes** salvo que el usuario los pida.
- **Datos privados:** nunca enviar datos personales del usuario a servicios externos.
- **Permiso previo** para descargas, publicaciones y acciones destructivas.
- **Reportar con honestidad:** decir qué se probó y qué no; si algo falla, decirlo con evidencia.
- **Probar antes de entregar:** compilar, correr pruebas y revisar en navegador (escritorio y celular, consola sin errores).
- **Estética:**
  - Web pública: llamativa sin saturar ni ser minimalista. Efectos *glow* y *gloss* en botones, degradados en lugar de colores planos, animaciones. Tipografías Montserrat (títulos) e Inter (texto). Paleta azul marino, azul y cian.
  - Gestión: misma paleta y tipografía que la web, **sin** efectos de botones ni animaciones (debe verse profesional).

---

## 3. Ubicación de los archivos

| Qué | Dónde |
| --- | --- |
| **Borrador web actual (repositorio Git)** | `C:\Users\Derem\OneDrive\Documents\Cinepolis_Remake_Borrador\Borrador_Frontend_web` |
| Prototipo de gestión (Vue, sin Git) | `C:\Users\Derem\OneDrive\Documents\Prototipo_cinepolis` |
| Respaldo de la gestión antes del rediseño | `Prototipo_cinepolis\respaldo-antes-del-rediseno.zip` |
| Prototipo web v3 (React, Figma Make) | `Prototipo_cinepolis\entrega-web\figma-make\App.tsx` |
| Originales del prototipo web | `C:\Users\Derem\Downloads\App(1).tsx`, `index(1).css` |
| Diagrama ER de la BD (pgAdmin) | `C:\Users\Derem\Downloads\Diagrama ER cinepolis.pgerd` |
| Análisis de implementación (Claude Doc) | https://claude.ai/artifact/8b7cDFi8cYwSBtaELt9zHj |
| Configuración de vista previa (fuera del repo) | `Cinepolis_Remake_Borrador\.claude\launch.json` (`web` en puerto 5180, `web-build` en 5181) |

---

## 4. Cronología

### Fase 1. Prototipo de gestión (Vue)

Vue 3 + TypeScript + Vite, CSS propio, `localStorage`, iconos Lucide. Sin Pinia, sin Tailwind/Bootstrap, sin backend ni autenticación real, con datos ficticios. Un solo administrador general: los filtros por complejo no son permisos.

Observaciones del usuario que se resolvieron:
- Precios por complejo específico.
- Programar funciones en varios complejos a la vez, con listas de casillas en menús desplegables para combinar atributos en lote.
- Combinaciones de productos (sabores, tamaños, complementos) distintas por complejo.
- Catálogo, existencias y complementos independientes por complejo.
- Al crear un combo se eligen sus productos.
- "Eliminar" un producto lo marca como **descontinuado** (se oculta, no se borra).
- Inventario: lo registra el **personal del complejo** (decisión del usuario).
- Se sobrescribió el código viejo y se quitó el convertidor de datos v1 ("Quitarlo").
- Módulos nuevos: Tarifas, Promociones, Pedidos, Contenido web.

Claves de `localStorage` de la gestión (no renombrar): `cinepolis-movies-v2`, `cinepolis-products-v2`, `cinepolis-complements`, `cinepolis-screenings`, `cinepolis-employees`, `cinepolis-rates`, `cinepolis-promotions`, `cinepolis-room-layouts`, `cinepolis-site-settings`, `cinepolis-stock-movements`, `cinepolis-orders`. El usuario corre la gestión en `localhost:5173`.

### Fase 2. Análisis del prototipo web (Figma Make, React)

El usuario pidió solo un texto con conclusiones (reglas de negocio, estética, funcionalidad, legibilidad, facilidad de uso), sin modificar nada. Se entregó.

### Fase 3. Modificación del prototipo web: v1 rota, v2 y v3

- **v1 (error mío):** reescribí la web en 23 archivos con clases nuevas. En Figma Make quedó **completamente rota** porque el `index.css` original seguía activo y yo solo había probado con mi propio CSS. El usuario pidió volver a la estética anterior conservando la funcionalidad.
- **v2:** tampoco convenció ("cambiaste la estética de muchas partes y no para mejor, pero la funcionalidad está bien"). El usuario mandó cuatro capturas del sitio real de Cinépolis como referencia y una lista de observaciones.
- **v3 (entregada y aprobada: "la página se ve excelente"):** un solo archivo `App.tsx` autocontenido, con CSS embebido y todas las clases con prefijo `cp-`, para no depender del CSS cargado. Tiene póster pequeño con tráiler de fondo en la portada, anillo de ocupación por función, sala con más asientos, glow y gloss en botones, menús desplegables modernos y degradado en el encabezado.

Lección: entregar autocontenido, probar en las condiciones reales del usuario (su CSS, su entorno) y nunca depender de estilos externos.

### Fase 4. Rediseño de la gestión

Pedido: estética consistente con la web pero sin efectos ni animaciones; crear funciones de forma más intuitiva; mostrar qué formatos admite cada sala (si admite 3D, también puede proyectar Tradicional); aplicación más legible.

Hecho y aplicado en `Prototipo_cinepolis`:
- Paleta de la web y Montserrat/Inter. Esto **reemplazó** la decisión anterior de dejar Sora en la gestión.
- Asistente de programación en 4 pasos (`src/components/ScheduleWizard.vue`): película e idioma → complejos y salas (cada sala muestra lo que puede proyectar; asignación manual o automática) → fechas y horarios (hora de término visible) → revisar y crear (con el motivo si algo no se puede crear).
- Formatos por sala en *Complejos y salas → Salas y formatos*. Todas las salas admiten Tradicional. No se puede quitar un formato que use una función vigente. La asignación automática reserva las salas especiales.
- Menú completo visible en pantallas de 768 px de alto, textos más grandes, aviso al salir sin guardar en Tarifas y Contenido web, "Ver guía" funcional.
- Pruebas: compila, 3,000 lotes aleatorios sin traslapes ni salas incompatibles, pantallas de 320 a 1920 px, datos guardados conservados.
- Decisiones para revisar con el usuario: se cobra el formato proyectado (función Tradicional en sala VIP cuesta como Tradicional); 3D con recargo ficticio de $25; no existe "IMAX 3D" combinado.
- El usuario respondió "Por ahora no" a agregar 3D a la web.

### Fase 5. Análisis exhaustivo de implementación

Documento: https://claude.ai/artifact/8b7cDFi8cYwSBtaELt9zHj, con pestañas **Análisis** (arquitectura, estructura del frontend, SignalR, seguridad, riesgos, pruebas, plan por fases), **Contrato para backend y BD** (endpoints, JSON, errores, garantías) y **Evidencia y fuentes**.

Hallazgos principales:
1. Iniciar en .NET 10 LTS.
2. La web debe reescribirse en Vue (el prototipo era React). La gestión puede evolucionar desde su código.
3. El frontend se adapta a nombres y formatos distintos, pero no a garantías faltantes: apartado atómico de asientos, pago sin duplicados y precio calculado en el servidor deben acordarse desde el inicio.
4. Los dos prototipos tenían planos de sala distintos (322 contra 154 asientos en Tradicional): debe existir un solo plano.
5. El redondeo de C# cambiaría precios con descuento respecto a JavaScript.
6. Nadie tiene asignada la taquilla, el control de acceso ni la herramienta del personal de dulcería.

Errores míos en los prototipos documentados en la sección 9 del documento (no corregidos allí porque se pidió solo análisis): el apartado podía alargarse a 91 minutos, el precio del carrito podía alterarse desde el navegador, el folio era predecible, traslapes posibles con cambio de horario, la gestión no permitía cancelar una función en la última hora, y el tráiler de YouTube con elementos encima incumple sus reglas.

El usuario dijo "Primero lo reviso" y rechazó por ahora generar un OpenAPI.

**Cinco imprecisiones del documento, detectadas por mí y aún sin corregir** (esperando las observaciones del usuario para aplicarlas juntas):
1. Falta la salida de un pago rechazado (secciones 6.1 y contrato E): el apartado debe volver a activo mientras le quede tiempo, o vencer.
2. "39 de 504 precios" cuenta combinaciones que no se venden.
3. La prueba del sincronizador está mal redactada: la reconexión durante la carga fue una prueba aparte de las 5,000 secuencias.
4. El método de prueba de la web está incompleto en la pestaña Evidencia.
5. La decisión D10 debe decir: "¿Se permite dejar un asiento vacío aislado y quién puede comprar los lugares accesibles?".

### Fase 6. Análisis del diagrama ER

Archivo `.pgerd` leído completo: **44 tablas, 282 columnas, 62 llaves foráneas, 25 restricciones únicas.** Conclusiones entregadas en el chat (el usuario no quiso agregarlas al documento: "No por ahora").

Lo que resuelve bien: separa el tipo físico de sala de la proyección 2D/3D; copia los asientos de una plantilla a cada función; impide vender un asiento dos veces (`UNIQUE asiento_id` en `detalle_venta_boleto`); precios explícitos en `precio_boleto` (elimina el problema de redondeo en boletos); dulcería por complejo, carrito con vencimiento, OTP por correo y puntos del Club.

Faltantes que bloquean funciones ya definidas:
1. No hay existencias ni movimientos de inventario.
2. `venta` no tiene estado, cancelación ni reembolso. Por el `UNIQUE` de `asiento_id`, **un asiento cancelado no puede volver a venderse** mientras exista ese renglón.
3. **La tabla `folio` es otra cosa: vales externos de beneficio.** Nuestro folio de boletos para pedir alimentos no existe en el modelo.
4. `venta` no tiene `complejo_id`, y `detalle_venta_producto` apunta al producto global, no al catálogo del complejo.
5. No hay estado de pedido de dulcería ni momento de recolección.
6. `pelicula` no tiene fecha de estreno, preventa, último día ni estado.
7. `promocion` no tiene días, formatos ni porcentaje.
8. No hay pago, referencia del proveedor ni vínculo carrito–venta.
9. No hay usuarios administrativos, permisos ni auditoría (`sesion` es el turno de caja).
10. No hay configuración ni contenido (salvo banners).

Problemas de diseño: 12 columnas de fecha/hora sin zona horaria; función guardada como fecha + hora inicio + hora término (una función de 23:00 a 01:46 "termina antes de empezar"); solo impide funciones con la misma hora de inicio en una sala; estado del asiento como columna actualizable; sin versión del mapa por función; plantilla sin posición visual para pasillos; posible fallo del trigger por `area_category_code` nulo; 27 columnas de estado como texto libre; 9 llaves foráneas sin índice aparente.

**Riesgo legal:** el diagrama menciona identificadores de la API real de Cinépolis (Vista), por ejemplo `asiento_api_id`, y reglas de dulcería "descubiertas en la red". El equipo debe confirmar que existe acceso autorizado antes de depender de ellos.

Impacto en el frontend: salas con tipo fijo más casillas de proyección; tarifas como tabla de precios explícitos más cargo por servicio; tipos de boleto desde la API; dulcería con reglas de mínimo y máximo de opciones y porcentajes de mezcla; la versión VIP de una plaza es otro complejo (son 19 complejos en Veracruz, no 5).

Qué pedir al equipo de BD: el script SQL completo (CHECK, triggers, índices), si el modelo es definitivo, si se eliminan por decisión el folio de alimentos, el inventario por complejo y las cancelaciones, y la confirmación del uso autorizado de la API de Cinépolis.

### Fase 7. Borrador del sitio web listo para producción (repositorio actual)

Pedido textual: "una versión borrador del sistema terminado... lo más cercano a un sistema real en producción listo para el despliegue, desarrolla únicamente el frontend basado en el prototipo web... aún no hay backend ni conexión a base de datos... la información faltante se manejará por valores por defecto, tampoco utilices imágenes ni videos aún, este borrador deberá ser adaptado fácilmente al backend y a la base de datos. Estaremos trabajando con un repositorio en git".

Estado: completo y verificado. Detalle en las secciones 6 a 9.

### Fase 8. Pregunta sobre "residuos" de la simulación

El usuario preguntó si al integrar quedarían restos de la simulación (cartelera, productos, horarios). Respuesta: los datos falsos solo viven en `src/mocks`, corren en el navegador y nunca llegan a la BD; en modo API real ese código no se descarga. Pero se encontraron **4 residuos reales, todavía sin corregir** (ver sección 9). El usuario no respondió si corregirlos y pidió este resumen.

### Fase 9. Actualización de diseño (rama `Actualización_diseño`)

Observaciones del usuario y cómo se resolvieron:

1. **No se aprovechaba la pantalla.** Contenido hasta 1760 px (antes 1320) y márgenes de 16 a 48 px. Encabezado y barra de cines de orilla a orilla (logotipo y acciones en las esquinas). Cartelera con columna lateral de filtros y películas en dos columnas; inicio con cuadrícula que llena el ancho; película con ficha técnica en una tercera columna; dulcería con "Tu pedido" fijo a la derecha; compra con resumen más ancho.
2. **Buscador del encabezado también busca cines.** Campo visible en el encabezado (≥1240 px; en pantallas menores, ícono que abre el mismo buscador en ventana). Cada cine muestra ciudad en pequeño, nombre y formatos. Elegir un cine lo agrega a tus cines (o cambia de ciudad) y abre la cartelera. También encuentra películas y formatos.
3. **Buscador vacío:** las 5 películas más populares y los formatos de todos los complejos (un formato abre la cartelera filtrada).
4. **Cines de una sola ciudad.** El store descarta cines de otra ciudad; en el selector, marcar uno de otra ciudad cambia la selección a esa ciudad con aviso.
5. **Cada cine en su burbuja** en la barra, con botón para quitarlo, y un botón "Agregar o cambiar" (solo ícono en celular).
6. **Buscador en el selector de cines**, arriba de la ventana; busca por nombre del cine o de la ciudad. Botón "Elegir todos" por ciudad.
7. **Se permite no tener cine.** Al abrir una película sin cine se muestra el selector y, al elegir, continúa a la película (guardia del router; un enlace directo entra y la vista pide el cine).
8. **La cartelera del inicio** muestra solo lo que hay en los cines elegidos (o en todos si no hay) y tiene la misma barra de fechas que la película.
9. **La dulcería se reutiliza en la compra de boletos:** componente `FoodCatalog` (categorías, búsqueda, tarjetas y personalización) en la pestaña Dulcería y en el paso de alimentos; `OrderLines` para la lista de productos en carrito, Dulcería y compra.
10. **Filtros con casillas:** tipo de sala, proyección, idioma y franja de horario (mañana, mediodía, tarde, noche), varias a la vez. Dentro de un grupo se suman; entre grupos se cumplen todos. Cada opción muestra cuántas funciones daría y hay chips para quitar filtros. En la URL: `?sala=imax,4dx&horario=noche`.

Cambios de contrato: `formats` en cada complejo de `/bootstrap` (opcional para el frontend) y `GET /movies?sort=popularity&limit=5`. Documentados en `docs/contrato-api.md` y `docs/mapeo-bd.md`.

---

## 5. Decisiones de negocio vigentes

Tomadas por el usuario:
- Inventario a cargo del **personal del complejo**.
- Comprar alimentos en línea **exige el folio de los boletos** ("Mantenerlo obligatorio").
- Los productos **no tienen folio propio**; la validación usa solo el folio de boletos.
- El folio se valida **automáticamente** al completar el formato: sin botón de validar y sin mensaje redundante de "se requiere folio".
- La compra rápida bajo el anuncio de portada aparece **solo al pulsar "Comprar boletos"**.
- Gestión con la misma paleta y tipografía que la web, sin efectos ni animaciones.
- 3D en la web: "Por ahora no" (en el prototipo React). El borrador Vue sí maneja proyección 2D/3D porque viene del modelo de BD.
- Fase 9: solo cines de una ciudad a la vez; se permite no tener cine (la película pide elegirlo); burbuja por cine; buscador de cines por nombre o ciudad; filtros de selección múltiple; misma dulcería en la compra de boletos.

Propuestas mías aceptadas sin objeción:
- Marca Cinépolis con aviso de prototipo no oficial.
- 2×1 los martes.
- Club solo informativo, sin canje.
- Mezcla de sabores: media porción de cada uno, sin cargo extra por mezclar.
- El folio permite varios pedidos hasta que termina la función y debe ser del mismo complejo.
- Artículos promocionales sin alimentos no requieren folio y se recogen con el nombre del comprador.
- La regla del folio aplica a ventas en línea, no a taquilla.
- Ocupación por color: menos de 25 % azul, menos de 50 % verde, menos de 75 % naranja, 75 % o más rojo.

---

## 6. Borrador web: arquitectura y decisiones técnicas

**Repositorio:** `Borrador_Frontend_web`. El usuario subió el borrador a `main` (commit `9c9e4`); `feature/borrador-web` apunta al mismo commit. La fase 9 vive en la rama `Actualización_diseño`, **sin commit**, junto con la corrección de `docs/mapeo-bd.md` y `docs/contexto-proyecto.md` (también sin commit).

**Versiones (fijadas exactas en `package.json`, rama `migracion-react`):** React 19.3.1, react-router 8.5.3, Zustand 5.1.0, @tanstack/react-query 5.108.4, zod 4.6.7, @microsoft/signalr 10.0.11, lucide-react 1.81.0, fuentes @fontsource-variable (Inter y Montserrat) 5.3.0, Vite 8.3.8 con @vitejs/plugin-react 6.3.0, TypeScript 5.9.3, Vitest 5.1.1 con happy-dom y Testing Library, ESLint 10 con eslint-plugin-react-hooks. Node 24 (`.nvmrc`); la máquina tiene 24.14 y npm avisa que dos dependencias piden 24.15 o más (sin efecto práctico).

**Estructura**

```
src/
  app/        arranque (main.tsx), App.tsx, config.ts, services.ts, router.tsx, navigation.ts, queries.ts, stores/, layout/
  domain/     models.ts y ports.ts: lo único que conocen las vistas
  adapters/   http/ (schemas zod, mappers, adapters) y realtime/signalr.ts
  mocks/      backend simulado (fixtures, schedule, store, server, index)
  features/   home, billboard, seats, checkout, food, account, content
  shared/     lib/ (dinero, fechas, HTTP, QR, errores, almacenamiento) y ui/ (componentes base)
docs/         contrato-api.md, mapeo-bd.md, este archivo
deploy/       nginx y script de configuración del contenedor
```

**Decisiones y su motivo**

| Decisión | Por qué |
| --- | --- |
| Puertos y adaptadores (`domain/ports.ts`) | Las vistas no conocen HTTP ni el simulador; si el backend cambia nombres, solo se corrige `adapters/http`. |
| El simulador es un `fetch` falso que responde el contrato JSON exacto | Ambos modos pasan por los mismos adaptadores y conversores: lo que funciona simulado ya prueba el código de producción. |
| Validar cada respuesta con zod | Un cambio del backend se detecta como "respuesta inválida" con detalle, no como un fallo raro en pantalla. |
| Valores desconocidos de enumeraciones caen a un valor seguro | Un estado nuevo del backend no rompe la interfaz (por ejemplo, función desconocida = no vendible). |
| El servidor aparta, cotiza y cobra | El navegador solo manda identificadores; evita alterar precios desde el navegador (error de los prototipos). |
| Dinero en centavos enteros; instantes ISO con zona; fechas de negocio `AAAA-MM-DD` | Evita errores de redondeo y de zona horaria entre navegador, servidor y complejo. |
| `Idempotency-Key` en apartar, comprar y cancelar; consulta por clave si se pierde la respuesta | Evita cobros o apartados duplicados por reintentos o fallas de red. |
| Sincronización de asientos: foto con versión + eventos numerados, nueva foto ante huecos, al reconectar, cada 30 s y al volver a la pestaña | SignalR puede perder o desordenar eventos; así el mapa siempre converge. |
| Configuración en tiempo de ejecución (`/config.json`) | La misma compilación se promueve entre ambientes sin recompilar. |
| SignalR y el simulador se cargan bajo demanda | En modo API real el simulador no se descarga; en modo simulado no se descarga SignalR. |
| Sesión por cookie más `X-CSRF-Token`; ante `CSRF_INVALID` se renueva la sesión y se repite la escritura una vez | Seguridad estándar sin guardar tokens en el navegador. |
| En `sessionStorage` solo se guardan identificadores (apartado, tipos, clave de compra) | Recuperar la compra tras recargar sin guardar precios ni datos de pago. |
| Sin imágenes ni videos: carteles generados con degradados (`PosterArt`) | Pedido del usuario; los campos `posterUrl`, `backdropUrl` y `trailerUrl` ya existen en el contrato. |
| Accesibilidad: modales con `<dialog>`, combobox WAI-ARIA, mapa navegable con flechas, enlace para saltar al contenido, respeto a "reducir movimiento" | Requisito de calidad de producción. |

**Modelo alineado con la BD:** complejos de Veracruz (la versión VIP de una plaza es otro complejo), salas con tipo fijo y proyección 2D/3D, precios explícitos por tipo de boleto, cargo por servicio de $6 por boleto, productos con reglas de personalización (mínimo, máximo, opciones, mezcla por porcentaje).

**Contrato del API:** documentado en `docs/contrato-api.md` (endpoints, convenciones, estados, códigos de error, tiempo real). Fuente ejecutable: `src/adapters/http/schemas.ts` y `src/mocks/contract.test.ts`. Folio con formato `CIN-XXXX-XXXX-XXXX` (Crockford Base32); el QR contiene `CPA1:<admissionToken>`, nunca el folio.

**Reglas del servidor simulado** (también son la especificación para el backend): apartado atómico de 10 minutos que no se renueva al cambiar asientos; cotización del servidor; compra idempotente; pago asíncrono (`payment-pending` → `confirmed` o `payment-failed`); folio y código de acceso solo con pago confirmado; un pago rechazado conserva el apartado; cancelación hasta 60 minutos antes con reembolso asíncrono y cancelación de alimentos ligados al folio; compras ajenas responden 404; CSRF; OTP con límite de intentos.

**Datos del simulador:** 8 complejos (Xalapa Centro, Xalapa Centro VIP, Xalapa Ánimas, Veracruz Boulevard, Veracruz Puerto, Boca del Río Costa, Coatzacoalcos Malecón, Córdoba Parque), formatos derivados de sus salas, popularidad base por película más los boletos confirmados, 10 películas ficticias, horarios deterministas a 14 días, tipos de boleto General/Niño/Adulto mayor, promociones (2×1 martes en salas tradicionales 2D, Jueves IMAX 20 %, Matiné de fin de semana antes de las 15:00, Meses sin intereses informativa), productos con existencias limitadas.

**Claves del navegador:** `cp-mock-state-v1` y `cp-mock-session` (solo simulador), `cp-selected-complexes` (local); `cp-cart`, `cp-checkout-<funcion>`, `cp-pending-ticket-code`, `cp-reloaded` (sesión).

**Migración a React (26 de noviembre de 2026, rama `migracion-react`, sin commit)**

El encargado del proyecto pidió que la web use React. Se migró desde el commit `ac8e5` (`Actualización_diseño` con `feature/revision-mejoras`). `domain/`, `adapters/`, `mocks/` y `shared/lib/` no cambiaron: el contrato, los esquemas y el simulador son los mismos. Equivalencias:

| Vue | React |
| --- | --- |
| Componentes `.vue` con estilos `scoped` | Componentes `.tsx` con CSS Modules (`*.module.css`, nombres en camelCase). Las clases globales de `base.css` (`btn`, `card`, `notice`…) siguen siendo texto. |
| Pinia (`app`, `cart`) | Zustand: almacenes `appStore` y `cartStore` con `useAppStore(selector)` y `useCartStore(selector)`. |
| `useCheckout` reactivo | Un almacén Zustand por pantalla de compra: las operaciones asíncronas leen el estado actual. |
| vue-router y `onBeforeRouteLeave` | React Router 8 con rutas diferidas. Un solo `useBlocker` en `App.tsx`; las reglas viven en `app/navigation.ts` (salir de la compra con asientos y película sin cine). |
| `provide/inject` de servicios | `ServicesContext` y `ConfigContext`. |
| `defineExpose` del formulario de pago | `ref` con `useImperativeHandle` (`PaymentFormHandle`). |
| `@vue/test-utils` | `@testing-library/react`. |

`StrictMode` está activo, así que los efectos (SignalR, sondeos, apartados) deben poder montarse dos veces sin efectos dobles.

**Despliegue**
- `Dockerfile`: compila con Node 24 y sirve con `nginxinc/nginx-unprivileged` en el puerto 8080.
- `deploy/docker-entrypoint.d/40-runtime-config.sh`: genera `/config.json` desde variables de entorno (`API_MODE`, `API_BASE_URL`, `HUB_URL`, `ENVIRONMENT_NAME`, `SUPPORT_EMAIL`, `FEATURE_REALTIME_SEATS`, `FEATURE_ONLINE_PAYMENTS`, `FEATURE_ACCOUNTS`) y rechaza valores inválidos. Probado localmente con `sh`.
- `deploy/nginx/`: rutas del historial hacia `index.html`, caché de un año en `/assets/`, `no-cache` en `index.html`, `no-store` en `config.json`, 404 real para archivos faltantes, `/healthz`, CSP y encabezados de seguridad.
- Kong enruta `/api/*` y `/hubs/*` al backend y lo demás al contenedor (mismo dominio: sin CORS).
- `.github/workflows/ci.yml`: lint, tipos, pruebas, compilación y construcción de la imagen.
- Desarrollo contra un backend local: `.env.local` con `VITE_API_MODE=http` y `VITE_PROXY_TARGET`.

**Comandos**

```bash
npm ci
npm run dev        # simulador en http://localhost:5173
npm run check      # lint + tipos + pruebas + compilación
npm test
```

Desde la carpeta superior: `npm --prefix Borrador_Frontend_web run dev`. La vista previa del agente usó el puerto 5180.

---

## 7. Errores y correcciones (para no repetirlos)

**Fases anteriores**
- **Web v1 rota en Figma Make:** dependía de CSS externo y solo se probó con el mío. Corrección: archivo único autocontenido con prefijo `cp-`, probado con el CSS del usuario.
- **Compilación de la gestión ya fallaba** (`replaceAll` con librería ES2020): se subió la librería a ES2022.
- **Casi sobrescribí cambios de otra sesión** en la gestión: un control de diferencias lo detuvo. Siempre comparar antes de aplicar.
- Comandos bash compuestos con *heredoc* fallaron o fueron bloqueados: escribir archivos con la herramienta de escritura y usar comandos simples.

**Borrador web, durante la construcción**
- Vite 8 no acepta `manualChunks` como objeto: se quitó esa opción.
- ESLint no cargaba una configuración `.ts`: se renombró a `eslint.config.js`.
- `eslint --fix` quitó afirmaciones de tipo necesarias en `useCheckout`: se agregó la interfaz `CheckoutState`.
- La vista previa buscaba `launch.json` en la carpeta superior, no en el repositorio: se dejó ahí con `npm --prefix`.
- Advertencia de Vue por atributos en `StateView` (renderizaba un fragmento): se le dio un elemento raíz.

**Borrador web, encontrados al probar en el navegador (todos corregidos)**
- Si otra persona apartaba un asiento que yo tenía marcado sin confirmar, seguía apareciendo como mío. Ahora se quita y se avisa. Luego apareció un segundo error: la pestaña que apartaba también recibía el aviso, porque el evento llegaba antes que la respuesta. Se ignora el evento mientras se confirma y la selección se toma del apartado del servidor.
- Al recargar, un asiento del apartado quedaba sin tipo de boleto: se asigna General por defecto. **Ojo:** ese valor por defecto usa el identificador del simulador `'tt-general'`, que es uno de los residuos pendientes.
- "Intentar de nuevo" tras un pago rechazado empezaba desde cero: el estado guardado se borraba al crear la compra. Ahora se conserva y se borra cuando la compra se confirma o se cancela.
- **El normalizador de folios convertía la "I" de "CIN" en "1"**, así que ningún folio con prefijo era válido. Ahora el prefijo se quita antes de normalizar.
- Compras pendientes o rechazadas mostraban folio: ahora el servidor simulado solo entrega folio y QR con pago confirmado.
- En celular, la página de compra medía 787 px de ancho en una pantalla de 375: columnas de cuadrícula con `1fr` en lugar de `minmax(0, 1fr)`. Además se agregó una barra fija inferior con total y botón principal, y el mapa arranca centrado.
- El folio quedaba en la URL de dulcería: ahora se guarda y se quita de la URL, y se muestra "Usaremos el folio … al pagar".
- Una fecha sin zona del backend se habría mostrado como "error de red": ahora se rechaza en la validación como respuesta inválida.
- El contrato prometía renovar el token CSRF y reintentar, pero no estaba implementado: se implementó.
- Las banderas `onlinePayments` y `accounts` no hacían nada: ahora suspenden pagos con aviso u ocultan el acceso por correo.
- Detalles de texto: complejo repetido en la tarjeta de dulcería, instrucción de recolección que ignoraba el folio, "boletos" en el pago de dulcería, espacio antes de coma en el estado del folio, título cortado en carteles pequeños, mensaje genérico cuando falla el arranque, descripción del Matiné sin "fin de semana", etiquetas del formulario que incluían el texto de ayuda en el nombre accesible.

**Fase 9, encontrados al probar (todos corregidos)**
- **La tira de fechas ampliaba la página a 980 px en celular** (error que ya existía): los textos ocultos para lectores de pantalla usan posición absoluta y, como la tira no tenía `position: relative`, escapaban del recorte del desplazamiento. El navegador móvil ampliaba el área visible y las ventanas se veían corridas.
- La cuadrícula de herramientas de la cartelera y la tarjeta de horarios tomaban el ancho completo de la tira de fechas: faltaba `grid-template-columns: minmax(0, 1fr)`.
- En el selector de cines, la lista se reordenaba bajo el cursor al cambiar de ciudad: el orden ahora se fija al abrir.
- El título de la pestaña cambiaba a "Película" aunque la guardia cancelara la navegación.
- Las preventas sin funciones ese día desaparecían del inicio: ahora quedan en "Próximamente y eventos".

**Falsas alarmas al probar** (no son errores): en una pestaña en segundo plano las transiciones se congelan porque el navegador pausa `requestAnimationFrame`; la herramienta de accesibilidad del navegador no muestra los nombres de las etiquetas implícitas, aunque sí existen.

---

## 8. Qué está verificado y qué no

Verificado:
- Fase 9: `npm run check` limpio con **68 pruebas** (nuevas: store de cines, filtros múltiples, formatos y populares del contrato, conversor de formatos). En navegador a 1920 px y 375 px: buscador con populares, formatos y cines; elegir cine desde el buscador; selector con búsqueda, cambio de ciudad y "Elegir todos"; burbujas y quitar cines hasta quedar sin cine; abrir película sin cine (selector y continuación); inicio con barra de fechas; cartelera con filtros múltiples y conteos; paso de alimentos con el catálogo de la dulcería; dulcería con "Tu pedido". Consola sin errores.
- Fase 7: `npm run check` completo: lint y tipos limpios, **52 pruebas** (reglas del servidor, cliente HTTP, sincronización con 40 escenarios aleatorios, conversión de respuestas, fechas y zonas horarias, dinero, folio, QR, personalización de productos, carrito) y compilación de producción. El simulador y SignalR salen en archivos aparte.
- En navegador, escritorio y 375 px de ancho: inicio, cartelera, película, ayuda, legal, 404, compra completa con dos pestañas (conflicto en tiempo real), tipos de boleto, promoción con motivo, alimentos, validación del formulario, pago rechazado, reintento, pago aprobado con QR, dulcería con folio, cancelación con reembolso en cascada, acceso con código (incorrecto y correcto), salir de la compra liberando asientos. Consola sin errores.
- Compilación de producción servida tal cual, incluida una ruta profunda inexistente; modo API sin backend muestra la pantalla de error con "Intentar de nuevo".

No verificado:
- La imagen Docker no se construyó (no hay Docker en la máquina); CI la construye.
- Kong, SignalR real y PostgreSQL en ejecución.
- Otros navegadores además del panel integrado (Chromium).
- La gestión y el prototipo React no se tocaron en la fase 7.

---

## 9. Pendientes

**Del borrador web (prioridad alta, antes de integrar):**
1. **Residuos de la simulación detectados, sin corregir:**
   - `'tt-general'` escrito en `src/features/checkout/useCheckout.ts` (3 lugares) como tipo de boleto por defecto. Con el backend real ese ID no existirá. Tomar el tipo por defecto de `/screenings/{id}/ticket-prices`.
   - `src/app/config.ts` cae en modo `mock` si `config.json` no carga o es inválido. En producción mostraría datos falsos. Hacer que la compilación de producción use `http` por defecto y muestre error ante configuración inválida.
   - Niveles del Club escritos en `src/features/content/ClubView.tsx`. Deberían venir del API (tabla `nivel_club`).
   - El archivo del simulador queda dentro de `dist/` y de la imagen aunque no se descargue. Excluirlo de la compilación de producción y borrar las claves `cp-mock-*` en modo API.
2. ~~Inconsistencia en `docs/mapeo-bd.md`~~ **Corregida el 23 de noviembre de 2026.** El documento mapeaba el folio de boletos a la tabla `folio`, que en realidad guarda vales de beneficio externo. Se reescribió con las descripciones del `.pgerd`: conversiones (pesos en `numeric` a centavos, horas sin zona, funciones que cruzan la medianoche), tabla por dato, 18 faltantes (folio de boletos y token del QR como columnas nuevas de `venta`, el `UNIQUE asiento_id` que impide revender butacas canceladas, inventario, pago, etc.), riesgos de diseño, riesgo legal y preguntas para BD. `docs/contrato-api.md` se alineó (duración del apartado, folio y reventa).
3. Hacer commit de la fase 9 en `Actualización_diseño` cuando el usuario lo pida.

**Del análisis (Claude Doc):** aplicar las cinco imprecisiones de la fase 5 junto con las observaciones del usuario, cuando las mande. Generar el OpenAPI solo si el usuario lo pide.

**Ofrecidos y no pedidos** (no empezar sin permiso):
- Alinear la gestión con la web: los pedidos de ejemplo de la gestión todavía dan folio propio a productos y la capacidad de salas difiere.
- Actualizar el README de la gestión, que dice que `src/shared` es idéntico al de la web (ya no lo es).
- Adaptar la gestión al modelo de BD: salas con tipo fijo y proyección 2D/3D, tarifas como precios explícitos, dulcería con reglas de mínimo y máximo.
- Pasarela de pago real (el contrato ya contempla `payment.kind = "redirect"`), monitoreo de errores, textos legales y contenido reales.

**Preguntas abiertas para los otros equipos:** duración del apartado (el borrador propone 10 minutos; el comentario de `carrito.fecha_expiracion` dice ~15) e intentos del código por correo (la BD indica 3); script SQL completo; si el modelo de BD es definitivo; si se eliminan por decisión el folio de alimentos, el inventario por complejo y las cancelaciones; autorización para usar la API de Cinépolis; quién construye taquilla, control de acceso y la herramienta del personal de dulcería.
