import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersRepository } from './users.repository';
import { Usuario, UsuarioDocument } from './usuario.schema';
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
  let model: jest.Mocked<Model<UsuarioDocument>>;

  beforeEach(async () => {
    const mockModel = jest.fn().mockImplementation(() => usuarioMock);
    mockModel.findOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(usuarioMock) });
    mockModel.findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(usuarioMock) });
    mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(usuarioMock) });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: getModelToken(Usuario.name), useValue: mockModel },
      ],
    }).compile();

    repository = module.get<UsersRepository>(UsersRepository);
    model = module.get(getModelToken(Usuario.name));
  });

  describe('findByEmail', () => {
    it('debería encontrar usuario por email (normalizado a minúsculas)', async () => {
      const resultado = await repository.findByEmail('JUAN@TEST.COM');
      expect(model.findOne).toHaveBeenCalledWith({ email: 'juan@test.com' });
      expect(resultado).toEqual(usuarioMock);
    });

    it('debería retornar null si el email no existe', async () => {
      (model.findOne as jest.Mock).mockReturnValue({
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
      expect(resultado).toEqual(usuarioMock);
    });
  });
});
