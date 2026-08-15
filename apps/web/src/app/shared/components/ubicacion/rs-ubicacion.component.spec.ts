import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsUbicacionComponent } from './rs-ubicacion.component';

describe('RsUbicacionComponent', () => {
  let fixture: ComponentFixture<RsUbicacionComponent>;

  const crear = (lugar: Record<string, unknown>): void => {
    fixture = TestBed.createComponent(RsUbicacionComponent);
    fixture.componentRef.setInput('lugar', lugar);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsUbicacionComponent] }).compileComponents();
  });

  it('debería pintar el mapa y los dos atajos cuando hay coordenadas', () => {
    crear({ lat: 40.4148, lng: -3.6873, direccion: 'Calle de Alfonso XII 40', ciudad: 'Madrid', nombre: 'Villa Canina' });

    const enlaces: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));
    expect(fixture.nativeElement.querySelector('rs-mapa')).toBeTruthy();
    expect(enlaces.map((a) => a.textContent?.trim())).toEqual(['Ver en Google Maps', 'Cómo llegar']);
    expect(enlaces[0].href).toContain('40.4148');
    // Se abre fuera para no perder la reserva a medias.
    expect(enlaces[0].target).toBe('_blank');
    expect(enlaces[0].rel).toContain('noopener');
  });

  it('debería mostrar la dirección junto a la ciudad', () => {
    crear({ lat: 40.4, lng: -3.7, direccion: 'Calle de Alfonso XII 40', ciudad: 'Madrid' });

    expect(fixture.nativeElement.querySelector('.ubi__direccion').textContent)
      .toContain('Calle de Alfonso XII 40 · Madrid');
  });

  it('no debería pintar mapa sin coordenadas, pero sí ofrecer los enlaces por dirección', () => {
    // Un mapa centrado en el país no dice nada; la dirección escrita sí sirve.
    crear({ direccion: 'Calle de Velázquez 45', ciudad: 'Madrid', nombre: 'Peluquería Guau' });

    expect(fixture.nativeElement.querySelector('rs-mapa')).toBeNull();
    expect(fixture.nativeElement.querySelector('.ubi__sin-mapa')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('a').length).toBe(2);
  });

  it('no debería ofrecer enlaces cuando no hay ni punto ni dirección', () => {
    crear({ nombre: 'Servicio sin ubicar' });

    expect(fixture.nativeElement.querySelectorAll('a').length).toBe(0);
  });
});
