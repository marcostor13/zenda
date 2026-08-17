import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PerrosService } from './perros.service';
import { Perro } from './perro.schema';
import { PerroHistorial } from './perro-historial.schema';
import { PerroVersion } from './perro-version.schema';
import { Consentimiento } from './consentimiento.schema';
import { Reserva } from '../bookings/reserva.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { TipoHistorial, VerticalKey } from 'shared';

const PROPIETARIO_ID = new Types.ObjectId().toString();

function perroDocMock(propietarioId: string) {
  return {
    _id: new Types.ObjectId(),
    propietarioId: { toString: () => propietarioId },
    nombre: 'Nala',
    toObject: jest.fn().mockReturnValue({ nombre: 'Nala', peso: 12 }),
    save: jest.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve(this);
    }),
    deleteOne: jest.fn().mockResolvedValue(undefined),
  };
}

describe('PerrosService', () => {
  let service: PerrosService;
  let perroModel: { create: jest.Mock; find: jest.Mock; findById: jest.Mock };
  let historialModel: {
    create: jest.Mock; find: jest.Mock; insertMany: jest.Mock;
    findOneAndUpdate: jest.Mock; deleteOne: jest.Mock;
  };
  let versionModel: { create: jest.Mock; find: jest.Mock };
  let consentimientoModel: { find: jest.Mock; findOneAndUpdate: jest.Mock; updateMany: jest.Mock };
  let reservaModel: { find: jest.Mock };

  beforeEach(async () => {
    perroModel = { create: jest.fn(), find: jest.fn(), findById: jest.fn() };
    historialModel = {
      create: jest.fn(), find: jest.fn(), insertMany: jest.fn().mockResolvedValue([]),
      findOneAndUpdate: jest.fn(), deleteOne: jest.fn(),
    };
    versionModel = { create: jest.fn().mockResolvedValue({}), find: jest.fn() };
    consentimientoModel = {
      find: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([]) }), exec: () => Promise.resolve([]) }),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
    };
    reservaModel = {
      find: jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }),
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PerrosService,
        { provide: getModelToken(Perro.name), useValue: perroModel },
        { provide: getModelToken(PerroHistorial.name), useValue: historialModel },
        { provide: getModelToken(PerroVersion.name), useValue: versionModel },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Consentimiento.name), useValue: consentimientoModel },
      ],
    }).compile();

    service = moduleRef.get(PerrosService);
  });

  it('debería crear un perro asociado al propietario autenticado', async () => {
    perroModel.create.mockResolvedValue({ _id: '1' });
    await service.crear(PROPIETARIO_ID, { nombre: 'Nala' });
    expect(perroModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Nala', propietarioId: PROPIETARIO_ID }),
    );
  });

  it('debería listar los perros del propietario ordenados por fecha', async () => {
    const exec = jest.fn().mockResolvedValue([{ nombre: 'Nala' }]);
    perroModel.find.mockReturnValue({ sort: () => ({ exec }) });

    const resultado = await service.listarPorPropietario(PROPIETARIO_ID);

    expect(resultado).toEqual([{ nombre: 'Nala' }]);
  });

  it('debería lanzar 404 si el perro no existe', async () => {
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(null) });
    await expect(service.obtenerPropio('x', PROPIETARIO_ID)).rejects.toThrow(DomainException);
  });

  it('debería lanzar 403 si el perro no pertenece al usuario', async () => {
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(perroDocMock('otro-usuario')) });
    await expect(service.obtenerPropio('x', PROPIETARIO_ID)).rejects.toThrow(DomainException);
  });

  it('debería actualizar un perro propio', async () => {
    const doc = perroDocMock(PROPIETARIO_ID);
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

    await service.actualizar('x', PROPIETARIO_ID, { nombre: 'Nala 2' });

    expect(doc.save).toHaveBeenCalled();
  });

  it('debería eliminar un perro propio', async () => {
    const doc = perroDocMock(PROPIETARIO_ID);
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

    await service.eliminar('x', PROPIETARIO_ID);

    expect(doc.deleteOne).toHaveBeenCalled();
  });

  it('debería lanzar 404 al agregar historial de un perro inexistente', async () => {
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(null) });
    await expect(
      service.agregarHistorial('x', 'comercio-1', { vertical: 'peluqueria' as never, nota: 'Nudos severos' }),
    ).rejects.toThrow(DomainException);
  });

  it('debería agregar una nota al historial del perro', async () => {
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(perroDocMock(PROPIETARIO_ID)) });
    historialModel.create.mockResolvedValue({ _id: 'h1' });

    await service.agregarHistorial('x', 'comercio-1', {
      vertical: 'peluqueria' as never,
      nota: 'Requiere deslanado intensivo',
    });

    expect(historialModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ perroId: 'x', comercioId: 'comercio-1' }),
    );
  });

  it('debería listar el historial de un perro propio', async () => {
    const perroId = new Types.ObjectId().toString();
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(perroDocMock(PROPIETARIO_ID)) });
    const exec = jest.fn().mockResolvedValue([{ nota: 'Todo bien' }]);
    historialModel.find.mockReturnValue({ sort: () => ({ exec }) });

    const resultado = await service.listarHistorial(perroId, PROPIETARIO_ID);

    expect(resultado).toEqual([{ nota: 'Todo bien' }]);
  });

  describe('obtenerPerfilCompatibilidad', () => {
    it('debería devolver solo tamano/tipoPelo/temperamento, sin exigir propiedad', async () => {
      const select = jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ tamano: 'mini', tipoPelo: ['corto'], temperamento: 'tranquilo' }) }),
      });
      perroModel.findById.mockReturnValue({ select });

      const resultado = await service.obtenerPerfilCompatibilidad('perro-1');

      expect(resultado).toEqual({ tamano: 'mini', tipoPelo: ['corto'], temperamento: 'tranquilo' });
    });

    it('debería devolver null si el perro no existe', async () => {
      const select = jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
      perroModel.findById.mockReturnValue({ select });

      const resultado = await service.obtenerPerfilCompatibilidad('no-existe');

      expect(resultado).toBeNull();
    });
  });

  describe('obtenerHistoriaCompartida', () => {
    const perroSaludMock = {
      nombre: 'Nala', especie: 'perro', esterilizado: true,
      vacunas: ['rabia'], alergias: ['pollo'], enfermedades: [], medicacion: [],
      certificadosUrl: [], autorizaCompartirHistorial: true,
    };

    it('debería devolver la ficha de salud + historial si el propietario autorizó compartir', async () => {
      const select = jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(perroSaludMock) }) });
      perroModel.findById.mockReturnValue({ select });
      historialModel.find.mockReturnValue({ sort: () => ({ lean: () => ({ exec: () => Promise.resolve([{ nota: 'Vacuna anual' }]) }) }) });

      const resultado = await service.obtenerHistoriaCompartida(new Types.ObjectId().toString());

      expect(resultado.nombre).toBe('Nala');
      expect(resultado.alergias).toEqual(['pollo']);
      expect(resultado.historial).toEqual([{ nota: 'Vacuna anual' }]);
    });

    it('debería lanzar 404 si el perro no existe', async () => {
      const select = jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
      perroModel.findById.mockReturnValue({ select });

      await expect(service.obtenerHistoriaCompartida('no-existe')).rejects.toThrow(DomainException);
    });

    it('debería lanzar 403 si el propietario no autorizó compartir el historial', async () => {
      const select = jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ ...perroSaludMock, autorizaCompartirHistorial: false }) }),
      });
      perroModel.findById.mockReturnValue({ select });

      await expect(service.obtenerHistoriaCompartida('perro-1')).rejects.toThrow(DomainException);
    });
  });

  describe('historialVisiblePara (compartición selectiva, RGPD)', () => {
    const perroId = new Types.ObjectId().toString();

    /** Devuelve el filtro con el que se consultó el historial. */
    const filtroConsultado = (): Record<string, unknown> =>
      historialModel.find.mock.calls[0]?.[0] as Record<string, unknown>;

    const conConsentimientos = (lista: Array<{ tipoHistorial: string }>): void => {
      consentimientoModel.find.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(lista) }),
      });
      historialModel.find.mockReturnValue({ sort: () => ({ exec: () => Promise.resolve([]) }) });
    };

    it('la peluquería no ve el informe veterinario sin consentimiento explícito', async () => {
      conConsentimientos([]);

      await service.historialVisiblePara(perroId, VerticalKey.PELUQUERIA);

      const tipos = (filtroConsultado()['$or'] as Array<Record<string, unknown>>)[0];
      expect(tipos['tipoHistorial']).toEqual({ $in: [TipoHistorial.GROOMING] });
    });

    it('cada vertical ve siempre lo que él mismo generó', async () => {
      conConsentimientos([]);

      await service.historialVisiblePara(perroId, VerticalKey.VETERINARIA);

      const tipos = (filtroConsultado()['$or'] as Array<Record<string, unknown>>)[0];
      expect(tipos['tipoHistorial']).toEqual({ $in: [TipoHistorial.VETERINARIO] });
    });

    it('con consentimiento, la peluquería sí ve el historial veterinario', async () => {
      conConsentimientos([{ tipoHistorial: TipoHistorial.VETERINARIO }]);

      await service.historialVisiblePara(perroId, VerticalKey.PELUQUERIA);

      const tipos = (filtroConsultado()['$or'] as Array<Record<string, unknown>>)[0];
      expect(tipos['tipoHistorial']).toEqual({
        $in: expect.arrayContaining([TipoHistorial.VETERINARIO, TipoHistorial.GROOMING]),
      });
    });

    it('solo cuentan los consentimientos concedidos y del vertical que pregunta', async () => {
      conConsentimientos([]);

      await service.historialVisiblePara(perroId, VerticalKey.PELUQUERIA);

      expect(consentimientoModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ verticalDestino: VerticalKey.PELUQUERIA, concedido: true }),
      );
    });
  });

  describe('versionado de la ficha', () => {
    it('debería guardar cómo estaba la ficha antes de cambiarla', async () => {
      const doc = perroDocMock(PROPIETARIO_ID);
      perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

      await service.actualizar('perro-1', PROPIETARIO_ID, { peso: 15 });

      expect(versionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ campos: ['peso'], anterior: { nombre: 'Nala', peso: 12 } }),
      );
    });

    it('no debería ensuciar el historial si no cambia nada', async () => {
      const doc = perroDocMock(PROPIETARIO_ID);
      perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

      await service.actualizar('perro-1', PROPIETARIO_ID, { peso: 12 });

      expect(versionModel.create).not.toHaveBeenCalled();
    });
  });

  describe('parsearImportacion (volcado copiar/pegar)', () => {
    it('debería separar fecha, concepto y detalle de un pegado desde Excel', () => {
      const filas = service.parsearImportacion('12/03/2026\tVacuna antirrábica\tLote A-22');

      expect(filas).toEqual([
        { fecha: '12/03/2026', concepto: 'Vacuna antirrábica', detalle: 'Lote A-22' },
      ]);
    });

    it('debería tratar el texto plano como un único concepto por línea', () => {
      const filas = service.parsearImportacion('Revisión anual sin incidencias');

      expect(filas).toEqual([{ concepto: 'Revisión anual sin incidencias' }]);
    });

    it('no debería tomar por fecha una primera columna que no lo es', () => {
      const filas = service.parsearImportacion('Vacunación\tAl día');

      expect(filas).toEqual([{ concepto: 'Vacunación', detalle: 'Al día' }]);
    });

    it('debería descartar líneas vacías del pegado', () => {
      const filas = service.parsearImportacion('Consulta\n\n   \nRevisión');

      expect(filas).toHaveLength(2);
    });
  });

  describe('control del historial por el propietario', () => {
    it('debería lanzar 404 al editar una entrada que no existe', async () => {
      perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(perroDocMock(PROPIETARIO_ID)) });
      historialModel.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve(null) });

      await expect(
        service.editarHistorial(
          new Types.ObjectId().toString(), new Types.ObjectId().toString(), PROPIETARIO_ID, 'texto',
        ),
      ).rejects.toThrow(DomainException);
    });

    it('debería marcar la fecha de edición al corregir una entrada', async () => {
      perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(perroDocMock(PROPIETARIO_ID)) });
      historialModel.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve({ nota: 'nuevo' }) });

      await service.editarHistorial(
        new Types.ObjectId().toString(), new Types.ObjectId().toString(), PROPIETARIO_ID, 'nuevo',
      );

      const cambios = historialModel.findOneAndUpdate.mock.calls[0][1] as { $set: Record<string, unknown> };
      expect(cambios.$set['nota']).toBe('nuevo');
      expect(cambios.$set['editadaAt']).toBeInstanceOf(Date);
    });

    it('debería lanzar 404 al eliminar una entrada que no existe', async () => {
      perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(perroDocMock(PROPIETARIO_ID)) });
      historialModel.deleteOne.mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 0 }) });

      await expect(
        service.eliminarHistorial(
          new Types.ObjectId().toString(), new Types.ObjectId().toString(), PROPIETARIO_ID,
        ),
      ).rejects.toThrow(DomainException);
    });

    it('debería rechazar un identificador malformado con 400, no reventar con 500', async () => {
      perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(perroDocMock(PROPIETARIO_ID)) });

      await expect(
        service.eliminarHistorial(new Types.ObjectId().toString(), 'no-es-un-id', PROPIETARIO_ID),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('estimarPrecioConHistorial (Ref. N8)', () => {
    it('debería devolver el precio base sin ajustar si el perro no tiene reservas anteriores', async () => {
      reservaModel.find.mockReturnValue({
        select: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }),
      });

      const estimacion = await service.estimarPrecioConHistorial(new Types.ObjectId().toString(), 100);

      expect(estimacion).toEqual({
        precioBase: 100, precioEstimado: 100, promedioAjustePct: 0, basadoEnReservas: 0,
      });
    });

    it('debería ajustar el precio según el porcentaje medio de suplementos aceptados', async () => {
      reservaModel.find.mockReturnValue({
        select: () => ({
          lean: () => ({
            exec: () => Promise.resolve([
              { montoSubtotal: 100, suplementos: [{ monto: 20 }] }, // +20%
              { montoSubtotal: 100, suplementos: [] },              // +0%
            ]),
          }),
        }),
      });

      const estimacion = await service.estimarPrecioConHistorial(new Types.ObjectId().toString(), 100);

      expect(estimacion.basadoEnReservas).toBe(2);
      expect(estimacion.promedioAjustePct).toBe(10);
      expect(estimacion.precioEstimado).toBe(110);
    });
  });
});
