import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ValorarTokenComponent } from './valorar-token.component';
import { ReviewsService } from '../services/reviews.service';

describe('ValorarTokenComponent', () => {
  let fixture: ComponentFixture<ValorarTokenComponent>;
  let componente: ValorarTokenComponent;
  let httpMock: HttpTestingController;
  let reviews: Record<string, jest.Mock>;

  const crear = async (
    respuesta: { cuerpo: unknown; estado?: number } = { cuerpo: { reservaId: 'r1', codigo: 'RES-AAAA1111' } },
    token = 'tok-1',
  ): Promise<void> => {
    reviews = { crear: jest.fn().mockResolvedValue({ _id: 'rev1' }) };

    await TestBed.configureTestingModule({
      imports: [ValorarTokenComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReviewsService, useValue: reviews },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token }) } },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ValorarTokenComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes(`/eventos/valoracion/${token}`));
    const cuerpo = respuesta.cuerpo as Record<string, unknown> | null;
    if (respuesta.estado) {
      req.flush(cuerpo, { status: respuesta.estado, statusText: 'Error' });
    } else {
      req.flush(cuerpo);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    httpMock.verify();
  });

  describe('apertura del enlace', () => {
    it('debería identificar la reserva a valorar', async () => {
      await crear();

      expect(componente.codigo()).toBe('RES-AAAA1111');
      expect(componente.error()).toBe('');
      expect(componente.cargando()).toBe(false);
    });

    it('debería explicar por qué el enlace no sirve', async () => {
      await crear({ cuerpo: { message: 'Esta reserva ya fue valorada' }, estado: 409 });

      expect(componente.error()).toBe('Esta reserva ya fue valorada');
    });

    it('debería dar un mensaje genérico si el servidor no explica el fallo', async () => {
      await crear({ cuerpo: null, estado: 404 });

      expect(componente.error()).toBe('Este enlace ya no es válido.');
      expect(componente.cargando()).toBe(false);
    });
  });

  describe('envío de la valoración', () => {
    it('debería exigir un comentario con contenido', async () => {
      await crear();
      componente.comentario = 'corto';

      await componente.enviar();

      // Una reseña de dos palabras no ayuda a quien compara servicios.
      expect(reviews['crear']).not.toHaveBeenCalled();
      expect(componente.errorEnvio()).toContain(String(componente.minimo));
    });

    it('debería publicar puntuación y comentario recortado', async () => {
      await crear();
      componente.puntuacion.set(4);
      componente.comentario = `  ${'Trato excelente y muy atentos con mi perro.'}  `;

      await componente.enviar();

      expect(reviews['crear']).toHaveBeenCalledWith({
        reservaId: 'r1', puntuacion: 4,
        comentario: 'Trato excelente y muy atentos con mi perro.',
      });
      expect(componente.enviada()).toBe(true);
      expect(componente.enviando()).toBe(false);
    });

    it('debería mostrar el motivo del rechazo del servidor', async () => {
      await crear();
      reviews['crear'].mockRejectedValue({ error: { message: 'Ya has valorado esta reserva' } });
      componente.comentario = 'Trato excelente y muy atentos con mi perro.';

      await componente.enviar();

      expect(componente.errorEnvio()).toBe('Ya has valorado esta reserva');
      expect(componente.enviada()).toBe(false);
    });

    it('debería dar un mensaje genérico si el fallo no trae motivo', async () => {
      await crear();
      reviews['crear'].mockRejectedValue({});
      componente.comentario = 'Trato excelente y muy atentos con mi perro.';

      await componente.enviar();

      expect(componente.errorEnvio()).toBe('No se pudo publicar la valoración.');
    });
  });
});
