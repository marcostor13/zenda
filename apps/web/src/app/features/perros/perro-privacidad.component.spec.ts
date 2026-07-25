import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TipoHistorial, VerticalKey } from 'shared';
import { PerroPrivacidadComponent } from './perro-privacidad.component';
import { ConsentimientoApi, PerrosService } from './perros.service';

const consentimiento = (
  tipoHistorial: TipoHistorial,
  verticalDestino: VerticalKey,
  concedido: boolean,
): ConsentimientoApi => ({ _id: `${tipoHistorial}-${verticalDestino}`, tipoHistorial, verticalDestino, concedido });

describe('PerroPrivacidadComponent', () => {
  let fixture: ComponentFixture<PerroPrivacidadComponent>;
  let componente: PerroPrivacidadComponent;
  let perrosService: jest.Mocked<
    Pick<PerrosService, 'obtener' | 'consentimientos' | 'fijarConsentimiento' | 'revocarTodos'>
  >;

  const crear = async (consentimientos: ConsentimientoApi[] = []): Promise<void> => {
    perrosService = {
      obtener: jest.fn().mockResolvedValue({ _id: 'p1', nombre: 'Maya' }),
      consentimientos: jest.fn().mockResolvedValue(consentimientos),
      fijarConsentimiento: jest.fn().mockImplementation((_id, dto) =>
        Promise.resolve(consentimiento(dto.tipoHistorial, dto.verticalDestino, dto.concedido)),
      ),
      revocarTodos: jest.fn().mockResolvedValue({ revocados: 1 }),
    };

    await TestBed.configureTestingModule({
      imports: [PerroPrivacidadComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PerrosService, useValue: perrosService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerroPrivacidadComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('no debería compartir nada por defecto', async () => {
    await crear();

    expect(componente.estaConcedido(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA)).toBe(false);
    expect(componente.hayAlgunoConcedido()).toBe(false);
  });

  it('debería marcar como propio el vertical que genera cada historial', async () => {
    await crear();

    expect(componente.esOrigen(TipoHistorial.VETERINARIO, VerticalKey.VETERINARIA)).toBe(true);
    expect(componente.esOrigen(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA)).toBe(false);
  });

  it('debería reflejar un permiso ya concedido', async () => {
    await crear([consentimiento(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA, true)]);

    expect(componente.estaConcedido(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA)).toBe(true);
  });

  it('debería conceder el acceso al activar la casilla', async () => {
    await crear();

    await componente.alternar(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA);

    expect(perrosService.fijarConsentimiento).toHaveBeenCalledWith('p1', {
      tipoHistorial: TipoHistorial.VETERINARIO,
      verticalDestino: VerticalKey.PELUQUERIA,
      concedido: true,
    });
    expect(componente.estaConcedido(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA)).toBe(true);
  });

  it('debería revocar el acceso al desactivar la casilla', async () => {
    await crear([consentimiento(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA, true)]);

    await componente.alternar(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA);

    expect(perrosService.fijarConsentimiento).toHaveBeenCalledWith(
      'p1', expect.objectContaining({ concedido: false }),
    );
    expect(componente.estaConcedido(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA)).toBe(false);
  });

  it('debería revocar todos los permisos de una vez', async () => {
    await crear([
      consentimiento(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA, true),
      consentimiento(TipoHistorial.CONDUCTA, VerticalKey.ALOJAMIENTO, true),
    ]);

    await componente.revocarTodo();

    expect(perrosService.revocarTodos).toHaveBeenCalledWith('p1');
    expect(componente.hayAlgunoConcedido()).toBe(false);
  });

  it('debería avisar si no se pudo guardar el cambio', async () => {
    await crear();
    perrosService.fijarConsentimiento.mockRejectedValue(new Error('red caída'));

    await componente.alternar(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA);

    expect(componente.mensaje()).toContain('No se pudo guardar');
    expect(componente.estaConcedido(TipoHistorial.VETERINARIO, VerticalKey.PELUQUERIA)).toBe(false);
  });
});
