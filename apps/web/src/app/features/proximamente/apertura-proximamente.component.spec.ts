import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { AperturaPendiente, AperturaProximamenteComponent } from './apertura-proximamente.component';
import { ListaEsperaService } from './lista-espera.service';

@Component({ selector: 'rs-navbar', standalone: true, template: '' })
class NavbarFalsoComponent {}

describe('AperturaProximamenteComponent', () => {
  let fixture: ComponentFixture<AperturaProximamenteComponent>;
  let componente: AperturaProximamenteComponent;
  let listaEspera: jest.Mocked<ListaEsperaService>;

  const html = (): string => fixture.nativeElement.textContent as string;

  const montar = async (apertura?: AperturaPendiente): Promise<void> => {
    listaEspera = { suscribir: jest.fn() } as unknown as jest.Mocked<ListaEsperaService>;
    await TestBed.configureTestingModule({
      imports: [AperturaProximamenteComponent],
      providers: [
        provideRouter([]),
        { provide: ListaEsperaService, useValue: listaEspera },
        { provide: ActivatedRoute, useValue: { data: of(apertura ? { apertura } : {}) } },
      ],
    })
      .overrideComponent(AperturaProximamenteComponent, {
        remove: { imports: [RsNavbarComponent] },
        add: { imports: [NavbarFalsoComponent] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(AperturaProximamenteComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  };

  afterEach(() => TestBed.resetTestingModule());

  it('debería anunciar que las reservas abren pronto por defecto', async () => {
    await montar();
    expect(html()).toContain('Las reservas abren muy pronto');
    expect(html()).toContain('Seguir explorando');
  });

  it('debería anunciar que el registro de negocios abre pronto', async () => {
    await montar('comercios');
    expect(html()).toContain('El registro de negocios abre muy pronto');
    const volver: HTMLAnchorElement = fixture.nativeElement.querySelector('.ap__volver');
    expect(volver.getAttribute('href')).toBe('/para-comercios');
  });

  it('debería pedir un email válido antes de enviar', async () => {
    await montar();
    componente.suscribir();
    fixture.detectChanges();

    expect(listaEspera.suscribir).not.toHaveBeenCalled();
    expect(componente.hayError()).toBe(true);
    expect(html()).toContain('Escribe un email válido');
  });

  it('debería apuntar el email con el origen de su pantalla', async () => {
    await montar('comercios');
    listaEspera.suscribir.mockReturnValue(of({ yaRegistrado: false } as never));
    componente.formulario.setValue({ email: 'negocio@ejemplo.com' });

    componente.suscribir();
    fixture.detectChanges();

    expect(listaEspera.suscribir).toHaveBeenCalledWith('negocio@ejemplo.com', 'comercios-proximamente');
    expect(componente.suscrito()).toBe(true);
    expect(html()).toContain('Te avisaremos en cuanto abramos');
  });

  it('debería avisar si el email ya estaba en la lista', async () => {
    await montar('reservas');
    listaEspera.suscribir.mockReturnValue(of({ yaRegistrado: true } as never));
    componente.formulario.setValue({ email: 'cliente@ejemplo.com' });

    componente.suscribir();

    expect(listaEspera.suscribir).toHaveBeenCalledWith('cliente@ejemplo.com', 'reservas-proximamente');
    expect(componente.mensaje()).toContain('Ya te teníamos apuntado');
  });

  it('debería mostrar el error si no se puede guardar el email', async () => {
    await montar();
    listaEspera.suscribir.mockReturnValue(throwError(() => new Error('caído')));
    componente.formulario.setValue({ email: 'cliente@ejemplo.com' });

    componente.suscribir();

    expect(componente.enviando()).toBe(false);
    expect(componente.suscrito()).toBe(false);
    expect(componente.hayError()).toBe(true);
  });

  it('no debería enviar dos veces mientras hay un envío en curso', async () => {
    await montar();
    componente.enviando.set(true);
    componente.suscribir();
    expect(listaEspera.suscribir).not.toHaveBeenCalled();
  });
});
