import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario, UsuarioDocument } from './usuario.schema';
import { Rol } from 'shared';

/** `.invalid` está reservado (RFC 2606): ningún correo puede llegar ahí por error. */
const DOMINIO_EMAIL_BAJA = 'doogking.invalid';

export interface CrearUsuarioParams {
  nombre: string;
  email: string;
  passwordHash?: string;
  telefono?: string;
  rol?: Rol;
  comercioId?: string;
  puesto?: string;
  proveedores?: string[];
  avatarUrl?: string;
  verificado?: boolean;
  invitado?: boolean;
}

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<UsuarioDocument>,
  ) {}

  /**
   * Sólo cuentas vivas. Una cuenta dada de baja ya no es de nadie: si contara,
   * su dueño no podría volver a registrarse con su email, y el login con Google
   * entraría en la cuenta cerrada en vez de crear una nueva.
   */
  async findByEmail(email: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel
      .findOne({ email: email.toLowerCase(), eliminadoAt: { $exists: false } })
      .exec();
  }

  /**
   * Suelta el email que todavía conserve una cuenta dada de baja, para que un
   * alta nueva pueda usarlo. La baja pasa a un email interno e irrepetible
   * (lleva su id) y guarda el original en `emailBaja`.
   */
  async liberarEmailDeBajas(email: string): Promise<void> {
    const normalizado = email.toLowerCase();
    const baja = await this.usuarioModel
      .findOne({ email: normalizado, eliminadoAt: { $exists: true } })
      .select('_id')
      .lean()
      .exec();
    if (!baja) return;
    await this.usuarioModel
      .updateOne(
        { _id: baja._id },
        { $set: { email: `baja-${String(baja._id)}@${DOMINIO_EMAIL_BAJA}`, emailBaja: normalizado } },
      )
      .exec();
  }

  async findById(id: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findById(id).exec();
  }

  /** Datos de contacto de varios clientes de una vez (listados del comercio). */
  async findContactosByIds(ids: string[]): Promise<UsuarioDocument[]> {
    if (!ids.length) return [];
    return this.usuarioModel
      .find({ _id: { $in: ids } })
      .select('nombre email telefono')
      .lean()
      .exec() as unknown as UsuarioDocument[];
  }

  /** Miembros del equipo de un comercio (admins y staff vinculados). */
  async listarPorComercio(comercioId: string): Promise<UsuarioDocument[]> {
    return this.usuarioModel
      .find({ comercioId })
      .select('nombre email rol puesto createdAt permisosComercio activo verificado requiereVerificacionEmail telefono')
      .sort({ createdAt: 1 })
      .lean()
      .exec() as unknown as UsuarioDocument[];
  }

  async crear(params: CrearUsuarioParams): Promise<UsuarioDocument> {
    await this.liberarEmailDeBajas(params.email);
    const usuario = new this.usuarioModel({
      ...params,
      email: params.email.toLowerCase(),
      rol: params.rol ?? Rol.CLIENTE,
    });
    return usuario.save();
  }

  async actualizarPorId(
    id: string,
    datos: Partial<Pick<Usuario, 'nombre' | 'telefono' | 'verificado' | 'avatarUrl'>>,
  ): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findByIdAndUpdate(id, datos, { new: true }).exec();
  }

  /**
   * Alta sobre una cuenta de invitado con el mismo email: se le pone contraseña
   * pero **sigue siendo invitada** hasta que se verifique el correo. Si no, quien
   * escribiera el email de otro invitado se quedaría con sus reservas.
   */
  async prepararRegistroDeInvitado(
    id: string,
    datos: { nombre: string; passwordHash: string; telefono?: string },
  ): Promise<UsuarioDocument | null> {
    return this.usuarioModel
      .findByIdAndUpdate(
        id,
        {
          nombre: datos.nombre,
          passwordHash: datos.passwordHash,
          ...(datos.telefono ? { telefono: datos.telefono } : {}),
          $addToSet: { proveedores: 'local' },
        },
        { new: true },
      )
      .exec();
  }

  async actualizarPassword(id: string, passwordHash: string): Promise<void> {
    await this.usuarioModel.findByIdAndUpdate(id, { passwordHash }).exec();
  }

  /** Vincula un proveedor social a la cuenta (idempotente) y marca el email como verificado. */
  async vincularProveedor(id: string, proveedor: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel
      .findByIdAndUpdate(id, { $addToSet: { proveedores: proveedor }, verificado: true, invitado: false }, { new: true })
      .exec();
  }

  /** Guarda (o renueva) el token de verificación de email y marca la cuenta como pendiente. */
  async establecerTokenVerificacion(id: string, token: string, expira: Date): Promise<void> {
    await this.usuarioModel
      .findByIdAndUpdate(id, {
        verificacionToken: token,
        verificacionExpira: expira,
        requiereVerificacionEmail: true,
        verificado: false,
      })
      .exec();
  }

  async findByVerificacionToken(token: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findOne({ verificacionToken: token }).exec();
  }

  /** Guarda la huella del token de recuperación y su caducidad. */
  async establecerTokenRecuperacion(id: string, tokenHash: string, expira: Date): Promise<void> {
    await this.usuarioModel
      .findByIdAndUpdate(id, { recuperacionTokenHash: tokenHash, recuperacionExpira: expira })
      .exec();
  }

  /** Busca por la huella del token, nunca por el token en claro. */
  async findByRecuperacionTokenHash(tokenHash: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findOne({ recuperacionTokenHash: tokenHash }).exec();
  }

  /**
   * Fija la contraseña nueva y consume el token en la misma escritura: dejarlo
   * vivo permitiría reutilizar el enlace del correo para volver a entrar.
   */
  async restablecerPassword(id: string, passwordHash: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel
      .findByIdAndUpdate(
        id,
        {
          passwordHash,
          // Quien abre el enlace del correo demuestra que el email es suyo: un
          // invitado que fija contraseña pasa a tener cuenta.
          invitado: false,
          $addToSet: { proveedores: 'local' },
          $unset: { recuperacionTokenHash: 1, recuperacionExpira: 1 },
        },
        { new: true },
      )
      .exec();
  }

  /** Confirma la verificación: marca verificado, libera el bloqueo y elimina el token. */
  async confirmarVerificacion(id: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel
      .findByIdAndUpdate(
        id,
        {
          verificado: true,
          requiereVerificacionEmail: false,
          invitado: false,
          $unset: { verificacionToken: 1, verificacionExpira: 1 },
        },
        { new: true },
      )
      .exec();
  }

  async actualizarAdmin(
    id: string,
    datos: Partial<Pick<Usuario, 'nombre' | 'telefono' | 'verificado' | 'rol' | 'permisosAdmin' | 'permisosComercio' | 'activo' | 'puesto'>> & { email?: string; comercioId?: string },
  ): Promise<UsuarioDocument | null> {
    const update: Record<string, unknown> = { ...datos };
    if (datos.email) {
      update['email'] = datos.email.toLowerCase();
      await this.liberarEmailDeBajas(datos.email);
    }
    return this.usuarioModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  /**
   * Baja lógica: la cuenta pierde el acceso pero conserva su historial. Es la
   * forma normal de cerrar una cuenta —borrarla dejaría sin autor las reservas
   * que hizo y las reseñas que escribió— y se puede deshacer con `restaurar`.
   */
  async darDeBaja(id: string, baja: { motivo?: string; actorId?: string }): Promise<UsuarioDocument | null> {
    return this.usuarioModel
      .findByIdAndUpdate(
        id,
        {
          activo: false,
          eliminadoAt: new Date(),
          baja: { motivo: baja.motivo, fecha: new Date(), actorId: baja.actorId },
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Deshace la baja dentro del periodo de gracia. `emailRecuperado` es el email
   * original cuando lo reclamó un alta y luego quedó libre otra vez.
   */
  async restaurar(id: string, emailRecuperado?: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel
      .findByIdAndUpdate(
        id,
        {
          activo: true,
          ...(emailRecuperado ? { email: emailRecuperado } : {}),
          $unset: { eliminadoAt: 1, baja: 1, emailBaja: 1 },
        },
        { new: true },
      )
      .exec();
  }

  /** Borrado físico. Reservado a datos de prueba: ver `AdminService.purgarUsuario`. */
  async eliminar(id: string): Promise<void> {
    await this.usuarioModel.findByIdAndDelete(id).exec();
  }

  async contarTodos(): Promise<number> {
    return this.usuarioModel.countDocuments().exec();
  }
}
