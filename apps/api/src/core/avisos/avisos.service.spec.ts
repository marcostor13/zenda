import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AvisosService } from './avisos.service';
import { AvisoProgramado } from './aviso-programado.schema';
import { PushService } from '../notifications/push.service';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('AvisosService', () => {
  let service: AvisosService;
  let avisoModel: any;
  let pushService: jest.Mocked<Pick<PushService, 'enviarAVarios' | 'contarDestinatarios'>>;
  let coleccion: jest.Mock;

  const ADMIN = '65b0000000000000000000ff';

  const aviso = (extra: Record<string, unknown> = {}) => ({
    _id: 'a1',
    nombre: 'Recordatorio',
    disparador: 'difusion',
    segmento: 'todos',
    titulo: 'Hola',
    cuerpo: 'Mensaje',
    ruta: '/',
    hora: '10:00',
    diasSemana: [],
    diasAntelacion: 3,
    activo: true,
    ...extra,
  });

  /** Devuelve lo que se le pase para cada colección de Mongo que se consulte. */
  const conColeccion = (documentos: unknown[]) => {
    coleccion.mockReturnValue({
      find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue(documentos) }),
    });
  };

  beforeEach(async () => {
    coleccion = jest.fn();
    conColeccion([]);

    avisoModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(aviso()) }),
      findByIdAndDelete: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(aviso()) }),
      create: jest.fn().mockResolvedValue(aviso()),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      db: { collection: coleccion },
    };

    pushService = {
      enviarAVarios: jest.fn().mockResolvedValue({ enviados: 3, desactivados: 0, omitido: false }),
      contarDestinatarios: jest.fn().mockResolvedValue(5),
    };

    const ref = await Test.createTestingModule({
      providers: [
        AvisosService,
        { provide: getModelToken(AvisoProgramado.name), useValue: avisoModel },
        { provide: PushService, useValue: pushService },
      ],
    }).compile();

    service = ref.get(AvisosService);
  });

  describe('enviarAhora', () => {
    it('debería traducir el segmento a los roles que le corresponden', async () => {
      await service.enviarAhora('comercios', { titulo: 'T', cuerpo: 'C' });

      expect(pushService.enviarAVarios).toHaveBeenCalledWith(
        { roles: ['comercio_admin', 'comercio_staff'] },
        expect.objectContaining({ titulo: 'T' }),
      );
    });

    it('debería mandar a todos cuando el segmento no restringe', async () => {
      await service.enviarAhora('todos', { titulo: 'T', cuerpo: 'C' });

      expect(pushService.enviarAVarios).toHaveBeenCalledWith({ roles: undefined }, expect.anything());
    });

    it('debería priorizar los usuarios concretos sobre el segmento', async () => {
      await service.enviarAhora('clientes', { titulo: 'T', cuerpo: 'C' }, ['u1', 'u2']);

      expect(pushService.enviarAVarios).toHaveBeenCalledWith(
        { usuarioIds: ['u1', 'u2'] },
        expect.anything(),
      );
    });

    it('debería informar de cuántos recibieron y cuántos había', async () => {
      const resultado = await service.enviarAhora('todos', { titulo: 'T', cuerpo: 'C' });

      expect(resultado).toEqual({ enviados: 3, destinatarios: 5, omitido: false });
    });
  });

  describe('validación de la hora', () => {
    it('debería rechazar una hora que no sea HH:mm de 24 horas', async () => {
      // Una hora inválida no casaría nunca con el barrido y el aviso quedaría
      // mudo sin que nadie se enterase.
      await expect(service.crear({ hora: '25:00' }, ADMIN)).rejects.toThrow(DomainException);
      await expect(service.crear({ hora: '10:5' }, ADMIN)).rejects.toThrow(DomainException);
    });

    it('debería aceptar una hora válida', async () => {
      await expect(service.crear({ hora: '09:30' }, ADMIN)).resolves.toBeTruthy();
    });

    it('no debería exigir hora cuando no se está cambiando', async () => {
      await expect(service.actualizar('a1', { activo: false }, ADMIN)).resolves.toBeTruthy();
    });
  });

  describe('ejecutarAhora', () => {
    it('debería fallar con 404 si el aviso no existe', async () => {
      await expect(service.ejecutarAhora('no-existe')).rejects.toThrow('no encontrado');
    });

    it('debería enviar una difusión sin condiciones', async () => {
      avisoModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(aviso()) });

      const resultado = await service.ejecutarAhora('a1');

      expect(resultado.enviados).toBe(3);
      expect(avisoModel.updateOne).toHaveBeenCalled();
    });

    it('no debería enviar nada si hoy nadie cumple la condición', async () => {
      // Es el caso normal la mayoría de los días: no es un fallo.
      avisoModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aviso({ disparador: 'pago_pendiente' })),
      });
      conColeccion([]);

      const resultado = await service.ejecutarAhora('a1');

      expect(resultado).toEqual({ enviados: 0, destinatarios: 0, omitido: false });
      expect(pushService.enviarAVarios).not.toHaveBeenCalled();
    });

    it('debería avisar sólo a quien tiene una reserva sin pagar', async () => {
      avisoModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aviso({ disparador: 'pago_pendiente' })),
      });
      conColeccion([{ usuarioId: 'u1' }, { usuarioId: 'u2' }, { usuarioId: 'u1' }]);

      await service.ejecutarAhora('a1');

      // El mismo usuario con dos reservas pendientes recibe un aviso, no dos.
      expect(pushService.enviarAVarios).toHaveBeenCalledWith(
        { usuarioIds: ['u1', 'u2'] },
        expect.anything(),
      );
    });
  });

  describe('revisarProgramados', () => {
    it('debería buscar sólo los avisos activos de la hora en curso', async () => {
      await service.revisarProgramados();

      const filtro = avisoModel.find.mock.calls[0][0];
      expect(filtro.activo).toBe(true);
      expect(filtro.hora).toMatch(/^\d{2}:\d{2}$/);
    });

    it('debería saltarse un aviso que no toca hoy', async () => {
      // diasSemana con un único día que no es hoy.
      const otroDia = (new Date().getDay() + 3) % 7;
      avisoModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([aviso({ diasSemana: [otroDia] })]),
      });

      await service.revisarProgramados();

      expect(pushService.enviarAVarios).not.toHaveBeenCalled();
    });

    it('no debería repetir un aviso que ya salió en este mismo minuto', async () => {
      // Dos instancias del API comparten base: sin este guard enviarían dos veces.
      avisoModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([aviso({ ultimaEjecucion: new Date() })]),
      });

      await service.revisarProgramados();

      expect(pushService.enviarAVarios).not.toHaveBeenCalled();
    });

    it('no debería tumbarse si un aviso falla', async () => {
      avisoModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([aviso()]),
      });
      pushService.enviarAVarios.mockRejectedValue(new Error('FCM caído'));

      await expect(service.revisarProgramados()).resolves.toBeUndefined();
    });
  });
});
