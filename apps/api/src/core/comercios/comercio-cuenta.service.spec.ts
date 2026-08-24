import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { MotivoBajaComercio, ReservaEstado } from 'shared';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ComercioCuentaService } from './comercio-cuenta.service';
import { ComerciosRepository } from './comercios.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';

/** Colección falsa: cada operación cuenta 0 y no borra nada salvo que se diga. */
function coleccionFalsa() {
  return {
    countDocuments: jest.fn().mockResolvedValue(0),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
  };
}

describe('ComercioCuentaService', () => {
  const comercioId = new Types.ObjectId();
  let service: ComercioCuentaService;
  let repo: jest.Mocked<Pick<ComerciosRepository, 'findById' | 'actualizarCampos' | 'eliminar'>>;
  let colecciones: Record<string, ReturnType<typeof coleccionFalsa>>;

  const comercioActivo = {
    _id: comercioId,
    nombreComercial: 'Peluquería Luna',
    estado: 'activo' as const,
  };

  beforeEach(async () => {
    colecciones = {};
    repo = {
      findById: jest.fn().mockResolvedValue(comercioActivo),
      actualizarCampos: jest.fn().mockImplementation((_id, campos) =>
        Promise.resolve({ ...comercioActivo, ...campos }),
      ),
      eliminar: jest.fn().mockResolvedValue(undefined),
    };

    const conexion = {
      collection: jest.fn((nombre: string) => {
        colecciones[nombre] ??= coleccionFalsa();
        return colecciones[nombre];
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ComercioCuentaService,
        { provide: ComerciosRepository, useValue: repo },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: getConnectionToken(), useValue: conexion },
      ],
    }).compile();

    service = moduleRef.get(ComercioCuentaService);
  });

  /** Cuántas reservas vivas devuelve el contador de `reservas`. */
  function conReservasActivas(activas: number, totales = activas): void {
    colecciones['reservas'] ??= coleccionFalsa();
    colecciones['reservas'].countDocuments.mockImplementation((filtro: Record<string, unknown>) =>
      Promise.resolve((filtro['estado'] as { $in?: string[] })?.$in ? activas : totales),
    );
  }

  describe('impacto', () => {
    it('debería marcar que no puede darse de baja si tiene reservas vivas', async () => {
      conReservasActivas(2, 9);

      const impacto = await service.impacto(String(comercioId));

      expect(impacto.reservasActivas).toBe(2);
      expect(impacto.reservas).toBe(9);
      expect(impacto.puedeDarseDeBaja).toBe(false);
    });

    it('debería contar como vivas las reservas con dinero retenido', async () => {
      await service.impacto(String(comercioId));

      const filtros = colecciones['reservas'].countDocuments.mock.calls.map((c) => c[0]);
      const conEstado = filtros.find((f) => f.estado);
      expect(conEstado.estado.$in).toContain(ReservaEstado.PAGO_RETENIDO);
      expect(conEstado.estado.$in).toContain(ReservaEstado.EN_DISPUTA);
    });

    it('debería tratar un comercio ya dado de baja como inexistente', async () => {
      repo.findById.mockResolvedValue({ ...comercioActivo, estado: 'eliminado' } as never);

      await expect(service.impacto(String(comercioId))).rejects.toThrow(DomainException);
    });
  });

  describe('pausar', () => {
    it('debería dejar la cuenta inactiva y ocultar sus listados del buscador', async () => {
      await service.pausar(
        String(comercioId),
        { motivo: MotivoBajaComercio.PAUSA_TEMPORADA, comentario: '  cerramos agosto  ' },
        'user-1',
      );

      expect(repo.actualizarCampos).toHaveBeenCalledWith(
        String(comercioId),
        expect.objectContaining({ estado: 'inactivo' }),
      );
      expect(colecciones['servicios'].updateMany).toHaveBeenCalledWith(
        { comercioId },
        { $set: { comercioActivo: false } },
      );
    });

    it('debería guardar el motivo con el comentario recortado y el estado previo', async () => {
      await service.pausar(
        String(comercioId),
        { motivo: MotivoBajaComercio.PAUSA_TEMPORADA, comentario: '  cerramos agosto  ' },
        'user-1',
      );

      const campos = repo.actualizarCampos.mock.calls[0][1] as { baja: Record<string, unknown> };
      expect(campos.baja).toMatchObject({
        motivo: MotivoBajaComercio.PAUSA_TEMPORADA,
        comentario: 'cerramos agosto',
        origen: 'comercio',
        estadoPrevio: 'activo',
      });
    });

    it('no debería dejar pausar una cuenta suspendida por la plataforma', async () => {
      repo.findById.mockResolvedValue({ ...comercioActivo, estado: 'suspendido' } as never);

      await expect(
        service.pausar(String(comercioId), { motivo: MotivoBajaComercio.OTRO }, 'user-1'),
      ).rejects.toThrow('suspendida');
    });
  });

  describe('reactivar', () => {
    it('debería volver a publicar los listados al salir de la pausa', async () => {
      repo.findById.mockResolvedValue({ ...comercioActivo, estado: 'inactivo' } as never);

      await service.reactivar(String(comercioId), 'user-1');

      expect(repo.actualizarCampos).toHaveBeenCalledWith(String(comercioId), { estado: 'activo' });
      expect(colecciones['servicios'].updateMany).toHaveBeenCalledWith(
        { comercioId },
        { $set: { comercioActivo: true } },
      );
    });

    it('no debería levantar una suspensión desde el panel del comercio', async () => {
      repo.findById.mockResolvedValue({ ...comercioActivo, estado: 'suspendido' } as never);

      await expect(service.reactivar(String(comercioId), 'user-1')).rejects.toThrow(DomainException);
    });
  });

  describe('darDeBaja', () => {
    const params = { motivo: MotivoBajaComercio.CIERRE_NEGOCIO, origen: 'comercio' as const, actorId: 'u1' };

    it('debería bloquear la baja mientras queden reservas en curso', async () => {
      conReservasActivas(3);

      await expect(service.darDeBaja(String(comercioId), params)).rejects.toThrow('3 reserva(s) en curso');
      expect(repo.actualizarCampos).not.toHaveBeenCalled();
    });

    it('debería despublicar los listados además de bajar el flag del buscador', async () => {
      await service.darDeBaja(String(comercioId), params);

      expect(colecciones['servicios'].updateMany).toHaveBeenCalledWith(
        { comercioId },
        { $set: { comercioActivo: false, estado: 'pausado' } },
      );
    });

    it('debería desactivar las cuentas del equipo sin borrarlas', async () => {
      await service.darDeBaja(String(comercioId), params);

      expect(colecciones['usuarios'].updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ comercioId }),
        { $set: { activo: false } },
      );
      expect(colecciones['usuarios'].deleteMany).not.toHaveBeenCalled();
    });

    it('debería conservar el comercio y anunciar hasta cuándo se puede restaurar', async () => {
      const resultado = await service.darDeBaja(String(comercioId), params);

      expect(repo.eliminar).not.toHaveBeenCalled();
      expect(resultado.purgado).toBe(false);
      expect(resultado.restaurableHasta).toBeDefined();
    });

    it('debería borrar de verdad comercio, listados y equipo al purgar', async () => {
      await service.darDeBaja(String(comercioId), { ...params, purgar: true });

      expect(colecciones['servicios'].deleteMany).toHaveBeenCalledWith({ comercioId });
      expect(colecciones['reservas'].deleteMany).toHaveBeenCalledWith({ comercioId });
      expect(colecciones['usuarios'].deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ comercioId }),
      );
      expect(repo.eliminar).toHaveBeenCalledWith(String(comercioId));
    });

    it('debería borrar los pagos de las reservas purgadas', async () => {
      const reservaId = new Types.ObjectId();
      colecciones['reservas'] = coleccionFalsa();
      colecciones['reservas'].find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ _id: reservaId }]),
      });

      await service.darDeBaja(String(comercioId), { ...params, purgar: true });

      expect(colecciones['pagos'].deleteMany).toHaveBeenCalledWith({ reservaId: { $in: [reservaId] } });
    });
  });

  describe('restaurar', () => {
    it('debería devolver la cuenta en pausa, nunca publicada de golpe', async () => {
      repo.findById.mockResolvedValue({ ...comercioActivo, estado: 'eliminado' } as never);

      await service.restaurar(String(comercioId), 'admin-1');

      expect(repo.actualizarCampos).toHaveBeenCalledWith(String(comercioId), {
        estado: 'inactivo',
        eliminadoAt: undefined,
      });
      expect(colecciones['usuarios'].updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ comercioId }),
        { $set: { activo: true } },
      );
    });

    it('debería rechazar restaurar un comercio que no está dado de baja', async () => {
      await expect(service.restaurar(String(comercioId), 'admin-1')).rejects.toThrow('no está dado de baja');
    });
  });
});
