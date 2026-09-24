import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HITO_VIAJE_LABELS, HitoViaje, Rol, normalizarHitoViaje } from 'shared';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { Usuario, UsuarioDocument } from '../users/usuario.schema';
import { Comercio, ComercioDocument } from '../comercios/comercio.schema';
import { NotificationsRepository } from './notifications.repository';
import { AdjuntoEmail, MailerService } from './mailer.service';
import { urlPublica } from '../../shared/url-publica';
import { tramoDeLaReserva } from '../bookings/momento-reserva.util';
import {
  DatosReservaConfirmada, asuntoReservaConfirmada, plantillaReservaConfirmada,
} from './plantillas/reserva-confirmada.plantilla';
import { plantillaNuevaReservaComercio } from './plantillas/nueva-reserva-comercio.plantilla';
import { construirIcs } from './plantillas/evento-calendario';
import { detallesLegibles } from './plantillas/detalles-reserva';
import { PushService } from './push.service';
import {
  plantillaAceptacionCliente, plantillaHitoViaje, plantillaPendienteAceptacion, plantillaPresupuestoRecibido,
  plantillaReembolso, plantillaSolicitudPresupuesto,
} from './plantillas/viaje.plantillas';

/** Qué se le dice al cliente en cada paso del viaje. */
const MENSAJE_HITO: Record<string, string> = {
  [HitoViaje.ASIGNADO]: 'ya tienes transportista asignado para tu viaje.',
  [HitoViaje.DE_CAMINO]: 'el transportista va de camino a recoger a tu mascota.',
  [HitoViaje.RECOGIDA]: 'tu mascota ya está con el transportista.',
  [HitoViaje.EN_TRAYECTO]: 'tu mascota está de camino a su destino.',
  [HitoViaje.ENTREGADA]: 'tu mascota ha llegado a su destino.',
  [HitoViaje.FINALIZADA]: 'el viaje ha terminado. ¡Gracias por confiar en Doogking!',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly mailer: MailerService,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<UsuarioDocument>,
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
    private readonly config: ConfigService,
    private readonly push: PushService,
  ) {}

  /**
   * Envía la confirmación al cliente y la alerta de nueva reserva al comercio.
   * Nunca lanza: un fallo de email no debe tumbar el webhook de pago que la invoca.
   */
  async notificarReservaConfirmada(reservaId: string): Promise<void> {
    try {
      const reserva = await this.reservaModel.findById(reservaId).lean().exec();
      if (!reserva) return;

      const [servicio, cliente, comercio, staffComercio] = await Promise.all([
        this.servicioModel.findById(reserva.servicioId)
          .select('titulo imagenes ubicacion direccion politicaCancelacion checkIn checkOut')
          .lean().exec(),
        this.usuarioModel.findById(reserva.usuarioId).select('nombre email').lean().exec(),
        this.comercioModel.findById(reserva.comercioId).select('nombreComercial contacto').lean().exec(),
        this.usuarioModel
          .find({ comercioId: reserva.comercioId, rol: { $in: [Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF] } })
          .select('email')
          .lean()
          .exec(),
      ]);

      const datos = this.datosDeConfirmacion(reserva, servicio, cliente?.nombre, comercio);

      if (cliente) {
        await this.enviarYRegistrar(
          {
            reservaId: reserva._id,
            tipo: 'reserva_confirmada',
            destinatario: cliente.email,
            asunto: asuntoReservaConfirmada(datos),
            cuerpo: plantillaReservaConfirmada(datos),
          },
          'Doogking | Reservas',
          [this.adjuntoCalendario(datos)],
        );
      }

      await Promise.all(
        staffComercio.map((u) =>
          this.enviarYRegistrar({
            reservaId: reserva._id,
            tipo: 'nueva_reserva_comercio',
            destinatario: u.email,
            asunto: `Nueva reserva ${datos.codigo} · ${datos.servicio.titulo}`,
            cuerpo: plantillaNuevaReservaComercio({ ...datos, clienteNombre: cliente?.nombre }),
          }),
        ),
      );
    } catch (error) {
      this.logger.error(`No se pudo notificar la reserva ${reservaId}`, error);
    }
  }

  /**
   * Reúne lo que cuenta el correo: servicio, comercio, cuándo (en hora del
   * comercio, con fin y duración) e importes desglosados con IVA.
   */
  private datosDeConfirmacion(
    reserva: Reserva & { _id: unknown },
    servicio: Record<string, unknown> | null,
    nombreCliente: string | undefined,
    comercio: { nombreComercial?: string; contacto?: { telefono?: string; email?: string } } | null,
  ): DatosReservaConfirmada {
    const { inicio, fin } = tramoDeLaReserva(reserva);
    const conHora = !(inicio.getUTCHours() === 0 && inicio.getUTCMinutes() === 0) || !!reserva.detalle?.['hora'];
    const ubicacion = (servicio?.['ubicacion'] ?? {}) as { calle?: string; numero?: string; codigoPostal?: string; ciudad?: string };
    const direccion = (servicio?.['direccion'] as string | undefined)
      ?? ([ubicacion.calle, ubicacion.numero].filter(Boolean).join(' ') || undefined);
    const perro = (reserva.perroSnapshot as { nombre?: string } | undefined)?.nombre;

    return {
      urlBase: this.urlBase(),
      cliente: { nombre: nombreCliente ?? 'cliente' },
      codigo: reserva.codigo,
      vertical: reserva.vertical,
      servicio: {
        titulo: (servicio?.['titulo'] as string | undefined) ?? 'Tu reserva',
        imagen: (servicio?.['imagenes'] as string[] | undefined)?.[0],
        direccion: [direccion, ubicacion.codigoPostal].filter(Boolean).join(', ') || undefined,
        ciudad: ubicacion.ciudad,
        politicaCancelacion: servicio?.['politicaCancelacion'] as string | undefined,
        checkIn: servicio?.['checkIn'] as string | undefined,
        checkOut: servicio?.['checkOut'] as string | undefined,
      },
      comercio: {
        nombre: comercio?.nombreComercial ?? 'El comercio',
        telefono: comercio?.contacto?.telefono,
        email: comercio?.contacto?.email,
      },
      inicio,
      // Una estancia sin salida no tiene fin: el "día completo" es sólo cosa de la agenda.
      fin: conHora || reserva.fechaFin ? fin : undefined,
      conHora,
      perro,
      cantidad: reserva.cantidad ?? 1,
      detalles: detallesLegibles(reserva.detalle),
      importes: {
        total: reserva.montoTotal,
        baseImponible: reserva.montoSubtotal,
        iva: Math.round((reserva.montoTotal - reserva.montoSubtotal) * 100) / 100,
        descuento: reserva.descuentoMonto ?? 0,
        cupon: reserva.cuponCodigo,
      },
    };
  }

  private adjuntoCalendario(datos: DatosReservaConfirmada): AdjuntoEmail {
    const lugar = [datos.comercio.nombre, datos.servicio.direccion, datos.servicio.ciudad].filter(Boolean).join(', ');
    return {
      nombre: `reserva-${datos.codigo}.ics`,
      tipo: 'text/calendar; charset=utf-8; method=PUBLISH',
      contenido: construirIcs({
        uid: datos.codigo,
        titulo: `${datos.servicio.titulo}${datos.perro ? ` · ${datos.perro}` : ''}`,
        descripcion: `Reserva ${datos.codigo} en ${datos.comercio.nombre}. Detalles: ${datos.urlBase}/reservas/${datos.codigo}`,
        lugar,
        inicio: datos.inicio,
        fin: datos.fin,
        diaCompleto: !datos.conHora,
        url: `${datos.urlBase}/reservas/${datos.codigo}`,
      }),
    };
  }

  /**
   * Avisa al cliente de que el comercio pide un ajuste de precio. Sin este
   * correo el cliente solo se enteraría si entra por su cuenta a la reserva, y
   * la regla del negocio es que ningún coste se aplica sin su aprobación.
   * Nunca lanza: el ajuste ya se registró y un fallo de email no debe revertirlo.
   */
  async notificarAjusteSolicitado(reservaId: string): Promise<void> {
    try {
      const reserva = await this.reservaModel.findById(reservaId).lean().exec();
      if (!reserva) return;

      const cliente = await this.usuarioModel
        .findById(reserva.usuarioId).select('nombre email').lean().exec();
      if (!cliente) return;

      // El motivo se compone de los suplementos propuestos: el cliente debe ver
      // exactamente por qué sube el importe, no un mensaje genérico.
      const motivo = reserva.suplementos
        .map((s) => `${s.concepto} (+${s.monto.toFixed(2)} €)${s.motivo ? ` — ${s.motivo}` : ''}`)
        .join('<br>');

      await this.enviarYRegistrar({
        reservaId: reserva._id,
        tipo: 'ajuste_solicitado',
        destinatario: cliente.email,
        asunto: `Cambio de importe en tu reserva ${reserva.codigo}`,
        cuerpo: this.plantillaAjusteSolicitado(
          cliente.nombre,
          reserva.codigo,
          reserva.montoTotal,
          reserva.montoAjustado ?? reserva.montoTotal,
          motivo || 'El profesional ha detectado necesidades adicionales en recepción.',
        ),
      });
    } catch (error) {
      this.logger.error(`No se pudo notificar el ajuste de la reserva ${reservaId}`, error);
    }
  }

  private plantillaAjusteSolicitado(
    nombre: string,
    codigo: string,
    importeInicial: number,
    importeNuevo: number,
    motivo: string,
  ): string {
    return `
      <h2>Hola ${nombre}, tu reserva ${codigo} necesita tu confirmación</h2>
      <p>El profesional propone un nuevo importe para el servicio:</p>
      <p style="font-size:18px">
        <span style="color:#8B9BBC;text-decoration:line-through">${importeInicial.toFixed(2)} €</span>
        &nbsp;→&nbsp;
        <strong style="color:#08258B">${importeNuevo.toFixed(2)} €</strong>
      </p>
      <p><strong>Motivo:</strong> ${motivo}</p>
      <p>No se te cobrará nada hasta que lo aceptes. Si lo rechazas, se te reembolsa el importe
         original menos el cargo mínimo de gestión.</p>
      <p style="color:#8B9BBC;font-size:13px">Entra en «Mis reservas» en Doogking para aceptar o rechazar el cambio.</p>
    `;
  }

  /**
   * Solicitud de reseña con **enlace único** a la reserva concreta (HU-053):
   * el usuario no tiene que buscar cuál valorar, y el token nos dice si abrió.
   */
  async solicitarValoracion(params: {
    destinatario: string;
    nombre: string;
    codigoReserva: string;
    token: string;
    esRecordatorio: boolean;
  }): Promise<void> {
    const url = `${this.urlBase()}/valorar/${params.token}`;

    await this.enviarYRegistrar({
      tipo: 'solicitud_valoracion',
      destinatario: params.destinatario,
      asunto: params.esRecordatorio
        ? `¿Cómo fue tu experiencia? — ${params.codigoReserva}`
        : `Cuéntanos qué tal fue, ${params.nombre}`,
      cuerpo: this.plantillaValoracion(
        params.nombre, params.codigoReserva, url, params.esRecordatorio, params.token,
      ),
    });
  }

  /** Aviso de reserva a medias, con el paso donde se quedó (HU-056). */
  async recuperarReserva(params: {
    destinatario: string;
    nombre: string;
    paso?: string;
    vertical?: string;
  }): Promise<void> {
    await this.enviarYRegistrar({
      tipo: 'recuperacion_reserva',
      destinatario: params.destinatario,
      asunto: 'Tu reserva se quedó a medias',
      cuerpo: this.plantillaRecuperacion(params.nombre, params.paso, params.vertical),
    });
  }

  private plantillaValoracion(
    nombre: string,
    codigo: string,
    url: string,
    esRecordatorio: boolean,
    token: string,
  ): string {
    return `
      <h2>${esRecordatorio ? `¿Nos cuentas, ${nombre}?` : `¡Gracias por confiar en nosotros, ${nombre}!`}</h2>
      <p>Tu reserva <strong>${codigo}</strong> ya está completada. Tu opinión ayuda a otros dueños
         a elegir bien, y al profesional a mejorar.</p>
      <p style="margin:24px 0">
        <a href="${url}" style="background:#FBAE17;color:#00135D;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700">
          Valorar en 30 segundos
        </a>
      </p>
      <p style="color:#8B9BBC;font-size:13px">
        Solo se puede valorar una vez por reserva.${esRecordatorio ? ' Este es el último recordatorio que te enviamos.' : ''}
      </p>
      <img src="${this.apiUrl()}/eventos/valoracion/${token}/pixel.gif"
           width="1" height="1" alt="" style="display:none">
    `;
  }

  private plantillaRecuperacion(nombre: string, paso?: string, vertical?: string): string {
    const donde = paso ? `en el paso de <strong>${paso}</strong>` : 'a mitad';

    return `
      <h2>Hola ${nombre}, tu reserva se quedó ${donde}</h2>
      <p>Seguimos guardando lo que habías elegido${vertical ? ` en ${vertical}` : ''}.
         Retomarla te llevará menos de un minuto.</p>
      <p style="margin:24px 0">
        <a href="${this.urlBase()}/reservas" style="background:#08258B;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">
          Retomar mi reserva
        </a>
      </p>
      <p style="color:#8B9BBC;font-size:13px">
        Recibes este aviso porque aceptaste comunicaciones comerciales. Puedes desactivarlas
        desde tu perfil cuando quieras.
      </p>
    `;
  }

  private urlBase(): string {
    return urlPublica(this.config.get<string>('APP_URL'), this.config.get<string>('NODE_ENV'));
  }

  /** Base del API: el píxel de apertura lo sirve el backend, no la web. */
  private apiUrl(): string {
    return this.config.get<string>('API_URL') ?? 'https://api.doogking.com';
  }

  /** Envía el correo de verificación de email con el enlace de confirmación. */
  async enviarVerificacionEmail(destinatario: string, nombre: string, url: string, esComercio = false): Promise<void> {
    await this.enviarYRegistrar(
      {
        tipo: 'verificacion_email',
        destinatario,
        asunto: esComercio
          ? '¡Bienvenido a Doogking! Activa tu cuenta'
          : '¡Bienvenido a Doogking! Confirma tu correo',
        cuerpo: this.plantillaVerificacion(nombre, url, esComercio),
      },
      'Doogking | Equipo de verificación',
    );
  }

  async enviarRecuperacionPassword(destinatario: string, nombre: string, url: string): Promise<void> {
    await this.enviarYRegistrar(
      {
        tipo: 'recuperacion_password',
        destinatario,
        asunto: 'Restablece tu contraseña de Doogking',
        cuerpo: this.plantillaRecuperacionPassword(nombre, url),
      },
      'Doogking | Seguridad de la cuenta',
    );
  }

  private plantillaRecuperacionPassword(nombre: string, url: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#08258B;margin-bottom:4px">Hola ${nombre}, ¿has olvidado tu contraseña?</h2>
        <p style="color:#334155">
          Nos has pedido restablecerla. Pulsa el botón y elige una nueva; tu contraseña
          actual sigue funcionando hasta que la cambies.
        </p>
        <p style="margin:28px 0;text-align:center">
          <a href="${url}" style="background:#08258B;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:700;box-shadow:0 4px 12px rgba(8,37,139,.25)">
            Elegir contraseña nueva
          </a>
        </p>
        <!-- Igual que en el correo de verificación: el token nunca se muestra en
             crudo. Se rompe al partirse en dos líneas y es exactamente lo que
             hacen los correos de phishing. -->
        <p style="color:#8B9BBC;font-size:12px;margin-top:24px">
          ¿No te funciona el botón?
          <a href="${url}" style="color:#08258B;font-weight:700">Restablece tu contraseña desde aquí</a>.
        </p>
        <p style="color:#8B9BBC;font-size:12px">
          El enlace caduca en 1 hora y sólo se puede usar una vez. <strong>Si no has sido tú</strong>,
          ignora este correo: tu contraseña no cambiará.
        </p>
        <p style="color:#8B9BBC;font-size:12px;margin-top:16px">Equipo Doogking · www.doogking.com</p>
      </div>
    `;
  }

  private plantillaVerificacion(nombre: string, url: string, esComercio: boolean): string {
    const saludo = esComercio
      ? `¡Bienvenido a Doogking! ${nombre}, estás a un solo paso de empezar a recibir reservas desde nuestra plataforma.`
      : `¡Bienvenido a Doogking! ${nombre}, estás a un solo paso de encontrar el mejor cuidado para tu mascota.`;
    const textoPrincipal = esComercio
      ? 'Gracias por registrarte. Solo necesitamos verificar tu correo para activar tu cuenta y que puedas acceder al panel de tu negocio.'
      : 'Gracias por registrarte. Solo necesitamos verificar tu correo para activar tu cuenta.';
    // "Activar mi cuenta" en ambos casos: es lo que el cliente aprobó, y lo que
    // se activa con el enlace es la cuenta — el negocio se completa después.
    const botonTexto = 'Activar mi cuenta';
    const pasos = esComercio
      ? ['Cuenta activada', 'Acceso a tu panel de negocio', 'Completa el perfil de tu negocio']
      : ['Cuenta activada', 'Acceso a tu perfil', 'Empieza a reservar servicios para tu mascota'];
    const ilusion = esComercio
      ? 'Cada día miles de personas buscan servicios como el tuyo. Ya falta muy poco para que puedan encontrarte.'
      : 'Miles de profesionales caninos verificados te esperan en Doogking.';

    return `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#08258B;margin-bottom:4px">${saludo}</h2>
        <p style="color:#334155">${textoPrincipal}</p>
        <p style="margin:28px 0;text-align:center">
          <a href="${url}" style="background:#08258B;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:700;box-shadow:0 4px 12px rgba(8,37,139,.25)">
            ${botonTexto}
          </a>
        </p>
        <div style="background:#F8F9FA;border-radius:12px;padding:16px 20px;margin:24px 0">
          <strong style="color:#08258B;font-size:14px">¿Qué ocurre después?</strong>
          <p style="margin:8px 0 0;font-size:13px;color:#475569">
            ${pasos.map((p) => `✅ ${p}`).join(' → ')}
          </p>
        </div>
        <p style="color:#475569;font-size:14px">${ilusion}</p>
        <!-- El enlace va detrás de un texto, nunca a la vista: un token de
             verificación en crudo dentro del correo es feo, se rompe al
             partirse en dos líneas y es justo lo que enseñan los correos de
             phishing. -->
        <p style="color:#8B9BBC;font-size:12px;margin-top:24px">
          ¿No te funciona el botón?
          <a href="${url}" style="color:#08258B;font-weight:700">Activa tu cuenta desde aquí</a>.
        </p>
        <p style="color:#8B9BBC;font-size:12px">El enlace caduca en 24 horas. Si no creaste esta cuenta, puedes ignorar este correo con total tranquilidad.</p>
        <p style="color:#8B9BBC;font-size:12px;margin-top:16px">Equipo Doogking · www.doogking.com</p>
      </div>
    `;
  }

  /**
   * Aviso de un paso del viaje (transportista asignado, recogida, entrega…) por
   * correo y push. Nunca lanza: el hito ya está guardado.
   */
  async notificarHitoViaje(reservaId: string, hito: string, nota?: string, fotoUrl?: string): Promise<void> {
    try {
      const contexto = await this.contextoReserva(reservaId);
      if (!contexto) return;
      const { reserva, servicio, cliente } = contexto;
      const clave = normalizarHitoViaje(hito);
      const etiqueta = HITO_VIAJE_LABELS[clave as HitoViaje] ?? hito;
      const mensaje = MENSAJE_HITO[clave] ?? 'hay novedades en tu reserva.';

      void this.push.enviarA(reserva.usuarioId.toString(), {
        titulo: etiqueta,
        cuerpo: `${servicio} · ${mensaje}`,
        ruta: `/reservas/${reserva.codigo}`,
      });
      await this.enviarYRegistrar({
        reservaId: reserva._id,
        tipo: `hito_${clave}`,
        destinatario: cliente.email,
        asunto: `${etiqueta} · ${reserva.codigo}`,
        cuerpo: plantillaHitoViaje({
          urlBase: this.urlBase(), nombre: cliente.nombre, codigo: reserva.codigo, servicio, hito: etiqueta, mensaje, nota, fotoUrl,
        }),
      });
    } catch (error) {
      this.logger.error(`No se pudo avisar del hito ${hito} de la reserva ${reservaId}`, error);
    }
  }

  /** Al comercio: tiene un viaje pagado que aceptar antes de que venza el plazo. */
  async notificarPendienteAceptacion(reservaId: string): Promise<void> {
    try {
      const contexto = await this.contextoReserva(reservaId);
      const venceEn = contexto?.reserva.aceptacion?.venceEn;
      if (!contexto || !venceEn) return;
      const { reserva, servicio } = contexto;
      const staff = await this.staffDe(reserva.comercioId.toString());
      const cuerpo = plantillaPendienteAceptacion({
        urlBase: this.urlBase(), codigo: reserva.codigo, servicio, inicio: reserva.fechaInicio,
        venceEn, detalles: detallesLegibles(reserva.detalle),
      });
      await Promise.all(staff.map((u) => {
        void this.push.enviarA(u._id.toString(), {
          titulo: 'Viaje pendiente de aceptar', cuerpo: `${servicio} · ${reserva.codigo}`, ruta: '/comercio/reservas',
        });
        return this.enviarYRegistrar({
          reservaId: reserva._id, tipo: 'aceptacion_pendiente', destinatario: u.email,
          asunto: `Acepta el viaje ${reserva.codigo}`, cuerpo,
        });
      }));
    } catch (error) {
      this.logger.error(`No se pudo avisar de la aceptación pendiente de ${reservaId}`, error);
    }
  }

  /** Al cliente: el comercio aceptó o rechazó (o dejó vencer) su viaje. */
  async notificarAceptacion(reservaId: string, aceptada: boolean, importeDevuelto?: number): Promise<void> {
    try {
      const contexto = await this.contextoReserva(reservaId);
      if (!contexto) return;
      const { reserva, servicio, cliente } = contexto;
      void this.push.enviarA(reserva.usuarioId.toString(), {
        titulo: aceptada ? 'Viaje aceptado' : 'Viaje no disponible',
        cuerpo: `${servicio} · ${reserva.codigo}`,
        ruta: `/reservas/${reserva.codigo}`,
      });
      await this.enviarYRegistrar({
        reservaId: reserva._id,
        tipo: aceptada ? 'aceptacion_ok' : 'aceptacion_rechazada',
        destinatario: cliente.email,
        asunto: aceptada ? `Tu viaje ${reserva.codigo} está aceptado` : `Tu viaje ${reserva.codigo} no se puede hacer`,
        cuerpo: plantillaAceptacionCliente({
          urlBase: this.urlBase(), nombre: cliente.nombre, codigo: reserva.codigo, servicio, aceptada,
          inicio: reserva.fechaInicio, motivo: reserva.aceptacion?.motivo, importeDevuelto,
        }),
      });
    } catch (error) {
      this.logger.error(`No se pudo avisar de la aceptación de ${reservaId}`, error);
    }
  }

  /** Al cliente: la reserva se canceló y esto es lo que se le devuelve. */
  async notificarCancelacion(reservaId: string): Promise<void> {
    try {
      const contexto = await this.contextoReserva(reservaId);
      if (!contexto) return;
      const { reserva, servicio, cliente } = contexto;
      await this.enviarYRegistrar({
        reservaId: reserva._id,
        tipo: 'reserva_cancelada',
        destinatario: cliente.email,
        asunto: `Reserva ${reserva.codigo} cancelada`,
        cuerpo: plantillaReembolso({
          urlBase: this.urlBase(), nombre: cliente.nombre, codigo: reserva.codigo, servicio,
          importe: reserva.reembolso?.importe ?? 0, porcentaje: reserva.reembolso?.porcentaje ?? 0,
          motivo: reserva.reembolso?.motivo ?? '',
        }),
      });
    } catch (error) {
      this.logger.error(`No se pudo avisar de la cancelación de ${reservaId}`, error);
    }
  }

  /** A cada comercio al que el cliente ha pedido presupuesto. */
  async notificarSolicitudPresupuesto(params: {
    comercioId: string;
    codigo: string;
    servicio: string;
    fechaServicio: Date;
    resumen: ReadonlyArray<readonly [string, string]>;
    comentario?: string;
  }): Promise<void> {
    try {
      const staff = await this.staffDe(params.comercioId);
      const cuerpo = plantillaSolicitudPresupuesto({ urlBase: this.urlBase(), ...params });
      await Promise.all(staff.map((u) => {
        void this.push.enviarA(u._id.toString(), {
          titulo: 'Nueva solicitud de presupuesto', cuerpo: params.servicio, ruta: '/comercio/presupuestos',
        });
        return this.enviarYRegistrar({
          tipo: 'presupuesto_solicitado', destinatario: u.email,
          asunto: `Solicitud de presupuesto ${params.codigo}`, cuerpo,
        });
      }));
    } catch (error) {
      this.logger.error(`No se pudo avisar de la solicitud de presupuesto ${params.codigo}`, error);
    }
  }

  /** Al cliente: una empresa ha puesto precio a su solicitud. */
  async notificarPresupuestoRecibido(params: {
    usuarioId: string;
    codigo: string;
    empresa: string;
    importe: number;
    validoHasta: Date;
    condiciones?: string;
  }): Promise<void> {
    try {
      const cliente = await this.usuarioModel.findById(params.usuarioId).select('nombre email').lean().exec();
      if (!cliente) return;
      void this.push.enviarA(params.usuarioId, {
        titulo: `Presupuesto recibido: ${params.importe.toFixed(2)} €`, cuerpo: params.empresa, ruta: '/presupuestos',
      });
      await this.enviarYRegistrar({
        tipo: 'presupuesto_recibido',
        destinatario: cliente.email,
        asunto: `Presupuesto recibido: ${params.importe.toFixed(2)} €`,
        cuerpo: plantillaPresupuestoRecibido({ urlBase: this.urlBase(), nombre: cliente.nombre, ...params }),
      });
    } catch (error) {
      this.logger.error(`No se pudo avisar del presupuesto ${params.codigo}`, error);
    }
  }

  private async contextoReserva(reservaId: string): Promise<{
    reserva: Reserva & { _id: Types.ObjectId };
    servicio: string;
    cliente: { nombre: string; email: string };
  } | null> {
    const reserva = await this.reservaModel.findById(reservaId).lean().exec() as (Reserva & { _id: Types.ObjectId }) | null;
    if (!reserva) return null;
    const [servicio, cliente] = await Promise.all([
      this.servicioModel.findById(reserva.servicioId).select('titulo').lean().exec(),
      this.usuarioModel.findById(reserva.usuarioId).select('nombre email').lean().exec(),
    ]);
    if (!cliente) return null;
    return { reserva, servicio: (servicio as { titulo?: string } | null)?.titulo ?? 'Tu reserva', cliente };
  }

  private async staffDe(comercioId: string): Promise<Array<{ _id: Types.ObjectId; email: string }>> {
    return this.usuarioModel
      .find({ comercioId, rol: { $in: [Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF] } })
      .select('email')
      .lean()
      .exec() as unknown as Promise<Array<{ _id: Types.ObjectId; email: string }>>;
  }

  private async enviarYRegistrar(
    data: Parameters<NotificationsRepository['crear']>[0],
    nombreRemitente?: string,
    adjuntos?: AdjuntoEmail[],
  ): Promise<void> {
    const notif = await this.repo.crear(data);
    try {
      await this.mailer.enviar({ to: data.destinatario, subject: data.asunto, html: data.cuerpo, nombreRemitente, adjuntos });
      await this.repo.marcarEnviado(notif._id);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      await this.repo.marcarFallido(notif._id, mensaje);
      this.logger.warn(`Email no enviado a ${data.destinatario}: ${mensaje}`);
    }
  }
}
