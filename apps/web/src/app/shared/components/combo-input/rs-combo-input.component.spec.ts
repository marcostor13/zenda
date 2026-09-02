import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsComboInputComponent } from './rs-combo-input.component';

describe('RsComboInputComponent', () => {
  let fixture: ComponentFixture<RsComboInputComponent>;
  let componente: RsComboInputComponent;
  let alCambiar: jest.Mock;
  let alTocar: jest.Mock;

  const OPCIONES = ['Cachorro', 'Obediencia básica', 'Modificación de conducta'];

  const montar = async (opciones: readonly string[] = OPCIONES): Promise<void> => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RsComboInputComponent] }).compileComponents();

    fixture = TestBed.createComponent(RsComboInputComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('opciones', opciones);

    alCambiar = jest.fn();
    alTocar = jest.fn();
    componente.registerOnChange(alCambiar);
    componente.registerOnTouched(alTocar);

    fixture.detectChanges();
  };

  const campo = (): HTMLInputElement =>
    (fixture.nativeElement as HTMLElement).querySelector('input')!;

  const opcionesVisibles = (): string[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.cb__opt'))
      .map((b) => b.textContent!.trim());

  const escribir = (texto: string): void => {
    const input = campo();
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const teclear = (key: string): KeyboardEvent => {
    const evento = new KeyboardEvent('keydown', { key, cancelable: true });
    campo().dispatchEvent(evento);
    fixture.detectChanges();
    return evento;
  };

  beforeEach(async () => await montar());

  describe('ControlValueAccessor', () => {
    it('debería pintar el valor que le escribe el formulario', () => {
      componente.writeValue('Cachorro');
      fixture.detectChanges();

      expect(campo().value).toBe('Cachorro');
    });

    it('debería tratar un valor nulo como campo vacío', () => {
      componente.writeValue(null);

      expect(componente.valor()).toBe('');
    });

    it('debería deshabilitar el campo cuando lo pide el formulario', () => {
      componente.setDisabledState(true);
      fixture.detectChanges();

      expect(campo().disabled).toBe(true);
    });
  });

  describe('sugerencias', () => {
    it('debería ofrecer el catálogo entero con el campo vacío', () => {
      componente.desplegar();
      fixture.detectChanges();

      expect(opcionesVisibles()).toEqual(OPCIONES);
    });

    it('debería filtrar por lo escrito', () => {
      escribir('obed');

      expect(opcionesVisibles()).toEqual(['Obediencia básica']);
    });

    it('debería ignorar mayúsculas y tildes al filtrar', () => {
      // "Modificación" se encuentra escribiendo "modificacion".
      escribir('MODIFICACION');

      expect(opcionesVisibles()).toEqual(['Modificación de conducta']);
    });

    /* Sobre un texto ya exacto la lista sólo taparía el campo siguiente. */
    it('no debería desplegar nada cuando lo escrito ya es la única coincidencia', () => {
      escribir('Cachorro');

      expect(componente.sugerencias()).toEqual([]);
      expect(opcionesVisibles()).toEqual([]);
    });

    it('no debería ofrecer nada si no hay coincidencias', () => {
      escribir('natación');

      expect(opcionesVisibles()).toEqual([]);
    });

    it('debería dejar escribir libremente sin catálogo', async () => {
      await montar([]);

      escribir('Curso propio');

      expect(componente.valor()).toBe('Curso propio');
      expect(opcionesVisibles()).toEqual([]);
    });
  });

  describe('escritura', () => {
    it('debería avisar al formulario de cada tecla', () => {
      escribir('obe');

      expect(alCambiar).toHaveBeenCalledWith('obe');
      expect(componente.desplegado()).toBe(true);
    });

    it('debería soltar el resaltado al seguir escribiendo', () => {
      componente.desplegar();
      teclear('ArrowDown');

      escribir('obe');

      expect(componente.resaltada()).toBe(-1);
    });
  });

  describe('teclado', () => {
    it('debería bajar por la lista y volver al principio', () => {
      componente.desplegar();
      fixture.detectChanges();

      teclear('ArrowDown');
      expect(componente.resaltada()).toBe(0);

      teclear('ArrowDown');
      teclear('ArrowDown');
      expect(componente.resaltada()).toBe(2);

      teclear('ArrowDown');
      expect(componente.resaltada()).toBe(0);
    });

    it('debería subir desde el principio hasta el final de la lista', () => {
      componente.desplegar();
      fixture.detectChanges();

      teclear('ArrowUp');

      expect(componente.resaltada()).toBe(OPCIONES.length - 1);
    });

    it('debería subir de una en una', () => {
      componente.desplegar();
      teclear('ArrowDown');
      teclear('ArrowDown');

      teclear('ArrowUp');

      expect(componente.resaltada()).toBe(0);
    });

    it('debería desplegar la lista al bajar con el campo cerrado', () => {
      componente.cerrar();

      teclear('ArrowDown');

      expect(componente.desplegado()).toBe(true);
    });

    it('no debería moverse por una lista vacía', async () => {
      await montar([]);

      teclear('ArrowDown');
      teclear('ArrowUp');

      expect(componente.resaltada()).toBe(-1);
    });

    it('debería elegir la opción resaltada con Enter', () => {
      componente.desplegar();
      fixture.detectChanges();
      teclear('ArrowDown');

      teclear('Enter');

      expect(componente.valor()).toBe('Cachorro');
      expect(alCambiar).toHaveBeenCalledWith('Cachorro');
      expect(componente.resaltada()).toBe(-1);
    });

    /* Sin `preventDefault`, Enter enviaría el formulario entero. */
    it('no debería dejar que Enter envíe el formulario', () => {
      const evento = teclear('Enter');

      expect(evento.defaultPrevented).toBe(true);
    });

    it('debería cerrar la lista con Enter si no hay nada resaltado', () => {
      componente.desplegar();

      teclear('Enter');

      expect(componente.desplegado()).toBe(false);
      expect(alCambiar).not.toHaveBeenCalled();
    });

    it('debería cerrar la lista con Escape', () => {
      componente.desplegar();

      teclear('Escape');

      expect(componente.desplegado()).toBe(false);
      expect(componente.resaltada()).toBe(-1);
    });

    it('no debería reaccionar a cualquier otra tecla', () => {
      componente.desplegar();

      const evento = teclear('Tab');

      expect(evento.defaultPrevented).toBe(false);
      expect(componente.desplegado()).toBe(true);
    });
  });

  describe('elegir del catálogo', () => {
    it('debería guardar la forma exacta del catálogo, no lo escrito', () => {
      // Es el motivo de existir del componente: que dos comercios no publiquen
      // "Curso cachorro" y "curso Cachorro" como si fueran cosas distintas.
      escribir('cachorro');

      componente.elegir('Cachorro');

      expect(componente.valor()).toBe('Cachorro');
      expect(alCambiar).toHaveBeenLastCalledWith('Cachorro');
      expect(alTocar).toHaveBeenCalled();
    });

    it('debería devolver el foco al campo tras elegir', () => {
      componente.desplegar();
      fixture.detectChanges();

      componente.elegir('Cachorro');

      expect(document.activeElement).toBe(campo());
    });

    it('no debería elegir nada con el campo deshabilitado', () => {
      componente.setDisabledState(true);

      componente.elegir('Cachorro');

      expect(componente.valor()).toBe('');
      expect(alCambiar).not.toHaveBeenCalled();
    });

    it('no debería desplegar la lista con el campo deshabilitado', () => {
      componente.setDisabledState(true);

      componente.desplegar();

      expect(componente.desplegado()).toBe(false);
    });
  });

  describe('pulsar fuera', () => {
    it('debería cerrar la lista y conservar lo escrito', () => {
      // El campo admite nombres propios: salir no puede descartar lo que no
      // está en el catálogo.
      escribir('Curso propio de la casa');
      componente.desplegar();

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(componente.desplegado()).toBe(false);
      expect(componente.valor()).toBe('Curso propio de la casa');
      expect(alTocar).toHaveBeenCalled();
    });

    it('no debería hacer nada si la lista ya estaba cerrada', () => {
      componente.cerrar();

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(alTocar).not.toHaveBeenCalled();
    });

    it('no debería cerrarse al pulsar dentro del propio campo', () => {
      componente.desplegar();
      fixture.detectChanges();

      campo().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(componente.desplegado()).toBe(true);
    });
  });

  describe('accesibilidad', () => {
    it('debería enlazar el campo con su lista de opciones', () => {
      componente.desplegar();
      fixture.detectChanges();

      const lista = (fixture.nativeElement as HTMLElement).querySelector('ul')!;
      expect(campo().getAttribute('aria-controls')).toBe(lista.id);
      expect(campo().getAttribute('role')).toBe('combobox');
      expect(campo().getAttribute('aria-expanded')).toBe('true');
    });

    it('debería anunciar la opción resaltada, y sólo mientras la haya', () => {
      componente.desplegar();
      fixture.detectChanges();
      expect(campo().getAttribute('aria-activedescendant')).toBeNull();

      teclear('ArrowDown');

      expect(campo().getAttribute('aria-activedescendant')).toBe(`${componente.listaId}-0`);
    });

    it('debería dar a cada instancia un id propio, para no repetirlo en la página', async () => {
      const primero = componente.listaId;
      await montar();

      expect(componente.listaId).not.toBe(primero);
    });
  });
});
