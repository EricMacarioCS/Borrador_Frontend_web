# Del contrato a la base de datos

Cómo se arma cada respuesta del API con las tablas del diagrama ER (`Diagrama ER cinepolis.pgerd`), qué hay que convertir y qué falta en el modelo. Es una propuesta para los equipos de backend y BD: el frontend no lee la BD, solo el contrato de [contrato-api.md](contrato-api.md).

**Fuente:** el archivo de pgAdmin completo, no solo la imagen: 44 tablas, 282 columnas, 62 llaves foráneas y 25 restricciones únicas, con las descripciones que el equipo de BD escribió en tablas y columnas. El archivo **no incluye** restricciones `CHECK`, disparadores, exclusiones ni índices que no sean únicos. Varias conclusiones dependen de ellos, así que hay que revisarlas con el script SQL completo.

## 1. Conversiones que hace el backend

| Tema | En la BD | En el contrato |
| --- | --- | --- |
| Identificadores | `serial` (entero) | Texto: `"42"`. |
| Dinero | `numeric` en pesos (`85.00`) | Centavos enteros: `{ "amount": 8500, "currency": "MXN" }`. Multiplicar por 100 con aritmética `numeric`/`decimal`, nunca con `float`. |
| Instantes | `timestamp` y `time` **sin** zona horaria | ISO 8601 con zona (`2026-11-24T19:30:00-06:00`). Interpretar en la zona del complejo (`America/Mexico_City` para Veracruz). |
| Inicio de función | `fecha_funcion` + `hora_inicio` | `startsAt` como instante. |
| Fin de función | `hora_termino` | `endsAt`. Si `hora_termino` es menor que `hora_inicio`, la función termina al día siguiente (una de 23:00 a 01:46). |
| Fecha de negocio | `fecha_funcion` | `businessDate` (`AAAA-MM-DD`). |
| Estado de asiento | `asiento.estado`: `disponible`, `reservado`, `vendido` | `available`, `held`, `sold`. `blocked` no tiene equivalente hoy (ver faltantes). |
| Estados y tipos en general | Texto libre en 27 columnas | Valores fijos del contrato. Acordar la lista y validarla con `CHECK`. |

## 2. Qué tabla alimenta cada dato

