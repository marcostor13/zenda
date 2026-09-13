import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ComercioMascotasComponent } from './comercio-mascotas.component';
import { ExpedienteService, MascotaComercioApi } from '../perros/expediente.service';

describe('ComercioMascotasComponent', () => {
  let fixture: ComponentFixture<ComercioMascotasComponent>;
  let component: ComercioMascotasComponent;

  const mascota = (extra: Partial<MascotaComercioApi>): MascotaComercioApi => ({
    perroId: 'p1', nombre: 'Nala', raza: 'Beagle', alergias: [], enfermedades: [], tieneMedicacion: false,
    propietario: { nombre: 'Ana Ruiz', telefono: '600' }, totalReservas: 1, serviciosCompletados: 1,
    verticales: ['veterinaria'], totalRegistros: 0, ultimoServicio: '2026-09-01',
    ...extra,
  });

  const crear = async (resultado: Promise<MascotaComercioApi[]>) => {
    await TestBed.configureTestingModule({
      imports: [ComercioMascotasComponent],
      providers: [provideRouter([]), { provide: ExpedienteService, useValue: { mascotasDelComercio: () => resultado } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ComercioMascotasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };

  it('debería listar las mascotas con su dueño y enlace al expediente', async () => {
    await crear(Promise.resolve([
      mascota({ fechaNacimiento: '2020-01-01', peso: 12 }),
      mascota({ perroId: 'p2', nombre: 'Toby', raza: undefined, alergias: ['Pollo'], enfermedades: ['Otitis'], tieneMedicacion: true, totalRegistros: 2, propietario: {} }),
    ]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Nala');
    expect(el.textContent).toContain('Ana Ruiz');
    expect(el.querySelector('a[href="/comercio/mascotas/p1"]')).not.toBeNull();
    expect(component.sinRegistros()).toBe(1);
    expect(component.conAlertas()).toBe(1);
  });

  it('debería filtrar por búsqueda sin tildes y por los indicadores', async () => {
    await crear(Promise.resolve([
      mascota({}),
      mascota({ perroId: 'p2', nombre: 'Toby', propietario: { nombre: 'Luis Gómez' }, alergias: ['Pollo'], totalRegistros: 3 }),
    ]));

    component.busqueda.set('gomez');
    expect(component.visibles().map((m) => m.perroId)).toEqual(['p2']);

    component.busqueda.set('');
    component.alternar('sinRegistros');
    expect(component.visibles().map((m) => m.perroId)).toEqual(['p1']);
    component.alternar('conAlertas');
    expect(component.visibles().map((m) => m.perroId)).toEqual(['p2']);
    component.alternar('conAlertas');
    expect(component.filtro()).toBe('todas');

    component.busqueda.set('zzz');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ninguna mascota coincide');
  });

  it('debería mostrar el estado vacío', async () => {
    await crear(Promise.resolve([]));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Todavía no hay mascotas');
  });

  it('debería avisar si la carga falla', async () => {
    await crear(Promise.reject(new Error('x')));
    expect(component.error()).toContain('No se pudieron cargar las mascotas');
  });
});
