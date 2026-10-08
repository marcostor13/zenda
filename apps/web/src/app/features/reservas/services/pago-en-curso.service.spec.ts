import { TestBed } from '@angular/core/testing';
import { PagoEnCursoService, vaConRetraso } from './pago-en-curso.service';
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

  describe('consultar()', () => {
    it.each([
      ['aprobado', 'aprobado'],
      // Pagado, a la espera del banco: no es lo mismo que no haber pagado.
      ['procesando', 'procesando'],
      // Canceló en su banco o falló la autenticación: no hay cobro.
      ['pendiente', 'no_cobrado'],
      ['rechazado', 'no_cobrado'],
    ])('debería traducir «%s» del servidor a «%s»', async (estado, esperado) => {
      payments.sincronizar.mockResolvedValue({ estado });

      await expect(service.consultar('pago-1')).resolves.toBe(esperado);
    });

    it('no debería afirmar ni que pagó ni que no si la consulta falla', async () => {
      payments.sincronizar.mockRejectedValue(new Error('sin red'));

      await expect(service.consultar('pago-1')).resolves.toBe('desconocido');
    });
  });

  describe('resolverPendiente()', () => {
    it('debería cerrar el pago anotado y borrar el apunte', async () => {
      service.anotar('pago-1');

      await expect(service.resolverPendiente()).resolves.toBe('aprobado');
      expect(payments.sincronizar).toHaveBeenCalledWith('pago-1');
      expect(service.pendiente()).toBeNull();
    });

    it('no debería llamar al API si no hay ningún pago a medias', async () => {
      await expect(service.resolverPendiente()).resolves.toBeNull();
      expect(payments.sincronizar).not.toHaveBeenCalled();
    });

    it('debería borrar el apunte aunque el cobro no llegue a hacerse', async () => {
      // Dejarlo haría que la siguiente pantalla reintentara un pago viejo.
      payments.sincronizar.mockResolvedValue({ estado: 'rechazado' });
      service.anotar('pago-1');

      await expect(service.resolverPendiente()).resolves.toBe('no_cobrado');
      expect(service.pendiente()).toBeNull();
    });
  });

  describe('vaConRetraso()', () => {
    it('debería avisar de retraso sólo cuando el cobro está hecho o no se sabe', () => {
      expect(vaConRetraso('procesando')).toBe(true);
      expect(vaConRetraso('desconocido')).toBe(true);
      expect(vaConRetraso('aprobado')).toBe(false);
      expect(vaConRetraso('no_cobrado')).toBe(false);
      expect(vaConRetraso(null)).toBe(false);
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
