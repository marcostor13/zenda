import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { TipoHistorial } from 'shared';
import { Comercio } from '../../comercios/comercio.schema';
import { PerroDocument } from '../perro.schema';
import { PerroHistorialDocument } from '../perro-historial.schema';
import { PerrosService } from '../perros.service';
import { InformePerroService } from './informe-perro.service';
import { InformePerro } from './informe-perro.tipos';
import { construirInformePdf } from './informe-perro.pdf';

jest.mock('./informe-perro.pdf', () => ({
  construirInformePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
}));

const dibujar = construirInformePdf as jest.MockedFunction<typeof construirInformePdf>;

/** Lo que le llega al dibujante: es lo que de verdad comprueban las pruebas. */
const datosPintados = (): InformePerro => dibujar.mock.calls.at(-1)![0];

const COMERCIO_ID = new Types.ObjectId();

const perro = (cambios: Partial<PerroDocument> = {}): PerroDocument =>
  ({
    nombre: 'Chispa',
    especie: 'perro',
    esMestizo: false,
    esterilizado: true,
    esPPP: false,
    vacunas: [],
    vacunasDetalle: [],
    alergias: [],
    enfermedades: [],
    medicacion: [],
    ...cambios,
  }) as PerroDocument;

const entrada = (cambios: Partial<PerroHistorialDocument> = {}): PerroHistorialDocument =>
  ({
    vertical: 'veterinaria',
    comercioId: COMERCIO_ID,
    origen: 'comercio',
    nota: 'Revisión anual.',
    datosEstructurados: {},
    tipoHistorial: TipoHistorial.VETERINARIO,
    get: () => new Date('2026-03-12T10:00:00Z'),
    ...cambios,
  }) as unknown as PerroHistorialDocument;

