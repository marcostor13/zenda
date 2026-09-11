/**
 * Pasa la configuración del contenedor al render de servidor.
 *
 * En el navegador, `environment.ts` lee `globalThis.__env`, que el contenedor
 * escribe en `public/env.js` al arrancar. En Node ese fichero no se ejecuta
 * nunca: sin esto, el render de servidor usaría los valores compilados por
 * defecto y pediría los datos al API equivocado —el de desarrollo— mientras el
 * navegador, con el mismo código, hablaría con el bueno.
 *
 * Se importa **el primero** en `server.ts`: los módulos de ESM se evalúan en el
 * orden en que se importan, así que lo que este fichero deja en `globalThis` ya
 * está puesto cuando el motor de Angular carga la aplicación.
 */
const PREFIJO = 'WEB_';

const publicas = Object.entries(process.env)
  .filter(([clave, valor]) => clave.startsWith(PREFIJO) && valor !== undefined && valor !== '')
  .reduce<Record<string, string>>((acumulado, [clave, valor]) => {
    acumulado[clave] = valor as string;
    return acumulado;
  }, {});

(globalThis as { __env?: Record<string, string> }).__env = publicas;

export const variablesPublicas = publicas;
