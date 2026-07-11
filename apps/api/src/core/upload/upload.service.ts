import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { DomainException } from '../../shared/exceptions/domain.exception';

@Injectable()
export class UploadService {
  private readonly region?: string;
  private readonly bucket?: string;
  private s3?: S3Client;

  constructor(private readonly config: ConfigService) {
    // Lectura no-eager (config.get, no getOrThrow): el API arranca aunque S3 no
    // esté configurado. La subida de imágenes es una feature opcional que solo
    // se valida cuando se usa (ver uploadImage), no en el bootstrap.
    this.region = config.get<string>('S3_REGION');
    this.bucket = config.get<string>('S3_BUCKET');
  }

  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    const client = this.getClient();
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const key = `uploads/${randomUUID()}.${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'max-age=31536000',
      }),
    );

    return { url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}` };
  }

  /** Crea el cliente S3 de forma perezosa; falla claro si falta configuración. */
  private getClient(): S3Client {
    if (this.s3) return this.s3;

    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    if (!this.region || !this.bucket || !accessKeyId || !secretAccessKey) {
      throw new DomainException(
        'La subida de imágenes no está configurada: faltan S3_REGION, S3_BUCKET, ' +
          'AWS_ACCESS_KEY_ID y/o AWS_SECRET_ACCESS_KEY en el entorno.',
        503,
      );
    }

    this.s3 = new S3Client({ region: this.region, credentials: { accessKeyId, secretAccessKey } });
    return this.s3;
  }
}
