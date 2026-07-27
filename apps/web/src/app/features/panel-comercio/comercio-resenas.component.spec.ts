import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { VerticalKey } from 'shared';
import { ComercioResenasComponent } from './comercio-resenas.component';
import { ComercioApiService, MiResena } from './comercio-api.service';

const resena = (extra: Partial<MiResena> = {}): MiResena => ({
  _id: 'rev1', servicioId: 's1', servicioTitulo: 'Residencia Royal', vertical: VerticalKey.ALOJAMIENTO,
  puntuacion: 5, comentario: 'Genial', usuarioNombre: 'Ana',
  createdAt: '2026-07-01T00:00:00.000Z', respuesta: null,
  ...extra,
});

/** Fallo síncrono: una promesa rechazada la reporta zone.js como error global. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('ComercioResenasComponent', () => {
  let fixture: ComponentFixture<ComercioResenasComponent>;
  let componente: ComercioResenasComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (resenas: MiResena[] = [resena()], ajustes: Record<string, jest.Mock> = {}): Promise<void> => {
    api = {
      getMisResenas: jest.fn().mockReturnValue(of(resenas)),
      responderResena: jest.fn().mockReturnValue(of(resena({ respuesta: 'Gracias' }))),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [ComercioResenasComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioResenasComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('carga', () => {
    it('debería cargar las reseñas del comercio', async () => {
      await crear([resena(), resena({ _id: 'rev2' })]);

      expect(componente.resenas()).toHaveLength(2);
      expect(componente.cargando()).toBe(false);
    });

    it('debería mostrar el estado vacío real si el API falla', async () => {
      await crear([], { getMisResenas: fallo('500') });

      // Nunca inventar reseñas: el comercio tomaría decisiones sobre datos falsos.
      expect(componente.resenas()).toEqual([]);
      expect(componente.cargando()).toBe(false);
    });
  });

  describe('resumen', () => {
    it('debería promediar las puntuaciones', async () => {
      await crear([resena({ puntuacion: 5 }), resena({ _id: 'rev2', puntuacion: 4 })]);

      expect(componente.promedioNum()).toBe(4.5);
      expect(componente.promedioGeneral()).toBe('4.5');
    });

    it('no debería mostrar promedio sin reseñas', async () => {
      await crear([]);

      expect(componente.promedioNum()).toBe(0);
      expect(componente.promedioGeneral()).toBeNull();
    });

    it('debería contar las reseñas pendientes de responder', async () => {
      await crear([resena(), resena({ _id: 'rev2', respuesta: 'Gracias' })]);

      expect(componente.sinResponder()).toBe(1);
    });

    it('debería repartir las reseñas por número de estrellas', async () => {
      await crear([resena({ puntuacion: 5 }), resena({ _id: 'rev2', puntuacion: 5 }), resena({ _id: 'rev3', puntuacion: 3 })]);

      expect(componente.countEstrellas(5)).toBe(2);
      expect(componente.pctEstrellas(5)).toBeCloseTo(66.67, 1);
      expect(componente.pctEstrellas(1)).toBe(0);
    });

    it('no debería dividir por cero sin reseñas', async () => {
      await crear([]);

      expect(componente.pctEstrellas(5)).toBe(0);
    });

    it('debería pintar tantas estrellas como la puntuación redondeada', async () => {
      await crear();

      expect(componente.estrellas(4.6).filter(Boolean)).toHaveLength(5);
      expect(componente.estrellas(3.2).filter(Boolean)).toHaveLength(3);
    });

    it('debería distinguir visualmente las puntuaciones bajas', async () => {
      await crear();

      expect(componente.puntBadge(5)).toContain('success');
      expect(componente.puntBadge(3)).toContain('warning');
      expect(componente.puntBadge(1)).toContain('error');
    });

    it('debería dar un icono por vertical', async () => {
      await crear();

      expect(componente.iconVertical(VerticalKey.ALOJAMIENTO)).toBeTruthy();
      expect(componente.iconVertical('inventado')).toBe('building');
    });
  });

  describe('respuesta pública', () => {
    it('debería abrir el editor en blanco', async () => {
      await crear();
      componente.respuestaCtrl.setValue('borrador anterior');

      componente.abrirRespuesta('rev1');

      expect(componente.respondiendoId()).toBe('rev1');
      expect(componente.respuestaCtrl.value).toBe('');
    });

    it('no debería publicar una respuesta vacía', async () => {
      await crear();
      componente.abrirRespuesta('rev1');

      await componente.enviarRespuesta('rev1');

      expect(api['responderResena']).not.toHaveBeenCalled();
      expect(componente.errorRespuesta()).toContain('Escribe una respuesta');
    });

    it('debería publicar la respuesta y mostrarla en la reseña', async () => {
      await crear();
      componente.abrirRespuesta('rev1');
      componente.respuestaCtrl.setValue('Gracias');

      await componente.enviarRespuesta('rev1');

      expect(api['responderResena']).toHaveBeenCalledWith('rev1', 'Gracias');
      expect(componente.resenas()[0].respuesta).toBe('Gracias');
      expect(componente.respondiendoId()).toBeNull();
      expect(componente.enviando()).toBe(false);
    });

    it('debería cerrar el editor descartando el borrador', async () => {
      await crear();
      componente.abrirRespuesta('rev1');
      componente.respuestaCtrl.setValue('Gracias');

      componente.cancelarRespuesta();

      expect(componente.respondiendoId()).toBeNull();
      expect(componente.respuestaCtrl.value).toBe('');
    });
  });
});
