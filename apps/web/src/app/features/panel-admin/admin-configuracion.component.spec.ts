import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminConfiguracionComponent } from './admin-configuracion.component';

describe('AdminConfiguracionComponent', () => {
  let fixture: ComponentFixture<AdminConfiguracionComponent>;
  let component: AdminConfiguracionComponent;
  let httpMock: HttpTestingController;

  /** Configuración tal y como la devuelve el API. */
  const configuracion = {
    modoMantenimiento: false,
    verticalesActivos: ['alojamiento', 'veterinaria'],
    notificaciones: {
      reserva_confirmada: { email: true, plataforma: true, push: false },
    },
  };

  /** Monta el componente y resuelve la carga inicial con la configuración dada. */
  async function montar(respuesta: unknown = configuracion, fallar = false): Promise<void> {
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url.includes('/configuracion'));
    if (fallar) {
      req.flush('boom', { status: 500, statusText: 'Server Error' });
    } else {
      req.flush(respuesta);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminConfiguracionComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminConfiguracionComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('carga inicial', () => {
    it('debería cargar la configuración y salir del estado de carga', async () => {
      await montar();

      expect(component.config()).toMatchObject({ modoMantenimiento: false });
      expect(component.cargando()).toBe(false);
    });

    it('debería avisar sin romperse si el API falla', async () => {
      await montar(null, true);

      expect(component.errorMsg()).toContain('Error cargando');
      expect(component.cargando()).toBe(false);
    });
  });

  describe('canales de aviso', () => {
    it('debería dar por activos email y plataforma cuando el aviso no tiene fila guardada', async () => {
      // Es el comportamiento previo a que existiera la tabla: no callar avisos
      // que hasta ahora sí se enviaban.
      await montar();

      expect(component.canalActivo('aviso_nuevo', 'email')).toBe(true);
      expect(component.canalActivo('aviso_nuevo', 'plataforma')).toBe(true);
      expect(component.canalActivo('aviso_nuevo', 'push')).toBe(false);
    });

    it('debería respetar la fila guardada cuando existe', async () => {
      await montar();

      expect(component.canalActivo('reserva_confirmada', 'push')).toBe(false);
      expect(component.canalActivo('reserva_confirmada', 'email')).toBe(true);
    });

    it('debería alternar el canal de un aviso ya guardado', async () => {
      await montar();

      component.alternarCanal('reserva_confirmada', 'push');

      expect(component.canalActivo('reserva_confirmada', 'push')).toBe(true);
    });

    it('debería crear la fila al alternar un aviso que no la tenía', async () => {
      await montar();

      component.alternarCanal('aviso_nuevo', 'push');

      expect(component.canalActivo('aviso_nuevo', 'push')).toBe(true);
      expect(component.canalActivo('aviso_nuevo', 'email')).toBe(true);
    });

    it('no debería tocar nada si la configuración aún no ha cargado', () => {
      component.alternarCanal('reserva_confirmada', 'push');

      expect(component.config()).toBeNull();
      httpMock.expectNone(() => true);
    });
  });

  describe('verticales activos', () => {
    it('debería reconocer los verticales ya activos', async () => {
      await montar();

      expect(component.verticalActivo('alojamiento')).toBe(true);
      expect(component.verticalActivo('transporte')).toBe(false);
    });

    it('debería añadir y quitar verticales al alternarlos', async () => {
      await montar();

      component.alternarVertical('transporte');
      expect(component.verticalActivo('transporte')).toBe(true);

      component.alternarVertical('alojamiento');
      expect(component.verticalActivo('alojamiento')).toBe(false);
    });

    it('debería tratar la lista ausente como vacía', async () => {
      await montar({ modoMantenimiento: false });

      expect(component.verticalActivo('alojamiento')).toBe(false);

      component.alternarVertical('alojamiento');
      expect(component.verticalActivo('alojamiento')).toBe(true);
    });
  });

  describe('guardar', () => {
    it('debería enviar la configuración editada y confirmar', async () => {
      await montar();
      component.editar('modoMantenimiento', true);

      const guardado = component.guardar();
      const req = httpMock.expectOne((r) => r.url.includes('/configuracion'));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.modoMantenimiento).toBe(true);
      req.flush({ ...configuracion, modoMantenimiento: true });
      await guardado;

      expect(component.okMsg()).toContain('guardada');
      expect(component.guardando()).toBe(false);
    });

    it('debería avisar si el guardado falla, sin dejar el botón bloqueado', async () => {
      await montar();

      const guardado = component.guardar();
      httpMock
        .expectOne((r) => r.url.includes('/configuracion'))
        .flush('boom', { status: 500, statusText: 'Server Error' });
      await guardado;

      expect(component.errorMsg()).toContain('No se pudo guardar');
      expect(component.guardando()).toBe(false);
    });

    it('no debería llamar al API si no hay configuración cargada', async () => {
      await component.guardar();

      httpMock.expectNone(() => true);
    });
  });
});
