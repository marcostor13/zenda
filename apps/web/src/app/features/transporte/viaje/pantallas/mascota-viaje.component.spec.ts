import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { ModalidadTransporte, TamanoPerro } from 'shared';
import { AuthService } from '../../../../core/auth/auth.service';
import { PerroApi, PerrosService } from '../../../perros/perros.service';
import { TransporteViajeStore } from '../transporte-viaje.store';
import { MascotaViajeComponent } from './mascota-viaje.component';

const perro = (id: string, nombre: string, extra: Partial<PerroApi> = {}): PerroApi => ({
  _id: id, nombre, fotos: [], especie: 'perro', esMestizo: false, esterilizado: false,
  tipoPelo: [], vacunas: [], alergias: [], enfermedades: [], medicacion: [], miedos: [],
  puedeQuedarseSolo: true, ansiedadSeparacion: false, seMarea: false,
  requiereTransportin: false, autorizaCompartirHistorial: true,
  ...extra,
});

describe('MascotaViajeComponent', () => {
  let fixture: ComponentFixture<MascotaViajeComponent>;
  let componente: MascotaViajeComponent;
  let store: TransporteViajeStore;
  let router: Router;
  let perros: jest.Mocked<Pick<PerrosService, 'misPerros' | 'crear'>>;
  let autenticado: ReturnType<typeof signal<boolean>>;

  const crear = async (conRuta = true): Promise<void> => {
    if (conRuta) {
      sessionStorage.setItem('doogking_viaje_transporte', JSON.stringify({
        version: 2,
        borrador: {
          origen: { texto: 'Madrid', placeId: 'a' }, destino: { texto: 'Toledo', placeId: 'b' }, fecha: '2999-01-01',
          personas: 6,
        },
      }));
    }
    await TestBed.configureTestingModule({
      imports: [MascotaViajeComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthService, useValue: { estaAutenticado: autenticado, usuario: signal(null), esComercio: signal(false), esAdmin: signal(false), esCliente: signal(true) } },
        { provide: PerrosService, useValue: perros },
      ],
    }).compileComponents();
    store = TestBed.inject(TransporteViajeStore);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(MascotaViajeComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    sessionStorage.clear();
    autenticado = signal(true);
    perros = {
      misPerros: jest.fn().mockResolvedValue([
        perro('p1', 'Hachi', { raza: 'Akita', peso: 40, fotos: ['h.jpg'], requiereTransportin: true, medicacion: ['Apoquel'] }),
        perro('p2', 'Luna', { especie: 'Gato', tamano: 'pequeno' }),
      ]),
      crear: jest.fn().mockResolvedValue(perro('p3', 'Toby', { tamano: TamanoPerro.GRANDE })),
    };
  });

  afterEach(() => {
    fixture?.destroy();
    store?.reiniciar();
  });

  it('debería volver a la pantalla 1 si no hay ruta completa', async () => {
    await crear(false);

    expect(router.navigate).toHaveBeenCalledWith(['/transporte']);
    expect(componente.perros()).toEqual([]);
  });

  it('debería rellenar el formulario desde el borrador, con las personas topadas a cuatro', async () => {
    await crear();
    expect(componente.form.controls.personas.value).toBe('4');
  });

  describe('mascotas guardadas', () => {
    it('debería listar las mascotas y describirlas', async () => {
      await crear();

      expect(componente.perros()).toHaveLength(2);
      expect(fixture.nativeElement.querySelectorAll('.mv2__perro')).toHaveLength(2);
      expect(componente.descripcionPerro(componente.perros()[0])).toBe('Akita · 40 kg');
      expect(componente.descripcionPerro(componente.perros()[1])).toMatch(/^Gato · /);
    });

    it('debería elegir una mascota y precargar sus necesidades, y quitarla al volver a pulsar', async () => {
      await crear();
      const hachi = componente.perros()[0];

      componente.alternarPerro(hachi);
      expect(componente.elegida('p1')).toBe(true);
      expect(store.borrador().mascotas[0]).toEqual(expect.objectContaining({
        perroId: 'p1', nombre: 'Hachi', especie: 'perro', tamano: TamanoPerro.GRANDE, foto: 'h.jpg', raza: 'Akita',
      }));
      expect(componente.form.controls.necesidades.value).toEqual(
        expect.arrayContaining(['transportin', 'medicacion']),
      );

      componente.alternarPerro(hachi);
      expect(componente.elegida('p1')).toBe(false);
      expect(store.borrador().mascotas).toEqual([]);
    });

    it('debería normalizar la especie y el tamaño de una ficha antigua', async () => {
      await crear();
      componente.alternarPerro(componente.perros()[1]);
      expect(store.borrador().mascotas[0]).toEqual(expect.objectContaining({ especie: 'gato', tamano: TamanoPerro.PEQUENO }));
    });

    it('debería elegir sola la única mascota guardada', async () => {
      perros.misPerros.mockResolvedValue([perro('p9', 'Única')]);
      await crear();

      expect(store.borrador().mascotas.map((m) => m.perroId)).toEqual(['p9']);
      expect(store.borrador().mascotas[0].tamano).toBe(TamanoPerro.MEDIANO);
    });

    it('no debería avanzar sin ninguna mascota elegida', async () => {
      await crear();

      componente.continuar();
      fixture.detectChanges();

      expect(componente.sinMascotas()).toBe(true);
      expect(router.navigate).not.toHaveBeenCalledWith(['/transporte/viaje/resultados']);
      expect(fixture.nativeElement.textContent).toContain('Elige al menos una mascota');
    });

    it('debería avanzar a resultados con una mascota elegida', async () => {
      await crear();
      componente.alternarPerro(componente.perros()[0]);

      componente.continuar();

      expect(router.navigate).toHaveBeenCalledWith(['/transporte/viaje/resultados']);
    });

    it('debería caer al alta manual si no se pueden cargar las mascotas', async () => {
      perros.misPerros.mockRejectedValue(new Error('500'));
      await crear();

      expect(componente.perros()).toEqual([]);
      expect(fixture.nativeElement.querySelector('.mv2__manual')).not.toBeNull();
    });
  });

  describe('alta rápida', () => {
    it('debería crear la mascota, añadirla a la lista y elegirla', async () => {
      await crear();
      componente.altaAbierta.set(true);
      componente.alta.setValue({ nombre: 'Toby', especie: 'perro', tamano: TamanoPerro.GRANDE });

      await componente.guardarAlta();

      expect(perros.crear).toHaveBeenCalledWith({ nombre: 'Toby', especie: 'perro', tamano: TamanoPerro.GRANDE });
      expect(componente.perros().map((p) => p._id)).toContain('p3');
      expect(componente.elegida('p3')).toBe(true);
      expect(componente.altaAbierta()).toBe(false);
      expect(componente.alta.controls.nombre.value).toBe('');
    });

    it('no debería crear una mascota sin nombre', async () => {
      await crear();
      await componente.guardarAlta();
      expect(perros.crear).not.toHaveBeenCalled();
    });

    it('debería avisar si no se puede guardar la mascota', async () => {
      perros.crear.mockRejectedValue(new Error('400'));
      await crear();
      componente.alta.controls.nombre.setValue('Toby');

      await componente.guardarAlta();

      expect(componente.errorAlta()).toContain('No se pudo guardar');
      expect(componente.guardandoAlta()).toBe(false);
    });
  });

  describe('sin sesión', () => {
    it('debería describir las mascotas a mano y volcarlo al borrador', async () => {
      autenticado.set(false);
      await crear();

      expect(componente.perros()).toEqual([]);
      expect(fixture.nativeElement.querySelector('.mv2__aviso')).not.toBeNull();

      componente.form.patchValue({ especie: 'gato', tamano: TamanoPerro.MINI, numero: 3, personas: 'x' });

      expect(store.borrador().especieManual).toBe('gato');
      expect(store.borrador().numeroManual).toBe(3);
      expect(store.borrador().personas).toBe(1);
      expect(store.mascotasDelViaje()).toHaveLength(3);
      expect(componente.sinMascotas()).toBe(false);

      componente.continuar();
      expect(router.navigate).toHaveBeenCalledWith(['/transporte/viaje/resultados']);
    });

    it('debería pedir personas y equipaje sólo si viaja con el dueño', async () => {
      autenticado.set(false);
      await crear();

      const radio = fixture.nativeElement.querySelector(`input[value="${ModalidadTransporte.CON_PROPIETARIO}"]`) as HTMLInputElement;
      radio.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(store.borrador().modalidad).toBe(ModalidadTransporte.CON_PROPIETARIO);
      expect(fixture.nativeElement.textContent).toContain('Equipaje');
    });
  });
});
