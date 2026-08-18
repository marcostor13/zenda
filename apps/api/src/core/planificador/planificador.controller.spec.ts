import { Test } from '@nestjs/testing';
import { PlanificadorController } from './planificador.controller';
import { PlanificadorService } from './planificador.service';

describe('PlanificadorController', () => {
  let controller: PlanificadorController;
  let service: jest.Mocked<Pick<PlanificadorService, 'generar'>>;

  const dto = { provincia: 'Valencia', desde: '2026-09-01' } as never;

  beforeEach(async () => {
    service = { generar: jest.fn().mockResolvedValue({ opciones: [] }) };

    const moduleRef = await Test.createTestingModule({
      controllers: [PlanificadorController],
      providers: [{ provide: PlanificadorService, useValue: service }],
    }).compile();

    controller = moduleRef.get(PlanificadorController);
  });

  it('debería generar el itinerario atribuido al usuario cuando hay sesión', async () => {
    await controller.generar(dto, { user: { sub: 'user-1' } } as never);

    expect(service.generar).toHaveBeenCalledWith(dto, 'user-1');
  });

  it('debería generar el itinerario también sin sesión', async () => {
    // Es contenido de descubrimiento: exigir cuenta perdería justo a quien
    // todavía no la tiene.
    await controller.generar(dto, {} as never);

    expect(service.generar).toHaveBeenCalledWith(dto, undefined);
  });
});
