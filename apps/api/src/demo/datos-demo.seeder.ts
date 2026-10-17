import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Connection, Model, Types } from 'mongoose';
import { slugDeFicha, slugLibre } from 'shared';
import { Comercio, ComercioDocument } from '../core/comercios/comercio.schema';
import { Usuario, UsuarioDocument } from '../core/users/usuario.schema';
import { COMERCIOS_DEMO, ComercioDemo, correoDemo, USUARIOS_DEMO, UsuarioDemo } from './datos-demo';

/** Sólo con este valor exacto se siembra: cualquier otro (o ninguno) no hace nada. */
export const VARIABLE_ACTIVACION = 'SEMBRAR_DATOS_DEMO';
export const VARIABLE_PASSWORD = 'DATOS_DEMO_PASSWORD';

const IDS_COMERCIOS = COMERCIOS_DEMO.map((comercio) => new Types.ObjectId(comercio.id));

interface ServicioSinSlug {
  comercioId?: Types.ObjectId;
  slug?: string;
  _id: Types.ObjectId;
  vertical: string;
  titulo?: string;
  ubicacion?: { ciudad?: string };
}

/**
 * Comercios y cuentas ficticios del entorno de desarrollo.
 *
 * Corre en `onApplicationBootstrap`, es decir, **después** de que los seeders
 * de cada vertical hayan creado sus listados en `onModuleInit`: así puede darles
 * dueño y dirección legible. Es idempotente (`$setOnInsert`): en cada despliegue
 * crea lo que falte y no pisa lo que los testers hayan cambiado.
 *
 * Dos barreras para que nunca escriba en producción: tiene que estar activado
 * por variable de entorno, y aun así se niega si la base ya tiene algún
 * comercio que no sea de los suyos.
 */
@Injectable()
export class DatosDemoSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatosDemoSeeder.name);

  constructor(
    @InjectModel(Comercio.name) private readonly comercios: Model<ComercioDocument>,
    @InjectModel(Usuario.name) private readonly usuarios: Model<UsuarioDocument>,
    @InjectConnection() private readonly conexion: Connection,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env[VARIABLE_ACTIVACION] !== 'true') return;
    const password = process.env[VARIABLE_PASSWORD];
    if (!password) {
      this.logger.warn(`${VARIABLE_ACTIVACION}=true pero falta ${VARIABLE_PASSWORD}: no se siembran datos demo.`);
      return;
    }
    try {
      await this.sembrar(password);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar los datos demo: ${(error as Error).message}`);
    }
  }

  private async sembrar(password: string): Promise<void> {
    if (await this.hayComerciosReales()) {
      this.logger.warn('La base tiene comercios que no son de demostración: no se siembra nada.');
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.comercios.bulkWrite(COMERCIOS_DEMO.map((comercio) => this.upsert(comercio.id, this.aComercio(comercio))));
    await this.usuarios.bulkWrite(USUARIOS_DEMO.map((usuario) => this.upsert(usuario.id, this.aUsuario(usuario, passwordHash))));
    const conSlug = await this.ponerSlugs();
    this.logger.log(
      `Datos demo listos: ${COMERCIOS_DEMO.length} comercios, ${USUARIOS_DEMO.length} cuentas, ${conSlug} slugs nuevos.`,
    );
  }

  private async hayComerciosReales(): Promise<boolean> {
    return (await this.comercios.exists({ _id: { $nin: IDS_COMERCIOS } })) !== null;
  }

  private upsert(id: string, documento: Record<string, unknown>) {
    return {
      updateOne: {
        filter: { _id: new Types.ObjectId(id) },
        update: { $setOnInsert: documento },
        upsert: true,
      },
    };
  }

  private aComercio(comercio: ComercioDemo): Record<string, unknown> {
    return {
      nombreComercial: comercio.nombreComercial,
      razonSocial: comercio.razonSocial,
      vatNumber: comercio.vatNumber,
      descripcion: `${comercio.nombreComercial}: negocio ficticio del entorno de desarrollo.`,
      verticales: [...comercio.verticales],
      modoLiquidacion: 'merchant',
      plan: comercio.plan,
      estado: comercio.estado,
      altaCompletada: comercio.estado === 'activo',
      politicaCancelacion: 'flexible',
      contacto: { nombreContacto: comercio.responsable, email: correoDemo(comercio.usuario), telefono: '+34 600 000 000' },
      direccion: { calle: comercio.calle, ciudad: 'Madrid', provincia: 'Madrid', codigoPostal: comercio.codigoPostal, pais: 'España' },
      datosBancarios: { titular: comercio.razonSocial, iban: 'ES9121000418450200051332', banco: 'Banco de pruebas' },
      preferenciasNotificacion: { nuevaReserva: true, cancelacion: true, resena: true, pagos: true },
    };
  }

  private aUsuario(usuario: UsuarioDemo, passwordHash: string): Record<string, unknown> {
    return {
      nombre: usuario.nombre,
      email: correoDemo(usuario.usuario),
      passwordHash,
      proveedores: ['local'],
      rol: usuario.rol,
      ...(usuario.comercioId ? { comercioId: new Types.ObjectId(usuario.comercioId) } : {}),
      activo: true,
      verificado: true,
      requiereVerificacionEmail: false,
    };
  }

  /** Los seeders de vertical insertan sin slug; la ficha se abriría sólo por id. */
  private async ponerSlugs(): Promise<number> {
    const servicios = this.conexion.collection<ServicioSinSlug>('servicios');
    const pendientes = await servicios
      .find({ comercioId: { $in: IDS_COMERCIOS }, slug: { $exists: false } })
      .project<ServicioSinSlug>({ vertical: 1, titulo: 1, 'ubicacion.ciudad': 1 })
      .toArray();
    for (const servicio of pendientes) {
      const base = slugDeFicha(servicio.titulo ?? '', servicio.ubicacion?.ciudad, 'servicio');
      const slug = await slugLibre(base, async (candidato) =>
        (await servicios.countDocuments({ vertical: servicio.vertical, slug: candidato })) > 0,
      );
      await servicios.updateOne({ _id: servicio._id }, { $set: { slug } });
    }
    return pendientes.length;
  }
}
