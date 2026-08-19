import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'stream';
import { Response } from 'express';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

describe('UploadController', () => {
  let controller: UploadController;
  let service: jest.Mocked<UploadService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: {
            uploadImage: jest.fn().mockResolvedValue({ url: 'https://cdn.doogking.com/uploads/a.png' }),
            obtenerImagen: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UploadController);
    service = module.get(UploadService);
  });

  /** Los tipos que el endpoint pasó al servicio en la última llamada. */
  const permitidos = (): string[] => service.uploadImage.mock.calls[0][1] as string[];

  it('debería delegar la subida en el servicio', async () => {
    const fichero = { originalname: 'luna.png' } as Express.Multer.File;

    await expect(controller.uploadImage(fichero)).resolves.toEqual({
      url: 'https://cdn.doogking.com/uploads/a.png',
    });
    expect(service.uploadImage).toHaveBeenCalledWith(fichero, expect.any(Array));
  });

  it('debería delegar la subida de vídeo en el servicio (Ref. ADI3)', async () => {
    const fichero = { originalname: 'sesion.mp4' } as Express.Multer.File;
    service.uploadImage.mockResolvedValue({ url: 'https://cdn.doogking.com/uploads/sesion.mp4' });

    await expect(controller.uploadVideo(fichero)).resolves.toEqual({
      url: 'https://cdn.doogking.com/uploads/sesion.mp4',
    });
    expect(service.uploadImage).toHaveBeenCalledWith(fichero, expect.any(Array));
  });

  describe('formatos que acepta cada endpoint', () => {
    const fichero = {} as Express.Multer.File;

    it('debería aceptar la foto del iPhone al subir una imagen', async () => {
      await controller.uploadImage(fichero);

      expect(permitidos()).toContain('image/heic');
    });

    it('debería aceptar PDF y foto en la documentación', async () => {
      // El seguro llega en PDF; el certificado, casi siempre, en foto del móvil.
      await controller.uploadDocumento(fichero);

      expect(permitidos()).toContain('application/pdf');
      expect(permitidos()).toContain('image/heic');
    });

    it('no debería aceptar vídeo por el endpoint de imágenes', async () => {
      await controller.uploadImage(fichero);

      expect(permitidos()).not.toContain('video/mp4');
    });

    it('debería aceptar el MOV del iPhone al subir vídeo', async () => {
      await controller.uploadVideo(fichero);

      expect(permitidos()).toEqual(['video/mp4', 'video/webm', 'video/quicktime']);
    });
  });

  it('debería servir la imagen con su tipo y una caché larga', async () => {
    const stream = Readable.from(['imagen']);
    service.obtenerImagen.mockResolvedValue({ stream, contentType: 'image/png', length: 6 });
    const set = jest.fn();

    const respuesta = await controller.obtenerImagen('507f1f77bcf86cd799439011', { set } as unknown as Response);

    expect(set).toHaveBeenCalledWith({
      'Content-Type': 'image/png',
      'Content-Length': '6',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    });
    expect(respuesta.getStream()).toBe(stream);
  });

  it('debería servir la foto HEIC en línea, no como descarga', async () => {
    // Forzar la descarga de una foto garantiza que no se vea. En línea al menos
    // funciona en iOS, que es justo de donde vienen esos ficheros.
    service.obtenerImagen.mockResolvedValue({
      stream: Readable.from(['heic']),
      contentType: 'image/heic',
      length: 4,
    });
    const set = jest.fn();

    await controller.obtenerImagen('507f1f77bcf86cd799439011', { set } as unknown as Response);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Disposition': 'inline' }),
    );
  });

  it('debería servir como descarga lo que no sea una imagen conocida', async () => {
    // Un PDF servido en línea desde el origen del API puede ejecutar scripts en
    // ese origen; como adjunto, no.
    service.obtenerImagen.mockResolvedValue({
      stream: Readable.from(['pdf']),
      contentType: 'application/pdf',
      length: 3,
    });
    const set = jest.fn();

    await controller.obtenerImagen('507f1f77bcf86cd799439011', { set } as unknown as Response);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Disposition': 'attachment',
        'X-Content-Type-Options': 'nosniff',
      }),
    );
  });
});
