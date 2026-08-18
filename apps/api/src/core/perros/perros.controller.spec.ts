import { Test } from '@nestjs/testing';
import { PerrosController } from './perros.controller';
import { PerrosService } from './perros.service';
import { PerroValoracionesService } from './perro-valoraciones.service';
import { BienestarService } from './bienestar.service';

describe('PerrosController', () => {
  let controller: PerrosController;
  let service: jest.Mocked<PerrosService>;
  let valoracionesService: jest.Mocked<PerroValoracionesService>;
  let bienestarService: jest.Mocked<BienestarService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PerrosController],
      providers: [
        {
          provide: PerrosService,
          useValue: {
            editarHistorial: jest.fn().mockResolvedValue([]),
            eliminarHistorial: jest.fn().mockResolvedValue([]),
            parsearImportacion: jest.fn().mockResolvedValue([]),
            importarHistorial: jest.fn().mockResolvedValue([]),
            listarVersiones: jest.fn().mockResolvedValue([]),
            listarConsentimientos: jest.fn().mockResolvedValue([]),
            fijarConsentimiento: jest.fn().mockResolvedValue([]),
            revocarTodosLosConsentimientos: jest.fn().mockResolvedValue([]),
            crear: jest.fn().mockResolvedValue({ _id: 'p1' }),
            listarPorPropietario: jest.fn().mockResolvedValue([]),
            obtenerPropio: jest.fn().mockResolvedValue({ _id: 'p1' }),
            actualizar: jest.fn().mockResolvedValue({ _id: 'p1' }),
            eliminar: jest.fn().mockResolvedValue(undefined),
            listarHistorial: jest.fn().mockResolvedValue([]),
            agregarHistorial: jest.fn().mockResolvedValue({ _id: 'h1' }),
            obtenerHistoriaCompartida: jest.fn().mockResolvedValue({ nombre: 'Nala' }),
            estimarPrecioConHistorial: jest.fn().mockResolvedValue({
              precioBase: 100, precioEstimado: 110, promedioAjustePct: 10, basadoEnReservas: 2,
            }),
          },
        },
        {
          provide: PerroValoracionesService,
          useValue: {
            crear: jest.fn().mockResolvedValue({ _id: 'v1' }),
            listarPorPerro: jest.fn().mockResolvedValue([]),
            indiceComportamiento: jest.fn().mockResolvedValue({ puntuacionPromedio: 0, totalValoraciones: 0, atributosPromedio: {} }),
          },
        },
        {
          provide: BienestarService,
          useValue: {
            calcular: jest.fn().mockResolvedValue({
              perroId: 'p1', puntuacion: 80, nivel: 'muy_bueno', descuentoSeguroPct: 0.1, ejes: [],
            }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(PerrosController);
    service = moduleRef.get(PerrosService);
    valoracionesService = moduleRef.get(PerroValoracionesService);
    bienestarService = moduleRef.get(BienestarService);
  });

  it('debería devolver el Índice de Bienestar del perro', async () => {
    const indice = await controller.bienestar('p1');

    expect(bienestarService.calcular).toHaveBeenCalledWith('p1');
    expect(indice.descuentoSeguroPct).toBe(0.1);
  });

  it('debería crear el perro con el propietario del token', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    const dto = { nombre: 'Nala' };
    await controller.crear(dto, req);
    expect(service.crear).toHaveBeenCalledWith('user-1', dto);
  });

  it('debería listar los perros del usuario autenticado', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    await controller.misPerros(req);
    expect(service.listarPorPropietario).toHaveBeenCalledWith('user-1');
  });

  it('debería obtener un perro propio por id', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    await controller.obtener('p1', req);
    expect(service.obtenerPropio).toHaveBeenCalledWith('p1', 'user-1');
  });

  it('debería actualizar un perro propio', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    const dto = { nombre: 'Nala 2' };
    await controller.actualizar('p1', dto, req);
    expect(service.actualizar).toHaveBeenCalledWith('p1', 'user-1', dto);
  });

  it('debería eliminar un perro propio', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    await controller.eliminar('p1', req);
    expect(service.eliminar).toHaveBeenCalledWith('p1', 'user-1');
  });

  it('debería listar el historial de un perro propio', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    await controller.listarHistorial('p1', req);
    expect(service.listarHistorial).toHaveBeenCalledWith('p1', 'user-1');
  });

  it('debería agregar historial usando el comercioId del token', async () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;
    const dto = { vertical: 'peluqueria' as never, nota: 'Nudos severos' };
    await controller.agregarHistorial('p1', dto, req);
    expect(service.agregarHistorial).toHaveBeenCalledWith('p1', 'comercio-1', dto);
  });

  it('debería obtener la historia veterinaria compartida sin exigir propietario', async () => {
    await controller.obtenerHistoriaCompartida('p1');
    expect(service.obtenerHistoriaCompartida).toHaveBeenCalledWith('p1');
  });

  it('debería obtener el índice de comportamiento sin exigir propietario', async () => {
    await controller.indiceComportamiento('p1');
    expect(valoracionesService.indiceComportamiento).toHaveBeenCalledWith('p1');
  });

  it('debería crear una valoración usando el comercioId del token', async () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;
    const dto = { reservaId: 'r1', puntuacion: 5 };
    await controller.crearValoracion('p1', dto, req);
    expect(valoracionesService.crear).toHaveBeenCalledWith('p1', 'comercio-1', dto);
  });

  it('debería listar las valoraciones de un perro', async () => {
    await controller.listarValoraciones('p1');
    expect(valoracionesService.listarPorPerro).toHaveBeenCalledWith('p1');
  });

  it('debería calcular la estimación de precio ajustada por historial (Ref. N8)', async () => {
    const estimacion = await controller.estimacionPrecio('p1', '100');
    expect(service.estimarPrecioConHistorial).toHaveBeenCalledWith('p1', 100);
    expect(estimacion.precioEstimado).toBe(110);
  });

  it('debería rechazar un precioBase no numérico con 400', async () => {
    expect(() => controller.estimacionPrecio('p1', 'no-es-un-numero')).toThrow();
  });
  describe('historial clinico', () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;

    it('deberia editar la nota exigiendo el usuario, no solo los ids', async () => {
      await controller.editarHistorial('perro-1', 'hist-1', { nota: 'corregido' } as never, req);

      expect(service.editarHistorial).toHaveBeenCalledWith(
        'perro-1', 'hist-1', 'user-1', 'corregido',
      );
    });

    it('deberia eliminar la entrada exigiendo el usuario', async () => {
      await controller.eliminarHistorial('perro-1', 'hist-1', req);

      expect(service.eliminarHistorial).toHaveBeenCalledWith('perro-1', 'hist-1', 'user-1');
    });

    it('deberia previsualizar la importacion sin escribir nada', async () => {
      // Es el paso de "esto es lo que voy a importar": no debe tocar la ficha.
      controller.previsualizarImportacion({ texto: 'linea 1' } as never);

      expect(service.parsearImportacion).toHaveBeenCalledWith('linea 1');
      expect(service.importarHistorial).not.toHaveBeenCalled();
    });

    it('deberia devolver cuantas entradas se importaron', async () => {
      service.importarHistorial.mockResolvedValue(3 as never);

      const resultado = await controller.importarHistorial(
        'perro-1', { vertical: 'veterinaria', filas: [] } as never, req,
      );

      expect(resultado).toEqual({ importadas: 3 });
    });
  });

  describe('versiones y consentimientos', () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;

    it('deberia listar versiones y consentimientos solo del propietario', async () => {
      await controller.listarVersiones('perro-1', req);
      await controller.listarConsentimientos('perro-1', req);

      expect(service.listarVersiones).toHaveBeenCalledWith('perro-1', 'user-1');
      expect(service.listarConsentimientos).toHaveBeenCalledWith('perro-1', 'user-1');
    });

    it('deberia fijar el consentimiento a nombre del propietario', async () => {
      const dto = { comercioId: 'comercio-9', concedido: true } as never;

      await controller.fijarConsentimiento('perro-1', dto, req);

      expect(service.fijarConsentimiento).toHaveBeenCalledWith('perro-1', 'user-1', dto);
    });

    it('deberia devolver cuantos consentimientos se revocaron', async () => {
      // El RGPD exige poder retirarlo todo de una vez y saber que se retiro.
      service.revocarTodosLosConsentimientos.mockResolvedValue(4 as never);

      await expect(controller.revocarConsentimientos('perro-1', req)).resolves.toEqual({ revocados: 4 });
    });
  });
});