describe('InformePerroService', () => {
  let service: InformePerroService;
  let perrosService: jest.Mocked<Pick<PerrosService, 'obtenerPropio' | 'listarHistorial'>>;
  let comercioModel: { find: jest.Mock };

  const comerciosDevueltos = (docs: Array<{ _id: Types.ObjectId; nombreComercial: string }>): void => {
    comercioModel.find.mockReturnValue({
      select: () => ({ lean: () => ({ exec: async () => docs }) }),
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    perrosService = { obtenerPropio: jest.fn(), listarHistorial: jest.fn() };
    comercioModel = { find: jest.fn() };
    comerciosDevueltos([{ _id: COMERCIO_ID, nombreComercial: 'Clínica Els Ports' }]);

    perrosService.obtenerPropio.mockResolvedValue(perro());
    perrosService.listarHistorial.mockResolvedValue([]);

    const modulo = await Test.createTestingModule({
      providers: [
        InformePerroService,
        { provide: PerrosService, useValue: perrosService },
        { provide: getModelToken(Comercio.name), useValue: comercioModel },
      ],
    }).compile();

    service = modulo.get(InformePerroService);
  });

  it('debería exigir que la ficha sea del usuario que pide el informe', async () => {
    // El permiso no se decide aquí: se delega en `obtenerPropio`, que es el
    // único sitio donde se sabe de quién es una ficha.
    perrosService.obtenerPropio.mockRejectedValue(new Error('No tienes permiso sobre esta ficha'));

    await expect(service.generar('perro-1', 'otro-usuario')).rejects.toThrow('No tienes permiso');
  });

  it('debería nombrar el fichero con el perro y la fecha', async () => {
    const informe = await service.generar('perro-1', 'usuario-1');

    expect(informe.nombreFichero).toMatch(/^doogking-informe-chispa-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('debería limpiar del nombre del fichero lo que rompería la cabecera', async () => {
    perrosService.obtenerPropio.mockResolvedValue(perro({ nombre: 'Lúa / Sol "la reina"' }));

    const informe = await service.generar('perro-1', 'usuario-1');

    expect(informe.nombreFichero).toContain('lua-sol-la-reina');
    expect(informe.nombreFichero).not.toMatch(/["/]/);
  });

  it('debería poner las alergias y la medicación por delante de la dieta', async () => {
    // Es lo que se lee primero si el animal llega de urgencia a otra clínica.
    perrosService.obtenerPropio.mockResolvedValue(
      perro({ dieta: 'Pienso de pescado', alergias: ['Pollo'], medicacion: ['Apoquel'] }),
    );

    await service.generar('perro-1', 'usuario-1');

    expect(datosPintados().salud.map((s) => s.titulo))
      .toEqual(['Alergias', 'Medicación actual', 'Dieta']);
  });

  it('no debería incluir apartados de salud vacíos', async () => {
    await service.generar('perro-1', 'usuario-1');

    expect(datosPintados().salud).toEqual([]);
  });

  it('debería escribir las vacunas con su fecha y sin repetir el texto antiguo', async () => {
    perrosService.obtenerPropio.mockResolvedValue(perro({
      vacunasDetalle: [{ tipo: 'antirrabica', fecha: new Date('2026-03-12T00:00:00Z') }],
      vacunas: ['Antirrábica (12 mar 2026)', 'Leptospirosis 2024'],
    } as Partial<PerroDocument>));

    await service.generar('perro-1', 'usuario-1');

    expect(datosPintados().salud[0].items)
      .toEqual(['Antirrábica (12 mar 2026)', 'Leptospirosis 2024']);
  });

  it('debería calcular la edad a partir de la fecha de nacimiento', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-13T00:00:00Z'));
    perrosService.obtenerPropio.mockResolvedValue(
      perro({ fechaNacimiento: new Date('2022-07-04T00:00:00Z'), sexo: 'hembra' } as Partial<PerroDocument>),
    );

    await service.generar('perro-1', 'usuario-1');

    expect(datosPintados().subtitulo).toContain('4 años');
    jest.useRealTimers();
  });

  it('debería firmar cada anotación con el nombre del profesional', async () => {
    perrosService.listarHistorial.mockResolvedValue([entrada()]);

    await service.generar('perro-1', 'usuario-1');

    expect(datosPintados().historial[0].profesional).toBe('Clínica Els Ports');
    expect(datosPintados().historial[0].fecha).toBe('12 mar 2026');
  });

  it('debería avisar de que una anotación la editó el propietario', async () => {
    // Quien lea el informe en otra clínica tiene que poder distinguir lo que
    // escribió el profesional de lo que se retocó después.
    perrosService.listarHistorial.mockResolvedValue([entrada({ editadaAt: new Date() })]);

    await service.generar('perro-1', 'usuario-1');

    expect(datosPintados().historial[0].profesional).toContain('editada por el propietario');
  });

  it('debería seguir nombrando la anotación de un comercio que ya no existe', async () => {
    comerciosDevueltos([]);
    perrosService.listarHistorial.mockResolvedValue([entrada()]);

    await service.generar('perro-1', 'usuario-1');

    expect(datosPintados().historial[0].profesional).toBe('Profesional dado de baja');
  });

  it('debería deducir la categoría de una anotación antigua sin tipoHistorial', async () => {
    perrosService.listarHistorial.mockResolvedValue([
      entrada({ tipoHistorial: undefined, vertical: 'peluqueria' } as Partial<PerroHistorialDocument>),
    ]);

    await service.generar('perro-1', 'usuario-1');

    expect(datosPintados().historial[0].categoria).toBe('Historial de peluquería');
  });

  it('debería enseñar los datos estructurados con etiquetas legibles', async () => {
    perrosService.listarHistorial.mockResolvedValue([
      entrada({ datosEstructurados: { tareasCasa: 'Cinco repeticiones', vacio: '  ', anidado: { x: 1 } } }),
    ]);

    await service.generar('perro-1', 'usuario-1');

    expect(datosPintados().historial[0].detalles)
      .toEqual([{ etiqueta: 'Tareas casa', valor: 'Cinco repeticiones' }]);
  });

  it('no debería consultar los comercios cuando no hay historial', async () => {
    await service.generar('perro-1', 'usuario-1');

    expect(comercioModel.find).not.toHaveBeenCalled();
  });

  describe('textos que dependen de lo que falte en la ficha', () => {
    /*
     * La mitad de las fichas están a medias: sin fecha de nacimiento, sin sexo,
     * con la raza puesta y el mestizaje marcado. El informe sale igual y sin
     * huecos raros, que es lo que estas pruebas vigilan.
     */
    const subtituloCon = async (cambios: Partial<PerroDocument>): Promise<string> => {
      perrosService.obtenerPropio.mockResolvedValue(perro(cambios));
      await service.generar('perro-1', 'usuario-1');
      return datosPintados().subtitulo;
    };

    it('debería decir sólo la especie cuando no hay raza, sexo ni edad', async () => {
      expect(await subtituloCon({})).toBe('Perro');
    });

    it('debería nombrar el mestizaje con la raza de referencia', async () => {
      expect(await subtituloCon({ esMestizo: true, raza: 'podenco' })).toContain('Mestizo de podenco');
    });

    it('debería decir Macho cuando el sexo es macho', async () => {
      expect(await subtituloCon({ sexo: 'macho' } as Partial<PerroDocument>)).toContain('Macho');
    });

    it('debería contar la edad en meses mientras no llegue al año', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-13T00:00:00Z'));

      expect(await subtituloCon({ fechaNacimiento: new Date('2026-08-13T00:00:00Z') }))
        .toContain('1 mes');
      jest.useRealTimers();
    });

    it('debería decir el año redondo sin añadir meses', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-13T00:00:00Z'));

      const subtitulo = await subtituloCon({ fechaNacimiento: new Date('2025-09-13T00:00:00Z') });

      expect(subtitulo).toContain('1 año');
      expect(subtitulo).not.toContain('mes');
      jest.useRealTimers();
    });

    it('debería marcar al perro de raza potencialmente peligrosa', async () => {
      // Cambia lo que un alojamiento puede aceptar y lo que exige el seguro.
      perrosService.obtenerPropio.mockResolvedValue(perro({ esPPP: true }));

      await service.generar('perro-1', 'usuario-1');

      expect(datosPintados().identidad).toContainEqual(
        { etiqueta: 'Perro de raza potencialmente peligrosa', valor: 'Sí' },
      );
    });

    it('debería escribir Esterilizada en femenino', async () => {
      perrosService.obtenerPropio.mockResolvedValue(
        perro({ sexo: 'hembra' } as Partial<PerroDocument>),
      );

      await service.generar('perro-1', 'usuario-1');

      expect(datosPintados().identidad.map((d) => d.etiqueta)).toContain('Esterilizada');
    });

    it('debería omitir de la identificación lo que no está relleno', async () => {
      await service.generar('perro-1', 'usuario-1');

      expect(datosPintados().identidad.map((d) => d.etiqueta))
        .toEqual(['Especie', 'Sexo'].filter((e) => e !== 'Sexo').concat('Esterilizado'));
    });

    it('debería escribir el peso con coma decimal', async () => {
      perrosService.obtenerPropio.mockResolvedValue(perro({ peso: 14.5 }));

      await service.generar('perro-1', 'usuario-1');

      expect(datosPintados().identidad).toContainEqual({ etiqueta: 'Peso', valor: '14,5 kg' });
    });

    it('debería enseñar una vacuna sin fecha registrada', async () => {
      perrosService.obtenerPropio.mockResolvedValue(perro({
        vacunasDetalle: [{ tipo: 'antirrabica' }],
      } as Partial<PerroDocument>));

      await service.generar('perro-1', 'usuario-1');

      expect(datosPintados().salud[0].items).toEqual(['Antirrábica']);
    });

    it('debería respetar una vacuna que no está en el catálogo', async () => {
      perrosService.obtenerPropio.mockResolvedValue(perro({
        vacunasDetalle: [{ tipo: 'inventada' }],
      } as unknown as Partial<PerroDocument>));

      await service.generar('perro-1', 'usuario-1');

      expect(datosPintados().salud[0].items).toEqual(['inventada']);
    });

    it('debería poner un guion en la fecha de una anotación sin marca de tiempo', async () => {
      perrosService.listarHistorial.mockResolvedValue([
        entrada({ get: () => undefined } as unknown as Partial<PerroHistorialDocument>),
      ]);

      await service.generar('perro-1', 'usuario-1');

      expect(datosPintados().historial[0].fecha).toBe('—');
    });

    it('debería marcar como suya la anotación que escribió el propietario', async () => {
      perrosService.listarHistorial.mockResolvedValue([entrada({ origen: 'propietario' })]);

      await service.generar('perro-1', 'usuario-1');

      expect(datosPintados().historial[0].profesional).toBe('Anotación del propietario');
    });

    it('debería usar el vertical como categoría si no lo reconoce', async () => {
      perrosService.listarHistorial.mockResolvedValue([
        entrada({ tipoHistorial: undefined, vertical: 'seguros' } as Partial<PerroHistorialDocument>),
      ]);

      await service.generar('perro-1', 'usuario-1');

      expect(datosPintados().historial[0].categoria).toBe('Seguros');
    });

    it('no debería romperse con una anotación sin datos estructurados', async () => {
      perrosService.listarHistorial.mockResolvedValue([
        entrada({ datosEstructurados: undefined } as unknown as Partial<PerroHistorialDocument>),
      ]);

      await service.generar('perro-1', 'usuario-1');

      expect(datosPintados().historial[0].detalles).toEqual([]);
    });

    it('debería aceptar un número como dato estructurado', async () => {
      perrosService.listarHistorial.mockResolvedValue([
        entrada({ datosEstructurados: { pesoKg: 14.5 } }),
      ]);

      await service.generar('perro-1', 'usuario-1');

      expect(datosPintados().historial[0].detalles)
        .toEqual([{ etiqueta: 'Peso kg', valor: '14.5' }]);
    });

    it('debería llamar al fichero "mascota" si el nombre no deja ni una letra', async () => {
      perrosService.obtenerPropio.mockResolvedValue(perro({ nombre: '???' }));

      const informe = await service.generar('perro-1', 'usuario-1');

      expect(informe.nombreFichero).toContain('doogking-informe-mascota-');
    });
  });
});
