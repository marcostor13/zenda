import {
  MAX_SUBIDA_BYTES, esHeic, pareceImagen, prepararImagen, problemaDeSubida,
} from './preparar-imagen';

describe('preparar-imagen', () => {
  /** Fichero con el nombre, el tipo y el peso que indique cada caso. */
  const fichero = (nombre: string, tipo = '', bytes = 3): File =>
    new File([new Uint8Array(bytes)], nombre, { type: tipo });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  describe('pareceImagen', () => {
    it('debería aceptar cualquier tipo de imagen declarado', () => {
      expect(pareceImagen(fichero('foto.jpg', 'image/jpeg'))).toBe(true);
      expect(pareceImagen(fichero('animado.gif', 'image/gif'))).toBe(true);
    });

    it('debería aceptar por extensión cuando iOS no declara el tipo', () => {
      expect(pareceImagen(fichero('IMG_0042.HEIC'))).toBe(true);
      expect(pareceImagen(fichero('captura.PNG', 'application/octet-stream'))).toBe(true);
      expect(pareceImagen(fichero('escaneo.jpeg', ''))).toBe(true);
    });

    it('no debería aceptar lo que no es una imagen', () => {
      expect(pareceImagen(fichero('contrato.pdf', 'application/pdf'))).toBe(false);
      expect(pareceImagen(fichero('paseo.mp4', 'video/mp4'))).toBe(false);
      expect(pareceImagen(fichero('sinextension'))).toBe(false);
    });
  });

  describe('prepararImagen', () => {
    it('debería devolver intacto un JPEG que ya cabe', async () => {
      // Reprocesar lo que ya funciona sólo le quitaría calidad.
      const jpeg = fichero('foto.jpg', 'image/jpeg', 1000);

      await expect(prepararImagen(jpeg)).resolves.toBe(jpeg);
    });

    it('debería convertir el HEIC a JPEG y renombrarlo', async () => {
      // Safari sí sabe decodificar HEIC; el canvas es la vía para volcarlo a JPEG.
      simularCanvas({ ancho: 3024, alto: 4032, tamano: 1000 });

      const convertido = await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      expect(convertido.type).toBe('image/jpeg');
      expect(convertido.name).toBe('IMG_0042.jpg');
    });

    it('debería respetar la orientación EXIF al decodificar', async () => {
      // Sin esto, una foto tomada en vertical se sube tumbada: el sensor la
      // guarda apaisada y la rotación vive sólo en los metadatos.
      const canvas = simularCanvas({ ancho: 100, alto: 80, tamano: 10 });

      await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      expect(canvas.decodificar).toHaveBeenCalledWith(
        expect.anything(),
        { imageOrientation: 'from-image' },
      );
    });

    it('debería reducir la foto por debajo del techo de canvas de iOS', async () => {
      // 48 MP es lo que produce un iPhone Pro en modo máximo. Safari devuelve un
      // lienzo en blanco por encima de ~16,7 Mpx, sin dar ningún error.
      const canvas = simularCanvas({ ancho: 8064, alto: 6048, tamano: 10 });

      await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      const [ancho, alto] = canvas.dimensiones[0];
      expect(ancho * alto).toBeLessThanOrEqual(4096 * 4096);
      expect(Math.max(ancho, alto)).toBeLessThanOrEqual(2560);
    });

    it('debería conservar la proporción al reducir', async () => {
      const canvas = simularCanvas({ ancho: 4032, alto: 3024, tamano: 10 });

      await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      const [ancho, alto] = canvas.dimensiones[0];
      expect(ancho / alto).toBeCloseTo(4032 / 3024, 2);
    });

    it('no debería ampliar una foto pequeña', async () => {
      const canvas = simularCanvas({ ancho: 320, alto: 240, tamano: 10 });

      await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      expect(canvas.dimensiones[0]).toEqual([320, 240]);
    });

    it('debería insistir con menos calidad mientras no quepa', async () => {
      // El síntoma que reportó el cliente: unas fotos subían y otras no, según
      // el móvil con el que se hubieran tomado.
      const canvas = simularCanvas({ ancho: 4032, alto: 3024, tamano: MAX_SUBIDA_BYTES * 3 });

      await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      expect(canvas.calidades.length).toBeGreaterThan(1);
      expect(canvas.calidades[1]).toBeLessThan(canvas.calidades[0]);
    });

    it('debería acabar reduciendo la resolución si la calidad no basta', async () => {
      const canvas = simularCanvas({ ancho: 4032, alto: 3024, tamano: MAX_SUBIDA_BYTES * 3 });

      await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      const ultima = canvas.dimensiones.at(-1)!;
      expect(ultima[0]).toBeLessThan(canvas.dimensiones[0][0]);
    });

    it('debería parar en cuanto el resultado cabe', async () => {
      const canvas = simularCanvas({ ancho: 4032, alto: 3024, tamano: 500 });

      await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      expect(canvas.dimensiones).toHaveLength(1);
    });

    it('debería reducir también un JPEG demasiado grande', async () => {
      // No es sólo cosa del HEIC: un JPEG de 48 MP tampoco cabe en la petición.
      simularCanvas({ ancho: 8064, alto: 6048, tamano: 1000 });
      const gordo = fichero('IMG_0100.jpg', 'image/jpeg', MAX_SUBIDA_BYTES + 1);

      const preparado = await prepararImagen(gordo);

      expect(preparado).not.toBe(gordo);
      expect(preparado.size).toBeLessThanOrEqual(MAX_SUBIDA_BYTES);
    });

    it('debería mantener en PNG un PNG grande, para no perder la transparencia', async () => {
      // Un logotipo pasado a JPEG saldría con el fondo relleno de negro.
      const canvas = simularCanvas({ ancho: 3000, alto: 3000, tamano: 1000 });
      const logo = fichero('logo.png', 'image/png', MAX_SUBIDA_BYTES + 1);

      const preparado = await prepararImagen(logo);

      expect(canvas.tipos[0]).toBe('image/png');
      expect(preparado.name).toBe('logo.png');
    });

    it('debería pasar el PNG a JPEG si ni reduciéndolo cabe', async () => {
      // Perder el alfa de una captura enorme es preferible a no poder subirla.
      const canvas = simularCanvas({ ancho: 6000, alto: 6000, tamano: MAX_SUBIDA_BYTES * 3 });

      await prepararImagen(fichero('captura.png', 'image/png', MAX_SUBIDA_BYTES + 1));

      expect(canvas.tipos[0]).toBe('image/png');
      expect(canvas.tipos.at(-1)).toBe('image/jpeg');
    });

    it('debería devolver el original si el navegador no sabe decodificarlo', async () => {
      // Chrome y Firefox no decodifican HEIC. Fallar aquí dejaría al usuario sin
      // poder subir; el API acepta HEIC como último recurso.
      global.createImageBitmap = jest.fn().mockRejectedValue(new Error('sin decodificador')) as never;
      const original = fichero('IMG_0042.HEIC', 'image/heic');

      await expect(prepararImagen(original)).resolves.toBe(original);
    });

    it('debería devolver el original si el canvas no produce nada', async () => {
      simularCanvas({ ancho: 100, alto: 80, tamano: null });
      const original = fichero('IMG_0042.HEIC', 'image/heic');

      await expect(prepararImagen(original)).resolves.toBe(original);
    });

    it('debería reintentar sin opciones si el navegador no conoce la orientación', async () => {
      /*
       * `imageOrientation: 'from-image'` sólo existe desde Safari 16, Chrome 112
       * y Firefox 111: antes lanzan TypeError al validar el diccionario, no lo
       * ignoran. En iOS 15 la conversión moría aquí y la foto de iPhone se subía
       * en HEIC crudo.
       */
      const canvas = simularCanvas({ ancho: 100, alto: 80, tamano: 10 });
      canvas.decodificar
        .mockRejectedValueOnce(new TypeError('imageOrientation desconocida'))
        .mockResolvedValue({ width: 100, height: 80, close: jest.fn() });

      const convertido = await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      expect(canvas.decodificar).toHaveBeenCalledTimes(2);
      expect(canvas.decodificar.mock.calls[1]).toHaveLength(1);
      expect(convertido.type).toBe('image/jpeg');
    });

    it('debería dejar holgura por debajo del tope, que el servidor compara con <', async () => {
      // `MaxFileSizeValidator` rechaza un fichero de exactamente 5 MB. Apuntar
      // al filo devolvía un 422 que en pantalla se leía como "formato no válido".
      const canvas = simularCanvas({ ancho: 4032, alto: 3024, tamano: MAX_SUBIDA_BYTES - 1 });

      await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      expect(canvas.calidades.length).toBeGreaterThan(1);
    });

    it('debería procesar un JPEG que se queda justo en el tope', async () => {
      simularCanvas({ ancho: 4032, alto: 3024, tamano: 1000 });
      const alFilo = fichero('IMG_0100.jpg', 'image/jpeg', MAX_SUBIDA_BYTES);

      const preparado = await prepararImagen(alFilo);

      expect(preparado).not.toBe(alFilo);
    });

    it('debería tirar de una etiqueta img cuando el navegador no tiene createImageBitmap', async () => {
      // Safari < 15 y las WebViews antiguas de Android no traen la API. Sin este
      // respaldo, ahí no se convertía ni se reducía absolutamente nada.
      const canvas = simularCanvas({ ancho: 4032, alto: 3024, tamano: 10 }, { conEtiquetaImg: true });
      delete (global as unknown as Record<string, unknown>)['createImageBitmap'];

      const convertido = await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      expect(convertido.type).toBe('image/jpeg');
      expect(Math.max(...canvas.dimensiones[0])).toBeLessThanOrEqual(2560);
    });

    it('debería liberar el bitmap siempre, aunque el volcado falle', async () => {
      // Un bitmap sin cerrar retiene la foto entera en memoria; en un móvil, con
      // varias fotos seguidas, eso acaba en pestaña recargada.
      const canvas = simularCanvas({ ancho: 100, alto: 80, tamano: null });

      await prepararImagen(fichero('IMG_0042.HEIC', 'image/heic'));

      expect(canvas.cerrado).toHaveBeenCalled();
    });
  });

  /**
   * Última verja antes de gastar una petición. Los tres casos son fallos reales
   * de fotos de iPhone que hasta ahora acababan en un 422 del servidor o en una
   * imagen que sólo se veía desde Safari.
   */
  describe('problemaDeSubida', () => {
    it('debería dar por buena una imagen convertida y ligera', () => {
      expect(problemaDeSubida(fichero('foto.jpg', 'image/jpeg', 1000))).toBeNull();
    });

    it('debería detectar la foto que iCloud no ha descargado', () => {
      expect(problemaDeSubida(fichero('IMG_0043.JPG', 'image/jpeg', 0))).toBe('vacio');
    });

    it('debería detectar el HEIC que no se pudo convertir', () => {
      // Subirlo dejaría la ficha con una imagen invisible fuera de Safari.
      expect(problemaDeSubida(fichero('IMG_0042.HEIC', 'image/heic', 1000))).toBe('sin_convertir');
    });

    it('debería detectar lo que no cabe ni tras comprimirlo', () => {
      const enorme = fichero('panoramica.jpg', 'image/jpeg', MAX_SUBIDA_BYTES);
      expect(problemaDeSubida(enorme)).toBe('demasiado_grande');
    });
  });

  interface CanvasSimulado {
    readonly dimensiones: [number, number][];
    readonly calidades: number[];
    readonly tipos: string[];
    readonly cerrado: jest.Mock;
    readonly decodificar: jest.Mock;
  }

  /**
   * Simula la decodificación y el volcado del navegador, registrando con qué
   * dimensiones, tipo y calidad se le pidió cada pasada.
   *
   * `tamano: null` = el navegador no devuelve blob (el caso del canvas que se
   * pasa del techo de iOS).
   */
  function simularCanvas(
    opciones: { ancho: number; alto: number; tamano: number | null },
    extra: { conEtiquetaImg?: boolean } = {},
  ): CanvasSimulado {
    const registro: CanvasSimulado = {
      dimensiones: [],
      calidades: [],
      tipos: [],
      cerrado: jest.fn(),
      decodificar: jest.fn().mockResolvedValue({
        width: opciones.ancho,
        height: opciones.alto,
        close: () => registro.cerrado(),
      }),
    };

    global.createImageBitmap = registro.decodificar as never;

    if (extra.conEtiquetaImg) {
      // jsdom no carga imágenes: sin esto la promesa del respaldo no se resuelve.
      URL.createObjectURL = jest.fn(() => 'blob:simulado');
      URL.revokeObjectURL = jest.fn();
    }

    jest.spyOn(document, 'createElement').mockImplementation((etiqueta: string) => {
      if (etiqueta === 'img' && extra.conEtiquetaImg) {
        const img = {
          naturalWidth: opciones.ancho,
          naturalHeight: opciones.alto,
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          set src(_url: string) { setTimeout(() => img.onload?.(), 0); },
        };
        return img as unknown as HTMLElement;
      }

      if (etiqueta !== 'canvas') {
        return Object.getPrototypeOf(document).createElement.call(document, etiqueta) as HTMLElement;
      }

      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: jest.fn() }),
        toBlob: (cb: (b: Blob | null) => void, tipo: string, calidad: number) => {
          registro.dimensiones.push([canvas.width, canvas.height]);
          registro.tipos.push(tipo);
          registro.calidades.push(calidad);
          cb(opciones.tamano === null ? null : new Blob([new Uint8Array(opciones.tamano)], { type: tipo }));
        },
      };
      return canvas as unknown as HTMLCanvasElement;
    });

    return registro;
  }
});
