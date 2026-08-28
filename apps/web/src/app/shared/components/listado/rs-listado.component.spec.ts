import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { VerticalKey } from 'shared';
import { RsListadoComponent } from './rs-listado.component';

describe('RsListadoComponent', () => {
  let fixture: ComponentFixture<RsListadoComponent>;
  let component: RsListadoComponent;
  let documento: Document;

  const montar = (): void => {
    fixture = TestBed.createComponent(RsListadoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('titulo', 'Alojamientos en Valencia');
    fixture.componentRef.setInput('vertical', VerticalKey.ALOJAMIENTO);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsListadoComponent] }).compileComponents();
    documento = TestBed.inject(DOCUMENT);
    documento.body.classList.remove('rs-sin-scroll');
  });

  describe('panel de filtros', () => {
    /*
     * En móvil el panel ocupa la pantalla entera: si el fondo sigue rodando, al
     * arrastrar dentro del panel se movía la lista de detrás.
     */
    it('debería bloquear el scroll del fondo mientras está abierto', () => {
      montar();

      component.abrirFiltros();
      fixture.detectChanges();
      expect(documento.body.classList.contains('rs-sin-scroll')).toBe(true);

      component.cerrarFiltros();
      fixture.detectChanges();
      expect(documento.body.classList.contains('rs-sin-scroll')).toBe(false);
    });

    it('debería cerrarse con Escape', () => {
      montar();
      component.abrirFiltros();

      component.alEscape();

      expect(component.filtrosAbiertos()).toBe(false);
    });

    it('no debería hacer nada con Escape si ya está cerrado', () => {
      montar();

      component.alEscape();

      expect(component.filtrosAbiertos()).toBe(false);
    });
  });

  describe('chips de filtros aplicados', () => {
    it('no debería pintar ninguno sin filtros', () => {
      montar();

      expect(component.chipsActivos()).toEqual([]);
      expect(component.numFiltrosActivos()).toBe(0);
    });

    it('debería resumir el precio máximo en euros', () => {
      montar();

      component.alCambiarFiltros({ vertical: {}, precioMax: 80 });

      expect(component.chipsActivos()[0]).toMatchObject({ id: 'precio', tipo: 'precio' });
      expect(component.chipsActivos()[0].etiqueta).toContain('80');
    });

    it('debería resumir la valoración mínima', () => {
      montar();

      component.alCambiarFiltros({ vertical: {}, ratingMin: 4 });

      expect(component.chipsActivos()).toEqual([
        { id: 'rating', tipo: 'rating', etiqueta: '4.0 o más' },
      ]);
    });

    it('debería pintar un chip por servicio elegido', () => {
      montar();

      component.alCambiarFiltros({ vertical: {}, amenities: ['Jardín vallado', 'Paseos diarios'] });

      expect(component.chipsActivos().map((c) => c.id))
        .toEqual(['amenities:Jardín vallado', 'amenities:Paseos diarios']);
    });

    /* La clave cruda del filtro no le dice nada a nadie: se busca su etiqueta. */
    it('debería nombrar un booleano con el texto que se vio al marcarlo', () => {
      montar();

      component.alCambiarFiltros({ vertical: { cancelacionGratis: true } });

      expect(component.chipsActivos()).toEqual([
        { id: 'cancelacionGratis', tipo: 'booleano', campo: 'cancelacionGratis', etiqueta: 'Cancelación gratis' },
      ]);
    });

    it('no debería pintar chip de un booleano desmarcado', () => {
      montar();

      component.alCambiarFiltros({ vertical: { cancelacionGratis: false } });

      expect(component.chipsActivos()).toEqual([]);
    });

    it('debería pintar un chip por cada valor de un filtro de lista', () => {
      montar();

      component.alCambiarFiltros({ vertical: { amenities: ['Piscina canina'] } });

      expect(component.chipsActivos()).toEqual([
        {
          id: 'amenities:Piscina canina', tipo: 'opcion', campo: 'amenities',
          valor: 'Piscina canina', etiqueta: 'Piscina canina',
        },
      ]);
    });

    it('debería caer a la clave cruda cuando el campo no está en el catálogo', () => {
      montar();

      component.alCambiarFiltros({ vertical: { inventado: true } });

      expect(component.chipsActivos()[0].etiqueta).toBe('inventado');
    });

    it('debería contar todos los filtros aplicados', () => {
      montar();

      component.alCambiarFiltros({
        vertical: { cancelacionGratis: true }, precioMax: 50, ratingMin: 3, amenities: ['Jardín vallado'],
      });

      expect(component.numFiltrosActivos()).toBe(4);
    });

    it('debería emitir la selección hacia fuera', () => {
      montar();
      const emitido = jest.fn();
      component.filtrosCambio.subscribe(emitido);

      component.alCambiarFiltros({ vertical: {}, precioMax: 30 });

      expect(emitido).toHaveBeenCalledWith({ vertical: {}, precioMax: 30 });
    });

    it('debería aguantar quitar o limpiar sin panel montado', () => {
      montar();

      expect(() => component.quitarChip({ id: 'precio', tipo: 'precio', etiqueta: 'Hasta 80 €' })).not.toThrow();
      expect(() => component.limpiarFiltros()).not.toThrow();
    });
  });

  describe('orden', () => {
    it('debería dar la etiqueta del orden elegido', () => {
      montar();
      fixture.componentRef.setInput('orden', 'precio_asc');
      fixture.detectChanges();

      expect(component.etiquetaOrden()).toBeTruthy();
    });

    it('debería quedarse en blanco ante un orden que no está en el catálogo', () => {
      montar();
      fixture.componentRef.setInput('orden', 'inventado');
      fixture.detectChanges();

      expect(component.etiquetaOrden()).toBe('');
    });

    it('debería emitir el nuevo orden al cambiarlo', () => {
      montar();
      const emitido = jest.fn();
      component.ordenCambio.subscribe(emitido);

      component.alCambiarOrden({ target: { value: 'rating' } } as unknown as Event);

      expect(emitido).toHaveBeenCalledWith('rating');
    });
  });

  /*
   * Tras reordenar, la lista es otra: dejar el scroll donde estaba dejaba al
   * usuario en mitad de unos resultados que ya no había visto.
   */
  describe('volver arriba de la lista', () => {
    /** Deja una barra de control a `top` px del viewport y devuelve el espía de scroll. */
    const prepararScroll = (top: number | null, scrollY = 0): jest.Mock => {
      const barra = top === null
        ? null
        : ({ getBoundingClientRect: () => ({ top }) as DOMRect } as HTMLElement);
      jest.spyOn(documento, 'querySelector').mockReturnValue(barra);
      Object.defineProperty(documento.defaultView, 'scrollY', { value: scrollY, configurable: true });
      const scrollTo = jest.fn();
      documento.defaultView!.scrollTo = scrollTo;
      return scrollTo;
    };

    afterEach(() => jest.restoreAllMocks());

    it('debería subir hasta la barra de control dejando un margen', () => {
      montar();
      const scrollTo = prepararScroll(400, 100);

      component.volverArribaDeLaLista();

      expect(scrollTo).toHaveBeenCalledWith({ top: 436, behavior: 'auto' });
    });

    it('no debería subir por encima del principio de la página', () => {
      montar();
      const scrollTo = prepararScroll(0, 0);

      component.volverArribaDeLaLista();

      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    });

    it('no debería hacer nada si la barra no está en el DOM', () => {
      montar();
      const scrollTo = prepararScroll(null);

      component.volverArribaDeLaLista();

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
