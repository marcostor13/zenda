import { StreamableFile } from '@nestjs/common';
import { VerticalKey } from 'shared';
import { MascotasComercioController } from './mascotas-comercio.controller';

describe('MascotasComercioController', () => {
  const expedientes = {
    listarMascotasComercio: jest.fn().mockResolvedValue([]),
    expedienteParaComercio: jest.fn().mockResolvedValue({ perro: { nombre: 'Nala' }, registros: [], servicios: [] }),
    crearRegistro: jest.fn().mockResolvedValue({ _id: 'r1' }),
    actualizarRegistro: jest.fn().mockResolvedValue({ _id: 'r1' }),
    eliminarRegistro: jest.fn().mockResolvedValue(undefined),
    informeParaComercio: jest.fn().mockResolvedValue({ nombreFichero: 'doogking-informe-nala-2026-09-13.pdf', pdf: Buffer.from('%PDF') }),
  };
  const controller = new MascotasComercioController(expedientes as never);
  const req = { user: { sub: 'u1', comercioId: 'c1' } } as never;

  beforeEach(() => jest.clearAllMocks());

  it('debería delegar cada operación con el comercio de la sesión', async () => {
    await controller.listar(req, 'nala');
    await controller.obtener(req, 'p1');
    await controller.crearRegistro(req, 'p1', { vertical: VerticalKey.VETERINARIA, titulo: 'Consulta' });
    await controller.actualizarRegistro(req, 'p1', 'r1', { titulo: 'Revisión' });
    await controller.eliminarRegistro(req, 'p1', 'r1');

    expect(expedientes.listarMascotasComercio).toHaveBeenCalledWith('c1', 'nala');
    expect(expedientes.expedienteParaComercio).toHaveBeenCalledWith('c1', 'p1');
    expect(expedientes.crearRegistro).toHaveBeenCalledWith({ comercioId: 'c1', usuarioId: 'u1' }, 'p1', expect.any(Object));
    expect(expedientes.actualizarRegistro).toHaveBeenCalledWith('c1', 'p1', 'r1', { titulo: 'Revisión' });
    expect(expedientes.eliminarRegistro).toHaveBeenCalledWith('c1', 'p1', 'r1');
  });

  it('debería devolver el informe del comercio como PDF descargable', async () => {
    const archivo = await controller.informe(req, 'p1');

    expect(archivo).toBeInstanceOf(StreamableFile);
    expect(expedientes.informeParaComercio).toHaveBeenCalledWith('c1', 'p1');
    expect(archivo.getHeaders()).toMatchObject({
      type: 'application/pdf', disposition: 'attachment; filename="doogking-informe-nala-2026-09-13.pdf"',
    });
  });

  it('debería rechazar una cuenta sin negocio vinculado', () => {
    expect(() => controller.listar({ user: { sub: 'u1' } } as never)).toThrow('Tu cuenta no está vinculada a ningún negocio');
  });
});
