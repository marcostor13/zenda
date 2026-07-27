import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RsTagsInputComponent } from './rs-tags-input.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RsTagsInputComponent],
  template: `
    <rs-tags-input [formControl]="control" [opciones]="opciones()"
                   [permiteNuevos]="permiteNuevos()" [maximo]="maximo()" />
  `,
})
class AnfitrionComponent {
  readonly control = new FormControl<string[]>([], { nonNullable: true });
  readonly opciones = signal<string[]>(['Tormentas', 'Petardos', 'Aspiradora']);
  readonly permiteNuevos = signal(true);
  readonly maximo = signal<number | null>(null);
}

describe('RsTagsInputComponent', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let anfitrion: AnfitrionComponent;
  let tags: RsTagsInputComponent;

  const input = (): HTMLInputElement => fixture.nativeElement.querySelector('.tg__input');
  const chips = (): string[] =>
    [...fixture.nativeElement.querySelectorAll('.tg__tag')].map((e) => (e as HTMLElement).textContent!.trim());
  const opcionesVisibles = (): string[] =>
    [...fixture.nativeElement.querySelectorAll('.tg__opt')].map((e) => (e as HTMLElement).textContent!.trim());

  /** Simula teclear en el campo, que es como llega el texto en la aplicación. */
  const escribir = (texto: string): void => {
    input().value = texto;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const pulsar = (key: string): void => {
    input().dispatchEvent(new KeyboardEvent('keydown', { key }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AnfitrionComponent] }).compileComponents();

    fixture = TestBed.createComponent(AnfitrionComponent);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
    tags = fixture.debugElement.children[0].componentInstance as RsTagsInputComponent;
  });

  describe('valor del formulario', () => {
    it('debería empezar sin etiquetas', () => {
      expect(chips()).toEqual([]);
      expect(anfitrion.control.value).toEqual([]);
    });

    it('debería pintar el valor que ya tenía el control', () => {
      anfitrion.control.setValue(['Tormentas']);
      fixture.detectChanges();

      expect(chips()).toContain('Tormentas');
    });

    it('debería aceptar el formato antiguo de cadena con comas', () => {
      // Fichas guardadas antes de este campo llegan como "a, b": no se pierden.
      tags.writeValue('Tormentas, Petardos' as never);

      expect(tags.valor()).toEqual(['Tormentas', 'Petardos']);
    });

    it('debería tratar el nulo como lista vacía', () => {
      tags.writeValue(null);

      expect(tags.valor()).toEqual([]);
    });
  });

  describe('elegir de la lista', () => {
    it('debería mostrar el catálogo al enfocar', () => {
      input().dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      expect(opcionesVisibles()).toEqual(['Tormentas', 'Petardos', 'Aspiradora']);
    });

    it('debería añadir la opción al pulsarla', () => {
      tags.anadir('Petardos');
      fixture.detectChanges();

      expect(anfitrion.control.value).toEqual(['Petardos']);
      expect(chips()).toContain('Petardos');
    });

    it('debería filtrar las sugerencias por lo tecleado', () => {
      escribir('petar');

      expect(opcionesVisibles()).toContain('Petardos');
      expect(opcionesVisibles()).not.toContain('Aspiradora');
    });

    it('debería filtrar ignorando tildes y mayúsculas', () => {
      anfitrion.opciones.set(['Alergía al polen', 'Ácaros']);
      fixture.detectChanges();

      escribir('acaros');

      expect(opcionesVisibles()).toContain('Ácaros');
    });

    it('debería ocultar lo que ya está elegido', () => {
      tags.anadir('Petardos');
      input().dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      expect(opcionesVisibles()).not.toContain('Petardos');
    });
  });

  describe('escribir a mano', () => {
    it('debería ofrecer añadir el texto que no está en el catálogo', () => {
      escribir('Ruido de obras');

      expect(opcionesVisibles().some((o) => o.includes('Ruido de obras'))).toBe(true);
    });

    it('debería añadir con Enter lo tecleado', () => {
      escribir('Ruido de obras');
      pulsar('Enter');

      expect(anfitrion.control.value).toEqual(['Ruido de obras']);
      expect(input().value).toBe('');
    });

    it('no debería admitir texto libre en un catálogo cerrado', () => {
      anfitrion.permiteNuevos.set(false);
      fixture.detectChanges();

      escribir('Inventado');
      pulsar('Enter');

      // Los catálogos cerrados alimentan filtros del buscador: una entrada
      // libre no casaría con ninguna búsqueda.
      expect(anfitrion.control.value).toEqual([]);
    });

    it('debería seguir admitiendo elegir del catálogo aunque sea cerrado', () => {
      anfitrion.permiteNuevos.set(false);
      fixture.detectChanges();

      tags.anadir('Petardos');

      expect(anfitrion.control.value).toEqual(['Petardos']);
    });

    it('debería repartir en etiquetas el texto pegado con comas', () => {
      escribir('Tormentas, Petardos, Ruido');

      expect(anfitrion.control.value).toEqual(['Tormentas', 'Petardos']);
      expect(input().value).toBe('Ruido');
    });

    it('debería vaciar el borrador si el texto pegado acaba en coma', () => {
      escribir('Tormentas, Petardos,');

      expect(anfitrion.control.value).toEqual(['Tormentas', 'Petardos']);
      expect(tags.borrador()).toBe('');
    });

    it('debería recortar los espacios sobrantes', () => {
      escribir('   Ruido de obras   ');
      pulsar('Enter');

      expect(anfitrion.control.value).toEqual(['Ruido de obras']);
    });

    it('no debería añadir una etiqueta vacía', () => {
      escribir('   ');
      pulsar('Enter');

      expect(anfitrion.control.value).toEqual([]);
    });

    it('debería guardar la forma del catálogo, no lo tecleado', () => {
      escribir('petardos');
      pulsar('Enter');

      // Sin esto convivirían "Petardos" y "petardos" como dos etiquetas distintas.
      expect(anfitrion.control.value).toEqual(['Petardos']);
    });

    it('no debería duplicar una etiqueta ya elegida', () => {
      tags.anadir('Petardos');
      tags.anadir('petardos');

      expect(anfitrion.control.value).toEqual(['Petardos']);
    });
  });

  describe('quitar etiquetas', () => {
    it('debería quitar la etiqueta indicada', () => {
      tags.anadir('Tormentas');
      tags.anadir('Petardos');

      tags.quitar('Tormentas');

      expect(anfitrion.control.value).toEqual(['Petardos']);
    });

    it('debería quitar la última con Backspace y el campo vacío', () => {
      tags.anadir('Tormentas');
      tags.anadir('Petardos');
      fixture.detectChanges();

      pulsar('Backspace');

      expect(anfitrion.control.value).toEqual(['Tormentas']);
    });

    it('no debería quitar nada si se está escribiendo', () => {
      tags.anadir('Tormentas');
      escribir('pet');

      pulsar('Backspace');

      expect(anfitrion.control.value).toEqual(['Tormentas']);
    });
  });

  describe('teclado', () => {
    it('debería recorrer las sugerencias con las flechas', () => {
      input().dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      pulsar('ArrowDown');
      expect(tags.resaltada()).toBe(0);

      pulsar('ArrowDown');
      expect(tags.resaltada()).toBe(1);

      pulsar('ArrowUp');
      expect(tags.resaltada()).toBe(0);
    });

    it('debería dar la vuelta al llegar al final de la lista', () => {
      input().dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      pulsar('ArrowUp');

      expect(tags.resaltada()).toBe(2);
    });

    it('debería añadir con Enter la sugerencia resaltada', () => {
      input().dispatchEvent(new Event('focus'));
      fixture.detectChanges();
      pulsar('ArrowDown');

      pulsar('Enter');

      expect(anfitrion.control.value).toEqual(['Tormentas']);
    });

    it('debería cerrar la lista con Escape', () => {
      input().dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      pulsar('Escape');

      expect(tags.desplegado()).toBe(false);
      expect(opcionesVisibles()).toEqual([]);
    });

    it('no debería enviar el formulario al pulsar Enter', () => {
      escribir('Ruido');
      const evento = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });

      input().dispatchEvent(evento);

      expect(evento.defaultPrevented).toBe(true);
    });
  });

  describe('límite de etiquetas', () => {
    it('debería dejar de admitir etiquetas al llegar al tope', () => {
      anfitrion.maximo.set(1);
      fixture.detectChanges();

      tags.anadir('Tormentas');
      tags.anadir('Petardos');

      expect(anfitrion.control.value).toEqual(['Tormentas']);
      expect(tags.alTope()).toBe(true);
    });

    it('debería volver a admitir al quitar una', () => {
      anfitrion.maximo.set(1);
      fixture.detectChanges();
      tags.anadir('Tormentas');

      tags.quitar('Tormentas');
      tags.anadir('Petardos');

      expect(anfitrion.control.value).toEqual(['Petardos']);
    });
  });

  describe('estado deshabilitado', () => {
    it('no debería aceptar cambios con el control deshabilitado', () => {
      anfitrion.control.disable();
      fixture.detectChanges();

      tags.anadir('Petardos');

      expect(tags.valor()).toEqual([]);
      expect(input().disabled).toBe(true);
    });

    it('no debería quitar etiquetas deshabilitado', () => {
      anfitrion.control.setValue(['Tormentas']);
      anfitrion.control.disable();
      fixture.detectChanges();

      tags.quitar('Tormentas');

      expect(tags.valor()).toEqual(['Tormentas']);
    });
  });

  describe('cierre al pulsar fuera', () => {
    it('debería cerrar la lista y marcar el control como tocado', () => {
      input().dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(tags.desplegado()).toBe(false);
      expect(anfitrion.control.touched).toBe(true);
    });
  });
});
