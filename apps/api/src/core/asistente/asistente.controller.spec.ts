import { Test } from '@nestjs/testing';
import { AsistenteController } from './asistente.controller';
import { AsistenteService } from './asistente.service';

describe('AsistenteController', () => {
  let controller: AsistenteController;
  let responder: jest.Mock;

  beforeEach(async () => {
    responder = jest.fn().mockResolvedValue({ disponible: true, respuesta: 'Claro' });
    const modulo = await Test.createTestingModule({
      controllers: [AsistenteController],
      providers: [{ provide: AsistenteService, useValue: { responder } }],
    }).compile();
    controller = modulo.get(AsistenteController);
  });

  it('debería pasar la consulta entera al servicio', async () => {
    const consulta = {
      pregunta: '¿Cómo reservo?',
      historial: [{ autor: 'cliente' as const, texto: 'hola' }],
      ruta: '/peluqueria/s1',
    };

    await expect(controller.responder(consulta)).resolves.toEqual({ disponible: true, respuesta: 'Claro' });
    expect(responder).toHaveBeenCalledWith(consulta);
  });
});
