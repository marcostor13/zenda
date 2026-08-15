#!/bin/sh
# Escribe la configuración de la web a partir de las variables del contenedor.
#
# Se ejecuta en cada arranque: cambiar la URL del API o apagar la pantalla de
# "muy pronto" es reiniciar el servicio en Coolify, no reconstruir la imagen.
#
# Sólo se publican las variables `WEB_*`. Es la barrera que impide que una clave
# de servidor (GOOGLE_MAPS_API_KEY, MONGODB_URI, la secreta de Stripe) acabe
# descargándose en el navegador por estar declarada en el mismo sitio.
set -e

DESTINO="/usr/share/nginx/html/env.js"

# Las comillas y las barras invertidas se escapan: un valor con comillas rompería
# el fichero y dejaría la web sin arrancar.
escapar() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

{
  echo "// Generado por docker-entrypoint.sh en el arranque. No editar."
  echo "window.__env = {"
  for variable in $(env | grep '^WEB_' | cut -d= -f1 | sort); do
    valor=$(eval "printf '%s' \"\$$variable\"")
    [ -z "$valor" ] && continue
    printf '  "%s": "%s",\n' "$variable" "$(escapar "$valor")"
  done
  echo "};"
} > "$DESTINO"

echo "Configuración de la web escrita en $DESTINO:"
grep -o '"WEB_[A-Z_]*"' "$DESTINO" | tr -d '"' | tr '\n' ' '
echo ""

exec "$@"
