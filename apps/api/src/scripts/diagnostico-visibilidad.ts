/**
 * diagnostico-visibilidad.ts — sólo lectura
 *
 * Uso:
 *   bun run --cwd apps/api diagnostico:visibilidad
 *   bun run --cwd apps/api diagnostico:visibilidad -- --comercio "Royal Dog"
 *
 * Responde a la pregunta que llega de soporte: **«este negocio está aprobado,
 * ¿por qué no sale en la búsqueda?»**. Para cada listado dice si el buscador lo
 * devolvería y, si no, por qué exactamente.
 *
 * Existe porque el buscador no consulta el estado del comercio: filtra por la
 * copia denormalizada `comercioActivo` que cada listado lleva encima (ver
 * `Servicio.comercioActivo`, y el porqué del índice ESR en CLAUDE.md §4.3). Un
 * negocio puede estar `activo` y sus listados marcados como inactivos, y desde
 * el panel no se ve la diferencia: los dos sitios dicen «activo».
 *
 * **No escribe nada.** La reparación es `backfill:comercio-activo --aplicar`.
 */
import mongoose from 'mongoose';
import { MIN_FOTOS_SERVICIO } from 'shared';
import { prepararEntorno } from './entorno';

const MONGODB_URI = prepararEntorno();

/** `--comercio "texto"` acota el informe a los negocios que casen por nombre. */
function filtroDeComercio(): string | null {
  const i = process.argv.indexOf('--comercio');
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

/** Contador de plazas libres de cada categoría, tal y como lo lee el buscador. */
const CAMPO_PLAZAS: Readonly<Record<string, string>> = {
  alojamiento: 'espaciosDisponibles',
  hoteles: 'unidadesDisponibles',
  transporte: 'unidadesDisponibles',
  veterinaria: 'citasDisponibles',
  peluqueria: 'cuposDisponibles',
  adiestramiento: 'cuposDisponibles',
  funerarios: 'cuposDisponibles',
};

interface Listado {
  _id: unknown;
  titulo?: string;
  vertical?: string;
  estado?: string;
  comercioActivo?: boolean;
  comercioId?: unknown;
  imagenes?: unknown[];
  ubicacion?: { ciudad?: string; geo?: unknown };
  [campo: string]: unknown;
}

interface Negocio {
  _id: unknown;
  nombreComercial?: string;
  estado?: string;
}

/**
 * Motivos por los que el buscador no devolvería el listado, del más grave al
 * más leve. Vacío = se ve.
 */
function motivos(listado: Listado, negocio: Negocio | undefined): string[] {
  const fallos: string[] = [];

  if (!negocio) {
    fallos.push('BLOQUEANTE · su comercio no existe (listado huérfano)');
  } else if (listado.comercioActivo !== true && negocio.estado === 'activo') {
    // El caso que trae a soporte: aprobado en `comercios`, inactivo en el flag.
    fallos.push('BLOQUEANTE · DESINCRONIZADO: el comercio está activo pero el listado lo lleva como inactivo');
  } else if (listado.comercioActivo !== true) {
    fallos.push(`BLOQUEANTE · su comercio está en estado "${negocio.estado}", no activo`);
  }

  if (listado.estado !== 'publicado') {
    fallos.push(`BLOQUEANTE · el listado está en "${listado.estado}", no publicado`);
  }

  /*
   * Guardado como texto, el listado se busca igual —el buscador no cruza con
   * `comercios`—, pero la propagación del flag sí lo hace por `_id`, así que
   * aprobar el negocio nunca alcanzará a este listado.
   */
  if (typeof listado.comercioId === 'string') {
    fallos.push('BLOQUEANTE · comercioId guardado como texto: aprobar el comercio no llegará a actualizarlo');
  }

  // Lo que sigue no lo esconde del todo, pero lo deja fuera de búsquedas muy
  // corrientes: el usuario casi siempre escribe una ciudad.
  if (!listado.ubicacion?.ciudad) {
    fallos.push('PARCIAL · sin ciudad: no aparece al buscar por población');
  }
  if (!listado.ubicacion?.geo) {
    fallos.push('PARCIAL · sin coordenadas: no sale en el mapa ni al ordenar por cercanía');
  }
  if ((listado.imagenes?.length ?? 0) < MIN_FOTOS_SERVICIO) {
    fallos.push(`PARCIAL · ${listado.imagenes?.length ?? 0} fotos (el mínimo para publicar son ${MIN_FOTOS_SERVICIO})`);
  }

  /*
   * Bloqueante, aunque no lo parezca: la búsqueda descarta por defecto lo que no
   * se puede reservar (`soloDisponibles` vale `true` si no se dice otra cosa).
   * Un contador a 0 esconde el listado de la web entera, publicado que esté; el
   * contador sale de la capacidad que declara el comercio (`disponibilidad.ts`).
   * Un contador **ausente** sí pasa el filtro, y por eso no cuenta aquí.
   */
  const campoPlazas = CAMPO_PLAZAS[listado.vertical ?? ''];
  if (campoPlazas && listado[campoPlazas] === 0) {
    fallos.push(`BLOQUEANTE · ${campoPlazas} a 0: sin capacidad declarada no hay nada que reservar`);
  }

  return fallos;
}

const esBloqueante = (motivo: string): boolean => motivo.startsWith('BLOQUEANTE');

async function diagnosticar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const negocios = await db.collection('comercios').find<Negocio>({}).toArray();
  const porId = new Map(negocios.map((c) => [String(c._id), c]));

  const buscado = filtroDeComercio();
  const idsBuscados = buscado
    ? new Set(
        negocios
          .filter((c) => (c.nombreComercial ?? '').toLowerCase().includes(buscado.toLowerCase()))
          .map((c) => String(c._id)),
      )
    : null;

  const listados = (await db.collection('servicios').find<Listado>({}).toArray())
    .filter((s) => !idsBuscados || idsBuscados.has(String(s.comercioId)));

  if (buscado) {
    console.log(`Filtrando por comercio que contenga «${buscado}»: ${idsBuscados?.size ?? 0} negocios.`);
    console.log('');
  }

  // ── 1. Lo primero que pregunta soporte ──────────────────────────────────
  const desincronizados = listados.filter((s) => {
    const negocio = porId.get(String(s.comercioId));
    return negocio?.estado === 'activo' && s.comercioActivo !== true;
  });

  console.log('── Negocios aprobados cuyos listados están marcados como inactivos ──');
  if (!desincronizados.length) {
    console.log('  Ninguno. El flag del buscador coincide con el estado de cada comercio.');
  } else {
    console.log(`  ${desincronizados.length} listado(s) afectados. Se reparan con:`);
    console.log('    bun run --cwd apps/api backfill:comercio-activo -- --aplicar');
    console.log('');
    const porNegocio = new Map<string, number>();
    for (const s of desincronizados) {
      const nombre = porId.get(String(s.comercioId))?.nombreComercial ?? '(sin nombre)';
      porNegocio.set(nombre, (porNegocio.get(nombre) ?? 0) + 1);
    }
    for (const [nombre, n] of porNegocio) console.log(`    ${nombre}: ${n} listado(s)`);
  }

  // ── 2. Recuento global ──────────────────────────────────────────────────
  const visibles = listados.filter((s) => !motivos(s, porId.get(String(s.comercioId))).some(esBloqueante));

  console.log('');
  console.log('── Qué devuelve hoy el buscador ───────────────────────────');
  console.log(`  Listados en la base            : ${listados.length}`);
  console.log(`  Visibles (publicado + activo)  : ${visibles.length}`);
  console.log(`  Ocultos                        : ${listados.length - visibles.length}`);

  // ── 3. Por qué están ocultos ────────────────────────────────────────────
  const cuenta = new Map<string, number>();
  for (const listado of listados) {
    for (const motivo of motivos(listado, porId.get(String(listado.comercioId)))) {
      cuenta.set(motivo, (cuenta.get(motivo) ?? 0) + 1);
    }
  }

  console.log('');
  console.log('── Motivos, por número de listados afectados ──────────────');
  const ordenados = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  if (!ordenados.length) console.log('  Ninguno: todos los listados se ven y están completos.');
  for (const [motivo, n] of ordenados) console.log(`  ${String(n).padStart(4)} · ${motivo}`);

  // ── 4. Detalle, negocio a negocio ───────────────────────────────────────
  console.log('');
  console.log('── Detalle por negocio ────────────────────────────────────');
  for (const negocio of negocios) {
    const suyos = listados.filter((s) => String(s.comercioId) === String(negocio._id));
    if (!suyos.length && idsBuscados) continue;
    if (!suyos.length) continue;

    const suyosVisibles = suyos.filter((s) => !motivos(s, negocio).some(esBloqueante));
    console.log('');
    console.log(`  ${negocio.nombreComercial ?? '(sin nombre)'} — comercio "${negocio.estado}"`);
    console.log(`  ${suyosVisibles.length} de ${suyos.length} listado(s) visibles`);

    for (const listado of suyos) {
      const fallos = motivos(listado, negocio);
      const marca = fallos.some(esBloqueante) ? '✗' : fallos.length ? '~' : '✓';
      console.log(`    ${marca} ${listado.titulo ?? '(sin título)'} [${listado.vertical}]`);
      for (const fallo of fallos) console.log(`        ${fallo}`);
    }
  }

  console.log('');
  await mongoose.disconnect();
}

diagnosticar().catch((error) => {
  console.error('❌  Error en el diagnóstico:', error);
  process.exit(1);
});
