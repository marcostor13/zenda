import { EstadoModeracion, TipoLugar, ZonaAdmitidaLugar } from 'shared';
import {
  FilaExplora, ORIGEN_EXPLORA_CV, calleDe, lugarDeFila, lugaresDeFilas, poblacionCanonica,
} from './explora-cv';

const restaurante = (extra: Partial<FilaExplora> = {}): FilaExplora => ({
  tipo: 'restaurante',
  nombre: 'Kofu',
  municipio: 'Castelló de la Plana',
  provincia: 'Castellón',
  direccion: 'Plaça del Jutge Borrull, 27',
  fuente: 'Guía Repsol, abril 2025',
  estado: 'pendiente',
  zonaAdmitida: 'por_confirmar',
  ...extra,
});

const tienda = (extra: Partial<FilaExplora> = {}): FilaExplora => ({
  tipo: 'tienda',
  nombre: 'Miscota',
  municipio: 'València',
  provincia: 'Valencia',
  direccion: 'C/ Cuba 12',
  cadena: 'Miscota',
  fuente: 'Localizador oficial de Miscota (24/09/2026)',
  estado: 'publicado',
  ...extra,
});

describe('poblacionCanonica', () => {
  it('debería pasar el nombre en valenciano al que usa el catálogo', () => {
    expect(poblacionCanonica('Alacant')).toBe('Alicante');
    expect(poblacionCanonica('València')).toBe('Valencia');
    expect(poblacionCanonica('Elx')).toBe('Elche');
  });

  it('debería dejar tal cual un pueblo que no está en el catálogo', () => {
    expect(poblacionCanonica('Beniarbeig')).toBe('Beniarbeig');
  });
});

describe('lugarDeFila', () => {
  it('debería importar los restaurantes pendientes de moderación', () => {
    const lugar = lugarDeFila(restaurante());

    expect(lugar).toMatchObject({
      tipo: TipoLugar.RESTAURANTE,
      nombre: 'Kofu',
      estado: EstadoModeracion.PENDIENTE,
      origenDatos: ORIGEN_EXPLORA_CV,
      ubicacion: { ciudad: 'Castellón de la Plana', provincia: 'Castellón' },
      atributos: { zonaAdmitida: ZonaAdmitidaLugar.POR_CONFIRMAR },
    });
    expect(lugar?.descripcion).toContain('Confirma con el local');
  });

  it('debería conservar la zona documentada y las condiciones', () => {
    const lugar = lugarDeFila(restaurante({ zonaAdmitida: 'terraza', condiciones: 'Perros educados' }));

    expect(lugar?.atributos).toMatchObject({ zonaAdmitida: 'terraza', condiciones: 'Perros educados' });
    expect(lugar?.descripcion).not.toContain('Confirma');
  });

  it('debería tratar una zona desconocida como «por confirmar»', () => {
    expect(lugarDeFila(restaurante({ zonaAdmitida: 'jardín' }))?.atributos['zonaAdmitida'])
      .toBe(ZonaAdmitidaLugar.POR_CONFIRMAR);
  });

  it('debería publicar las tiendas verificadas con la población en el nombre', () => {
    expect(lugarDeFila(tienda())).toMatchObject({
      tipo: TipoLugar.TIENDA,
      nombre: 'Miscota Valencia',
      estado: EstadoModeracion.PUBLICADO,
      atributos: { cadena: 'Miscota' },
    });
  });

  it('debería descartar una fila sin nombre o sin población', () => {
    expect(lugarDeFila(tienda({ nombre: ' ' }))).toBeNull();
    expect(lugarDeFila(tienda({ municipio: '' }))).toBeNull();
  });
});

describe('lugaresDeFilas', () => {
  it('debería añadir la calle cuando una cadena repite población', () => {
    const lugares = lugaresDeFilas([
      tienda({ direccion: 'C/ Cuba 12, 46006 València' }),
      tienda({ direccion: 'Av. del Puerto 3' }),
      tienda({ municipio: 'Mislata', direccion: 'C/ Mayor 1' }),
    ]);

    expect(lugares.map((l) => l.nombre)).toEqual([
      'Miscota Valencia · C/ Cuba 12',
      'Miscota Valencia · Av. del Puerto 3',
      'Miscota Mislata',
    ]);
  });

  it('debería saltarse las filas incompletas', () => {
    expect(lugaresDeFilas([tienda({ nombre: '' }), restaurante()])).toHaveLength(1);
  });
});

describe('calleDe', () => {
  it('debería quedarse con la calle y el número', () => {
    expect(calleDe('C/ Cuba 12, 46006 València')).toBe('C/ Cuba 12');
    expect(calleDe('C. Bolulla, 23, 03009 Alicante')).toBe('C. Bolulla, 23');
    expect(calleDe('Av. Arenal')).toBe('Av. Arenal');
  });
});
