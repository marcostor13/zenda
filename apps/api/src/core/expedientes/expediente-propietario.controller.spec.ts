import { ExpedientePropietarioController } from './expediente-propietario.controller';

describe('ExpedientePropietarioController', () => {
  it('debería pedir el expediente del perro en nombre de su dueño', async () => {
    const expediente = { perro: { nombre: 'Toby' }, registros: [], servicios: [] };
    const expedientes = { expedienteParaPropietario: jest.fn().mockResolvedValue(expediente) };
    const controller = new ExpedientePropietarioController(expedientes as never);

    await expect(controller.obtener('p1', { user: { sub: 'dueno-1' } } as never)).resolves.toBe(expediente);
    expect(expedientes.expedienteParaPropietario).toHaveBeenCalledWith('dueno-1', 'p1');
  });
});
