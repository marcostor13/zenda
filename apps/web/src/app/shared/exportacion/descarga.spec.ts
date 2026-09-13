import { descargarFichero } from './descarga';

describe('descargarFichero', () => {
  let enlace: HTMLAnchorElement;
  let crearUrl: jest.SpyInstance;
  let liberarUrl: jest.SpyInstance;

  beforeEach(() => {
    enlace = { href: '', download: '', click: jest.fn() } as unknown as HTMLAnchorElement;
    jest.spyOn(document, 'createElement').mockReturnValue(enlace);
    crearUrl = jest.fn().mockReturnValue('blob:doogking/1');
    liberarUrl = jest.fn();
    URL.createObjectURL = crearUrl as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = liberarUrl as unknown as typeof URL.revokeObjectURL;
  });

  afterEach(() => jest.restoreAllMocks());

  it('debería entregar el fichero con el nombre pedido', () => {
    descargarFichero(new Blob(['%PDF-']), 'informe.pdf');

    expect(enlace.download).toBe('informe.pdf');
    expect(enlace.href).toBe('blob:doogking/1');
    expect(enlace.click).toHaveBeenCalled();
  });

  it('debería liberar la URL temporal', () => {
    // Sin esto el blob se queda en memoria hasta que se recarga la pestaña.
    descargarFichero(new Blob(['%PDF-']), 'informe.pdf');

    expect(liberarUrl).toHaveBeenCalledWith('blob:doogking/1');
  });
});
