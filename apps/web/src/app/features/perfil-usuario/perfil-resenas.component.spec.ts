import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { PerfilResenasComponent } from './perfil-resenas.component';
import { AuthService } from '../../core/auth/auth.service';
import { ReviewsService, ResenaApi, PendienteDeValorarApi } from '../reservas/services/reviews.service';

const resena = (overrides: Partial<ResenaApi>): ResenaApi => ({
  _id: 'r1',
  reservaId: 'res-1',
  servicioTitulo: 'Suite Canina',
  vertical: 'alojamiento',
  puntuacion: 5,
  comentario: 'Genial experiencia',
  createdAt: new Date('2026-01-01').toISOString(),
  ...overrides,
});

const pendiente = (overrides: Partial<PendienteDeValorarApi>): PendienteDeValorarApi => ({
  reservaId: 'res-2',
  servicioId: 's2',
  servicioTitulo: 'Hotel Canino',
  vertical: 'alojamiento',
  imagen: null,
  fechaInicio: new Date('2026-01-05').toISOString(),
  ...overrides,
});

describe('PerfilResenasComponent', () => {
  let fixture: ComponentFixture<PerfilResenasComponent>;
  let componente: PerfilResenasComponent;
  let reviewsService: jest.Mocked<Pick<ReviewsService, 'misResenas' | 'pendientesDeValorar' | 'crear' | 'actualizar' | 'eliminar'>>;

  const crear = async (resenas: ResenaApi[], pendientes: PendienteDeValorarApi[]): Promise<void> => {
    reviewsService = {
      misResenas: jest.fn().mockResolvedValue(resenas),
      pendientesDeValorar: jest.fn().mockResolvedValue(pendientes),
      crear: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PerfilResenasComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            usuario: signal({ id: 'user-1' }),
            estaAutenticado: signal(true),
            esAdmin: signal(false),
            esComercio: signal(false),
            logout: jest.fn(),
          },
        },
        { provide: ReviewsService, useValue: reviewsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilResenasComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  it('debería cargar reseñas y pendientes al iniciar', async () => {
    await crear([resena({})], [pendiente({})]);

    expect(componente.resenas()).toHaveLength(1);
    expect(componente.pendientes()).toHaveLength(1);
    expect(componente.cargando()).toBe(false);
  });

  it('debería mostrar el estado vacío si no hay reseñas ni pendientes', async () => {
    await crear([], []);

    expect(componente.huboAlgunaVez()).toBe(false);
  });

  describe('filtros', () => {
    it('debería excluir las eliminadas del filtro "todas"', async () => {
      await crear([resena({ _id: 'a' }), resena({ _id: 'b', eliminada: true })], []);

      expect(componente.resenasVisibles().map((r) => r._id)).toEqual(['a']);
    });

    it('debería mostrar solo publicadas en el filtro "publicadas"', async () => {
      await crear([resena({ _id: 'a' }), resena({ _id: 'b', eliminada: true })], []);
      componente.filtro.set('publicadas');

      expect(componente.resenasVisibles().map((r) => r._id)).toEqual(['a']);
    });

    it('debería mostrar solo las que tienen respuesta en el filtro "conRespuesta"', async () => {
      await crear([resena({ _id: 'a', respuesta: 'Gracias!' }), resena({ _id: 'b' })], []);
      componente.filtro.set('conRespuesta');

      expect(componente.resenasVisibles().map((r) => r._id)).toEqual(['a']);
    });

    it('debería mostrar solo las eliminadas en el filtro "eliminadas"', async () => {
      await crear([resena({ _id: 'a' }), resena({ _id: 'b', eliminada: true })], []);
      componente.filtro.set('eliminadas');

      expect(componente.resenasVisibles().map((r) => r._id)).toEqual(['b']);
    });

    it('no debería mostrar reseñas en el filtro "pendientes"', async () => {
      await crear([resena({})], []);
      componente.filtro.set('pendientes');

      expect(componente.resenasVisibles()).toEqual([]);
    });
  });

  describe('formulario de reseña', () => {
    it('debería abrir el formulario de creación con los aspectos del vertical de la pendiente', async () => {
      await crear([], [pendiente({ vertical: 'peluqueria' })]);

      componente.abrirFormularioCrear(componente.pendientes()[0]);

      expect(componente.formulario()?.modo).toBe('crear');
      expect(componente.aspectosDelFormulario().map((a) => a.key)).toEqual(['resultado', 'tratoAlPerro', 'puntualidad']);
    });

    it('debería crear la reseña y quitar la pendiente de la lista', async () => {
      const p = pendiente({});
      await crear([], [p]);
      const creada = resena({ _id: 'nueva' });
      reviewsService.crear.mockResolvedValue(creada);

      componente.abrirFormularioCrear(p);
      componente.comentarioCtrl.setValue('Muy buena experiencia');
      componente.puntuacion.set(4);

      await componente.guardar();

      expect(reviewsService.crear).toHaveBeenCalledWith(
        expect.objectContaining({ reservaId: p.reservaId, puntuacion: 4, comentario: 'Muy buena experiencia' }),
      );
      expect(componente.pendientes()).toHaveLength(0);
      expect(componente.resenas().map((r) => r._id)).toContain('nueva');
      expect(componente.formulario()).toBeNull();
    });

    it('no debería guardar si el comentario es demasiado corto', async () => {
      await crear([], [pendiente({})]);
      componente.abrirFormularioCrear(componente.pendientes()[0]);
      componente.comentarioCtrl.setValue('corto');

      await componente.guardar();

      expect(reviewsService.crear).not.toHaveBeenCalled();
    });

    it('debería editar una reseña existente', async () => {
      const r = resena({ _id: 'r1', puntuacion: 3 });
      await crear([r], []);
      const actualizada = { ...r, puntuacion: 5 };
      reviewsService.actualizar.mockResolvedValue(actualizada);

      componente.abrirFormularioEditar(r);
      componente.puntuacion.set(5);
      await componente.guardar();

      expect(reviewsService.actualizar).toHaveBeenCalledWith('r1', expect.objectContaining({ puntuacion: 5 }));
      expect(componente.resenas()[0].puntuacion).toBe(5);
    });
  });

  describe('eliminar', () => {
    it('debería marcar la reseña como eliminada de forma optimista', async () => {
      const r = resena({ _id: 'r1' });
      await crear([r], []);
      reviewsService.eliminar.mockResolvedValue(undefined);

      await componente.eliminar(r);

      expect(componente.resenas()[0].eliminada).toBe(true);
    });

    it('debería revertir si falla la eliminación', async () => {
      const r = resena({ _id: 'r1' });
      await crear([r], []);
      reviewsService.eliminar.mockRejectedValue(new Error('fallo'));

      await componente.eliminar(r);

      expect(componente.resenas()[0].eliminada).toBeFalsy();
    });
  });

  describe('reputación del reseñador (HU-11.5)', () => {
    const varias = (n: number, extra: Partial<ResenaApi> = {}): ResenaApi[] =>
      Array.from({ length: n }, (_, i) => resena({ _id: `r${i}`, ...extra }));

    it('no debería mostrar reputación sin reseñas publicadas', async () => {
      await crear([], [pendiente({})]);

      expect(componente.reputacion()).toBeNull();
    });

    it('debería empezar en Colaborador con la primera reseña', async () => {
      await crear([resena({ puntuacion: 4 })], []);

      const rep = componente.reputacion()!;
      expect(rep.nivelLabel).toBe('Colaborador');
      expect(rep.total).toBe(1);
      expect(rep.media).toBe(4);
      expect(rep.siguiente).toEqual({ falta: 9, label: 'Experto' });
    });

    it('debería subir a Experto a partir de 10 reseñas', async () => {
      await crear(varias(10), []);

      expect(componente.reputacion()!.nivelLabel).toBe('Experto');
    });

    it('debería marcar el máximo reconocimiento sin siguiente nivel', async () => {
      await crear(varias(25), []);

      const rep = componente.reputacion()!;
      expect(rep.nivelLabel).toBe('Embajador Doogking');
      expect(rep.siguiente).toBeNull();
    });

    it('no debería contar las reseñas eliminadas en la reputación', async () => {
      await crear([resena({ _id: 'r1' }), resena({ _id: 'r2', eliminada: true })], []);

      expect(componente.reputacion()!.total).toBe(1);
    });

    it('debería contar cuántas reseñas llevan fotos', async () => {
      await crear([resena({ _id: 'r1', fotos: ['a.jpg'] }), resena({ _id: 'r2' })], []);

      expect(componente.reputacion()!.conFotos).toBe(1);
    });
  });
});
