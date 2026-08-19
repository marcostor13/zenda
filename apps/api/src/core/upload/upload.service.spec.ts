import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { Writable } from 'stream';
import { UploadService } from './upload.service';
import { DomainException } from '../../shared/exceptions/domain.exception';

const enviarS3 = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: (...args: unknown[]) => enviarS3(...args) })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

/** Doble de GridFSBucket: registra lo subido y responde a las búsquedas. */
const gridFs = {
  openUploadStream: jest.fn(),
  openDownloadStream: jest.fn(),
  find: jest.fn(),
};
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    mongo: {
      ...actual.mongo,
      GridFSBucket: jest.fn().mockImplementation(() => gridFs),
    },
  };
});

const ID_VALIDO = '507f1f77bcf86cd799439011';

/** Stream de subida que termina bien y expone un id, como hace GridFS. */
function streamDeSubida(id = ID_VALIDO): Writable & { id: unknown } {
  const stream = new Writable({ write: (_c, _e, cb) => cb() }) as Writable & { id: unknown };
  stream.id = { toString: () => id };
  return stream;
}

async function crearServicio(vars: Record<string, string>): Promise<UploadService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      UploadService,
      { provide: ConfigService, useValue: { get: (clave: string) => vars[clave] } },
      { provide: getConnectionToken(), useValue: { db: {} } },
    ],
  }).compile();

  return module.get(UploadService);
}

/** Cabecera PNG real: la subida decide por los bytes, no por lo que declare nadie. */
const CABECERA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Cabecera de una foto de iPhone: contenedor ISO-BMFF con marca `heic`. */
const CABECERA_HEIC = Buffer.from([
  0, 0, 0, 0x18, ...[...'ftyp'].map((c) => c.charCodeAt(0)), ...[...'heic'].map((c) => c.charCodeAt(0)),
]);

/** Tipos que acepta `POST /upload/image`, tal y como los pasa el controlador. */
const IMAGENES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

const ficheroDePrueba = {
  originalname: 'luna.PNG',
  mimetype: 'image/png',
  buffer: Buffer.concat([CABECERA_PNG, Buffer.from('imagen')]),
} as Express.Multer.File;

const VARS_S3 = {
  S3_REGION: 'eu-west-1',
  S3_BUCKET: 'doogking-uploads',
  AWS_ACCESS_KEY_ID: 'clave',
  AWS_SECRET_ACCESS_KEY: 'secreto',
};

