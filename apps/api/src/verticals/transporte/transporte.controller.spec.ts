import { Test } from '@nestjs/testing';
import { BuscarTransportesDto, BusquedaTransportesRespuesta, OrdenTransporte, SolicitudViajeDto } from 'shared';
import { TransporteController } from './transporte.controller';
import { TransporteCotizadorService } from './transporte-cotizador.service';

describe('TransporteController', () => {
  let controller: TransporteController;
  let cotizador: jest.Mocked<Pick<TransporteCotizadorService, 'buscar' | 'cotizarEmpresa'>>;

  const respuesta: BusquedaTransportesRespuesta = { ruta: null, viajes: 1, resultados: [] };
  const solicitud = { fecha: '2026-10-01' } as SolicitudViajeDto;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TransporteController],
      providers: [
        {
          provide: TransporteCotizadorService,
          useValue: { buscar: jest.fn().mockResolvedValue(respuesta), cotizarEmpresa: jest.fn().mockResolvedValue(respuesta) },
        },
      ],
    }).compile();

    controller = moduleRef.get(TransporteController);
    cotizador = moduleRef.get(TransporteCotizadorService);
  });

  it('debería buscar con el orden recomendado por defecto', async () => {
    await expect(controller.buscar({ solicitud } as BuscarTransportesDto)).resolves.toBe(respuesta);
    expect(cotizador.buscar).toHaveBeenCalledWith(solicitud, OrdenTransporte.RECOMENDADOS);
  });

  it('debería buscar con el orden pedido', async () => {
    await controller.buscar({ solicitud, orden: OrdenTransporte.PRECIO } as BuscarTransportesDto);
    expect(cotizador.buscar).toHaveBeenCalledWith(solicitud, OrdenTransporte.PRECIO);
  });

  it('debería cotizar con un transportista concreto', async () => {
    await expect(controller.cotizarEmpresa('servicio-1', solicitud)).resolves.toBe(respuesta);
    expect(cotizador.cotizarEmpresa).toHaveBeenCalledWith('servicio-1', solicitud);
  });
});