| Dato del contrato | Tablas | Observaciones |
| --- | --- | --- |
| Complejos (`/bootstrap`) | `complejo`, `ciudad` | Son **19 complejos** de Veracruz. La versión VIP y la Tradicional de una misma plaza son complejos distintos. `kind` sale de `tipo_complejo`; `slug` ya existe. No hay columna de zona horaria. El sitio solo deja elegir cines de una misma `ciudad`. |
| Formatos del complejo (`formats` en `/bootstrap`) | `sala`, `sala_formato_sala`, `formato_sala` | Tipos de sala distintos de sus salas activas (`sala.tipo_sala`, `kind = room-type`) más las proyecciones que admiten (`sala_formato_sala` con `es_proyeccion`, `kind = projection`; normalmente solo se publica 3D). Se calcula con un `SELECT DISTINCT`; no hace falta columna nueva. |
| Populares (`/movies?sort=popularity`) | `detalle_venta_boleto`, `venta`, `funcion` | Conteo de boletos vendidos por película en los complejos pedidos durante los últimos días (`venta.fecha`). Con el modelo actual se puede calcular; conviene un índice por fecha de venta o una vista materializada que se refresque cada pocos minutos. |
| Película | `pelicula`, `pelicula_persona`, `persona` | `rating.code` = `clasificacion` (sin descripción); `genres` se obtiene separando `genero`, que es texto libre ("TERROR, SUSPENSO"); `isSpecialEvent` = `es_especial`; `posterUrl` = `poster_url`, `backdropUrl` = `banner_url`, `trailerUrl` = `trailer_url`; reparto por `rol`. **No hay fecha de estreno ni estado**, así que `stage` y `releaseDate` no se pueden calcular. |
| Función | `funcion`, `sala`, `formato_sala` | `projection` = `funcion.formato_id` (formato con `es_proyeccion = true`: 2D o 3D); `room.type` = `sala.tipo_sala` (fijo: Tradicional, VIP, IMAX, Macro XE, 4DX, Junior); `language` = `idioma`. `status` se deriva de `activa`, `es_preventa`, la hora y la ocupación. |
| Proyecciones que admite una sala | `sala_formato_sala` | Solo formatos de proyección (lo verifica el disparador `trg_check_formato_proyeccion`). |
| Plano de la sala | `asiento` de la función | El disparador `trg_generar_asientos` copia `asiento_plantilla` a `asiento` al crear la función, así que cambiar la plantilla no altera funciones ya creadas. El contrato pide `layout { id, version }` como valores opacos: puede servirse un plano por función (`id` = `funcion_id`, `version` = 1) sin tocar el frontend. **Falta la posición visual de pasillos y huecos.** |
| Estado de asientos | `asiento.estado`, `carrito.fecha_expiracion` | El estado se actualiza en una columna. Si el proceso que libera carritos vencidos se retrasa, el asiento queda `reservado`: la disponibilidad debe comprobar el vencimiento del carrito en la misma consulta o transacción. |
| Tipos de boleto y precios | `tipo_boleto`, `precio_boleto` | Precio por complejo, proyección (`formato_id`), tipo de boleto, tipo de sala y `area_category_code`. `tipo_boleto.precio_fijo` cubre boletos a precio fijo (Fiesta Cinépolis). `cargo_servicio_online` es el cargo por boleto. Que un tipo no esté permitido (por ejemplo, niño en clasificación C) es una regla del backend: no hay columna. |
| Promociones | `promocion`, `promocion_complejo` | `aplica_todos` o tabla puente por complejo; `nivel_id` liga promociones del Club. Las condiciones viven en `restricciones` como texto, así que **no se pueden evaluar** automáticamente. |
| Destacados del inicio | `banner_promo`, `banner_promo_complejo` | Para `/content/home`. |
| Niveles del Club | `nivel_club` | `visitas_min_semestre`, `visitas_max_semestre` (nulo en Súper Fanático), `porcentaje_acumulacion_puntos`, `descripcion_beneficios`. Hoy la página del Club los tiene escritos en el frontend; deben venir de aquí. |
| Dulcería | `producto_dulceria`, `categoria_dulceria`, `catalogo_complejo`, `detalle_catalogo`, `modificador_regla`, `modificador_opcion`, `disponibilidad_modificador` | `structure` = `estructura` (`simple`, `compound`, `combo`). Precio local en `detalle_catalogo.precio_actual` y disponibilidad en `detalle_catalogo.disponibilidad` (sí/no, sin cantidad). Reglas: `titulo_regla`, `tipo_modificador`, `min_items`, `max_items`. Opciones: `nombre_opcion`, `precio_adicional`, `es_default`; por complejo, `disponibilidad_modificador.activo` y `precio_extra`. Confirmar cuál precio de opción manda. |
| Apartado | `carrito`, `detalle_carrito`, `asiento` | `carrito.uuid_sesion_web` identifica al invitado; `fecha_expiracion` es el vencimiento absoluto (el comentario dice **~15 minutos**; el borrador propone 10: acordar uno). `estado`: `activo`, `abandonado`, `convertido`. `detalle_carrito.asiento_id` y `tipo_boleto_id` por boleto. |
| Cotización | `carrito`, `detalle_carrito`, `detalle_personalizacion` | Precios en `detalle_carrito.precio_unitario`; mezclas con `detalle_personalizacion.cantidad` y `porcentaje`. Puede usarse `carrito_id` como identificador de la cotización. |
| Compra | `venta`, `detalle_venta_boleto`, `detalle_venta_producto`, `personalizacion_venta`, `detalle_venta_promocion` | Comprador en `nombre_comprador`, `apellido_comprador`, `correo_comprador`; `socio_id` opcional; `sesion_id` nulo en ventas en línea. `detalle_venta_boleto.precio_unitario` guarda el precio cobrado y su `UNIQUE asiento_id` impide vender una butaca dos veces. |
| "Mis compras" por correo | `otp_verificacion`, `venta.correo_comprador` | El código permite consultar compras como invitado. Máximo 3 intentos y vigencia de ~2 minutos según los comentarios. |
| Cuenta del Club | `cuenta_club`, `detalle_puntos` | Correo único. En el borrador el Club es solo informativo. |

