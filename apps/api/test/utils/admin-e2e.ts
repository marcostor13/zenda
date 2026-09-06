import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { PagoEstado, PermisoAdmin, ReservaEstado, Rol, VerticalKey } from 'shared';
import { ruta, type AppE2E } from './app-e2e';

/**
 * Siembra y credenciales para los E2E del panel de administración.
 *
 * Las cuentas y los datos se insertan directo en Mongo: lo que prueban estas
 * suites es el panel del admin, no el alta de clientes ni el onboarding de
 * comercios, que tienen sus propios E2E. La sesión sí se obtiene por el login
 * real, porque el token —con su rol y su `sub`— es parte de lo que se prueba.
 */

export const PASSWORD_E2E = 'contrasena-segura-8';

export interface CuentaSembrada {
  readonly id: Types.ObjectId;
  readonly email: string;
  readonly token: string;
}

interface OpcionesCuenta {
  readonly email?: string;
  readonly nombre?: string;
  /** Vacío = superadministrador (así se comportaba el panel antes de los permisos). */
  readonly permisosAdmin?: PermisoAdmin[];
  readonly comercioId?: Types.ObjectId;
}

export function api(e2e: AppE2E) {
  return request(e2e.app.getHttpServer());
}

/** Cuenta con el rol indicado, ya verificada, y su token de sesión real. */
export async function sembrarCuenta(
  e2e: AppE2E,
  rol: Rol,
  opciones: OpcionesCuenta = {},
): Promise<CuentaSembrada> {
  const id = new Types.ObjectId();
  const email = opciones.email ?? `${rol}-${id.toString().slice(-6)}@doogking.test`;

  await e2e.conexion.collection('usuarios').insertOne({
    _id: id,
    nombre: opciones.nombre ?? `Cuenta ${rol}`,
    email,
    passwordHash: await bcrypt.hash(PASSWORD_E2E, 10),
    rol,
    permisosAdmin: opciones.permisosAdmin ?? [],
    permisosComercio: [],
    comercioId: opciones.comercioId,
    proveedores: [],
    activo: true,
    verificado: true,
    requiereVerificacionEmail: false,
    aceptaMarketing: false,
  });

  const { body } = await api(e2e)
    .post(ruta('/auth/login'))
    .send({ email, password: PASSWORD_E2E })
    .expect(200);

  return { id, email, token: body.accessToken as string };
}

export interface ComercioSembrado {
  readonly comercioId: Types.ObjectId;
  readonly servicioId: Types.ObjectId;
}

/** Comercio con un listado publicado. */
export async function sembrarComercio(
  e2e: AppE2E,
  opciones: {
    readonly nombreComercial?: string;
    readonly estado?: string;
    readonly vertical?: VerticalKey;
  } = {},
): Promise<ComercioSembrado> {
  const comercioId = new Types.ObjectId();
  const servicioId = new Types.ObjectId();
  const vertical = opciones.vertical ?? VerticalKey.VETERINARIA;
  const estado = opciones.estado ?? 'activo';

  await e2e.conexion.collection('comercios').insertOne({
    _id: comercioId,
    razonSocial: 'Clínica Royal SL',
    nombreComercial: opciones.nombreComercial ?? 'Clínica Royal',
    vatNumber: `B${comercioId.toString().slice(-8)}`,
    verticales: [vertical],
    estado,
    plan: 'basico',
    modoLiquidacion: 'merchant',
    createdAt: new Date(),
  });

  await e2e.conexion.collection('servicios').insertOne({
    _id: servicioId,
    comercioId,
    comercioActivo: estado === 'activo',
    vertical,
    __t: 'Veterinaria',
    titulo: 'Consulta general',
    descripcion: 'Consulta veterinaria general.',
    ubicacion: { ciudad: 'Valencia' },
    precioBase: 40,
    moneda: 'EUR',
    estado: 'publicado',
    ratingPromedio: 0,
    totalReseñas: 0,
  });

  return { comercioId, servicioId };
}

/** Reserva del comercio, con su pago aprobado opcional para los informes. */
export async function sembrarReserva(
  e2e: AppE2E,
  datos: {
    readonly comercio: ComercioSembrado;
    readonly usuarioId: Types.ObjectId;
    readonly codigo: string;
    readonly estado: ReservaEstado;
    readonly montoTotal?: number;
    readonly vertical?: VerticalKey;
    readonly conPagoAprobado?: boolean;
  },
): Promise<Types.ObjectId> {
  const reservaId = new Types.ObjectId();
  const montoTotal = datos.montoTotal ?? 121;
  const montoSubtotal = Math.round((montoTotal / 1.21) * 100) / 100;
  const comisionMonto = Math.round(montoSubtotal * 0.1 * 100) / 100;

  await e2e.conexion.collection('reservas').insertOne({
    _id: reservaId,
    codigo: datos.codigo,
    usuarioId: datos.usuarioId,
    comercioId: datos.comercio.comercioId,
    servicioId: datos.comercio.servicioId,
    vertical: datos.vertical ?? VerticalKey.VETERINARIA,
    detalle: {},
    fechaInicio: new Date(),
    cantidad: 1,
    montoSubtotal,
    comisionMonto,
    montoTotal,
    moneda: 'EUR',
    estado: datos.estado,
    suplementos: [],
    historialEstados: [],
    evidencias: [],
    seguimiento: [],
    createdAt: new Date(),
  });

  if (datos.conPagoAprobado) {
    const stripeFee = Math.round((montoTotal * 0.029 + 0.25) * 100) / 100;
    await e2e.conexion.collection('pagos').insertOne({
      reservaId,
      usuarioId: datos.usuarioId,
      pasarela: 'stripe',
      montoTotal,
      montoSubtotal,
      ivaMonto: Math.round((montoTotal - montoSubtotal) * 100) / 100,
      comisionPlataforma: comisionMonto,
      stripeFee,
      montoLiquidacion: Math.round((montoTotal - comisionMonto - stripeFee) * 100) / 100,
      moneda: 'EUR',
      estado: PagoEstado.APROBADO,
      esSuplemento: false,
      esPrueba: false,
      createdAt: new Date(),
    });
  }

  return reservaId;
}

/** Cabecera de autorización, que es lo único que cambia entre llamadas. */
export function como(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
