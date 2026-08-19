import { detectarTipoReal, tipoAceptado } from './firma-fichero';

/** Cabecera de un fichero, rellenada hasta `longitud` para simular contenido. */
const conCabecera = (bytes: number[], longitud = 32): Buffer =>
  Buffer.concat([Buffer.from(bytes), Buffer.alloc(Math.max(0, longitud - bytes.length))]);

const ascii = (texto: string): number[] => [...texto].map((c) => c.charCodeAt(0));

const JPEG = conCabecera([0xff, 0xd8, 0xff, 0xe0]);
const PNG = conCabecera([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = conCabecera(ascii('GIF89a'));
const WEBP = conCabecera([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')]);
const PDF = conCabecera(ascii('%PDF-1.7'));
const WEBM = conCabecera([0x1a, 0x45, 0xdf, 0xa3]);
const MP4 = conCabecera([0, 0, 0, 0x20, ...ascii('ftyp'), ...ascii('isom')]);
const MOV = conCabecera([0, 0, 0, 0x14, ...ascii('ftyp'), ...ascii('qt  ')]);

/** Foto del carrete de un iPhone: mismo contenedor que el vídeo, otra marca. */
const HEIC = conCabecera([0, 0, 0, 0x18, ...ascii('ftyp'), ...ascii('heic')]);
const HEIF = conCabecera([0, 0, 0, 0x18, ...ascii('ftyp'), ...ascii('mif1')]);

describe('detectarTipoReal', () => {
  it.each([
    ['image/jpeg', JPEG],
    ['image/png', PNG],
    ['image/gif', GIF],
    ['image/webp', WEBP],
    ['application/pdf', PDF],
    ['video/webm', WEBM],
    ['video/mp4', MP4],
    ['video/quicktime', MOV],
    ['image/heic', HEIC],
    ['image/heic', HEIF],
  ])('debería reconocer %s por su firma', (esperado, buffer) => {
    expect(detectarTipoReal(buffer)).toBe(esperado);
  });

  it('debería devolver null para contenido que no reconoce', () => {
    expect(detectarTipoReal(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
  });

  it('debería devolver null para un buffer vacío', () => {
    expect(detectarTipoReal(Buffer.alloc(0))).toBeNull();
  });

  it('no debería confundir un RIFF que no es WebP (p. ej. un WAV)', () => {
    const wav = conCabecera([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE')]);

    expect(detectarTipoReal(wav)).toBeNull();
  });
});

describe('tipoAceptado', () => {
  const IMAGENES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
  const DOCUMENTOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  const VIDEOS = ['video/mp4', 'video/webm', 'video/quicktime'];

  it('debería devolver el tipo real cuando el endpoint lo acepta', () => {
    expect(tipoAceptado(PNG, IMAGENES)).toBe('image/png');
    expect(tipoAceptado(PDF, DOCUMENTOS)).toBe('application/pdf');
    expect(tipoAceptado(MOV, VIDEOS)).toBe('video/quicktime');
  });

  it('debería rechazar un formato válido pero de otro endpoint', () => {
    expect(tipoAceptado(PDF, IMAGENES)).toBeNull();
    expect(tipoAceptado(MP4, IMAGENES)).toBeNull();
    expect(tipoAceptado(GIF, DOCUMENTOS)).toBeNull();
  });

  it('debería rechazar HTML disfrazado de imagen', () => {
    // Este es el caso que la validación por Content-Type dejaba pasar.
    const html = Buffer.from('<!doctype html><script>fetch("/api/v1/users/me")</script>');

    expect(tipoAceptado(html, IMAGENES)).toBeNull();
  });

  it('debería rechazar un SVG, que es texto y puede llevar scripts', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');

    expect(tipoAceptado(svg, IMAGENES)).toBeNull();
  });

  it('debería rechazar contenido que no reconoce', () => {
    expect(tipoAceptado(Buffer.alloc(0), IMAGENES)).toBeNull();
  });

  describe('fotos de iPhone', () => {
    it('no debería confundir una foto HEIC con un vídeo MP4', () => {
      // HEIC usa el mismo contenedor ISO-BMFF que el vídeo. Sin mirar la marca,
      // una foto del carrete se detectaba como MP4 y la subida se rechazaba.
      expect(detectarTipoReal(HEIC)).toBe('image/heic');
      expect(detectarTipoReal(HEIC)).not.toBe('video/mp4');
    });

    it('debería seguir reconociendo el MP4 y el MOV de verdad', () => {
      expect(detectarTipoReal(MP4)).toBe('video/mp4');
      expect(detectarTipoReal(MOV)).toBe('video/quicktime');
    });

    it('debería aceptar la foto tanto si iOS la escribe heic como heif', () => {
      expect(tipoAceptado(HEIC, IMAGENES)).toBe('image/heic');
      expect(tipoAceptado(HEIF, IMAGENES)).toBe('image/heic');
    });

    it('debería aceptarla aunque iOS no sepa qué tipo declarar', () => {
      // El caso de la app Archivos: Safari manda `application/octet-stream` o
      // nada. Ya no importa: la decisión se toma sólo sobre el contenido.
      expect(tipoAceptado(HEIC, IMAGENES)).toBe('image/heic');
    });

    it('no debería dejar pasar un vídeo por el endpoint de imágenes', () => {
      expect(tipoAceptado(MP4, IMAGENES)).toBeNull();
    });

    it('debería aceptar la foto también como documentación', () => {
      // Una foto del móvil es la forma más común de aportar un certificado.
      expect(tipoAceptado(HEIC, DOCUMENTOS)).toBe('image/heic');
    });
  });
});
