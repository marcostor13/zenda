import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TipoHistorial, Vacuna, VerticalKey } from 'shared';
import { PerrosService, PerroApi, porcentajeCompletitud } from './perros.service';

describe('PerrosService', () => {
  let service: PerrosService;
  let httpMock: HttpTestingController;

  const resolver = (fragmento: string, respuesta: unknown = {}) => {
    const req = httpMock.expectOne((r) => r.url.includes(fragmento));
    req.flush(respuesta as Record<string, unknown>);
    return req.request;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PerrosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('ficha', () => {
    it('debería listar los perros propios', async () => {
      const promesa = service.misPerros();

      expect(resolver('/perros/mis', []).method).toBe('GET');
      await promesa;
    });

    it('debería enviar las vacunas con su fecha al crear', async () => {
      const payload = {
        nombre: 'Maya',
        vacunasDetalle: [{ tipo: Vacuna.ANTIRRABICA, fecha: '2026-03-01' }],
      };
      const promesa = service.crear(payload);

      const req = resolver('/perros', { _id: 'p1' });
      expect(req.method).toBe('POST');
      expect(req.body.vacunasDetalle).toEqual(payload.vacunasDetalle);

      await promesa;
    });

    it('debería actualizar con PATCH, no reemplazar la ficha entera', async () => {
      const promesa = service.actualizar('p1', { peso: 15 });

      const req = resolver('/perros/p1');
      expect(req.method).toBe('PATCH');
      expect(req.body).toEqual({ peso: 15 });

      await promesa;
    });

    it('debería eliminar con DELETE', async () => {
      const promesa = service.eliminar('p1');

      expect(resolver('/perros/p1').method).toBe('DELETE');
      await promesa;
    });

    it('debería pedir el Índice de Bienestar en su propia ruta (HU-8.1.7)', async () => {
      const promesa = service.bienestar('p1');

      expect(resolver('/perros/p1/bienestar').url).toContain('/bienestar');
      await promesa;
    });
  });

  describe('historial', () => {
    it('debería editar una entrada enviando solo la nota', async () => {
      const promesa = service.editarHistorial('p1', 'h1', 'Texto corregido');

      const req = resolver('/perros/p1/historial/h1');
      expect(req.method).toBe('PATCH');
      expect(req.body).toEqual({ nota: 'Texto corregido' });

      await promesa;
    });

    it('debería permitir al propietario borrar una entrada del comercio', async () => {
      const promesa = service.eliminarHistorial('p1', 'h1');

      expect(resolver('/perros/p1/historial/h1').method).toBe('DELETE');
      await promesa;
    });

    it('debería pedir el historial de cambios de la ficha', async () => {
      const promesa = service.versiones('p1');

      expect(resolver('/perros/p1/versiones', []).method).toBe('GET');
      await promesa;
    });
  });

  describe('privacidad', () => {
    it('debería fijar el consentimiento por tipo de historial y vertical', async () => {
      const promesa = service.fijarConsentimiento('p1', {
        tipoHistorial: TipoHistorial.VETERINARIO,
        verticalDestino: VerticalKey.PELUQUERIA,
        concedido: true,
      });

      const req = resolver('/perros/p1/consentimientos');
      expect(req.method).toBe('PATCH');
      expect(req.body).toMatchObject({
        tipoHistorial: TipoHistorial.VETERINARIO,
        verticalDestino: VerticalKey.PELUQUERIA,
        concedido: true,
      });

      await promesa;
    });

    it('debería revocar todos los permisos con DELETE', async () => {
      const promesa = service.revocarTodos('p1');

      const req = resolver('/perros/p1/consentimientos');
      expect(req.method).toBe('DELETE');

      await expect(promesa).resolves.toBeDefined();
    });

    it('debería consultar la historia veterinaria en su propia ruta', async () => {
      const promesa = service.historiaVeterinaria('p1');

      expect(resolver('/perros/p1/historia-veterinaria').url).toContain('historia-veterinaria');
      await promesa;
    });
  });
});

describe('porcentajeCompletitud', () => {
  const perroVacio: PerroApi = {
    _id: 'p1', nombre: 'Maya', fotos: [], especie: 'perro', esMestizo: true,
    esterilizado: false, tipoPelo: [], vacunas: [], alergias: [], enfermedades: [],
    medicacion: [], puedeQuedarseSolo: true, ansiedadSeparacion: false, miedos: [],
    seMarea: false, requiereTransportin: false, autorizaCompartirHistorial: true,
  };

  it('debería ser 0% para una ficha recién creada sin datos opcionales', () => {
    expect(porcentajeCompletitud(perroVacio)).toBe(0);
  });

  it('debería ser 100% cuando todos los campos opcionales están rellenos', () => {
    const completo: PerroApi = {
      ...perroVacio,
      raza: 'Golden Retriever', fechaNacimiento: '2022-01-01', peso: 28, sexo: 'hembra',
      tipoPelo: ['corto'], tamano: 'grande', estadoManto: 'bueno',
      vacunas: ['rabia'], sociabilidadPerros: 'alta', sociabilidadPersonas: 'alta',
      temperamento: 'tranquilo', microchip: '123456789', dieta: 'pienso premium',
      fotos: ['maya.jpg'], ciudad: 'Madrid', cartillaSanitariaUrl: 'cartilla.pdf',
    };
    expect(porcentajeCompletitud(completo)).toBe(100);
  });

  it('debería subir gradualmente al rellenar campos, no todo o nada', () => {
    const parcial: PerroApi = { ...perroVacio, raza: 'Mestizo', peso: 12 };
    const pct = porcentajeCompletitud(parcial);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
});
