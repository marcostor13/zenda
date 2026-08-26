import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  GrupoFiltro,
  RsAdminFiltrosComponent,
  ValoresFiltro,
} from './rs-admin-filtros.component';

const GRUPOS: GrupoFiltro[] = [
  {
    clave: 'estado',
    label: 'Estado',
    tipo: 'pastillas',
    opciones: [
      { valor: 'pendiente', label: 'Pendientes' },
      { valor: 'activo', label: 'Activos' },
    ],
  },
  {
    clave: 'plan',
    label: 'Plan',
    tipo: 'select',
    opciones: [
      { valor: 'basico', label: 'Básico' },
      { valor: 'premium', label: 'Premium' },
    ],
  },
];

describe('RsAdminFiltrosComponent', () => {
  let fixture: ComponentFixture<RsAdminFiltrosComponent>;
  let componente: RsAdminFiltrosComponent;

  const montar = async (valores: ValoresFiltro = { estado: '', plan: '' }): Promise<void> => {
    await TestBed.configureTestingModule({ imports: [RsAdminFiltrosComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsAdminFiltrosComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('grupos', GRUPOS);
    fixture.componentRef.setInput('valores', valores);
    fixture.componentRef.setInput('total', 7);
    fixture.componentRef.setInput('etiquetaSingular', 'comercio');
    fixture.componentRef.setInput('etiquetaPlural', 'comercios');
    fixture.detectChanges();
  };

  const texto = (): string => fixture.nativeElement.textContent as string;

  describe('el botón de filtros', () => {
    it('no debería llevar contador sin filtros puestos', async () => {
      await montar();

      expect(componente.numActivos()).toBe(0);
      expect(fixture.nativeElement.querySelector('.af__btn-n')).toBeNull();
    });

    it('debería contar sólo los filtros con valor', async () => {
      await montar({ estado: 'pendiente', plan: '' });

      expect(componente.numActivos()).toBe(1);
      expect(fixture.nativeElement.querySelector('.af__btn-n').textContent.trim()).toBe('1');
    });

    it('debería abrir y cerrar el panel', async () => {
      await montar();

      componente.abrir();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.af__panel.is-abierto')).not.toBeNull();

      componente.cerrar();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.af__panel.is-abierto')).toBeNull();
    });
  });

  /**
   * El motivo de todo esto: al pulsar "Todos" o "Pendientes" sólo cambiaba de
   * color la pastilla y nada decía qué se estaba mirando.
   */
  describe('aviso de lo que se está filtrando', () => {
    it('debería enseñar el recuento junto al botón', async () => {
      await montar();

      expect(texto()).toContain('7');
      expect(texto()).toContain('comercios');
    });

    it('debería usar el singular con un solo resultado', async () => {
      await montar();
      fixture.componentRef.setInput('total', 1);
      fixture.detectChanges();

      expect(texto()).toContain('1');
      expect(texto()).toContain('comercio');
      expect(texto()).not.toContain('comercios');
    });

    it('debería pintar una pastilla por filtro aplicado, con su etiqueta legible', async () => {
      await montar({ estado: 'pendiente', plan: 'premium' });

      expect(componente.chips().map((c) => c.texto)).toEqual([
        'Estado: Pendientes',
        'Plan: Premium',
      ]);
    });

    it('no debería pintar pastilla de un filtro sin valor', async () => {
      await montar({ estado: '', plan: 'basico' });

      expect(componente.chips().map((c) => c.clave)).toEqual(['plan']);
    });

    it('debería anunciar el recuento a un lector de pantalla', async () => {
      await montar();

      expect(fixture.nativeElement.querySelector('.af__count').getAttribute('aria-live'))
        .toBe('polite');
    });
  });

  describe('cambios de filtro', () => {
    it('debería emitir todos los valores al elegir una opción', async () => {
      await montar({ estado: '', plan: 'basico' });
      const emitido: ValoresFiltro[] = [];
      componente.cambio.subscribe((v) => emitido.push(v));

      componente.fijar('estado', 'activo');

      expect(emitido).toEqual([{ estado: 'activo', plan: 'basico' }]);
    });

    it('debería emitir en cuanto se toca, sin esperar a cerrar el panel', async () => {
      await montar();
      const emitido: ValoresFiltro[] = [];
      componente.cambio.subscribe((v) => emitido.push(v));

      componente.abrir();
      componente.fijar('plan', 'premium');

      expect(emitido).toHaveLength(1);
      expect(componente.abierto()).toBe(true);
    });

    it('quitar una pastilla debería vaciar sólo ese filtro', async () => {
      await montar({ estado: 'activo', plan: 'premium' });
      const emitido: ValoresFiltro[] = [];
      componente.cambio.subscribe((v) => emitido.push(v));

      componente.quitar('estado');

      expect(emitido).toEqual([{ estado: '', plan: 'premium' }]);
    });

    it('limpiar debería vaciar todos los grupos, también los que no venían', async () => {
      await montar({ estado: 'activo', plan: 'premium' });
      const emitido: ValoresFiltro[] = [];
      componente.cambio.subscribe((v) => emitido.push(v));

      componente.limpiar();

      expect(emitido).toEqual([{ estado: '', plan: '' }]);
    });

    it('debería emitir el texto del buscador', async () => {
      await montar();
      const emitido: string[] = [];
      componente.buscarCambio.subscribe((v) => emitido.push(v));

      const input = fixture.nativeElement.querySelector('.af__buscar-inp') as HTMLInputElement;
      input.value = 'luna';
      input.dispatchEvent(new Event('input'));

      expect(emitido).toEqual(['luna']);
    });
  });
});
