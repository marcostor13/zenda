import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { RsAsistenteComponent } from './rs-asistente.component';
import { AsistenteService } from './asistente.service';

describe('RsAsistenteComponent', () => {
  let fixture: ComponentFixture<RsAsistenteComponent>;
  let componente: RsAsistenteComponent;
  let preguntar: jest.Mock;

  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => el().textContent ?? '';
  const esperar = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    preguntar = jest.fn().mockResolvedValue({ disponible: true, respuesta: 'Se reserva así.' });

    await TestBed.configureTestingModule({
      imports: [RsAsistenteComponent, RouterTestingModule.withRoutes([
        { path: '', children: [] },
        { path: 'comercio/mascotas', children: [] },
      ])],
      providers: [{ provide: AsistenteService, useValue: { preguntar } }],
    }).compileComponents();

    fixture = TestBed.createComponent(RsAsistenteComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería arrancar cerrado, sólo con el lanzador', async () => {
    expect(el().querySelector('[data-testid="lanzador-asistente"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="panel-asistente"]')).toBeNull();
  });

  /*
   * Observación del cliente: con la chispa sola había que acercar el ratón para
   * enterarse de qué era el botón, y quien no lo acerca nunca se entera.
   */
  it('debería enseñar «¿Te ayudo?» en reposo, sin esperar al ratón', async () => {
    expect(el().querySelector('[data-testid="lanzador-asistente"]')!.textContent)
      .toContain('¿Te ayudo?');
  });

  /*
   * En los paneles la esquina de abajo a la izquierda es del menú lateral: sin
   * apartarse, el flotante tapaba el "Volver al inicio" del panel del comercio.
   */
  it('debería apartarse de la columna lateral en los paneles', async () => {
    const router = TestBed.inject(Router);
    expect(el().querySelector('.as--tras-columna')).toBeNull();

    await router.navigateByUrl('/comercio/mascotas');
    fixture.detectChanges();
    expect(el().querySelector('.as--tras-columna')).not.toBeNull();

    await router.navigateByUrl('/');
    fixture.detectChanges();
    expect(el().querySelector('.as--tras-columna')).toBeNull();
  });

  it('debería abrir el panel con un saludo y las preguntas más frecuentes', async () => {
    el().querySelector<HTMLButtonElement>('[data-testid="lanzador-asistente"]')!.click();
    await esperar();

    expect(el().querySelector('[data-testid="panel-asistente"]')).not.toBeNull();
    expect(texto()).toContain('Soy el asistente de Doogking');
    expect(el().querySelectorAll('.as__sugerencia')).toHaveLength(4);
  });

  describe('conversación', () => {
    beforeEach(async () => {
      el().querySelector<HTMLButtonElement>('[data-testid="lanzador-asistente"]')!.click();
      await esperar();
    });

    it('debería pintar la pregunta y la respuesta, y mandar la ruta como contexto', async () => {
      await componente['enviar']('¿Cómo reservo?');
      await esperar();

      expect(texto()).toContain('¿Cómo reservo?');
      expect(texto()).toContain('Se reserva así.');
      expect(preguntar).toHaveBeenCalledWith(expect.objectContaining({
        pregunta: '¿Cómo reservo?', ruta: '/',
      }));
    });

    /* El historial deja que el asistente entienda "¿y si la cancelo?". */
    it('debería mandar los turnos anteriores, sin el saludo', async () => {
      await componente['enviar']('¿Cómo reservo?');
      await esperar();
      await componente['enviar']('¿Y cancelarla?');
      await esperar();

      expect(preguntar.mock.calls[0][0].historial).toEqual([]);
      expect(preguntar.mock.calls[1][0].historial).toEqual([
        { autor: 'cliente', texto: '¿Cómo reservo?' },
        { autor: 'asistente', texto: 'Se reserva así.' },
      ]);
    });

    it('debería ofrecer como enlaces lo que propone la respuesta', async () => {
      preguntar.mockResolvedValue({
        disponible: true, respuesta: 'Mira aquí.',
        enlaces: [{ titulo: 'Mis reservas', ruta: '/reservas/mis' }],
      });

      await componente['enviar']('¿Dónde veo mis reservas?');
      await esperar();

      const enlace = el().querySelector<HTMLAnchorElement>('.as__enlace');
      expect(enlace?.textContent).toContain('Mis reservas');
      expect(enlace?.getAttribute('href')).toBe('/reservas/mis');
    });

    it('debería esconder las sugerencias en cuanto se pregunta algo', async () => {
      await componente['enviar']('¿Cómo reservo?');
      await esperar();

      expect(el().querySelectorAll('.as__sugerencia')).toHaveLength(0);
    });

    /* Que el hilo nunca se quede mudo: un fallo de red también se contesta. */
    it('debería contestar algo si la consulta falla', async () => {
      preguntar.mockRejectedValue(new Error('red caída'));

      await componente['enviar']('¿Cómo reservo?');
      await esperar();

      expect(texto()).toContain('No he podido conectar');
      expect(el().querySelector('.as__enlace')?.textContent).toContain('Centro de ayuda');
    });

    it('no debería mandar una pregunta vacía', async () => {
      await componente['enviar']('   ');
      expect(preguntar).not.toHaveBeenCalled();
    });
  });

  it('debería cerrarse con Escape, como el resto de paneles', async () => {
    el().querySelector<HTMLButtonElement>('[data-testid="lanzador-asistente"]')!.click();
    await esperar();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await esperar();

    expect(el().querySelector('[data-testid="panel-asistente"]')).toBeNull();
  });
});
