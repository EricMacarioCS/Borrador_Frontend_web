#!/bin/sh
# Genera /config.json a partir de variables de entorno al arrancar el contenedor.
# Así la misma imagen sirve para pruebas, staging y producción sin recompilar.
set -eu

target=/usr/share/nginx/html/config.json

json_string() {
  # Escapa barras invertidas y comillas para producir una cadena JSON válida.
  printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"
}

json_bool() {
  case "$1" in
    true|false) printf '%s' "$1" ;;
    *) echo "40-runtime-config: valor booleano inválido: $1" >&2; exit 1 ;;
  esac
}

case "${API_MODE}" in
  http|mock) ;;
  *) echo "40-runtime-config: API_MODE debe ser http o mock" >&2; exit 1 ;;
esac

support=null
if [ -n "${SUPPORT_EMAIL:-}" ]; then support=$(json_string "$SUPPORT_EMAIL"); fi

cat > "$target" <<EOF
{
  "apiMode": $(json_string "$API_MODE"),
  "apiBaseUrl": $(json_string "$API_BASE_URL"),
  "hubUrl": $(json_string "$HUB_URL"),
  "environmentName": $(json_string "$ENVIRONMENT_NAME"),
  "supportEmail": $support,
  "features": {
    "realtimeSeats": $(json_bool "$FEATURE_REALTIME_SEATS"),
    "onlinePayments": $(json_bool "$FEATURE_ONLINE_PAYMENTS"),
    "accounts": $(json_bool "$FEATURE_ACCOUNTS")
  },
  "mock": { "latencyMs": [120, 420], "failureRate": 0 }
}
EOF

echo "40-runtime-config: config.json generado para ${ENVIRONMENT_NAME} (${API_MODE})"
