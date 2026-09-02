import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { VerticalKey } from 'shared';
import { ComercioAltaComponent } from './comercio-alta.component';
import { ComercioApiService, MiComercio, ActualizarPerfilComercioPayload } from './comercio-api.service';

const miComercio = (extra: Partial<MiComercio> = {}): MiComercio => ({
  _id: 'c1', nombreComercial: 'Canes', razonSocial: '', vatNumber: '',
  verticales: [VerticalKey.ALOJAMIENTO, VerticalKey.PELUQUERIA],
  plan: 'basico', estado: 'activo',
  ...extra,
} as MiComercio);

describe('ComercioAltaComponent', () => {
  let fixture: ComponentFixture<ComercioAltaComponent>;
  let componente: ComercioAltaComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (
    comercio: MiComercio | Error = miComercio(),
    servicios: unknown[] = [],
  ): Promise<void> => {
    // El asistente recuerda por dónde iba; sin limpiar, una prueba arrastraría
    // el recorrido de la anterior.
    localStorage.clear();
    api = {
      getMiComercio: jest.fn().mockReturnValue(
        comercio instanceof Error ? throwError(() => comercio) : of(comercio),
      ),
      getMisServicios: jest.fn().mockReturnValue(of(servicios)),
      actualizarComercio: jest.fn().mockReturnValue(of(miComercio())),
    };

    await TestBed.configureTestingModule({
      imports: [ComercioAltaComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioAltaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const ultimoPayload = (): ActualizarPerfilComercioPayload =>
    api['actualizarComercio'].mock.calls.at(-1)?.[0] as ActualizarPerfilComercioPayload;

  /** Deja el formulario del último paso en condiciones de enviarse. */
  const rellenarNegocio = (): void => {
    componente.negocioForm.patchValue({
      nombreComercial: 'Canes Premium',
      email: 'hola@canes.com',
      operaLegalmente: true,
      condicionesGenerales: true,
    });
  };

  describe('elección del servicio', () => {
    it('debería ofrecer sólo las categorías que el negocio marcó al registrarse', async () => {
      // Enseñarle aquí las siete contradiría lo que acaba de elegir en el alta.
      await crear();

      expect(componente.opciones().map((o) => o.key))
        .toEqual([VerticalKey.ALOJAMIENTO, VerticalKey.PELUQUERIA]);
    });

    it('debería empezar en la elección cuando hay varias categorías', async () => {
      await crear();

      expect(componente.paso()).toBe('elegir');
    });

    it('debería saltarse la elección si el negocio sólo tiene una categoría', async () => {
      // Una sola opción no es una elección: preguntarla es un paso de más.
      await crear(miComercio({ verticales: [VerticalKey.VETERINARIA] }));

      expect(componente.paso()).toBe('servicio');
      expect(componente.elegido()).toBe(VerticalKey.VETERINARIA);
    });

    it('debería guardar la categoría elegida', async () => {
      await crear();

      componente.elegir(VerticalKey.PELUQUERIA);

      expect(componente.elegido()).toBe(VerticalKey.PELUQUERIA);
    });
  });

  describe('retomar el alta', () => {
    it('no debería repetir la ficha si ya hay un servicio creado', async () => {
      // Repetirla le crearía un duplicado al que vuelve a entrar; se le deja en
      // la bifurcación, desde donde puede añadir otro o cerrar el alta.
      await crear(miComercio(), [{ _id: 's1' }]);

      expect(componente.paso()).toBe('creado');
    });

    it('debería dejar vacío el nombre provisional del alta rápida', async () => {
      // El registro deja «Negocio de Ana» porque el documento no puede quedarse
      // sin nombre; presentarlo relleno invitaría a darlo por bueno.
      await crear(miComercio({ nombreComercial: 'Negocio de Ana Torres' }), [{ _id: 's1' }]);

      expect(componente.negocioForm.getRawValue().nombreComercial).toBe('');
    });

    it('debería dejar vacía la razón social provisional', async () => {
      // Las altas antiguas copiaron el provisional también aquí; enseñarlo
      // escrito lo daba por bueno de vuelta al guardar.
      await crear(miComercio({
        nombreComercial: 'Negocio de Ana Torres',
        razonSocial: 'Negocio de Ana Torres',
      } as Partial<MiComercio>), [{ _id: 's1' }]);

      expect(componente.negocioForm.getRawValue().razonSocial).toBe('');
    });

    it('debería conservar la razón social que el comercio ya declaró', async () => {
      await crear(miComercio({
        nombreComercial: 'Canes Premium',
        razonSocial: 'Canes Premium S.L.',
      } as Partial<MiComercio>), [{ _id: 's1' }]);

      expect(componente.negocioForm.getRawValue().razonSocial).toBe('Canes Premium S.L.');
    });

    it('debería conservar el nombre que el comercio ya eligió', async () => {
      await crear(miComercio({ nombreComercial: 'Canes Premium' }), [{ _id: 's1' }]);

      expect(componente.negocioForm.getRawValue().nombreComercial).toBe('Canes Premium');
    });

    it('debería precargar lo que el negocio ya tenía puesto', async () => {
      await crear(miComercio({
        vatNumber: 'B12345678',
        contacto: { email: 'hola@canes.com', telefono: '600000000' },
        consentimientos: { condicionesGenerales: { aceptado: true } },
      } as Partial<MiComercio>), [{ _id: 's1' }]);

      expect(componente.negocioForm.getRawValue()).toMatchObject({
        vatNumber: 'B12345678',
        email: 'hola@canes.com',
        condicionesGenerales: true,
      });
    });

    it('debería avisar si el negocio no carga', async () => {
      await crear(new Error('500'));

      expect(componente.error()).toContain('No pudimos cargar');
    });
  });

  /**
   * Un negocio con varias categorías tiene que poder publicarlas de una
   * sentada: obligarle a terminar el alta y volver a entrar por el panel para
   * la segunda es perder el impulso con el que ha llegado.
   */
  describe('añadir más de un servicio', () => {
    it('debería parar en la bifurcación al crear uno, no saltar al negocio', async () => {
      await crear();
      componente.elegir(VerticalKey.ALOJAMIENTO);

      componente.servicioCreado();

      expect(componente.paso()).toBe('creado');
      expect(componente.serviciosCreados()).toBe(1);
    });

    it('debería volver a la elección de categoría al añadir otro', async () => {
      await crear();
      componente.elegir(VerticalKey.ALOJAMIENTO);
      componente.servicioCreado();

      componente.anadirOtroServicio();

      expect(componente.paso()).toBe('elegir');
      // Sin limpiar la elección, el formulario arrancaría con la anterior.
      expect(componente.elegido()).toBeNull();
    });

    it('debería saltarse la elección si el negocio sólo tiene una categoría', async () => {
      await crear(miComercio({ verticales: [VerticalKey.VETERINARIA] }));
      componente.servicioCreado();

      componente.anadirOtroServicio();

      expect(componente.paso()).toBe('servicio');
      expect(componente.elegido()).toBe(VerticalKey.VETERINARIA);
    });

    it('debería ir contando los servicios creados', async () => {
      await crear();
      componente.servicioCreado();
      componente.servicioCreado();

      expect(componente.serviciosCreados()).toBe(2);
    });

    it('debería poder seguir al negocio desde la bifurcación', async () => {
      await crear();
      componente.servicioCreado();

      componente.paso.set('negocio');

      expect(componente.paso()).toBe('negocio');
    });

    it('debería contar los que ya tenía al retomar el alta', async () => {
      await crear(miComercio(), [{ _id: 's1' }, { _id: 's2' }]);

      expect(componente.serviciosCreados()).toBe(2);
      expect(componente.paso()).toBe('creado');
    });

    it('no debería retroceder la barra de avance en la bifurcación', async () => {
      // «Creado» es el remate del paso del servicio, no un paso más.
      await crear();
      componente.elegir(VerticalKey.ALOJAMIENTO);
      componente.paso.set('servicio');
      const enServicio = componente.indicePaso();

      componente.servicioCreado();

      expect(componente.indicePaso()).toBe(enServicio);
    });
  });

  describe('cierre del alta', () => {
    it('debería exigir las dos casillas antes de terminar', async () => {
      await crear(miComercio(), [{ _id: 's1' }]);
      componente.negocioForm.patchValue({ email: 'hola@canes.com' });

      await componente.finalizar();

      expect(api['actualizarComercio']).not.toHaveBeenCalled();
      expect(componente.faltanAcuerdos()).toBe(true);
    });

    it('no debería avisar de las casillas antes de intentarlo', async () => {
      // Regañar antes de tiempo con algo que aún no se ha pedido sobra.
      await crear(miComercio(), [{ _id: 's1' }]);

      expect(componente.faltanAcuerdos()).toBe(false);
    });

    it('no debería terminar sin el nombre del negocio', async () => {
      // Es lo que ve el cliente en la ficha: sin él no hay nada que publicar.
      await crear(miComercio(), [{ _id: 's1' }]);
      componente.negocioForm.patchValue({
        nombreComercial: '', email: 'hola@canes.com',
        operaLegalmente: true, condicionesGenerales: true,
      });

      await componente.finalizar();

      expect(api['actualizarComercio']).not.toHaveBeenCalled();
    });

    it('debería enviar el nombre del negocio al terminar', async () => {
      await crear(miComercio(), [{ _id: 's1' }]);
      rellenarNegocio();

      await componente.finalizar();

      expect(ultimoPayload().nombreComercial).toBe('Canes Premium');
    });

    it('no debería terminar sin un email de contacto válido', async () => {
      await crear(miComercio(), [{ _id: 's1' }]);
      componente.negocioForm.patchValue({
        email: 'no-es-un-email', operaLegalmente: true, condicionesGenerales: true,
      });

      await componente.finalizar();

      expect(api['actualizarComercio']).not.toHaveBeenCalled();
    });

    it('debería marcar el alta como completada al terminar', async () => {
      await crear(miComercio(), [{ _id: 's1' }]);
      rellenarNegocio();

      await componente.finalizar();

      expect(ultimoPayload().altaCompletada).toBe(true);
      expect(componente.paso()).toBe('fin');
    });

    it('debería enviar sólo el "sí" de cada consentimiento', async () => {
      // La fecha y la versión las sella el servidor: si las mandara el cliente,
      // la prueba de consentimiento no valdría nada.
      await crear(miComercio(), [{ _id: 's1' }]);
      rellenarNegocio();

      await componente.finalizar();

      expect(ultimoPayload().consentimientos)
        .toEqual({ operaLegalmente: true, condicionesGenerales: true });
    });

    it('debería mandar los campos vacíos como undefined, no como cadena vacía', async () => {
      // Un '' borraría el CIF ya guardado y chocaría con el índice único.
      await crear(miComercio(), [{ _id: 's1' }]);
      rellenarNegocio();

      await componente.finalizar();

      expect(ultimoPayload().vatNumber).toBeUndefined();
      expect(ultimoPayload().razonSocial).toBeUndefined();
    });

    it('debería avisar del fallo sin dejar el botón bloqueado', async () => {
      await crear(miComercio(), [{ _id: 's1' }]);
      componente.paso.set('negocio');
      rellenarNegocio();
      api['actualizarComercio'].mockReturnValue(throwError(() => new Error('500')));

      await componente.finalizar();

      expect(componente.error()).toContain('No pudimos guardar');
      expect(componente.guardando()).toBe(false);
      // Se queda donde estaba: avanzar sobre un error escondería el mensaje.
      expect(componente.paso()).toBe('negocio');
    });
  });

  describe('continuar más tarde', () => {
    it('debería guardar lo escrito sin exigir nada', async () => {
      // El sentido del botón es no tener que rellenar todavía; tirar lo ya
      // escrito castigaría al que empezó de buena fe.
      await crear(miComercio(), [{ _id: 's1' }]);
      componente.negocioForm.patchValue({ vatNumber: 'B12345678' });

      await componente.continuarMasTarde();

      expect(ultimoPayload().vatNumber).toBe('B12345678');
      expect(componente.paso()).toBe('fin');
    });

    it('debería dejar el alta sin cerrar', async () => {
      await crear(miComercio(), [{ _id: 's1' }]);

      await componente.continuarMasTarde();

      expect(ultimoPayload().altaCompletada).toBe(false);
    });

    it('debería cerrar con un texto que no felicita por algo a medias', async () => {
      await crear(miComercio(), [{ _id: 's1' }]);

      await componente.continuarMasTarde();

      expect(componente.tituloFin()).toContain('cuando puedas');
      expect(componente.textoFin()).toContain('borrador');
    });
  });
});
