import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EstadoPoliza, ResultadoElegibilidad, TipoSeguro } from 'shared';
import { SegurosService } from './seguros.service';
import { SegurosAvailabilityStrategy } from './seguros-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { Poliza } from './poliza.schema';
import { PerrosService } from '../../core/perros/perros.service';
import { BienestarService } from '../../core/perros/bienestar.service';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('SegurosService', () => {
  let service: SegurosService;
  let servicioModel: { find: jest.Mock; findById: jest.Mock };
  let polizaModel: { create: jest.Mock; find: jest.Mock; findById: jest.Mock };
  let estrategia: { evaluarAdmision: jest.Mock };
  let perrosService: { obtenerPropio: jest.Mock };
  let bienestarService: { calcular: jest.Mock };

  const USUARIO_ID = new Types.ObjectId().toString();
  const PERRO_ID = new Types.ObjectId().toString();

  const perro = (extra: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(PERRO_ID),
    nombre: 'Nala',
    peso: 12,
    raza: 'Border Collie',
    esPPP: false,
    vacunasDetalle: [{ tipo: 'rabia' }],
    ...extra,
  });

  const admisionOk = (extra: Record<string, unknown> = {}) => ({
    resultado: ResultadoElegibilidad.ELEGIBLE,
    recargoPct: 0,
    motivo: undefined,
    ...extra,
  });

  function mockPolizasPublicadas(polizas: unknown[]) {
    servicioModel.find.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(polizas),
    });
  }

  beforeEach(async () => {
    servicioModel = { find: jest.fn(), findById: jest.fn() };
    polizaModel = { create: jest.fn(), find: jest.fn(), findById: jest.fn() };
    estrategia = { evaluarAdmision: jest.fn().mockReturnValue(admisionOk()) };
    perrosService = { obtenerPropio: jest.fn().mockResolvedValue(perro()) };
    bienestarService = { calcular: jest.fn().mockResolvedValue({ descuentoSeguroPct: 0 }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SegurosService,
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
        { provide: getModelToken(Poliza.name), useValue: polizaModel },
        { provide: SegurosAvailabilityStrategy, useValue: estrategia },
        { provide: PerrosService, useValue: perrosService },
        { provide: BienestarService, useValue: bienestarService },
      ],
    }).compile();

    service = moduleRef.get(SegurosService);
  });

  describe('recomendarPara', () => {
    it('debería aplicar el descuento del Índice de Bienestar sobre la prima', async () => {
      bienestarService.calcular.mockResolvedValue({ descuentoSeguroPct: 0.1 });
      mockPolizasPublicadas([
        { _id: new Types.ObjectId(), titulo: 'Básico', primaAnualBase: 200, tiposSeguro: [] },
      ]);

      const [recomendada] = await service.recomendarPara(PERRO_ID, USUARIO_ID);

      expect(recomendada.primaAnual).toBe(200);
      expect(recomendada.primaConDescuento).toBe(180);
      expect(recomendada.descuentoBienestarPct).toBe(0.1);
    });

    it('debería sumar a la prima el recargo por riesgo que devuelva la admisión', async () => {
      estrategia.evaluarAdmision.mockReturnValue(admisionOk({ recargoPct: 0.25 }));
      mockPolizasPublicadas([
        { _id: new Types.ObjectId(), titulo: 'Con recargo', primaAnualBase: 100, tiposSeguro: [] },
      ]);

      const [recomendada] = await service.recomendarPara(PERRO_ID, USUARIO_ID);

      expect(recomendada.primaAnual).toBe(125);
    });

    it('debería ordenar por precio ya con descuento, no por prima base', async () => {
      // Ordenar por la prima antes del bonus-malus daría un orden distinto del
      // que el cliente va a pagar de verdad.
      const cara = new Types.ObjectId();
      const barata = new Types.ObjectId();
      mockPolizasPublicadas([
        { _id: cara, titulo: 'Cara', primaAnualBase: 300, tiposSeguro: [] },
        { _id: barata, titulo: 'Barata', primaAnualBase: 120, tiposSeguro: [] },
      ]);

      const recomendadas = await service.recomendarPara(PERRO_ID, USUARIO_ID);

      expect(recomendadas.map((r) => r.titulo)).toEqual(['Barata', 'Cara']);
    });

    it('debería mostrar al final lo no elegible, sin ocultarlo', async () => {
      const noApta = new Types.ObjectId();
      const apta = new Types.ObjectId();
      estrategia.evaluarAdmision.mockImplementation((condiciones: Record<string, unknown>) =>
        condiciones['excluyePPP']
          ? { resultado: ResultadoElegibilidad.NO_ELEGIBLE, recargoPct: 0, motivo: 'Raza excluida' }
          : admisionOk(),
      );
      mockPolizasPublicadas([
        { _id: noApta, titulo: 'No apta', primaAnualBase: 50, tiposSeguro: [], condicionesAdmision: { excluyePPP: true } },
        { _id: apta, titulo: 'Apta', primaAnualBase: 400, tiposSeguro: [] },
      ]);

      const recomendadas = await service.recomendarPara(PERRO_ID, USUARIO_ID);

      // Aunque sea más barata, la no elegible va la última.
      expect(recomendadas.map((r) => r.titulo)).toEqual(['Apta', 'No apta']);
      expect(recomendadas[1].motivo).toBe('Raza excluida');
    });

    it('debería explicar la cobertura obligatoria en un perro PPP', async () => {
      perrosService.obtenerPropio.mockResolvedValue(perro({ esPPP: true }));
      mockPolizasPublicadas([
        { _id: new Types.ObjectId(), titulo: 'PPP', primaAnualBase: 300, tiposSeguro: [TipoSeguro.PPP] },
      ]);

      const [recomendada] = await service.recomendarPara(PERRO_ID, USUARIO_ID);

      expect(recomendada.razon).toContain('potencialmente peligrosas');
    });

    it('debería destacar los gastos veterinarios en una mascota mayor', async () => {
      const hace10Anios = new Date();
      hace10Anios.setFullYear(hace10Anios.getFullYear() - 10);
      perrosService.obtenerPropio.mockResolvedValue(perro({ fechaNacimiento: hace10Anios }));
      mockPolizasPublicadas([
        {
          _id: new Types.ObjectId(), titulo: 'Salud', primaAnualBase: 300,
          tiposSeguro: [TipoSeguro.GASTOS_VET_ENFERMEDAD],
        },
      ]);

      const [recomendada] = await service.recomendarPara(PERRO_ID, USUARIO_ID);

      expect(recomendada.razon).toContain('mascotas mayores');
    });

    it('debería mencionar la cobertura de viaje cuando la póliza la incluye', async () => {
      mockPolizasPublicadas([
        { _id: new Types.ObjectId(), titulo: 'Viaje', primaAnualBase: 150, tiposSeguro: [TipoSeguro.VIAJE] },
      ]);

      const [recomendada] = await service.recomendarPara(PERRO_ID, USUARIO_ID);

      expect(recomendada.razon).toContain('viaje');
    });

    it('debería dar una razón genérica cuando no hay nada destacable', async () => {
      mockPolizasPublicadas([
        { _id: new Types.ObjectId(), titulo: 'Simple', primaAnualBase: 150, tiposSeguro: [] },
      ]);

      const [recomendada] = await service.recomendarPara(PERRO_ID, USUARIO_ID);

      expect(recomendada.razon).toContain('Cumple las condiciones');
    });

    it('debería devolver lista vacía si no hay pólizas publicadas', async () => {
      mockPolizasPublicadas([]);

      expect(await service.recomendarPara(PERRO_ID, USUARIO_ID)).toEqual([]);
    });
  });

  describe('contratar', () => {
    const params = {
      servicioId: new Types.ObjectId().toString(),
      perroId: PERRO_ID,
      usuarioId: USUARIO_ID,
      declaracionVeracidadAceptada: true,
    };

    function mockPoliza(doc: unknown) {
      servicioModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });
    }

    const polizaBase = {
      _id: new Types.ObjectId(),
      comercioId: new Types.ObjectId(),
      primaAnualBase: 200,
      tiposSeguro: [TipoSeguro.RC_OBLIGATORIA],
      duracionMeses: 12,
      renovacionAutomatica: true,
    };

    it('debería exigir la declaración de veracidad antes de contratar', async () => {
      await expect(
        service.contratar({ ...params, declaracionVeracidadAceptada: false }),
      ).rejects.toThrow('datos de tu mascota son ciertos');

      expect(polizaModel.create).not.toHaveBeenCalled();
    });

    it('debería lanzar 404 si la póliza no existe', async () => {
      mockPoliza(null);

      await expect(service.contratar(params)).rejects.toThrow('Póliza no encontrada');
    });

    it('debería impedir contratar si la mascota no es elegible', async () => {
      mockPoliza(polizaBase);
      estrategia.evaluarAdmision.mockReturnValue({
        resultado: ResultadoElegibilidad.NO_ELEGIBLE, recargoPct: 0, motivo: 'Supera la edad máxima',
      });

      await expect(service.contratar(params)).rejects.toThrow('Supera la edad máxima');
      expect(polizaModel.create).not.toHaveBeenCalled();
    });

    it('debería nacer pendiente de validación, no vigente', async () => {
      // El precio que vio el cliente es orientativo: la aseguradora revisa antes
      // de que la cobertura sea firme.
      mockPoliza(polizaBase);

      await service.contratar(params);

      const creada = polizaModel.create.mock.calls[0][0];
      expect(creada.estado).toBe(EstadoPoliza.PENDIENTE_VALIDACION);
      expect(creada.declaracionVeracidadAceptada).toBe(true);
      expect(creada.fechaDeclaracion).toBeInstanceOf(Date);
    });

    it('debería congelar el snapshot del perro como prueba de lo declarado', async () => {
      mockPoliza(polizaBase);

      await service.contratar(params);

      const creada = polizaModel.create.mock.calls[0][0];
      expect(creada.perroSnapshot).toEqual(expect.objectContaining({ nombre: 'Nala' }));
    });

    it('debería aplicar el recargo de admisión a la prima contratada', async () => {
      mockPoliza(polizaBase);
      estrategia.evaluarAdmision.mockReturnValue(admisionOk({ recargoPct: 0.5 }));

      await service.contratar(params);

      const creada = polizaModel.create.mock.calls[0][0];
      expect(creada.primaAnual).toBe(300);
      expect(creada.recargoAplicadoPct).toBe(0.5);
    });

    it('debería tomar la carencia y la franquicia más altas de las coberturas', async () => {
      mockPoliza({
        ...polizaBase,
        limitesCobertura: [
          { carenciaDias: 15, franquiciaEur: 50 },
          { carenciaDias: 30, franquiciaEur: 120 },
        ],
      });

      await service.contratar(params);

      const creada = polizaModel.create.mock.calls[0][0];
      expect(creada.franquiciaEur).toBe(120);
      expect(creada.carenciaHasta).toBeInstanceOf(Date);
      expect(creada.carenciaHasta.getTime()).toBeGreaterThan(Date.now());
    });

    it('no debería fijar carencia si ninguna cobertura la exige', async () => {
      mockPoliza({ ...polizaBase, limitesCobertura: [{ franquiciaEur: 50 }] });

      await service.contratar(params);

      expect(polizaModel.create.mock.calls[0][0].carenciaHasta).toBeUndefined();
    });

    it('debería usar 12 meses de vigencia cuando la póliza no declara duración', async () => {
      mockPoliza({ ...polizaBase, duracionMeses: undefined });

      await service.contratar(params);

      const { vigenciaDesde, vigenciaHasta } = polizaModel.create.mock.calls[0][0];
      const dias = (vigenciaHasta.getTime() - vigenciaDesde.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(dias)).toBe(360);
    });

    it('debería vincular la reserva cuando el seguro se contrata desde una', async () => {
      mockPoliza(polizaBase);
      const reservaId = new Types.ObjectId().toString();

      await service.contratar({ ...params, reservaId });

      expect(String(polizaModel.create.mock.calls[0][0].reservaId)).toBe(reservaId);
    });

    it('no debería vincular reserva si se contrata de forma independiente', async () => {
      mockPoliza(polizaBase);

      await service.contratar(params);

      expect(polizaModel.create.mock.calls[0][0].reservaId).toBeUndefined();
    });
  });

  describe('listarDeUsuario', () => {
    it('debería devolver las pólizas del usuario, la de vigencia más larga primero', async () => {
      const exec = jest.fn().mockResolvedValue([{ _id: 'p1' }]);
      const sort = jest.fn().mockReturnValue({ exec });
      polizaModel.find.mockReturnValue({ sort });

      const res = await service.listarDeUsuario(USUARIO_ID);

      expect(sort).toHaveBeenCalledWith({ vigenciaHasta: -1 });
      expect(res).toEqual([{ _id: 'p1' }]);
    });
  });

  describe('validar', () => {
    const COMERCIO_ID = new Types.ObjectId().toString();

    function mockPolizaGuardada(doc: unknown) {
      polizaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
    }

    it('debería rechazar un identificador malformado con 400, no reventar con 500', async () => {
      await expect(service.validar('no-es-un-id', COMERCIO_ID, true))
        .rejects.toThrow('Identificador no válido');
    });

    it('debería lanzar 404 si la póliza no existe', async () => {
      mockPolizaGuardada(null);

      await expect(service.validar(new Types.ObjectId().toString(), COMERCIO_ID, true))
        .rejects.toThrow('Póliza no encontrada');
    });

    it('no debería dejar validar la póliza de otra aseguradora', async () => {
      mockPolizaGuardada({
        aseguradoraComercioId: new Types.ObjectId(),
        estado: EstadoPoliza.PENDIENTE_VALIDACION,
      });

      await expect(service.validar(new Types.ObjectId().toString(), COMERCIO_ID, true))
        .rejects.toThrow('No tienes permiso sobre esta póliza');
    });

    it('no debería permitir validar dos veces la misma póliza', async () => {
      mockPolizaGuardada({
        aseguradoraComercioId: { toString: () => COMERCIO_ID },
        estado: EstadoPoliza.VIGENTE,
      });

      await expect(service.validar(new Types.ObjectId().toString(), COMERCIO_ID, true))
        .rejects.toThrow('ya fue validada');
    });

    it('debería dejar la póliza vigente al aceptarla', async () => {
      const save = jest.fn().mockImplementation(function (this: unknown) { return this; });
      const poliza: Record<string, unknown> = {
        aseguradoraComercioId: { toString: () => COMERCIO_ID },
        estado: EstadoPoliza.PENDIENTE_VALIDACION,
        save,
      };
      mockPolizaGuardada(poliza);

      await service.validar(new Types.ObjectId().toString(), COMERCIO_ID, true);

      expect(poliza.estado).toBe(EstadoPoliza.VIGENTE);
      expect(poliza.motivoRechazo).toBeUndefined();
      expect(save).toHaveBeenCalled();
    });

    it('debería conservar el motivo al rechazarla', async () => {
      const poliza: Record<string, unknown> = {
        aseguradoraComercioId: { toString: () => COMERCIO_ID },
        estado: EstadoPoliza.PENDIENTE_VALIDACION,
        save: jest.fn().mockImplementation(function (this: unknown) { return this; }),
      };
      mockPolizaGuardada(poliza);

      await service.validar(new Types.ObjectId().toString(), COMERCIO_ID, false, 'Datos incompletos');

      expect(poliza.estado).toBe(EstadoPoliza.RECHAZADA);
      expect(poliza.motivoRechazo).toBe('Datos incompletos');
    });
  });
});
