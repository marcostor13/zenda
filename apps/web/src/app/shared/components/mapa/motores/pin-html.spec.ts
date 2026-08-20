import { escapar, htmlPin, htmlTarjeta } from './pin-html';
import type { PuntoMapa } from './motor-mapa';

const PUNTO: PuntoMapa = {
  id: 'a1',
  lat: 40.4168,
  lng: -3.7038,
  etiqueta: '24 €',
  vertical: 'alojamiento',
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
  it('debería pintar el icono de la categoría, no el precio', () => {
    // Veinte pastillas de precio tapan el mapa que se está enseñando.
    const html = htmlPin(PUNTO, false);

    expect(html).toContain('src="/icons/alojamiento.svg"');
    expect(html).not.toContain('24 €<');
  });

  it('debería seguir siendo un botón alcanzable con teclado', () => {
    const html = htmlPin(PUNTO, false);

    expect(html).toContain('<button type="button"');
  });

  it('debería anunciar nombre y precio a quien no ve el mapa', () => {
    // El texto del pin ya no dice nada, así que carga la etiqueta accesible.
    expect(htmlPin(PUNTO, false)).toContain('aria-label="Residencia Las Rozas, 24 €"');
  });

  it('debería anunciar solo el nombre cuando no hay precio', () => {
    const html = htmlPin({ ...PUNTO, etiqueta: undefined }, false);

    expect(html).toContain('aria-label="Residencia Las Rozas"');
  });

  it('debería marcar el pin resaltado para que se distinga del resto', () => {
    const html = htmlPin(PUNTO, true);

    expect(html).toContain('rs-pin rs-pin--activo');
    expect(html).toContain('aria-current="true"');
  });

  it('debería usar el icono genérico si la categoría no se reconoce', () => {
    // Disfrazarlo del icono de otra categoría sería peor que no decir nada.
    const html = htmlPin({ id: 'x', lat: 1, lng: 2 }, false);

    expect(html).toContain('src="/icons/mas-servicios.svg"');
    expect(html).toContain('aria-label="Servicio"');
  });

  it('debería escapar el título antes de meterlo en el marcado', () => {
    const html = htmlPin({ ...PUNTO, titulo: 'Can "Feliç" & Co' }, false);

    expect(html).toContain('aria-label="Can &quot;Feliç&quot; &amp; Co, 24 €"');
  });
});

describe('htmlTarjeta', () => {
  it('debería componer imagen, nota y precio del punto', () => {
    // El precio no desaparece del mapa: se lee aquí, a un toque del pin.
    const html = htmlTarjeta(PUNTO) ?? '';

    expect(html).toContain('src="https://cdn.doogking.com/foto.jpg"');
    expect(html).toContain('>4.6<');
    expect(html).toContain('>24 €<');
    expect(html).toContain('Residencia Las Rozas');
  });

  it('debería situar el punto con su subtítulo cuando lo trae', () => {
    // En /explora el nombre no basta: "Playa canina" hay en medio litoral.
    const html = htmlTarjeta({ ...PUNTO, subtitulo: 'Dénia' }) ?? '';

    expect(html).toContain('>Dénia<');
  });

  it('no debería dejar un hueco cuando no hay subtítulo', () => {
    expect(htmlTarjeta(PUNTO) ?? '').not.toContain('rs-mapa-pop__sub');
  });

  it('debería escapar el subtítulo, que también viene del API', () => {
    const html = htmlTarjeta({ ...PUNTO, subtitulo: '<script>x</script>' }) ?? '';

    expect(html).not.toContain('<script>');
  });

  it('debería omitir la nota cuando todavía no hay reseñas', () => {
    const html = htmlTarjeta({ ...PUNTO, rating: 0 }) ?? '';

    expect(html).not.toContain('rs-mapa-pop__nota');
  });

  it('debería devolver null sin título: una tarjeta vacía no aporta nada', () => {
    expect(htmlTarjeta({ id: 'x', lat: 1, lng: 2 })).toBeNull();
  });
});
