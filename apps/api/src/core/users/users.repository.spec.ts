import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersRepository } from './users.repository';
import { Usuario } from './usuario.schema';
import { Rol } from 'shared';

const usuarioMock = {
  id: 'user-id-1',
  nombre: 'Juan Pérez',
  email: 'juan@test.com',
  passwordHash: 'hashed',
  rol: Rol.CLIENTE,
  verificado: false,
  save: jest.fn(),
};

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = jest.fn().mockImplementation(() => usuarioMock);
    mockModel.findOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(usuarioMock) });
    mockModel.findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(usuarioMock) });
    mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(usuarioMock) });
    mockModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([usuarioMock]),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: getModelToken(Usuario.name), useValue: mockModel },
      ],
    }).compile();

    repository = module.get<UsersRepository>(UsersRepository);
  });

  describe('findByEmail', () => {
    it('debería encontrar usuario por email (normalizado a minúsculas)', async () => {
      const resultado = await repository.findByEmail('JUAN@TEST.COM');
      expect(mockModel.findOne).toHaveBeenCalledWith({ email: 'juan@test.com' });
      expect(resultado).toMatchObject({ email: 'juan@test.com' });
    });

    it('debería retornar null si el email no existe', async () => {
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const resultado = await repository.findByEmail('noexiste@test.com');
      expect(resultado).toBeNull();
    });
  });

  describe('crear', () => {
    it('debería crear y guardar el usuario con rol CLIENTE por defecto', async () => {
      usuarioMock.save.mockResolvedValue(usuarioMock);
      const resultado = await repository.crear({
        nombre: 'Juan',
        email: 'Juan@Test.com',
        passwordHash: 'hashed',
      });

      expect(usuarioMock.save).toHaveBeenCalled();
      expect(resultado).toBeDefined();
    });

    it('debería guardar el email en minúsculas', async () => {
      // El login busca normalizado; guardarlo tal cual dejaría fuera a quien se
      // registró escribiendo mayúsculas.
      await repository.crear({ nombre: 'Juan', email: 'Juan@Test.com', passwordHash: 'x' });

      expect(mockModel).toHaveBeenCalledWith(expect.objectContaining({ email: 'juan@test.com' }));
    });

    it('debería respetar el rol cuando se indica', async () => {
      await repository.crear({
        nombre: 'Ana', email: 'ana@test.com', passwordHash: 'x', rol: Rol.COMERCIO_ADMIN,
      });

      expect(mockModel).toHaveBeenCalledWith(expect.objectContaining({ rol: Rol.COMERCIO_ADMIN }));
    });
  });

  describe('consultas por lote', () => {
    it('no debería consultar la BD si la lista de ids viene vacía', async () => {
      await expect(repository.findContactosByIds([])).resolves.toEqual([]);
      expect(mockModel.find).not.toHaveBeenCalled();
    });

    it('debería pedir sólo los datos de contacto, no el documento entero', async () => {
      const cadena = mockModel.find();
      await repository.findContactosByIds(['a', 'b']);

      expect(mockModel.find).toHaveBeenCalledWith({ _id: { $in: ['a', 'b'] } });
      expect(cadena.select).toHaveBeenCalledWith('nombre email telefono');
    });

    it('debería listar el equipo del comercio por antigüedad', async () => {
      const cadena = mockModel.find();
      await repository.listarPorComercio('comercio-1');

      expect(mockModel.find).toHaveBeenCalledWith({ comercioId: 'comercio-1' });
      expect(cadena.sort).toHaveBeenCalledWith({ createdAt: 1 });
    });

    it('no debería exponer el hash de la contraseña del equipo', async () => {
      const cadena = mockModel.find();
      await repository.listarPorComercio('comercio-1');

      expect(cadena.select.mock.calls[0][0]).not.toContain('passwordHash');
    });
  });

  describe('actualizaciones', () => {
    it('debería devolver el documento ya actualizado', async () => {
      await repository.actualizarPorId('user-1', { nombre: 'Nuevo' });

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-1', { nombre: 'Nuevo' }, { new: true },
      );
    });

    it('debería guardar sólo el hash al cambiar la contraseña', async () => {
      await repository.actualizarPassword('user-1', 'hash-nuevo');

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith('user-1', { passwordHash: 'hash-nuevo' });
    });

    it('debería vincular el proveedor sin duplicarlo y dar el email por verificado', async () => {
      // `$addToSet` hace la operación idempotente: entrar diez veces con Google
      // no debe dejar diez entradas en `proveedores`.
      await repository.vincularProveedor('user-1', 'google');

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-1',
        { $addToSet: { proveedores: 'google' }, verificado: true },
        { new: true },
      );
    });
  });

  describe('tokens de verificación y recuperación', () => {
    it('debería bloquear la cuenta al emitir un token de verificación', async () => {
      const expira = new Date();
      await repository.establecerTokenVerificacion('user-1', 'tok', expira);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
        verificacionToken: 'tok',
        verificacionExpira: expira,
        requiereVerificacionEmail: true,
        verificado: false,
      });
    });

    it('debería consumir el token al confirmar la verificación', async () => {
      // Dejarlo vivo permitiría reutilizar el enlace del correo.
      await repository.confirmarVerificacion('user-1');

      const [, actualizacion] = mockModel.findByIdAndUpdate.mock.calls[0];
      expect(actualizacion.$unset).toEqual({ verificacionToken: 1, verificacionExpira: 1 });
    });

    it('debería guardar la huella del token de recuperación, no el token', async () => {
      const expira = new Date();
      await repository.establecerTokenRecuperacion('user-1', 'huella-sha256', expira);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
        recuperacionTokenHash: 'huella-sha256',
        recuperacionExpira: expira,
      });
    });

    it('debería buscar la recuperación por la huella', async () => {
      await repository.findByRecuperacionTokenHash('huella-sha256');

      expect(mockModel.findOne).toHaveBeenCalledWith({ recuperacionTokenHash: 'huella-sha256' });
    });

    it('debería consumir el token al restablecer la contraseña', async () => {
      await repository.restablecerPassword('user-1', 'hash-nuevo');

      const [, actualizacion] = mockModel.findByIdAndUpdate.mock.calls[0];
      expect(actualizacion.passwordHash).toBe('hash-nuevo');
      expect(actualizacion.$unset).toEqual({ recuperacionTokenHash: 1, recuperacionExpira: 1 });
    });
  });
});
