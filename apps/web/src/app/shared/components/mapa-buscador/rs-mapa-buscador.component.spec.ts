import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RsMapaBuscadorComponent } from './rs-mapa-buscador.component';
import type { ZonaMapa } from '../mapa/rs-mapa.component';

/**
 * Leaflet no arranca de verdad en jsdom, así que aquí se verifica la lógica de
 * la que depende la búsqueda por mapa: cuándo se pide una nueva búsqueda, cuándo
 * se deja en espera y qué se le cuenta al usuario.
 */
describe('RsMapaBuscadorComponent', () => {
  let fixture: ComponentFixture<RsMapaBuscadorComponent>;
  let componente: RsMapaBuscadorComponent;

  const zona: ZonaMapa = {
    swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6,
    centroLat: 40.4, centroLng: -3.7, zoom: 12,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RsMapaBuscadorComponent, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(RsMapaBuscadorComponent);
    componente = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('debería buscar al mover el mapa cuando la opción está activada', () => {
    const emitidas: ZonaMapa[] = [];
    componente.zonaBuscada.subscribe((z) => emitidas.push(z));

    componente.alMoverMapa(zona);

    expect(emitidas).toEqual([zona]);
    expect(componente.zonaPendiente()).toBeNull();
  });

  it('debería dejar la zona en espera con la búsqueda automática apagada', () => {
    const emitidas: ZonaMapa[] = [];
    componente.buscarAlMover.set(false);
    componente.zonaBuscada.subscribe((z) => emitidas.push(z));

    componente.alMoverMapa(zona);

    expect(emitidas).toEqual([]);
    expect(componente.zonaPendiente()).toEqual(zona);

    componente.buscarEnEstaZona();
    expect(emitidas).toEqual([zona]);
    expect(componente.zonaPendiente()).toBeNull();
  });

  it('debería buscar la zona en espera al reactivar la búsqueda automática', () => {
    const emitidas: ZonaMapa[] = [];
    componente.buscarAlMover.set(false);
    componente.alMoverMapa(zona);
    componente.zonaBuscada.subscribe((z) => emitidas.push(z));

    componente.alternarAuto();

    // Sin esto habría que mover el mapa un pixel para que reaccionase.
    expect(componente.buscarAlMover()).toBe(true);
    expect(emitidas).toEqual([zona]);
  });

  it('debería dejar de reencuadrar en cuanto el usuario mueve el mapa', () => {
    expect(componente.autoencuadre()).toBe(true);
    componente.alMoverMapa(zona);
    // A partir de aquí la vista es del usuario: recolocarla sería pelearse con él.
    expect(componente.autoencuadre()).toBe(false);
  });

  it('debería centrar el mapa en la población elegida', () => {
    componente.irALugar({ placeId: 'p1', ciudad: 'Valencia', lat: 39.47, lng: -0.376 });

    expect(componente.centro()).toEqual({ lat: 39.47, lng: -0.376, zoom: 13 });
  });

  it('no debería centrar en una población sin coordenadas', () => {
    // El catálogo local sugiere poblaciones sin `placeId` real ni coordenadas.
    componente.irALugar({ placeId: '', ciudad: 'Cuenca', lat: NaN, lng: NaN });

    expect(componente.centro()).toBeNull();
  });

  it('debería avisar de los resultados que no caben en el mapa por no tener ubicación', () => {
    fixture.componentRef.setInput('total', 12);
    fixture.componentRef.setInput('puntos', [
      { id: 'a1', lat: 40.4, lng: -3.7 },
      { id: 'a2', lat: 40.5, lng: -3.6 },
    ]);

    expect(componente.resumen()).toBe('12 resultados · 10 sin ubicación exacta');
  });

  it('debería decirlo claramente cuando la zona está vacía', () => {
    fixture.componentRef.setInput('total', 0);

    expect(componente.resumen()).toBe('Sin resultados en esta zona');
  });

  it('refrescar debería ser seguro aunque el mapa no se haya montado', () => {
    expect(() => componente.refrescar()).not.toThrow();
  });
});
