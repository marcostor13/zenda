import { coincideConDeclarado, detectarTipoReal } from './firma-fichero';

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

describe('coincideConDeclarado', () => {
  it('debería aceptar un PNG declarado como PNG', () => {
    expect(coincideConDeclarado(PNG, 'image/png')).toBe(true);
  });

  it('debería rechazar HTML disfrazado de imagen', () => {
    // Este es el caso que la validación por Content-Type dejaba pasar.
    const html = Buffer.from('<!doctype html><script>fetch("/api/v1/users/me")</script>');

    expect(coincideConDeclarado(html, 'image/png')).toBe(false);
  });

  it('debería rechazar un PDF declarado como imagen', () => {
    expect(coincideConDeclarado(PDF, 'image/jpeg')).toBe(false);
  });

  it('debería rechazar un SVG, que es texto y puede llevar scripts', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');

    expect(coincideConDeclarado(svg, 'image/png')).toBe(false);
  });

  it('debería tolerar que un móvil etiquete un MOV como MP4', () => {
    // Comparten contenedor ISO-BMFF; rechazarlo dejaría fuera vídeos legítimos.
    expect(coincideConDeclarado(MOV, 'video/mp4')).toBe(true);
    expect(coincideConDeclarado(MP4, 'video/quicktime')).toBe(true);
  });

  it('no debería tolerar la mezcla entre vídeo e imagen', () => {
    expect(coincideConDeclarado(MP4, 'image/png')).toBe(false);
  });
});
