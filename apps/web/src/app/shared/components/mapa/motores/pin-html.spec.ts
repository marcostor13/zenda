import { escapar, htmlPin, htmlTarjeta } from './pin-html';
import type { PuntoMapa } from './motor-mapa';

const PUNTO: PuntoMapa = {
  id: 'a1',
  lat: 40.4168,
  lng: -3.7038,
  etiqueta: '€24',
  titulo: 'Residencia Las Rozas',
  imagen: 'https://cdn.doogking.com/foto.jpg',
  rating: 4.62,
};

describe('escapar', () => {
  it('debería neutralizar el marcado que venga del API', () => {
    expect(escapar('<img src=x onerror="alert(1)">'))
      .toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('debería escapar el ampersand antes que el resto', () => {
    expect(escapar('Perros & Gatos')).toBe('Perros &amp; Gatos');
  });
});

describe('htmlPin', () => {
  it('debería pintar la etiqueta dentro de un botón alcanzable con teclado', () => {
    const html = htmlPin(PUNTO, false);

    expect(html).toContain('<button type="button"');
    expect(html).toContain('>€24</button>');
    expect(html).toContain('aria-label="Residencia Las Rozas"');
  });

  it('debería marcar el pin resaltado para que se distinga del resto', () => {
    const html = htmlPin(PUNTO, true);

    expect(html).toContain('rs-pin rs-pin--activo');
    expect(html).toContain('aria-current="true"');
  });

  it('debería usar un punto medio cuando el servicio no trae etiqueta', () => {
    expect(htmlPin({ id: 'x', lat: 1, lng: 2 }, false)).toContain('>·</button>');
  });
});

describe('htmlTarjeta', () => {
  it('debería componer imagen, nota y precio del punto', () => {
    const html = htmlTarjeta(PUNTO) ?? '';

    expect(html).toContain('src="https://cdn.doogking.com/foto.jpg"');
    expect(html).toContain('>4.6<');
    expect(html).toContain('>€24<');
    expect(html).toContain('Residencia Las Rozas');
  });

  it('debería omitir la nota cuando todavía no hay reseñas', () => {
    const html = htmlTarjeta({ ...PUNTO, rating: 0 }) ?? '';

    expect(html).not.toContain('rs-mapa-pop__nota');
  });

  it('debería devolver null sin título: una tarjeta vacía no aporta nada', () => {
    expect(htmlTarjeta({ id: 'x', lat: 1, lng: 2 })).toBeNull();
  });
});