describe('UploadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gridFs.openUploadStream.mockReturnValue(streamDeSubida());
  });

  describe('uploadImage con S3 configurado', () => {
    it('debería subir a S3 y devolver la URL pública del bucket', async () => {
      const service = await crearServicio(VARS_S3);

      const { url } = await service.uploadImage(ficheroDePrueba, IMAGENES);

      expect(enviarS3).toHaveBeenCalledTimes(1);
      expect(url).toMatch(
        /^https:\/\/doogking-uploads\.s3\.eu-west-1\.amazonaws\.com\/uploads\/[\w-]+\.png$/,
      );
    });

    it('debería usar S3_PUBLIC_BASE_URL cuando el bucket se sirve por CDN', async () => {
      const service = await crearServicio({
        ...VARS_S3,
        S3_PUBLIC_BASE_URL: 'https://cdn.doogking.com/',
      });

      const { url } = await service.uploadImage(ficheroDePrueba, IMAGENES);

      expect(url).toMatch(/^https:\/\/cdn\.doogking\.com\/uploads\/[\w-]+\.png$/);
    });
  });

  describe('validación del contenido', () => {
    /** Foto que llega desde la app Archivos: sin tipo declarado utilizable. */
    const desdeArchivos = {
      originalname: 'IMG_0042',
      mimetype: 'application/octet-stream',
      buffer: Buffer.concat([CABECERA_HEIC, Buffer.alloc(16)]),
    } as Express.Multer.File;

    it('debería rechazar contenido que no es una imagen de verdad', async () => {
      // Sin mirar los bytes, cualquier contenido viajaba etiquetado como imagen
      // y luego se servía desde el origen del API.
      const service = await crearServicio({});
      const disfrazado = {
        originalname: 'inocente.png',
        mimetype: 'image/png',
        buffer: Buffer.from('<!doctype html><script>alert(1)</script>'),
      } as Express.Multer.File;

      await expect(service.uploadImage(disfrazado, IMAGENES)).rejects.toThrow(DomainException);
    });

    it('debería rechazar un formato válido que este endpoint no acepta', async () => {
      const service = await crearServicio({});
      const pdf = {
        originalname: 'seguro.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7 contenido'),
      } as Express.Multer.File;

      await expect(service.uploadImage(pdf, IMAGENES)).rejects.toThrow(DomainException);
    });

    it('debería aceptar la foto del iPhone aunque no declare tipo', async () => {
      /*
       * El caso que rompía las subidas desde iOS: cuando la foto llega desde la
       * app Archivos, Safari manda `application/octet-stream`. Validar contra
       * ese valor rechazaba fotos perfectamente válidas.
       */
      const service = await crearServicio({ API_URL: 'https://api.doogking.com' });

      await expect(service.uploadImage(desdeArchivos, IMAGENES)).resolves.toBeDefined();
    });

    it('debería almacenar el tipo real, no el que declaró el cliente', async () => {
      // Guardar `application/octet-stream` hacía que `GET /upload/:id` lo sirviera
      // con ese tipo y el navegador no pintara nada.
      const service = await crearServicio({ API_URL: 'https://api.doogking.com' });

      await service.uploadImage(desdeArchivos, IMAGENES);

      expect(gridFs.openUploadStream).toHaveBeenCalledWith(
        expect.stringMatching(/\.heic$/),
        { contentType: 'image/heic' },
      );
    });

    it('debería nombrar el fichero por su tipo real, no por su extensión', async () => {
      // iOS pone `.HEIC` a cosas que ya no lo son, y nada en absoluto a las que
      // llegan desde la app Archivos.
      const service = await crearServicio({ API_URL: 'https://api.doogking.com' });
      const malNombrado = {
        originalname: 'IMG_0042.HEIC',
        mimetype: 'image/heic',
        buffer: Buffer.concat([CABECERA_PNG, Buffer.from('imagen')]),
      } as Express.Multer.File;

      await service.uploadImage(malNombrado, IMAGENES);

      expect(gridFs.openUploadStream).toHaveBeenCalledWith(
        expect.stringMatching(/\.png$/),
        { contentType: 'image/png' },
      );
    });
  });

  describe('uploadImage sin S3 configurado', () => {
    it('debería guardar en GridFS y devolver una URL servida por el API (TCK-8012)', async () => {
      const service = await crearServicio({ API_URL: 'https://api.doogking.com' });

      const { url } = await service.uploadImage(ficheroDePrueba, IMAGENES);

      expect(enviarS3).not.toHaveBeenCalled();
      expect(gridFs.openUploadStream).toHaveBeenCalledWith(
        expect.stringMatching(/\.png$/),
        { contentType: 'image/png' },
      );
      expect(url).toBe(`https://api.doogking.com/api/v1/upload/${ID_VALIDO}`);
    });

    it('debería caer a S3 solo cuando están las cuatro variables', async () => {
      const service = await crearServicio({ S3_REGION: 'eu-west-1', S3_BUCKET: 'doogking-uploads' });

      await service.uploadImage(ficheroDePrueba, IMAGENES);

      expect(enviarS3).not.toHaveBeenCalled();
    });

    it('no debería duplicar el prefijo si API_URL ya lo incluye', async () => {
      const service = await crearServicio({ API_URL: 'https://api.doogking.com/api/v1' });

      const { url } = await service.uploadImage(ficheroDePrueba, IMAGENES);

      expect(url).toBe(`https://api.doogking.com/api/v1/upload/${ID_VALIDO}`);
    });

    it('debería propagar el error si GridFS falla al escribir', async () => {
      const stream = new Writable({ write: (_c, _e, cb) => cb(new Error('disco lleno')) });
      gridFs.openUploadStream.mockReturnValue(stream);
      const service = await crearServicio({});

      await expect(service.uploadImage(ficheroDePrueba, IMAGENES)).rejects.toThrow('disco lleno');
    });
  });

  describe('obtenerImagen', () => {
    it('debería devolver el stream con su tipo y tamaño', async () => {
      const descarga = Symbol('stream');
      gridFs.find.mockReturnValue({
        limit: () => ({ toArray: async () => [{ contentType: 'image/png', length: 42 }] }),
      });
      gridFs.openDownloadStream.mockReturnValue(descarga);
      const service = await crearServicio({});

      const imagen = await service.obtenerImagen(ID_VALIDO);

      expect(imagen).toEqual({ stream: descarga, contentType: 'image/png', length: 42 });
    });

    it('debería lanzar 400 si el identificador no es un ObjectId', async () => {
      const service = await crearServicio({});

      await expect(service.obtenerImagen('no-es-un-id')).rejects.toThrow(
        expect.objectContaining({ statusCode: 400 }) as DomainException,
      );
    });

    it('debería lanzar 404 si la imagen no existe', async () => {
      gridFs.find.mockReturnValue({ limit: () => ({ toArray: async () => [] }) });
      const service = await crearServicio({});

      await expect(service.obtenerImagen(ID_VALIDO)).rejects.toThrow(
        expect.objectContaining({ statusCode: 404 }) as DomainException,
      );
    });

    it('debería lanzar 503 si la conexión a Mongo aún no está lista', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UploadService,
          { provide: ConfigService, useValue: { get: () => undefined } },
          { provide: getConnectionToken(), useValue: { db: undefined } },
        ],
      }).compile();

      await expect(module.get(UploadService).obtenerImagen(ID_VALIDO)).rejects.toThrow(
        expect.objectContaining({ statusCode: 503 }) as DomainException,
      );
    });
  });
});
