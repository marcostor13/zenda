import { VerticalKey, VERTICAL_LABELS } from 'shared';
import {
  VERTICALES_PUBLICOS, VERTICALES_UI, enlaceAServicio, rutaDeVertical,
  subtitularDeVertical, titularDeVertical, verticalUi,
} from './verticales.config';

describe('verticales.config', () => {
  it('debería cubrir todas las categorías del dominio', () => {
    const keys = VERTICALES_UI.map((v) => v.key).sort();
    expect(keys).toEqual(Object.values(VerticalKey).sort());
  });

  it('debería usar las etiquetas del dominio compartido', () => {
    for (const v of VERTICALES_UI) {
      expect(v.label).toBe(VERTICAL_LABELS[v.key]);
    }
  });

  it('debería tener una ruta y un icono propio por categoría', () => {
    for (const v of VERTICALES_UI) {
      expect(v.route).toBe(`/${v.key}`);
      expect(v.icono).toBe(`/icons/${v.key}.svg`);
    }
  });

  it('debería incluir Seguros como vertical, no como añadido transversal', () => {
    const seguros = verticalUi(VerticalKey.SEGUROS);

    expect(seguros.key).toBe(VerticalKey.SEGUROS);
    expect(seguros.route).toBe('/seguros');
    // No se reserva por fechas: se contrata según elegibilidad.
    expect(seguros.reservaPorNoches).toBe(false);
  });

  it('debería incluir Paseadores y cuidado a domicilio como vertical (Ref. COMI3)', () => {
    // Retirado como "Cuidadores" (TCK-8021); reintroducido con paseo + cuidado a domicilio
    // tras confirmar con el cliente que esa decisión ya no aplica.
    const cuidadores = verticalUi(VerticalKey.CUIDADORES);

    expect(cuidadores.key).toBe(VerticalKey.CUIDADORES);
    expect(cuidadores.route).toBe('/cuidadores');
    // "Paseadores" no es un vertical propio: es una modalidad dentro de este.
    const claves: string[] = VERTICALES_UI.map((v) => v.key);
    expect(claves).not.toContain('paseadores');
  });

  describe('escaparate público', () => {
    it('no debería ofrecer Cuidadores en el menú ni en el buscador', () => {
      expect(VERTICALES_PUBLICOS.map((v) => v.key)).not.toContain(VerticalKey.CUIDADORES);
    });

    it('debería seguir resolviendo Cuidadores para quien llegue por su ruta', () => {
      // Retirarlo del escaparate no borra el vertical: la ficha, el panel del
      // comercio y los enlaces guardados siguen funcionando.
      expect(verticalUi(VerticalKey.CUIDADORES).key).toBe(VerticalKey.CUIDADORES);
    });

    it('debería ofrecer todo lo demás', () => {
      const ocultos = VERTICALES_UI.filter((v) => v.fueraDelEscaparate);

      expect(VERTICALES_PUBLICOS).toHaveLength(VERTICALES_UI.length - ocultos.length);
      expect(VERTICALES_PUBLICOS.every((v) => !v.fueraDelEscaparate)).toBe(true);
    });

    it('debería mantener el orden de la lista completa', () => {
      const enOrden = VERTICALES_UI.filter((v) => VERTICALES_PUBLICOS.includes(v));

      expect(VERTICALES_PUBLICOS).toEqual(enOrden);
    });
  });

  it('debería reservar por noches solo alojamiento y hoteles', () => {
    const porNoches = VERTICALES_UI.filter((v) => v.reservaPorNoches).map((v) => v.key);
    expect(porNoches).toEqual([VerticalKey.ALOJAMIENTO, VerticalKey.HOTELES]);
  });

  it('debería resolver la config de una categoría por su clave', () => {
    expect(verticalUi(VerticalKey.PELUQUERIA).labelCorto).toBe('Peluquería');
    expect(rutaDeVertical(VerticalKey.VETERINARIA)).toBe('/veterinaria');
  });

  it('debería distinguir el alojamiento canino de un hotel pet-friendly', () => {
    expect(verticalUi(VerticalKey.ALOJAMIENTO).labelCorto).toBe('Alojamiento canino');
  });

  it('debería definir titular y subtitular a la vez, nunca solo uno', () => {
    for (const v of VERTICALES_UI) {
      expect(Boolean(v.titular)).toBe(Boolean(v.subtitular));
    }
  });

  it('debería exponer el copy de marca de los verticales revisados', () => {
    expect(titularDeVertical(VerticalKey.TRANSPORTE)).toBe('Más que un transporte');
    expect(subtitularDeVertical(VerticalKey.TRANSPORTE)).toBe('Su bienestar es el destino más importante.');
    expect(titularDeVertical(VerticalKey.VETERINARIA)).toBe('Veterinarios de confianza');
    expect(titularDeVertical(VerticalKey.PELUQUERIA)).toBe('El cuidado que merece');
    expect(titularDeVertical(VerticalKey.ALOJAMIENTO)).toBe('Más que un alojamiento');
  });

  it('debería dar copy propio a todas las categorías, sin caer en la etiqueta', () => {
    // Adiestramiento y hoteles no lo tenían y caían a `label`: entre titulares
    // de marca aparecían dos que eran el nombre pelado de la categoría.
    for (const v of VERTICALES_UI) {
      expect(v.titular).toBeTruthy();
      expect(titularDeVertical(v.key)).toBe(v.titular);
      expect(subtitularDeVertical(v.key)).toBe(v.subtitular);
    }
  });

  it('debería escribir los titulares en mayúscula inicial, nunca en versales', () => {
    // Veterinaria y transporte iban en MAYÚSCULAS y el resto no, así que
    // cambiar de servicio cambiaba el tono de la pantalla.
    for (const v of VERTICALES_UI) {
      const titular = v.titular!;
      expect(titular).not.toBe(titular.toUpperCase());
      expect(titular.charAt(0)).toBe(titular.charAt(0).toUpperCase());
    }
  });

  it('no debería anunciar servicios que Doogking no intermedia', () => {
    const vet = verticalUi(VerticalKey.VETERINARIA);
    const copy = `${vet.descripcion} ${vet.claim} ${vet.subtitular}`.toLowerCase();
    expect(copy).not.toContain('cirugía');
    expect(copy).not.toContain('dermatología');
  });

  it('debería caer en alojamiento cuando la clave no existe', () => {
    expect(verticalUi('inventado').key).toBe(VerticalKey.ALOJAMIENTO);
    expect(rutaDeVertical(null)).toBe('/alojamiento');
    expect(rutaDeVertical(undefined)).toBe('/alojamiento');
  });
});

