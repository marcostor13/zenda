/**
 * migrar-servicios-clinicos.ts — Ola 4, DK-V07
 *
 * Uso:
 *   npm run migrar:servicios-clinicos --workspace=api            (simulación)
 *   npm run migrar:servicios-clinicos --workspace=api -- --aplicar
 *
 * Los listados de veterinaria guardaban el servicio como texto libre. El
 * catálogo pasa a ser cerrado (`ServicioClinicoTipo`), así que hay que asignar
 * un `tipo` a lo ya publicado.
 *
 * **La migración no borra nada.** Lo que no se reconoce se marca
 * `activo: false` y se lista en el informe final para que alguien lo revise con
 * el comercio: dar de baja un servicio en silencio sería peor que dejarlo.
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ServicioClinicoTipo, SERVICIO_CLINICO_LABELS } from 'shared';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env['MONGODB_URI'];
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI no definida en .env');
  process.exit(1);
}

const APLICAR = process.argv.includes('--aplicar');

interface ServicioClinicoDoc {
  tipo?: string;
  nombre?: string;
  precio?: number;
  duracionMin?: number;
  esPrecioCerrado?: boolean;
  activo?: boolean;
}

/** Sinónimos frecuentes en los listados existentes. */
const SINONIMOS: Record<string, ServicioClinicoTipo> = {
  'consulta': ServicioClinicoTipo.CONSULTA_GENERAL,
  'primera consulta': ServicioClinicoTipo.CONSULTA_GENERAL,
  'consulta veterinaria': ServicioClinicoTipo.CONSULTA_GENERAL,
  'revision': ServicioClinicoTipo.CONSULTA_REVISION,
  'revision general': ServicioClinicoTipo.CONSULTA_REVISION,
  'urgencias': ServicioClinicoTipo.CONSULTA_URGENTE,
  'urgencia': ServicioClinicoTipo.CONSULTA_URGENTE,
  'consulta urgente': ServicioClinicoTipo.CONSULTA_URGENTE,
  'limpieza dental': ServicioClinicoTipo.HIGIENE_DENTAL,
  'limpieza bucal': ServicioClinicoTipo.HIGIENE_DENTAL,
  'vacuna': ServicioClinicoTipo.VACUNACION,
  'vacunas': ServicioClinicoTipo.VACUNACION,
  'chip': ServicioClinicoTipo.MICROCHIP,
  'identificacion': ServicioClinicoTipo.MICROCHIP,
  'consulta online': ServicioClinicoTipo.TELECONSULTA,
  'videoconsulta': ServicioClinicoTipo.TELECONSULTA,
};

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** Mapa etiqueta oficial → tipo, calculado una vez. */
const POR_ETIQUETA = new Map<string, ServicioClinicoTipo>(
  Object.values(ServicioClinicoTipo).map((t) => [normalizar(SERVICIO_CLINICO_LABELS[t]), t]),
);

function reconocer(nombre?: string): ServicioClinicoTipo | undefined {
  if (!nombre) return undefined;
  const clave = normalizar(nombre);
  return POR_ETIQUETA.get(clave) ?? SINONIMOS[clave];
}

async function migrar(): Promise<void> {
  await mongoose.connect(MONGODB_URI!);
  console.log(`✅  Conectado a MongoDB${APLICAR ? '' : '  (SIMULACIÓN: nada se guardará)'}`);

  const servicios = mongoose.connection.collection('servicios');
  const cursor = servicios.find({ vertical: 'veterinaria' });

  let listadosRevisados = 0;
  let listadosTocados = 0;
  let reconocidos = 0;
  const sinReconocer: Array<{ servicioId: string; titulo: string; nombre: string }> = [];

  for await (const doc of cursor) {
    listadosRevisados++;
    const lista = (doc['serviciosClinicos'] as ServicioClinicoDoc[] | undefined) ?? [];
    if (!lista.length) continue;

    let cambiado = false;
    const migrada = lista.map((s) => {
      if (s.tipo) return s;

      const tipo = reconocer(s.nombre);
      cambiado = true;

      if (tipo) {
        reconocidos++;
        return { ...s, tipo, nombre: SERVICIO_CLINICO_LABELS[tipo], activo: true };
      }

      sinReconocer.push({
        servicioId: String(doc['_id']),
        titulo: String(doc['titulo'] ?? ''),
        nombre: s.nombre ?? '(sin nombre)',
      });
      // Se desactiva, no se elimina: el comercio conserva el dato y puede
      // reasignarlo al catálogo desde su panel.
      return { ...s, activo: false };
    });

    if (!cambiado) continue;
    listadosTocados++;

    if (APLICAR) {
      await servicios.updateOne({ _id: doc['_id'] }, { $set: { serviciosClinicos: migrada } });
    }
  }

  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Listados de veterinaria revisados : ${listadosRevisados}`);
  console.log(`Listados con cambios              : ${listadosTocados}`);
  console.log(`Servicios asignados al catálogo   : ${reconocidos}`);
  console.log(`Servicios sin reconocer           : ${sinReconocer.length}`);

  if (sinReconocer.length) {
    console.log('');
    console.log('⚠️  Revisar con el comercio (quedan desactivados, no borrados):');
    for (const s of sinReconocer) {
      console.log(`   · [${s.servicioId}] ${s.titulo} → "${s.nombre}"`);
    }
  }

  if (!APLICAR) {
    console.log('');
    console.log('ℹ️  Simulación. Vuelve a ejecutarlo con --aplicar para guardar los cambios.');
  }

  await mongoose.disconnect();
}

migrar().catch((error) => {
  console.error('❌  Error en la migración:', error);
  process.exit(1);
});
