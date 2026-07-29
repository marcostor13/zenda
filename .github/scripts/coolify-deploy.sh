#!/usr/bin/env bash
#
# Dispara un deploy en Coolify.
#
# La API de deploy de Coolify autentica con la cabecera `Authorization: Bearer <API token>`,
# NO con un token en la query string: una petición sin esa cabecera responde 401 y el deploy
# nunca se encola (ese fue el fallo que dejó doogking.com sirviendo un 502, sin contenedor
# detrás del dominio). El endpoint espera GET, no POST.
#
# Uso: coolify-deploy.sh <url-del-endpoint-de-deploy> <etiqueta-del-recurso>
# Requiere la variable de entorno COOLIFY_TOKEN.

set -uo pipefail

url="${1-}"
etiqueta="${2-el recurso}"

if [ -z "$url" ]; then
  echo "::error::Falta la URL de deploy de Coolify para ${etiqueta}. Configúrala en GitHub > Settings > Secrets and variables > Actions."
  exit 1
fi

if [ -z "${COOLIFY_TOKEN-}" ]; then
  echo "::error::Falta el secret COOLIFY_TOKEN. Genéralo en Coolify > Keys & Tokens > API tokens y añádelo a GitHub Secrets."
  exit 1
fi

cuerpo="$(mktemp)"
trap 'rm -f "$cuerpo"' EXIT

codigo="$(curl -sS --request GET "$url" \
  --header "Authorization: Bearer ${COOLIFY_TOKEN}" \
  --output "$cuerpo" \
  --write-out '%{http_code}')"

# curl escribe 000 cuando no llegó a recibir respuesta (DNS, TLS o conexión rechazada).
if ! [[ "$codigo" =~ ^[0-9]{3}$ ]] || [ "$codigo" = "000" ]; then
  echo "::error::No se pudo contactar con Coolify para desplegar ${etiqueta} (fallo de red, TLS o URL inválida)."
  exit 1
fi

if [ "$codigo" -lt 200 ] || [ "$codigo" -ge 300 ]; then
  echo "::error::Coolify respondió HTTP ${codigo} al desplegar ${etiqueta}."
  # Un 401 casi siempre significa token inválido/caducado o UUID que no corresponde al recurso.
  cat "$cuerpo"
  exit 1
fi

echo "Deploy de ${etiqueta} encolado en Coolify (HTTP ${codigo})."
cat "$cuerpo"