**Tablas que el sitio web no usa:**
- `folio`: según su descripción, son **folios de beneficio externo que actúan como moneda de cambio** (vales). Más adelante podrían aceptarse como forma de pago o descuento, pero **no son el folio de boletos** que se usa para pedir alimentos.
- `sesion`, `corte_caja`, `punto_venta`: turnos y caja de taquilla. `sesion` es el turno de un empleado, no una sesión de acceso.
- `empleado`, `rol`: personal de los complejos (sistema de gestión).
- `garantia_reclamo`: reclamaciones de la garantía de satisfacción; formulario futuro.
- `historial_producto`: historial de precios (sistema de gestión).

## 3. Lo que falta para funciones ya definidas

| # | Falta | Consecuencia | Propuesta |
| --- | --- | --- | --- |
| 1 | **Código de la compra (folio de boletos) y código de acceso del QR** | Nuestro folio `CIN-XXXX-XXXX-XXXX` no existe en el modelo; la tabla `folio` es otra cosa. Sin él no se pueden pedir alimentos ni mostrar el boleto. | `venta.codigo_compra` único y `venta.token_acceso` único y aleatorio. El QR usa el token, no el folio, para que una foto del folio no sirva de entrada. |
| 2 | Pedido de alimentos ligado a los boletos | Al cancelar los boletos no se puede cancelar la comida ligada, ni validar que sea del mismo complejo. | `venta.venta_boletos_id` (llave a la venta de boletos). |
| 3 | **Estado de la venta, cancelación y reembolso** | No se puede cancelar sin borrar. Además, por el `UNIQUE asiento_id` de `detalle_venta_boleto`, **un asiento cancelado no puede volver a venderse** mientras exista ese renglón. | `venta.estado` (`payment-pending`, `confirmed`, `payment-failed`, `refund-pending`, `refunded`, `cancelled`) con `CHECK`, más fechas y datos de reembolso. Cambiar el `UNIQUE asiento_id` por un índice único parcial sobre los boletos vigentes (`WHERE cancelado_en IS NULL`), para conservar el historial y liberar la butaca. |
| 4 | Complejo de la venta | Un pedido solo de alimentos no indica de qué complejo es, y `detalle_venta_producto` apunta al producto global, no al catálogo del complejo. | `venta.complejo_id` (y, si se necesita, `detalle_venta_producto.detalle_catalogo_id`). |
| 5 | Estado del pedido de dulcería y momento de recolección | No existen "En preparación", "Listo" ni "Entregado", ni "antes" o "durante la función". | `venta.estado_pedido` y `venta.recoger_en`, con `CHECK`. |
| 6 | Inventario | No hay existencias ni movimientos: no se puede implementar el inventario del personal del complejo, los productos agotados ni las medias porciones. | `detalle_catalogo.existencias` y una tabla de movimientos (quién, cuándo, cuánto, motivo). |
| 7 | Pago y relación carrito–venta | No se puede conciliar un cobro ni evitar ventas duplicadas por reintentos. | Tabla `pago` (proveedor, referencia, estado, monto, fechas), `venta.carrito_id` único y una clave de idempotencia (tabla `idempotencia` o columna única). |
| 8 | Datos de cartelera de la película | Sin fechas no se calculan Próximamente, Preventa ni Estreno, ni "Estreno el 28 de noviembre". | `pelicula.fecha_estreno`, `inicio_preventa`, `fecha_fin` y un catálogo `clasificacion(codigo, descripcion)`. |
| 9 | Reglas de promociones | El 2×1 de los martes no puede aplicarse solo, y no se guarda cuánto se descontó. | Condiciones estructuradas (días, proyecciones, tipos de sala, horario, porcentaje o 2×1) y `detalle_venta_promocion.monto_descuento`. |
| 10 | Zona horaria | 12 columnas de fecha y hora no tienen zona: si el servidor corre en UTC, `CURRENT_TIMESTAMP` guarda horas desfasadas seis horas. | `timestamptz` en instantes; para funciones, inicio como `timestamptz` (resuelve también las que cruzan la medianoche). Como mínimo, `complejo.zona_horaria`. |
| 11 | Versión del mapa por función | Los eventos de SignalR llevan un contador consecutivo para detectar eventos perdidos. | `funcion.version_asientos bigint`, incrementado en la misma transacción que cambia `asiento.estado`. |
| 12 | Posición visual del plano | `asiento_plantilla` solo tiene fila y número de columna: no hay pasillos, huecos ni una etiqueta separada del número. | Columna de posición visual (o huecos explícitos) y `etiqueta`. |
| 13 | Asiento bloqueado | No hay estado para butacas fuera de servicio. | Agregar `bloqueado` a los valores de `asiento.estado`. |
| 14 | Mitad y mitad | `porcentaje` existe en las personalizaciones, pero nada indica qué reglas permiten repartir. | `modificador_regla.permite_mitades boolean`. |
| 15 | Componentes de un combo | No hay tabla de qué productos forman un combo. | Tabla `combo_componente` o confirmar que se modela con reglas. |
| 16 | Configuración | Asientos por compra, minutos de apartado, plazo de cancelación y limpieza entre funciones no tienen dónde vivir. | Tabla de configuración (global y por complejo). |
| 17 | Contenido | Preguntas frecuentes y textos legales no tienen tabla (solo existen banners). | Tablas simples o un CMS; el contrato no cambia. |
| 18 | Usuarios administrativos, permisos y auditoría | El inicio de sesión del sistema de gestión y el registro de cambios no tienen dónde guardarse. | Tablas de usuario, rol de acceso y bitácora. |

