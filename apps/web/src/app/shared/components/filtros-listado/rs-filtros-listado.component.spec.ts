import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsFiltrosListadoComponent } from './rs-filtros-listado.component';
import type { FiltrosSeleccionados } from './rs-filtros-listado.component';

describe('RsFiltrosListadoComponent', () => {
  let fixture: ComponentFixture<RsFiltrosListadoComponent>;
  let component: RsFiltrosListadoComponent;
  let emitidos: FiltrosSeleccionados[];

  /** Monta el componente para un vertical concreto y engancha la salida. */
  function montar(vertical = 'alojamiento'): void {
    fixture = TestBed.createComponent(RsFiltrosListadoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('vertical', vertical);
    emitidos = [];
    component.cambio.subscribe((f) => emitidos.push(f));
    fixture.detectChanges();
  }

  const ultimo = (): FiltrosSeleccionados => emitidos[emitidos.length - 1];

  /** Primer grupo de opciones múltiples del vertical montado. */
  const grupoOpciones = () => component.grupos().find((g) => Boolean(g.campo) && g.tipo !== 'precio');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsFiltrosListadoComponent] }).compileComponents();
  });

  it('debería arrancar con el máximo del vertical, no con un tope fijo', () => {
    // Si arrancara por debajo del tope, el listado saldría ya filtrado sin que
    // nadie lo haya pedido.
    montar();

    expect(component.precioMax).toBeGreaterThan(0);
    expect(component.precioMin).toBe(0);
  });

  describe('contadores de facetas', () => {
    it('debería devolver null si el API no aporta contadores', () => {
      montar();

      expect(component.conteoOpcion('parking')).toBeNull();
      expect(component.conteoValoracion(4)).toBeNull();
    });

    it('debería devolver el contador de la opción cuando existe', () => {
      montar();
      fixture.componentRef.setInput('conteos', [{ valor: 'parking', n: 514 }]);
      fixture.detectChanges();

      expect(component.conteoOpcion('parking')).toBe(514);
      expect(component.conteoOpcion('otra')).toBeNull();
    });

    it('debería devolver el contador de la valoración cuando existe', () => {
      montar();
      fixture.componentRef.setInput('conteosValoracion', [{ minimo: 4, n: 12 }]);
      fixture.detectChanges();

      expect(component.conteoValoracion(4)).toBe(12);
      expect(component.conteoValoracion(3)).toBeNull();
    });
  });

  describe('valoración mínima', () => {
    it('debería fijar la valoración y emitirla', () => {
      montar();

      component.alternarRating(4);

      expect(ultimo().ratingMin).toBe(4);
    });

    it('debería quitar el filtro al volver a pulsar la misma estrella', () => {
      montar();

      component.alternarRating(4);
      component.alternarRating(4);

      // Cero no es "valorado con cero": es "sin filtro", así que no viaja.
      expect(ultimo().ratingMin).toBeUndefined();
    });
  });

  describe('opciones por vertical', () => {
    it('debería marcar y desmarcar una opción', () => {
      montar();
      const grupo = grupoOpciones();
      if (!grupo?.campo) return;

      component.alternarOpcion(grupo, 'valor-1');
      expect(component.estaMarcado(grupo, 'valor-1')).toBe(true);

      component.alternarOpcion(grupo, 'valor-1');
      expect(component.estaMarcado(grupo, 'valor-1')).toBe(false);
    });

    it('debería acumular varias opciones del mismo grupo', () => {
      montar();
      const grupo = grupoOpciones();
      if (!grupo?.campo) return;

      component.alternarOpcion(grupo, 'valor-1');
      component.alternarOpcion(grupo, 'valor-2');

      expect(component.estaMarcado(grupo, 'valor-1')).toBe(true);
      expect(component.estaMarcado(grupo, 'valor-2')).toBe(true);
    });

    it('no debería hacer nada con un grupo sin campo asociado', () => {
      montar();
      const antes = emitidos.length;

      component.alternarOpcion({ titulo: 'x', tipo: 'chips' } as never, 'v');

      expect(emitidos).toHaveLength(antes);
    });

    it('no debería considerar marcado nada en un grupo sin campo', () => {
      montar();

      expect(component.estaMarcado({ titulo: 'x', tipo: 'chips' } as never, 'v')).toBe(false);
    });
  });

  describe('interruptores', () => {
    it('debería enviar el interruptor sólo cuando está activo', () => {
      montar();

      component.alternarBooleano('cancelacionGratis');
      expect(ultimo().vertical['cancelacionGratis']).toBe(true);

      component.alternarBooleano('cancelacionGratis');
      expect(ultimo().vertical['cancelacionGratis']).toBeUndefined();
    });
  });

  describe('emisión de filtros', () => {
    it('no debería enviar el precio máximo si está en el tope', () => {
      montar();

      component.emitir();

      expect(ultimo().precioMax).toBeUndefined();
      expect(ultimo().precioMin).toBeUndefined();
    });

    it('debería enviar el precio cuando el usuario lo estrecha', () => {
      montar();
      component.precioMin = 50;
      component.precioMax = 120;

      component.emitir();

      expect(ultimo().precioMin).toBe(50);
      expect(ultimo().precioMax).toBe(120);
    });

    it('debería separar amenities del resto de campos del vertical', () => {
      montar();
      const grupoAmenities = component.grupos().find((g) => g.campo === 'amenities');
      if (!grupoAmenities) return;

      component.alternarOpcion(grupoAmenities, 'piscina');

      expect(ultimo().amenities).toEqual(['piscina']);
      expect(ultimo().vertical['amenities']).toBeUndefined();
    });
  });

  /*
   * Los chips de "filtros aplicados" viven en el listado pero la selección está
   * aquí: sin este puente, quitar un chip no deshacía nada.
   */
  describe('quitar un filtro desde los chips del listado', () => {
    it('debería devolver el precio a su rango completo', () => {
      montar();
      const tope = component.precioMax;
      component.precioMin = 40;
      component.precioMax = 90;

      component.quitar('precio');

      expect(component.precioMin).toBe(0);
      expect(component.precioMax).toBe(tope);
      expect(ultimo().precioMax).toBeUndefined();
    });

    it('debería quitar la valoración mínima', () => {
      montar();
      component.alternarRating(4);

      component.quitar('rating');

      expect(component.ratingMin()).toBe(0);
      expect(ultimo().ratingMin).toBeUndefined();
    });

    it('debería apagar un interruptor', () => {
      montar();
      component.alternarBooleano('cancelacionGratis');

      component.quitar('booleano', 'cancelacionGratis');

      expect(component.booleanos()['cancelacionGratis']).toBe(false);
      expect(ultimo().vertical['cancelacionGratis']).toBeUndefined();
    });

    it('debería quitar solo el valor indicado, dejando los demás del grupo', () => {
      montar();
      const grupo = grupoOpciones()!;
      const [a, b] = grupo.opciones!.slice(0, 2);
      component.alternarOpcion(grupo, a.valor);
      component.alternarOpcion(grupo, b.valor);

      component.quitar('opcion', grupo.campo, a.valor);

      expect(component.estaMarcado(grupo, a.valor)).toBe(false);
      expect(component.estaMarcado(grupo, b.valor)).toBe(true);
    });

    it('debería aguantar que se pida quitar un valor de un grupo sin marcar', () => {
      montar();
      const grupo = grupoOpciones()!;

      component.quitar('opcion', grupo.campo, 'inventado');

      expect(component.estaMarcado(grupo, 'inventado')).toBe(false);
    });

    it.each([
      ['un booleano sin campo', 'booleano' as const, undefined, undefined],
      ['una opción sin campo', 'opcion' as const, undefined, 'x'],
      ['una opción sin valor', 'opcion' as const, 'amenities', undefined],
    ])('no debería tocar nada al quitar %s, pero sí volver a emitir', (_caso, tipo, campo, valor) => {
      montar();
      component.alternarRating(5);
      const antes = ultimo();

      component.quitar(tipo, campo, valor);

      expect(ultimo()).toEqual(antes);
    });
  });

  it('debería devolver todo al estado inicial al limpiar', () => {
    montar();
    component.precioMin = 50;
    component.precioMax = 120;
    component.alternarRating(5);
    component.alternarBooleano('cancelacionGratis');

    component.limpiar();

    expect(component.precioMin).toBe(0);
    expect(component.ratingMin()).toBe(0);
    expect(component.booleanos()).toEqual({});
    expect(ultimo().precioMax).toBeUndefined();
    expect(ultimo().ratingMin).toBeUndefined();
  });
});
