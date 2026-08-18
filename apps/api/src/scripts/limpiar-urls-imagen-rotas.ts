/**
 * limpiar-urls-imagen-rotas.ts
 *
 * Uso:
 *   bun run --cwd apps/api limpiar:urls-imagen            (simulación)
 *   bun run --cwd apps/api limpiar:urls-imagen -- --aplicar
 *
 * El panel del comercio guardaba las imágenes de una sola URL haciendo `arr[0]`
 * sobre un valor que ya era la cadena, de modo que en la base quedó escrita la
 * **primera letra** de la URL (`"h"` de `https://…`). La ficha salía con la
 * imagen rota al recargar. El formulario ya está corregido; esto limpia lo que
 * quedó guardado.
 *
 * **Sólo borra valores que no pueden ser una URL** (uno o dos caracteres). No
 * intenta reconstruir nada: el fichero original sigue subido, pero su URL se
 * perdió al truncarse, así que lo honesto es dejar el campo vacío y que el
 * comercio vuelva a elegir la imagen, no inventar una ruta.
 */
import mongoose from 'mongoose';
import { prepararEntorno } from './entorno';

const MONGODB_URI = prepararEntorno();

const APLICAR = process.argv.includes('--aplicar');

/** Campos de imagen única afectados, con su ruta en el documento. */
const CAMPOS = [
  'logoUrl',
  'coverUrl',
  'verificacion.documentoIdentidadUrl',
  'verificacion.licenciaNegocioUrl',
] as const;

/**
 * Una URL real nunca tiene dos caracteres. Se usa la longitud y no un `=== 'h'`
 * porque el truncado deja la primera letra de lo que hubiera: `/` en una ruta
 * relativa, `d` en un `data:`…
 */
const LONGITUD_IMPOSIBLE = 2;

function esRota(valor: unknown): boolean {
  return typeof valor === 'string' && valor.trim().length > 0 && valor.trim().length <= LONGITUD_IMPOSIBLE;
}

/** Lee un campo anidado con notación de punto. */
function leer(documento: Record<string, unknown>, ruta: string): unknown {
  return ruta.split('.').reduce<unknown>(
    (actual, parte) => (actual as Record<string, unknown> | undefined)?.[parte],
    documento,
  );
}

async function limpiar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const comercios = db.collection('comercios');
  const todos = await comercios.find({}).toArray();

  let tocados = 0;
  const porCampo: Record<string, number> = {};
  const ejemplos: string[] = [];

  for (const comercio of todos) {
    const documento = comercio as unknown as Record<string, unknown>;
    const aBorrar: Record<string, ''> = {};

    for (const campo of CAMPOS) {
      const valor = leer(documento, campo);
      if (!esRota(valor)) continue;

      aBorrar[campo] = '';
      porCampo[campo] = (porCampo[campo] ?? 0) + 1;

      if (ejemplos.length < 10) {
        ejemplos.push(`   · ${String(documento['nombreComercial'])} — ${campo}: ${JSON.stringify(valor)}`);
      }
    }

    if (!Object.keys(aBorrar).length) continue;
    tocados++;

    if (APLICAR) {
      await comercios.updateOne({ _id: comercio._id }, { $unset: aBorrar });
    }
  }

  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Comercios revisados        : ${todos.length}`);
  console.log(`Comercios con URLs rotas   : ${tocados}`);
  for (const campo of CAMPOS) {
    if (porCampo[campo]) console.log(`  ${campo.padEnd(36)}: ${porCampo[campo]}`);
  }

  if (ejemplos.length) {
    console.log('');
    console.log('Valores que se borran:');
    ejemplos.forEach((linea) => console.log(linea));
  }

  if (!APLICAR) {
    console.log('');
    console.log('ℹ️  Simulación. Vuelve a ejecutarlo con --aplicar para guardar los cambios.');
  } else if (tocados) {
    console.log('');
    console.log('✅ Campos vaciados. Cada comercio afectado debe volver a subir su imagen.');
  }

  await mongoose.disconnect();
}

limpiar().catch((error) => {
  console.error('❌  Error limpiando las URLs:', error);
  process.exit(1);
});
