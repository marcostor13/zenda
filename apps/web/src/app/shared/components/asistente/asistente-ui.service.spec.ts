import { AsistenteUiService } from './asistente-ui.service';

describe('AsistenteUiService', () => {
  let ui: AsistenteUiService;

  beforeEach(() => { ui = new AsistenteUiService(); });

  it('debería arrancar cerrado y sin botón en la cabecera', () => {
    expect(ui.abierto()).toBe(false);
    expect(ui.hayDisparadorEnCabecera()).toBe(false);
  });

  /* Dos cabeceras a la vez (una transición de rutas) no deben dejar la cuenta mal. */
  it('debería contar los botones registrados sin bajar de cero', () => {
    ui.registrarDisparador();
    ui.registrarDisparador();
    ui.retirarDisparador();
    expect(ui.hayDisparadorEnCabecera()).toBe(true);

    ui.retirarDisparador();
    ui.retirarDisparador();
    expect(ui.hayDisparadorEnCabecera()).toBe(false);
  });

  it('debería recordar desde qué botón se abrió', () => {
    const boton = document.createElement('button');
    ui.alternar(boton);

    expect(ui.abierto()).toBe(true);
    expect(ui.origen()).toBe(boton);
  });

  it('debería cerrar al alternar estando abierto', () => {
    ui.alternar(null);
    ui.alternar(null);
    expect(ui.abierto()).toBe(false);
  });
});
