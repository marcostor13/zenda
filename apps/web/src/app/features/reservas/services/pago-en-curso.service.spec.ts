import { TestBed } from '@angular/core/testing';
import { PagoEnCursoService } from './pago-en-curso.service';
import { PaymentsService } from './payments.service';

const CLAVE = 'doogking_pago_en_curso';

describe('PagoEnCursoService', () => {
  let service: PagoEnCursoService;
  let payments: { sincronizar: jest.Mock };

  beforeEach(() => {
    sessionStorage.clear();
    payments = { sincronizar: jest.fn().mockResolvedValue({ estado: 'aprobado' }) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PagoEnCursoService,
        { provide: PaymentsService, useValue: payments },
      ],
    });
    service = TestBed.inject(PagoEnCursoService);
  });

  it('debería recordar el pago entre recargas de la página', () => {
    // Es lo único que sobrevive a que Stripe se lleve el navegador fuera.
    service.anotar('pago-1');

    expect(sessionStorage.getItem(CLAVE)).toBe('pago-1');
    expect(service.pendiente()).toBe('pago-1');
  });

  it('debería olvidar el pago cuando se le pide', () => {
    service.anotar('pago-1');

    service.olvidar();

    expect(service.pendiente()).toBeNull();
  });

  it('no debería inventarse un pago cuando no hay ninguno anotado', () => {
    expect(service.pendiente()).toBeNull();
  });

  describe('sincronizar()', () => {
    it('debería dar por confirmado un pago aprobado', async () => {
      await expect(service.sincronizar('pago-1')).resolves.toBe(true);
      expect(payments.sincronizar).toHaveBeenCalledWith('pago-1');
    });

    it('no debería dar por confirmado un pago que la pasarela deja pendiente', async () => {
      payments.sincronizar.mockResolvedValue({ estado: 'pendiente' });

      await expect(service.sincronizar('pago-1')).resolves.toBe(false);
    });

    it('no debería prometer una confirmación si la consulta falla', async () => {
      // El webhook sigue de respaldo; lo que no se puede es enseñar
      // «confirmada» y que el listado diga «pendiente».
      payments.sincronizar.mockRejectedValue(new Error('sin red'));

      await expect(service.sincronizar('pago-1')).resolves.toBe(false);
    });
  });

  describe('cerrarPendiente()', () => {
    it('debería cerrar el pago anotado y borrar el apunte', async () => {
      service.anotar('pago-1');

      await expect(service.cerrarPendiente()).resolves.toBe(true);
      expect(payments.sincronizar).toHaveBeenCalledWith('pago-1');
      expect(service.pendiente()).toBeNull();
    });

    it('no debería llamar al API si no hay ningún pago a medias', async () => {
      await expect(service.cerrarPendiente()).resolves.toBe(false);
      expect(payments.sincronizar).not.toHaveBeenCalled();
    });

    it('debería borrar el apunte aunque el cobro no llegue a confirmarse', async () => {
      // Dejarlo haría que la siguiente pantalla reintentara un pago viejo.
      payments.sincronizar.mockResolvedValue({ estado: 'rechazado' });
      service.anotar('pago-1');

      await expect(service.cerrarPendiente()).resolves.toBe(false);
      expect(service.pendiente()).toBeNull();
    });
  });

  describe('sin almacenamiento disponible', () => {
    /* Navegación privada o cuota llena: el pago sigue su curso sin el atajo. */
    const romperSessionStorage = (): jest.SpyInstance[] => [
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); }),
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); }),
      jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('bloqueado'); }),
    ];

    afterEach(() => jest.restoreAllMocks());

    it('no debería romper al anotar, leer ni olvidar', () => {
      romperSessionStorage();

      expect(() => service.anotar('pago-1')).not.toThrow();
      expect(service.pendiente()).toBeNull();
      expect(() => service.olvidar()).not.toThrow();
    });
  });
});
