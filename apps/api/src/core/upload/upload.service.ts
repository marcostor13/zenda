import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, mongo } from 'mongoose';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { DomainException } from '../../shared/exceptions/domain.exception';

/** Colección GridFS donde caen las imágenes cuando no hay S3 configurado. */
const BUCKET_GRIDFS = 'uploads';

/** Imagen servida desde GridFS por `GET /upload/:id`. */
export interface ImagenAlmacenada {
  readonly stream: Readable;
  readonly contentType: string;
  readonly length: number;
}

@Injectable()
export class UploadService {
  private readonly region?: string;
  private readonly bucket?: string;
  private s3?: S3Client;

  constructor(
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {
    // Lectura no-eager (config.get, no getOrThrow): el API arranca aunque S3 no
    // esté configurado. Sin S3 la subida no falla, cae a GridFS (ver uploadImage).
    this.region = config.get<string>('S3_REGION');
    this.bucket = config.get<string>('S3_BUCKET');
  }

  /**
   * Guarda la imagen y devuelve la URL con la que el navegador podrá pintarla.
   * Con S3 configurado va a S3; si no, a GridFS, para que la foto de la ficha
   * de la mascota funcione en cualquier entorno (TCK-8012).
   */
  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    return this.hayS3() ? this.subirAS3(file) : this.subirAGridFs(file);
  }

  /** Lee del almacén local. Solo aplica a las imágenes servidas por el API. */
  async obtenerImagen(id: string): Promise<ImagenAlmacenada> {
    const objectId = this.aObjectId(id);
    const bucket = this.gridFs();
    const [fichero] = await bucket.find({ _id: objectId }).limit(1).toArray();
    if (!fichero) throw new DomainException('La imagen no existe.', 404);

    return {
      stream: bucket.openDownloadStream(objectId),
      contentType: fichero.contentType ?? 'application/octet-stream',
      length: fichero.length,
    };
  }

  private async subirAS3(file: Express.Multer.File): Promise<{ url: string }> {
    const key = `uploads/${randomUUID()}.${this.extensionDe(file)}`;

    await this.clienteS3().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'max-age=31536000',
      }),
    );

    return { url: `${this.baseS3()}/${key}` };
  }

  private async subirAGridFs(file: Express.Multer.File): Promise<{ url: string }> {
    const nombre = `${randomUUID()}.${this.extensionDe(file)}`;
    const subida = this.gridFs().openUploadStream(nombre, { contentType: file.mimetype });

    await new Promise<void>((resolve, reject) => {
      subida.once('error', reject);
      subida.once('finish', () => resolve());
      subida.end(file.buffer);
    });

    return { url: `${this.baseApi()}/upload/${subida.id.toString()}` };
  }

  private hayS3(): boolean {
    return !!(
      this.region &&
      this.bucket &&
      this.config.get<string>('AWS_ACCESS_KEY_ID') &&
      this.config.get<string>('AWS_SECRET_ACCESS_KEY')
    );
  }

  private clienteS3(): S3Client {
    if (this.s3) return this.s3;

    this.s3 = new S3Client({
      region: this.region!,
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
    return this.s3;
  }

  /**
   * Origen público de los objetos de S3. Un bucket privado (el valor por defecto
   * de AWS) devuelve 403 al pintar la URL directa, así que cuando se sirve por
   * CDN o dominio propio hay que fijar S3_PUBLIC_BASE_URL (ver DEPLOY.md).
   */
  private baseS3(): string {
    const publica = this.config.get<string>('S3_PUBLIC_BASE_URL');
    return publica
      ? publica.replace(/\/+$/, '')
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
  }

  /** Origen público del propio API, base de las URLs servidas desde GridFS. */
  private baseApi(): string {
    const declarada = this.config.get<string>('API_URL');
    const puerto = this.config.get<string>('PORT') ?? '3000';
    const origen = (declarada ?? `http://localhost:${puerto}`).replace(/\/+$/, '');
    return origen.endsWith('/api/v1') ? origen : `${origen}/api/v1`;
  }

  private gridFs(): mongo.GridFSBucket {
    if (!this.connection.db) {
      throw new DomainException('La base de datos no está disponible.', 503);
    }
    return new mongo.GridFSBucket(this.connection.db, { bucketName: BUCKET_GRIDFS });
  }

  private aObjectId(id: string): mongo.ObjectId {
    if (!mongo.ObjectId.isValid(id)) {
      throw new DomainException('Identificador de imagen no válido.', 400);
    }
    return new mongo.ObjectId(id);
  }

  private extensionDe(file: Express.Multer.File): string {
    return file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
  }
}
