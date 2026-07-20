import { Test } from '@nestjs/testing';
import { RecomendadorController } from './recomendador.controller';
import { RecomendadorService } from './recomendador.service';

describe('RecomendadorController', () => {
  let controller: RecomendadorController;
  let service: jest.Mocked<RecomendadorService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RecomendadorController],
      providers: [
        {
          provide: RecomendadorService,
          useValue: {
            recomendarAdiestramiento: jest.fn().mockReturnValue({ tipoRecomendado: 'individual_o_grupal', bloqueaGrupales: false, mensaje: 'ok' }),
            recomendarVeterinaria: jest.fn().mockReturnValue({ accion: 'consulta_general', mensaje: 'ok' }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(RecomendadorController);
    service = moduleRef.get(RecomendadorService);
  });

  it('debería delegar la recomendación de adiestramiento en el service', () => {
    const dto = { motivo: 'tirones_correa' as never, intensidad: 'leve' as never };
    controller.adiestramiento(dto);
    expect(service.recomendarAdiestramiento).toHaveBeenCalledWith(dto);
  });

  it('debería delegar el triaje de veterinaria en el service', () => {
    const dto = { motivo: 'cojera' as never, gravedad: 'leve' as never };
    controller.veterinaria(dto);
    expect(service.recomendarVeterinaria).toHaveBeenCalledWith(dto);
  });
});