/**
 * Todas las categorías tienen que comportarse igual. Veterinaria y peluquería
 * se habían quedado sin ficha: sus tarjetas llevaban de vuelta al listado y no
 * había forma de ver el detalle de un comercio.
 */
describe('enlaceAServicio', () => {
  it('deberia llevar a la ficha en todas las categorias', () => {
    for (const v of VERTICALES_UI) {
      expect(enlaceAServicio(v.key, 's1')).toEqual([v.route, 's1']);
    }
  });

  it('no deberia inventarse una ruta para una categoria desconocida', () => {
    // Mejor el listado de alojamiento que un 404.
    expect(enlaceAServicio('inventado', 's1')).toEqual(['/alojamiento']);
  });
});

/**
 * Reclamo de la página de resultados: la frase y el texto que van bajo el
 * buscador, junto a la ilustración de la categoría.
 */
describe('reclamo de la categoria', () => {
  it('deberia haber uno por categoria', () => {
    for (const v of VERTICALES_UI) {
      expect(v.reclamo.titulo).toBeTruthy();
      expect(v.reclamo.texto).toBeTruthy();
    }
  });

  it('deberia ser distinto en cada categoria', () => {
    // Si dos compartieran reclamo, cambiar de servicio no cambiaria nada.
    const titulos = new Set(VERTICALES_UI.map((v) => v.reclamo.titulo));

    expect(titulos.size).toBe(VERTICALES_UI.length);
  });

  it('deberia explicar, no solo titular', () => {
    for (const v of VERTICALES_UI) {
      expect(v.reclamo.texto.length).toBeGreaterThan(50);
    }
  });

  it('no deberia repetir el gancho de la portada', () => {
    // `claim` es el gancho de las tarjetas del home; este habla a quien ya
    // esta buscando. Son dos textos y dos sitios distintos.
    for (const v of VERTICALES_UI) {
      expect(v.reclamo.titulo).not.toBe(v.claim);
    }
  });

  it('deberia tener ilustracion propia', () => {
    for (const v of VERTICALES_UI) {
      expect(v.icono).toContain('.svg');
    }
  });
});
