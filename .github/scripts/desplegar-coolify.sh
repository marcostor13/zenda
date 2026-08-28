#!/usr/bin/env bash
#
# Dispara un despliegue en Coolify.
#
# Coolify ofrece dos formas de lanzarlo y NO aceptan el mismo verbo HTTP:
#
#   - API de despliegue: GET  https://<coolify>/api/v1/deploy?uuid=<uuid>
#     con `Authorization: Bearer <api-token>`.
#   - Webhook de la aplicación: POST https://<coolify>/webhooks/deploy/<token>
#
# Usar el verbo equivocado no da un error legible: Coolify responde **405** y
# `curl -f` corta con "exit code 22", que no dice ni qué URL ni qué método.
# Ya pasó: el despliegue de la web llevaba tiempo fallando así.
#
# Por eso aquí se elige el método por la forma de la URL y, si aun así llega un
# 405, se reintenta una vez con el otro. El resto de códigos se reportan con su
# número y el cuerpo de la respuesta.
#
# La URL NO se imprime nunca: la del webhook lleva un token en la ruta.
#
# Uso: desplegar-coolify.sh <url> <api-token> <nombre-del-servicio>
set -euo pipefail

url="${1:-}"
token="${2:-}"
servicio="${3:-servicio}"

if [ -z "$url" ]; then
  echo "::error::Falta la URL de despliegue de Coolify para $servicio (secret sin configurar en GitHub → Settings → Secrets and variables → Actions)."
  exit 1
fi

if [ -z "$token" ]; then
  echo "::error::Falta COOLIFY_API_TOKEN (Coolify → Keys & Tokens → API tokens, con permiso 'deploy')."
  exit 1
fi

# El webhook por aplicación es POST; la API de despliegue, GET.
case "$url" in
  */webhooks/*) metodo="POST" ;;
  *)            metodo="GET"  ;;
esac

cuerpo="$(mktemp)"
trap 'rm -f "$cuerpo"' EXIT

lanzar() {
  curl -sS -o "$cuerpo" -w '%{http_code}' \
    --request "$1" "$url" --header "Authorization: Bearer $token"
}

codigo="$(lanzar "$metodo")"

if [ "$codigo" = "405" ]; then
  # El servidor dice que ese verbo no vale ahí: la URL es del otro tipo.
  if [ "$metodo" = "GET" ]; then otro="POST"; else otro="GET"; fi
  echo "Coolify rechazó $metodo con 405; reintentando con $otro."
  metodo="$otro"
  codigo="$(lanzar "$metodo")"
fi

case "$codigo" in
  2*)
    echo "Despliegue de $servicio lanzado en Coolify ($metodo, HTTP $codigo)."
    ;;
  401|403)
    echo "::error::Coolify rechazó las credenciales al desplegar $servicio (HTTP $codigo). Revisa COOLIFY_API_TOKEN y su permiso 'deploy'."
    cat "$cuerpo"
    exit 1
    ;;
  404)
    echo "::error::Coolify no encuentra el recurso al desplegar $servicio (HTTP 404). La URL apunta a un uuid o a un webhook que ya no existe."
    cat "$cuerpo"
    exit 1
    ;;
  *)
    echo "::error::Coolify respondió HTTP $codigo al desplegar $servicio con $metodo."
    cat "$cuerpo"
    exit 1
    ;;
esac
