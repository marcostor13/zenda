import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { AlojamientoDetalleComponent } from './alojamiento-detalle.component';
import { AlojamientoService, AlojamientoDetalle, Espacio } from '../services/alojamiento.service';

describe('AlojamientoDetalleComponent', () => {
  let fixture: ComponentFixture<AlojamientoDetalleComponent>;
  let component: AlojamientoDetalleComponent;
  let alojamientoService: jest.Mocked<AlojamientoService>;

  const espacioMock: Espacio = {
    id: 'e1',
    tipo: 'suite',
    descripcion: 'Suite climatizada',
    tamanoMaxPerro: 'grande',
    precioNoche: 45,
    cantidad: 4,
    disponible: true,
    amenities: ['Climatización'],
    imagenes: ['img.jpg'],
    cancelacionGratis: true,
  };

  const detalleMock: AlojamientoDetalle = {
    id: 'a1',
    nombre: 'Royal Paws Retreat',
    ciudad: 'Madrid',
    barrio: 'Pozuelo',
    direccion: 'Camino de la Dehesa 12',
    score: 5.0,
    scoreLabel: 'Excepcional',
    numResenas: 128,
    precioPorNoche: 45,
    imagenes: ['img1.jpg', 'img2.jpg'],
    amenities: ['Piscina para perros'],
    cancelacionGratis: true,
    paseosIncluidos: true,
    espaciosDisponibles: 4,
    destacado: true,
    descripcion: 'Alojamiento canino de lujo',
    politicaCancelacion: 'Gratis hasta 24h antes',
    checkIn: '10:00',
    checkOut: '19:00',
    requisitoVacunas: true,
    camaras24h: true,
    espacios: [espacioMock],
    resenas: [],
    scoreDesglose: { limpieza: 5, ubicacion: 5, cuidado: 5, valorPrecio: 4.8, instalaciones: 5, personal: 5 },
    reglas: ['Cartilla de vacunación al día obligatoria'],
    comercioId: 'c1',
    compatibilidadSocialAdmitida: [],
    requisitoMicrochip: false,
    requiereDesparasitacionInterna: false,
    requiereDesparasitacionExterna: false,
    requiereVacunaTosPerreras: false,
    serviciosAdicionales: [],
  };

  beforeEach(async () => {
    alojamientoService = { buscar: jest.fn(), obtener: jest.fn() } as any;
    alojamientoService.obtener.mockResolvedValue(detalleMock);

    await TestBed.configureTestingModule({
      imports: [AlojamientoDetalleComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: AlojamientoService, useValue: alojamientoService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AlojamientoDetalleComponent);
    component = fixture.componentInstance;
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  it('debería cargar el detalle del alojamiento al iniciar', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(alojamientoService.obtener).toHaveBeenCalled();
    expect(component.alojamiento()?.nombre).toBe('Royal Paws Retreat');
    expect(component.cargando()).toBe(false);
  });

  it('debería mostrar los espacios con su precio por noche', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const html: string = fixture.nativeElement.innerHTML;
    expect(html).toContain('Tipos de espacio');
    expect(html).toContain('€45');
    expect(html).toContain('por noche');
  });

  it('debería alternar la selección de un espacio', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.seleccionarEspacio(espacioMock);
    expect(component.espacioSelec()?.id).toBe('e1');

    component.seleccionarEspacio(espacioMock);
    expect(component.espacioSelec()).toBeNull();
  });

  it('no debería navegar a reserva sin espacio seleccionado', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate');

    component.irAReserva();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('debería navegar a /reservas/alojamiento con el espacio seleccionado', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.seleccionarEspacio(espacioMock);
    component.irAReserva();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/reservas', 'alojamiento', 'a1'],
      expect.objectContaining({
        queryParams: expect.objectContaining({ espacioId: 'e1', precioBase: 45 }),
      }),
    );
  });

  it('debería traducir tipo y tamaño de perro a etiquetas en español', () => {
    expect(component.tipoLabel('suite')).toBe('Suite individual');
    expect(component.tipoLabel('compartido')).toBe('Espacio compartido');
    expect(component.tamanoLabel('pequeno')).toBe('pequeño');
    expect(component.tamanoLabel('gigante')).toBe('gigante');
  });

  it('debería quedar sin detalle (no encontrado, sin mock) si la API falla', async () => {
    alojamientoService.obtener.mockRejectedValue(new Error('offline'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.alojamiento()).toBeNull();
    expect(component.cargando()).toBe(false);
  });
});
