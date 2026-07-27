import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RsPhoneInputComponent } from './rs-phone-input.component';
import { PAISES_EUROPA, paisDelTelefono } from '../../catalogos/paises.catalogo';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RsPhoneInputComponent],
  template: `<rs-phone-input [formControl]="control" />`,
})
class AnfitrionComponent {
  readonly control = new FormControl<string>('', { nonNullable: true });
}

describe('RsPhoneInputComponent', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let anfitrion: AnfitrionComponent;
  let telefono: RsPhoneInputComponent;

  const numeroInput = (): HTMLInputElement => fixture.nativeElement.querySelector('.ph__num');
  const botonPais = (): HTMLButtonElement => fixture.nativeElement.querySelector('.ph__pais');
  const opciones = (): string[] =>
    [...fixture.nativeElement.querySelectorAll('.ph__nombre')].map((e) => (e as HTMLElement).textContent!.trim());

  const escribirNumero = (texto: string): void => {
    numeroInput().value = texto;
    numeroInput().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const buscar = (texto: string): void => {
    const campo: HTMLInputElement = fixture.nativeElement.querySelector('.ph__buscar');
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const pais = (iso: string) => PAISES_EUROPA.find((p) => p.iso === iso)!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AnfitrionComponent] }).compileComponents();

    fixture = TestBed.createComponent(AnfitrionComponent);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
    telefono = fixture.debugElement.children[0].componentInstance as RsPhoneInputComponent;
  });

  describe('país por defecto', () => {
    it('debería arrancar en España', () => {
      expect(telefono.pais().iso).toBe('ES');
      expect(botonPais().textContent).toContain('+34');
      expect(botonPais().textContent).toContain('🇪🇸');
    });

    it('debería ofrecer España la primera de la lista', () => {
      botonPais().click();
      fixture.detectChanges();

      // Es lo que elige la mayoría: buscarla en la "E" sería fricción para todos.
      expect(opciones()[0]).toBe('España');
    });
  });

  describe('valor del control', () => {
    it('debería componer el teléfono con el prefijo elegido', () => {
      escribirNumero('600123456');

      expect(anfitrion.control.value).toBe('+34600123456');
    });

    it('debería quedar vacío si no hay número, no dejar solo el prefijo', () => {
      escribirNumero('600123456');

      escribirNumero('');

      // Un "+34" suelto en un campo opcional se guardaría como teléfono falso.
      expect(anfitrion.control.value).toBe('');
    });

    it('debería descartar espacios, guiones y paréntesis al teclear', () => {
      escribirNumero('600 12-34 (56)');

      // `@IsPhoneNumber()` del API rechaza cualquier cosa que no sea E.164.
      expect(anfitrion.control.value).toBe('+34600123456');
    });

    it('debería recomponer el número al cambiar de país', () => {
      escribirNumero('600123456');

      telefono.elegirPais(pais('PT'));

      expect(anfitrion.control.value).toBe('+351600123456');
    });

    it('debería marcar el control como tocado al escribir', () => {
      escribirNumero('600123456');

      expect(anfitrion.control.touched).toBe(true);
    });
  });

  describe('carga de un valor existente', () => {
    it('debería separar prefijo y número de un teléfono internacional', () => {
      anfitrion.control.setValue('+351912345678');
      fixture.detectChanges();

      expect(telefono.pais().iso).toBe('PT');
      expect(telefono.numero()).toBe('912345678');
    });

    it('debería reconocer prefijos de tres cifras sin confundirlos con los de dos', () => {
      anfitrion.control.setValue('+376712345');
      fixture.detectChanges();

      // "+376" (Andorra) empieza por "+37": sin ordenar por longitud fallaría.
      expect(telefono.pais().iso).toBe('AD');
      expect(telefono.numero()).toBe('712345');
    });

    it('debería limpiar el formato con el que viniera guardado', () => {
      anfitrion.control.setValue('+34 600-12 34 56');
      fixture.detectChanges();

      expect(telefono.pais().iso).toBe('ES');
      expect(telefono.numero()).toBe('600123456');
    });

    it('debería asumir España en números antiguos sin prefijo', () => {
      anfitrion.control.setValue('600123456');
      fixture.detectChanges();

      expect(telefono.pais().iso).toBe('ES');
      expect(telefono.numero()).toBe('600123456');
    });

    it('debería quedarse vacío con un valor nulo', () => {
      telefono.writeValue(null);

      expect(telefono.numero()).toBe('');
    });
  });

  describe('selector de país', () => {
    it('debería abrirse y cerrarse', () => {
      botonPais().click();
      fixture.detectChanges();
      expect(telefono.desplegado()).toBe(true);

      botonPais().click();
      fixture.detectChanges();
      expect(telefono.desplegado()).toBe(false);
    });

    it('debería filtrar por nombre ignorando tildes', () => {
      botonPais().click();
      fixture.detectChanges();

      buscar('espana');

      expect(opciones()).toEqual(['España']);
    });

    it('debería filtrar por prefijo con o sin el signo +', () => {
      botonPais().click();
      fixture.detectChanges();

      buscar('351');
      expect(opciones()).toEqual(['Portugal']);

      buscar('+33');
      expect(opciones()).toEqual(['Francia']);
    });

    it('debería avisar cuando ningún país coincide', () => {
      botonPais().click();
      fixture.detectChanges();

      buscar('Argentina');

      expect(opciones()).toEqual([]);
      expect(fixture.nativeElement.querySelector('.ph__vacio').textContent).toContain('Argentina');
    });

    it('debería cerrar el desplegable al elegir', () => {
      botonPais().click();
      fixture.detectChanges();

      telefono.elegirPais(pais('IT'));
      fixture.detectChanges();

      expect(telefono.desplegado()).toBe(false);
      expect(telefono.pais().iso).toBe('IT');
    });

    it('debería cerrarse al pulsar fuera', () => {
      botonPais().click();
      fixture.detectChanges();

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(telefono.desplegado()).toBe(false);
    });

    it('debería olvidar el filtro anterior al reabrir', () => {
      botonPais().click();
      fixture.detectChanges();
      buscar('Francia');

      telefono.cerrar();
      botonPais().click();
      fixture.detectChanges();

      expect(telefono.filtro()).toBe('');
      expect(opciones().length).toBe(PAISES_EUROPA.length);
    });
  });

  describe('estado deshabilitado', () => {
    it('no debería abrir el selector ni admitir texto', () => {
      anfitrion.control.disable();
      fixture.detectChanges();

      telefono.alternar();

      expect(telefono.desplegado()).toBe(false);
      expect(numeroInput().disabled).toBe(true);
      expect(botonPais().disabled).toBe(true);
    });
  });

  describe('catálogo de países', () => {
    it('debería cubrir los mercados europeos con prefijos únicos por país', () => {
      expect(PAISES_EUROPA.length).toBeGreaterThan(40);
      expect(new Set(PAISES_EUROPA.map((p) => p.iso)).size).toBe(PAISES_EUROPA.length);
    });

    it('debería resolver el país de un teléfono internacional', () => {
      expect(paisDelTelefono('+34600123456')?.iso).toBe('ES');
      expect(paisDelTelefono('+3519123456')?.iso).toBe('PT');
    });

    it('no debería resolver país sin prefijo internacional', () => {
      expect(paisDelTelefono('600123456')).toBeUndefined();
    });
  });
});
