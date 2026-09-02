/**
 * Un diccionario es un mapa plano `clave → texto`. Plano y no anidado a
 * propósito: la búsqueda es un único `Map.get` sin recorrer rutas, y comparar
 * dos idiomas para ver qué falta es un `Object.keys` sin recursión.
 *
 * La clave sigue el patrón `<ambito>.<elemento>` en camelCase
 * (`navbar.misReservas`, `home.proTitulo`). El ámbito es la pantalla o el
 * componente, nunca la ruta: un texto que se mueve de sitio no cambia de clave.
 */
export type Diccionario = Readonly<Record<string, string>>;

/** Valores admitidos en la interpolación `{nombre}` de una traducción. */
export type ParametrosTraduccion = Readonly<Record<string, string | number>>;
