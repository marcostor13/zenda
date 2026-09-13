import { ExpedientePropietarioController } from './expediente-propietario.controller';
import { nombreArchivo } from './archivo-pdf';

describe('ExpedientePropietarioController', () => {
  const expediente = { perro: { nombre: 'Toby Ñandú' }, registros: [], servicios: [] };
  const expedientes = { expedienteParaPropietario: jest.fn().mockResolvedValue(expediente) };
  const informes = { generar: jest.fn().mockResolvedValue(Buffer.from('%PDF')) };
  const controller = new ExpedientePropietarioController(expedientes as never, informes as never);
  const req = { user: { sub: 'dueno-1' } } as never;

  it('debería pedir el expediente del perro en nombre de su dueño', async () => {
    await expect(controller.obtener('p1', req)).resolves.toBe(expediente);
    expect(expedientes.expedienteParaPropietario).toHaveBeenCalledWith('dueno-1', 'p1');
  });

  it('debería generar el informe emitido por Doogking para el dueño', async () => {
    const archivo = await controller.informe('p1', req);

    expect(informes.generar).toHaveBeenCalledWith({ emisor: 'Doogking', destinatario: 'propietario', expediente });
    expect(archivo.getHeaders().disposition).toBe('attachment; filename="historial-toby-nandu.pdf"');
  });
});

describe('nombreArchivo', () => {
  it('debería usar un nombre genérico si la mascota no tiene nombre utilizable', () => {
    expect(nombreArchivo(undefined)).toBe('historial-mascota.pdf');
    expect(nombreArchivo('***')).toBe('historial-mascota.pdf');
  });
});
