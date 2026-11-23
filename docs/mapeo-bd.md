# Del contrato a la base de datos

Cómo se arma cada respuesta del API con las tablas del diagrama ER (`Diagrama ER cinepolis.pgerd`) y qué hace falta agregar. Es una propuesta para el equipo de backend y BD: el frontend no lee la BD, solo el contrato de [contrato-api.md](contrato-api.md).

El diagrama exportado no incluye restricciones `CHECK`, índices únicos, disparadores ni exclusiones. Varias reglas de abajo dependen de ellos, así que conviene revisar el DDL completo.

## Mapeo

| Dato del contrato | Tablas | Observaciones |
| --- | --- | --- |
| Complejo (`/bootstrap`) | `complejo`, `ciudad` | `kind` sale de `tipo_complejo`. La versión VIP de una plaza es otro complejo. |
| Película | `pelicula`, `pelicula_persona`, `persona` | `rating.code` = `clasificacion`; `genres` sale de `genero`. `posterUrl` = `poster_url`, `backdropUrl` = `banner_url`. |
| Función | `funcion`, `sala`, `formato_sala` | `startsAt` = `fecha_funcion` + `hora_inicio` en la zona del complejo, enviado con zona. `status` se deriva de `activa`, la hora y la ocupación. |
| Formatos que admite una sala | `sala_formato_sala`, `formato_sala` | `es_proyeccion` distingue 2D/3D del tipo de sala. |
| Plano de la sala | `asiento_plantilla` | `fila`, `columna`, `tipo_asiento`; los pasillos son celdas vacías. |
| Estado de asientos | `asiento` (por función) | `estado` por `funcion_id`. Ver regla de atomicidad. |
| Precios | `precio_boleto`, `tipo_boleto` | Por complejo, formato, tipo de sala y tipo de boleto. `cargo_servicio_online` es el cargo por boleto. |
| Promociones | `promocion`, `promocion_complejo`, `banner_promo` | Las reglas viven en `restricciones` como texto. |
| Dulcería | `producto_dulceria`, `categoria_dulceria`, `catalogo_complejo`, `detalle_catalogo`, `modificador_regla`, `modificador_opcion`, `disponibilidad_modificador` | `min_items`/`max_items` son el mínimo y máximo de cada regla. El precio vigente sale de `detalle_catalogo.precio_actual` y `disponibilidad_modificador.precio_extra`. |
| Apartado | `carrito`, `detalle_carrito` | `fecha_expiracion` es el vencimiento absoluto; `asiento_id` liga cada asiento. |
| Cotización | `carrito`, `detalle_carrito`, `detalle_personalizacion` | Totales calculados en el servidor. |
| Compra | `venta`, `detalle_venta_boleto`, `detalle_venta_producto`, `personalizacion_venta`, `detalle_venta_promocion` | Datos del comprador en `nombre_comprador`, `apellido_comprador`, `correo_comprador`. |
| Folio | `folio` | `codigo` con formato `CIN-XXXX-XXXX-XXXX` (Crockford Base32), `estado`, `venta_id`. |
| Código por correo | `otp_verificacion` | `intentos` y `expiracion` dan el bloqueo y el vencimiento. |
| Club | `cuenta_club`, `nivel_club`, `detalle_puntos` | En este borrador el club solo es informativo. |

## Columnas o tablas que faltan

| Necesidad | Por qué | Propuesta |
| --- | --- | --- |
| Zona horaria del complejo | Para convertir `fecha_funcion` + `hora_inicio` en un instante sin ambigüedad. | `complejo.zona_horaria text not null default 'America/Mexico_City'`. |
| Fecha de estreno | La etapa (`coming-soon`, `presale`, `premiere`, `now-showing`) depende de ella. | `pelicula.fecha_estreno date`. |
| Descripción de clasificación | La interfaz muestra "Para adolescentes de 12 años en adelante". | Catálogo `clasificacion(codigo, descripcion)`. |
| Versión del plano | El cliente guarda el plano en caché por versión. Si cambia a mitad de la venta, los asientos no deben moverse. | `sala.version_plano int` y copiar el plano a `asiento` al crear la función, como ya sugiere el diseño. |
| Versión del mapa por función | Los eventos de SignalR llevan un contador consecutivo para detectar huecos. | `funcion.version_asientos bigint`, incrementado en la misma transacción que cambia `asiento.estado`. |
| Atomicidad del apartado | Dos clientes no deben apartar el mismo asiento. | `UPDATE asiento SET estado = 'apartado' ... WHERE estado = 'disponible'` comprobando filas afectadas, o índice único parcial en `detalle_carrito(asiento_id)` para carritos vigentes. |
| Estado de la compra | `payment-pending`, `confirmed`, `payment-failed`, `refund-pending`, `refunded`, `cancelled`. | `venta.estado` con `CHECK`, más referencia del proveedor de pago. |
| Clave de idempotencia | Repetir la misma petición no debe cobrar dos veces. | Tabla `idempotencia(clave uuid primary key, sesion, alcance, huella, recurso_id, creado_en)` o `venta.clave_idempotencia` única. |
| Reembolso | Estado e importe del reembolso. | `venta.reembolso_estado`, `venta.reembolso_monto`, `venta.reembolsada_en`. |
| Complejo de un pedido de dulcería | Una venta sin boletos no tiene función de la que sacar el complejo. | `venta.complejo_id`. |
| Momento de recolección | "Antes de la función" o "durante la función". | `venta.recoger_en` con `CHECK`. |
| Pedido ligado a un folio | Al cancelar los boletos se cancela la comida ligada. | `venta.folio_vinculado_id` → `folio`. |
| Mitad y mitad | `personalizacion_venta.porcentaje` existe, pero no hay forma de saber qué reglas lo permiten. | `modificador_regla.permite_mitades boolean`. |
| Existencias | Productos que se agotan en línea. | `detalle_catalogo.existencias int null` (null = sin límite). |
| Reglas de promociones | `restricciones` como texto no se puede evaluar. | Columnas o JSON estructurado: días, tipos de sala, formatos, horario y porcentaje. |
| Código de acceso del QR | El QR no debe ser el folio, para que una foto del folio no sirva de entrada. | `folio.token_acceso` aleatorio, de un solo uso en la entrada. |
| OTP seguro | El código no debe guardarse en claro. | Guardar el hash de `codigo` y limitar intentos por correo y por IP. |
| Contenido | Páginas legales y preguntas frecuentes no tienen tabla. | Tablas simples o un CMS; el contrato no cambia. |
