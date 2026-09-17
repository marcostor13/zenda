import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PerroFichaComponent } from './perro-ficha.component';
import { ExpedienteApi, ExpedienteService } from './expediente.service';
import { PerroApi, PerrosService } from './perros.service';

// Compila una página entera con sus hijos: con la suite completa en paralelo, 5 s no llegan.
jest.setTimeout(20_000);

describe('PerroFichaComponent', () => {
  let fixture: ComponentFixture<PerroFichaComponent>;
  let component: PerroFichaComponent;
  let expedientes: { delPropietario: jest.Mock; descargarInformePropietario: jest.Mock };

  const futuro = new Date(Date.now() + 10 * 86_400_000).toISOString();
  const perro = {
    _id: 'p1', nombre: 'Nala', fotos: [], especie: 'perro', raza: 'Beagle', esMestizo: false, esterilizado: true,
    tipoPelo: [], vacunas: [], alergias: ['Pollo'], enfermedades: [], medicacion: ['Apoquel'], puedeQuedarseSolo: true,
    ansiedadSeparacion: false, miedos: [], seMarea: false, requiereTransportin: false, autorizaCompartirHistorial: true,
    microchip: '941',
  } as PerroApi;

  const expediente = (extra: Partial<ExpedienteApi> = {}): ExpedienteApi => ({
    perro: perro as ExpedienteApi['perro'],
    registros: [
      { _id: 'r1', vertical: 'veterinaria', origen: 'comercio', titulo: 'Revisión anual', nota: 'Revisión anual',
        datosEstructurados: {}, fechaServicio: '2026-09-01', comercioNombre: 'Clínica Royal', esPropio: false },
    ],
    servicios: [
      { reservaId: 's1', codigo: 'RES-1', vertical: 'veterinaria', comercioId: 'c1', comercioNombre: 'Clínica Royal',
        fechaInicio: '2026-08-01', estado: 'completada' },
      { reservaId: 's2', codigo: 'RES-2', vertical: 'peluqueria', comercioId: 'c2', comercioNombre: 'Pelu Canina',
        fechaInicio: futuro, estado: 'confirmada' },
    ],
    ...extra,
  });

  const crear = async (opciones: { falla?: boolean; tab?: string; embebidaCon?: string } = {}) => {
    expedientes = {
      delPropietario: opciones.falla ? jest.fn(() => rechazo(new Error('x'))) : jest.fn().mockResolvedValue(expediente()),
      descargarInformePropietario: jest.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [PerroFichaComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ExpedienteService, useValue: expedientes },
        { provide: PerrosService, useValue: { bienestar: jest.fn().mockResolvedValue({ perroId: 'p1', puntuacion: 80, nivel: 'muy_bueno', descuentoSeguroPct: 0, ejes: [{ clave: 'v', etiqueta: 'Vacunas', puntos: 20, maximo: 25 }] }) } },
        // Incrustada no hay `:id` en la ruta: la mascota llega por la entrada.
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(opciones.embebidaCon ? {} : { id: 'p1' }), queryParamMap: convertToParamMap(opciones.tab ? { tab: opciones.tab } : {}) } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PerroFichaComponent);
    component = fixture.componentInstance;
    if (opciones.embebidaCon) {
      fixture.componentRef.setInput('perroId', opciones.embebidaCon);
      fixture.componentRef.setInput('embebida', true);
    }
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };

  it('debería cargar la ficha con avisos de salud, indicadores y actividad reciente', async () => {
    await crear();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(expedientes.delPropietario).toHaveBeenCalledWith('p1');
    expect(texto).toContain('Nala');
    expect(texto).toContain('Pollo');
    expect(texto).toContain('Revisión anual');
    expect(texto).toContain('Próximas reservas');
    expect(component.realizados()).toHaveLength(1);
    expect(component.ultimoVeterinario()).toBe('2026-09-01');
    expect(component.proximaCita()).toBe(futuro);
    expect(component.bienestar()?.puntuacion).toBe(80);
  });

  it('debería abrir la pestaña indicada en la URL', async () => {
    await crear({ tab: 'historial' });
    expect(component.pestana()).toBe('historial');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Servicios reservados en Doogking');
  });

  it('debería cambiar de pestaña y reflejarlo en la URL', async () => {
    await crear();
    const navegar = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    for (const pestana of ['salud', 'comportamiento', 'documentos', 'resumen'] as const) {
      component.irA(pestana);
      fixture.detectChanges();
    }

    expect(navegar).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { tab: null } }));
  });

  it('debería descargar el PDF y avisar si falla', async () => {
    await crear();
    await component.descargarPdf();
    expect(expedientes.descargarInformePropietario).toHaveBeenCalledWith('p1', 'Nala');

    expedientes.descargarInformePropietario.mockRejectedValue(new Error('x'));
    await component.descargarPdf();
    expect(component.avisoPdf()).toContain('No se pudo generar el PDF');
  });

  it('debería mostrar un error si la ficha no carga', async () => {
    await crear({ falla: true });
    expect(component.error()).toBe('No se pudo cargar la ficha de tu perro.');
  });

  describe('incrustada en /perros', () => {
    it('debería cargar la mascota que le pasan, sin `:id` en la ruta', async () => {
      await crear({ embebidaCon: 'p9' });

      expect(expedientes.delPropietario).toHaveBeenCalledWith('p9');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nala');
    });

    it('no debería repetir el navbar ni el enlace de vuelta que ya pone la página', async () => {
      await crear({ embebidaCon: 'p1' });
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector('rs-navbar')).toBeNull();
      expect(el.querySelector('.volver')).toBeNull();
      expect(el.querySelector('.dk-pagina')).toBeNull();
    });
  });

  it('debería traducir estados y categorías con respaldo', async () => {
    await crear();
    expect(component.estado('confirmada')).toBe('Confirmada');
    expect(component.estado('raro')).toBe('raro');
    expect(component.etiqueta('veterinaria')).toBe('Veterinarios');
    expect(component.icono('veterinaria')).toBeTruthy();
  });
});

/** Rechazo ya observado: Zone no lo da por no gestionado antes de que el componente lo espere. */
function rechazo(error: unknown): Promise<never> {
  const promesa = Promise.reject(error);
  promesa.catch(() => undefined);
  return promesa;
}
