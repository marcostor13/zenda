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

  it('debería delegar la subida en el servicio', async () => {
    const fichero = { originalname: 'luna.png' } as Express.Multer.File;

    await expect(controller.uploadImage(fichero)).resolves.toEqual({
      url: 'https://cdn.doogking.com/uploads/a.png',
    });
    expect(service.uploadImage).toHaveBeenCalledWith(fichero);
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
    });
    expect(respuesta.getStream()).toBe(stream);
  });
});
