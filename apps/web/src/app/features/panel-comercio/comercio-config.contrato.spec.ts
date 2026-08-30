import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarPerfilComercioDto, VerticalKey } from 'shared';
import { ComercioConfigComponent } from './comercio-config.component';
import { ComercioApiService, MiComercio } from './comercio-api.service';

/**
 * Contrato entre el panel del comercio y el API.
 *
 * El API valida con `whitelist` y `forbidNonWhitelisted`, así que un campo que
 * el panel envíe y el DTO no declare **tumba la petición entera con un 400**. Ya
 * ocurrió tres veces seguidas en producción: con `documentos`, con `abre2` y con
 * `cierra2`. Cada `guardar*` se probaba por separado con dobles, y ninguno de
 * esos tests podía ver el desajuste porque el doble acepta lo que le den.
 *
 * Aquí se toma el payload **real** que arma cada sección del panel y se pasa por
 * la validación **real** del DTO. Si alguien añade un campo al formulario y se
 * olvida del DTO, falla aquí y no delante del cliente.
 */
describe('ComercioConfigComponent — contrato con el API', () => {
  let componente: ComercioConfigComponent;
  let api: Record<string, jest.Mock>;

  const miComercio = (extra: Partial<MiComercio> = {}): MiComercio => ({
    _id: 'c1', nombreComercial: 'Canes', razonSocial: 'Canes SL', vatNumber: 'ESB12345678',
    verticales: [VerticalKey.ALOJAMIENTO], plan: 'basico', estado: 'activo',
    ...extra,
  } as MiComercio);

  beforeEach(async () => {
    api = {
      getMiComercio: jest.fn().mockReturnValue(of(miComercio())),
      getMisServicios: jest.fn().mockReturnValue(of([])),
      actualizarComercio: jest.fn().mockReturnValue(of(miComercio())),
    };

    await TestBed.configureTestingModule({
      imports: [ComercioConfigComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ComercioConfigComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  /** Valida el último payload enviado igual que lo haría el ValidationPipe. */
  async function erroresDelUltimoEnvio(): Promise<string[]> {
    const payload = api['actualizarComercio'].mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(payload).toBeDefined();

    const dto = plainToInstance(ActualizarPerfilComercioDto, payload);
    const fallos = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: false,
    });

    return fallos.flatMap(function aplanar(f): string[] {
      const propios = Object.values(f.constraints ?? {});
      return [...propios, ...(f.children ?? []).flatMap(aplanar)];
    });
  }

  it('el perfil del negocio', async () => {
    componente.infoForm.patchValue({
      nombreComercial: 'Residencia Royal',
      descripcion: 'Suites con jardín.',
    });

    await componente.guardarInfo();

    await expect(erroresDelUltimoEnvio()).resolves.toEqual([]);
  });

  it('los datos fiscales', async () => {
    // Faltaban en el DTO: el panel no tenía dónde ponerlos y el paso "Datos
    // fiscales (CIF/NIF)" quedaba pendiente para siempre.
    componente.infoForm.patchValue({
      nombreComercial: 'Villa Perruna',
      razonSocial: 'Villa Perruna S.L.',
      vatNumber: 'B12345678',
    });

    await componente.guardarInfo();

    await expect(erroresDelUltimoEnvio()).resolves.toEqual([]);
    expect(api['actualizarComercio'].mock.calls.at(-1)![0]).toMatchObject({
      razonSocial: 'Villa Perruna S.L.',
      vatNumber: 'B12345678',
    });
  });

  it('el contacto', async () => {
    componente.contactoForm.patchValue({
      nombreContacto: 'Ana', email: 'ana@royal.test', telefono: '600000000', whatsapp: '600000000',
    });

    await componente.guardarContacto();

    await expect(erroresDelUltimoEnvio()).resolves.toEqual([]);
  });

  it('las categorías de servicio', async () => {
    // El caso que faltaba: el paso "Servicios que ofreces" no podía guardar
    // porque `verticales` no estaba declarado en el DTO.
    componente.alternarVertical(VerticalKey.PELUQUERIA);

    await componente.guardarVerticales();

    await expect(erroresDelUltimoEnvio()).resolves.toEqual([]);
  });

  it('debería rechazar quedarse sin ninguna categoría', async () => {
    const dto = plainToInstance(ActualizarPerfilComercioDto, { verticales: [] });
    const fallos = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(fallos.flatMap((f) => Object.values(f.constraints ?? {})))
      .toContain('Marca al menos una categoría de servicio');
  });

  it('los datos bancarios', async () => {
    componente.datosBancariosForm.patchValue({
      titular: 'Canes SL', iban: 'ES9121000418450200051332', banco: 'CaixaBank', swift: 'CAIXESBB',
    });

    await componente.guardarDatosBancarios();

    await expect(erroresDelUltimoEnvio()).resolves.toEqual([]);
  });

});
