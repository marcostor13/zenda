import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ImpactoBajaComercioDto, MotivoBajaComercio } from 'shared';
import { ComercioCuentaComponent } from './comercio-cuenta.component';
import { ComercioApiService, MiComercio } from './comercio-api.service';
import { AuthService } from '../../core/auth/auth.service';

const comercio = (extra: Partial<MiComercio> = {}): MiComercio =>
  ({ _id: 'c1', nombreComercial: 'Peluquería Luna', estado: 'activo', ...extra }) as MiComercio;

const impacto = (extra: Partial<ImpactoBajaComercioDto> = {}): ImpactoBajaComercioDto => ({
  servicios: 3, serviciosPublicados: 2, usuarios: 2, reservas: 12, reservasActivas: 0,
  resenas: 5, puedeDarseDeBaja: true, ...extra,
});

describe('ComercioCuentaComponent', () => {
  let fixture: ComponentFixture<ComercioCuentaComponent>;
  let componente: ComercioCuentaComponent;
  let api: Record<string, jest.Mock>;
  let auth: { logout: jest.Mock };

  const crear = async (ajustes: Record<string, jest.Mock> = {}): Promise<void> => {
    api = {
      getMiComercio: jest.fn().mockReturnValue(of(comercio())),
      getImpactoCuenta: jest.fn().mockReturnValue(of(impacto())),
      pausarCuenta: jest.fn().mockReturnValue(of(comercio({ estado: 'inactivo' }))),
      reactivarCuenta: jest.fn().mockReturnValue(of(comercio({ estado: 'activo' }))),
      darDeBajaCuenta: jest.fn().mockReturnValue(of({ comercioId: 'c1', purgado: false })),
      ...ajustes,
    };
    auth = { logout: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [ComercioCuentaComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioCuentaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('debería cargar el estado de la cuenta y su impacto', async () => {
    await crear();

    expect(componente.comercio()?.estado).toBe('activo');
    expect(componente.impacto()?.reservas).toBe(12);
  });

  describe('pausa', () => {
    it('debería pausar la cuenta con el motivo elegido', async () => {
      await crear();
      componente.abrir('pausar');
      componente.motivo.set(MotivoBajaComercio.PAUSA_TEMPORADA);
      componente.reactivarEl.set('2026-09-01');

      await componente.confirmar();

      expect(api['pausarCuenta']).toHaveBeenCalledWith({
        motivo: MotivoBajaComercio.PAUSA_TEMPORADA,
        comentario: undefined,
        reactivarEl: '2026-09-01',
      });
      expect(componente.comercio()?.estado).toBe('inactivo');
    });

    it('debería reactivar la cuenta sin pedir nada más', async () => {
      await crear({ getMiComercio: jest.fn().mockReturnValue(of(comercio({ estado: 'inactivo' }))) });

      await componente.reactivar();

      expect(api['reactivarCuenta']).toHaveBeenCalled();
      expect(componente.comercio()?.estado).toBe('activo');
    });
  });

  describe('baja', () => {
    it('debería exigir escribir el nombre del negocio antes de cerrar la cuenta', async () => {
      await crear();
      componente.abrir('baja');
      componente.motivo.set(MotivoBajaComercio.CIERRE_NEGOCIO);

      expect(componente.puedeConfirmar()).toBe(false);

      componente.confirmacion.set('  peluquería luna  ');
      expect(componente.puedeConfirmar()).toBe(true);
    });

    it('debería exigir comentario en los motivos que no dicen nada por sí solos', async () => {
      await crear();
      componente.abrir('baja');
      componente.motivo.set(MotivoBajaComercio.OTRO);
      componente.confirmacion.set('Peluquería Luna');

      expect(componente.puedeConfirmar()).toBe(false);

      componente.comentario.set('me mudo de ciudad');
      expect(componente.puedeConfirmar()).toBe(true);
    });

    it('debería cerrar sesión y volver a la home tras darse de baja', async () => {
      await crear();
      const router = TestBed.inject(Router);
      const navegar = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      componente.abrir('baja');
      componente.motivo.set(MotivoBajaComercio.CIERRE_NEGOCIO);
      componente.confirmacion.set('Peluquería Luna');

      await componente.confirmar();

      expect(api['darDeBajaCuenta']).toHaveBeenCalledWith(
        expect.objectContaining({ motivo: MotivoBajaComercio.CIERRE_NEGOCIO, confirmacion: 'Peluquería Luna' }),
      );
      expect(auth.logout).toHaveBeenCalled();
      expect(navegar).toHaveBeenCalledWith(['/'], { queryParams: { baja: 'comercio' } });
    });

    it('debería enseñar el motivo real que devuelve el API cuando la baja se rechaza', async () => {
      await crear({
        darDeBajaCuenta: jest.fn().mockReturnValue(
          throwError(() => ({ error: { message: 'No se puede dar de baja: hay 2 reserva(s) en curso.' } })),
        ),
      });
      componente.abrir('baja');
      componente.motivo.set(MotivoBajaComercio.CIERRE_NEGOCIO);
      componente.confirmacion.set('Peluquería Luna');

      await componente.confirmar();

      expect(componente.errorModal()).toContain('2 reserva(s) en curso');
    });

    it('no debería dejar abrir la baja con reservas vivas', async () => {
      await crear({
        getImpactoCuenta: jest.fn().mockReturnValue(of(impacto({ reservasActivas: 2, puedeDarseDeBaja: false }))),
      });

      expect(componente.impacto()?.puedeDarseDeBaja).toBe(false);
      const boton = fixture.nativeElement.querySelector('.rs-btn--danger') as HTMLButtonElement;
      expect(boton.disabled).toBe(true);
    });
  });
});