## 4. Riesgos de diseño

- **Traslape de funciones:** `uq_funcion_logica` solo impide dos funciones con la misma hora de inicio en una sala. Una a las 18:00 y otra a las 18:30 se aceptan, salvo que exista una exclusión o un disparador fuera del diagrama. Propuesta: restricción de exclusión con un rango de tiempo por sala (incluyendo limpieza).
- **Disparador de asientos:** `area_category_code` admite nulos en `asiento_plantilla` pero no en `asiento`. Si `trg_generar_asientos` copia el valor directamente, fallará al crear funciones con plantillas incompletas. Hay que probarlo.
- **Apartado atómico:** dos clientes no deben reservar la misma butaca. Hacerlo con `UPDATE asiento SET estado = 'reservado' WHERE ... AND estado = 'disponible'` comprobando las filas afectadas, dentro de la transacción que crea el carrito.
- **Índices:** 9 llaves foráneas no tienen índice aparente, por ejemplo `historial_producto.detalle_id` y `precio_boleto.tipo_boleto_id`.
- **Código por correo:** `otp_verificacion.codigo` debería guardarse con hash, y el límite de intentos aplicarse también por IP.
- **Versión de PostgreSQL:** `uq_precio_boleto` y otra restricción usan `NULLS NOT DISTINCT`, que exige PostgreSQL 15 o posterior.

## 5. Riesgo legal

Varias columnas dependen de la API real de Cinépolis (Vista): `vista_id`, `asiento_api_id` ("requerido por el servidor de Cinépolis para concretar compras reales"), `api_id`, `api_id_opcion`, y las reglas de dulcería se describen como "descubiertas en la red". Antes de construir sobre eso, el equipo debe confirmar que existe **acceso autorizado y documentado**. Si esos identificadores se obtuvieron observando el tráfico de su sitio, no se debe depender de ellos ni hacer compras a través de esos servidores.

## 6. Qué pedir al equipo de base de datos

1. El script SQL completo, con `CHECK`, disparadores e índices.
2. Si el modelo es definitivo o se pueden agregar los faltantes de la sección 3.
3. Si el folio de boletos para alimentos, el inventario por complejo y las cancelaciones se eliminan **por decisión** o solo faltan. Si se eliminan, hay que retirarlos de los prototipos y del borrador.
4. Cuánto dura un apartado (10 o 15 minutos) y cuántos intentos admite el código por correo.
5. La confirmación del uso autorizado de la API de Cinépolis.
