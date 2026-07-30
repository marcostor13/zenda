import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProximamenteComponent } from './proximamente.component';
import { ListaEsperaService } from './lista-espera.service';

describe('ProximamenteComponent', () => {
  let fixture: ComponentFixture<ProximamenteComponent>;
  let componente: ProximamenteComponent;
  let listaEspera: jest.Mocked<ListaEsperaService>;

  const html = (): string => fixture.nativeElement.textContent as string;

  beforeEach(async () => {
    listaEspera = { suscribir: jest.fn() } as unknown as jest.Mocked<ListaEsperaService>;

    await TestBed.configureTestingModule({
      imports: [ProximamenteComponent],
      providers: [{ provide: ListaEsperaService, useValue: listaEspera }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProximamenteComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería mostrar el logo de Doogking', () => {
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.pm__logo');
    expect(img.getAttribute('alt')).toBe('Doogking');
  });

  it('debería anunciar el lanzamiento con un mensaje con fuerza', () => {
    expect(html()).toContain('Estamos preparando algo muy grande');
  });

  it('debería usar el copy abierto a todas las mascotas, no solo a perros', () => {
    const texto = html();
    expect(texto).toContain('todo lo que tu mascota necesita en un solo lugar');
    expect(texto).toContain('Muy pronto podrás reservar con profesionales de confianza');
  });

  it('debería listar las tres promesas de valor', () => {
    const ventajas = fixture.nativeElement.querySelectorAll('.pm__ventaja');
    expect(ventajas.length).toBe(3);
    expect(html()).toContain('Reserva en menos de un minuto');
    expect(html()).toContain('Profesionales verificados');
  });

  it('debería mostrar los ocho servicios con su etiqueta bajo el icono', () => {
    const servicios = fixture.nativeElement.querySelectorAll('.pm__servicio');
    expect(servicios.length).toBe(8);

    const etiquetas = Array.from(
      fixture.nativeElement.querySelectorAll('.pm__servicio-label'),
    ).map((el) => (el as HTMLElement).textContent?.trim());

    expect(etiquetas).toEqual([
      'Residencias',
      'Hoteles pet friendly',
      'Veterinarios',
      'Peluquerías',
      'Transporte',
      'Adiestradores',
      'Seguros',
      'Explora con tu mascota',
    ]);
  });

  it('debería mostrar el mensaje de confianza antes del pie', () => {
    expect(html()).toContain(
      'La plataforma donde propietarios y profesionales se encuentran con total confianza.',
    );
  });

  it('debería ofrecer las redes sociales de la marca', () => {
    const enlaces = fixture.nativeElement.querySelectorAll('.pm__cta-red');
    expect(enlaces.length).toBe(3);
    expect(enlaces[0].getAttribute('href')).toBe('https://instagram.com/doogking');
  });

  describe('lista de espera', () => {
    const enviarFormulario = (): void => {
      const form: HTMLFormElement = fixture.nativeElement.querySelector('.pm__cta-form');
      form.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };

    it('no debería llamar al API si el email no es válido', () => {
      componente.formulario.setValue({ email: 'no-es-un-email' });
      enviarFormulario();

      expect(listaEspera.suscribir).not.toHaveBeenCalled();
      expect(componente.hayError()).toBe(true);
      expect(html()).toContain('Escribe un email válido');
    });

    it('debería suscribir el email y mostrar la confirmación', () => {
      listaEspera.suscribir.mockReturnValue(
        of({ email: 'ana@doogking.com', yaRegistrado: false }),
      );
      componente.formulario.setValue({ email: 'ana@doogking.com' });
      enviarFormulario();

      expect(listaEspera.suscribir).toHaveBeenCalledWith('ana@doogking.com');
      expect(componente.suscrito()).toBe(true);
      expect(html()).toContain('Serás de los primeros en entrar en Doogking');
    });

    it('debería avisar de que el email ya estaba apuntado', () => {
      listaEspera.suscribir.mockReturnValue(
        of({ email: 'ana@doogking.com', yaRegistrado: true }),
      );
      componente.formulario.setValue({ email: 'ana@doogking.com' });
      enviarFormulario();

      expect(html()).toContain('Ya te teníamos apuntado');
    });

    it('debería mostrar un error recuperable si el API falla', () => {
      listaEspera.suscribir.mockReturnValue(throwError(() => new Error('500')));
      componente.formulario.setValue({ email: 'ana@doogking.com' });
      enviarFormulario();

      expect(componente.suscrito()).toBe(false);
      expect(componente.enviando()).toBe(false);
      expect(html()).toContain('No hemos podido guardar tu email');
    });
  });
});
