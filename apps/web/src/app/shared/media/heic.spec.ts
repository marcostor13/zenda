import { esHeic, normalizarImagen } from './heic';

describe('heic', () => {
  /** Fichero de prueba con el nombre y el tipo que indique cada caso. */
  const fichero = (nombre: string, tipo = ''): File =>
    new File([new Uint8Array([1, 2, 3])], nombre, { type: tipo });

  describe('esHeic', () => {
    it('debería reconocer los tipos que anuncia iOS', () => {
      expect(esHeic(fichero('foto.heic', 'image/heic'))).toBe(true);
      expect(esHeic(fichero('foto.heif', 'image/heif'))).toBe(true);
      expect(esHeic(fichero('rafaga.heic', 'image/heic-sequence'))).toBe(true);
    });

    it('debería reconocerlo por la extensión cuando iOS no rellena el tipo', () => {
      // Es lo que ocurre cuando la foto llega desde la app Archivos: sin esto se
      // descartaba en silencio y el usuario no veía pasar nada.
      expect(esHeic(fichero('IMG_0042.HEIC'))).toBe(true);
      expect(esHeic(fichero('IMG_0042.heic', 'application/octet-stream'))).toBe(true);
    });

    it('no debería confundir otros formatos con HEIC', () => {
      expect(esHeic(fichero('foto.jpg', 'image/jpeg'))).toBe(false);
      expect(esHeic(fichero('documento.pdf', 'application/pdf'))).toBe(false);
      expect(esHeic(fichero('heicoso.png', 'image/png'))).toBe(false);
    });
  });

  describe('normalizarImagen', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('debería devolver intacto lo que no es HEIC', async () => {
      const jpeg = fichero('foto.jpg', 'image/jpeg');

      await expect(normalizarImagen(jpeg)).resolves.toBe(jpeg);
    });

    it('debería convertir el HEIC a JPEG y renombrarlo', async () => {
      // Safari sí sabe decodificar HEIC; el canvas es la vía para volcarlo a JPEG.
      simularCanvas(new Blob(['jpeg'], { type: 'image/jpeg' }));

      const convertido = await normalizarImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      expect(convertido.type).toBe('image/jpeg');
      expect(convertido.name).toBe('IMG_0042.jpg');
    });

    it('debería devolver el original si el navegador no sabe decodificarlo', async () => {
      // Chrome y Firefox no decodifican HEIC. Fallar aquí dejaría al usuario sin
      // poder subir; el API acepta HEIC como último recurso.
      global.createImageBitmap = jest.fn().mockRejectedValue(new Error('sin decodificador')) as never;
      const original = fichero('IMG_0042.HEIC', 'image/heic');

      await expect(normalizarImagen(original)).resolves.toBe(original);
    });

    it('debería devolver el original si el canvas no produce el JPEG', async () => {
      simularCanvas(null);
      const original = fichero('IMG_0042.HEIC', 'image/heic');

      await expect(normalizarImagen(original)).resolves.toBe(original);
    });
  });

  /** Simula la decodificación y el volcado a JPEG que hace Safari. */
  function simularCanvas(resultado: Blob | null): void {
    global.createImageBitmap = jest.fn().mockResolvedValue({
      width: 100, height: 80, close: jest.fn(),
    }) as never;

    jest.spyOn(document, 'createElement').mockImplementation((etiqueta: string) => {
      if (etiqueta !== 'canvas') {
        return Object.getPrototypeOf(document).createElement.call(document, etiqueta) as HTMLElement;
      }
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: jest.fn() }),
        toBlob: (cb: (b: Blob | null) => void) => cb(resultado),
      } as unknown as HTMLCanvasElement;
    });
  }
});
