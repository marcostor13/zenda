import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';

/** Un año: las imágenes son inmutables, cada subida genera una clave nueva. */
const CACHE_INMUTABLE = 'public, max-age=31536000, immutable';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Subir imagen (max 5 MB, JPEG / PNG / WebP / GIF). Va a S3 si está configurado; si no, a GridFS',
  })
  uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /image\/(jpeg|png|webp|gif)/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploadService.uploadImage(file);
  }

  /**
   * Sirve las imágenes guardadas en GridFS. Es público a propósito: la URL viaja
   * en el `src` de un `<img>`, que no puede enviar el Authorization header.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Descargar una imagen almacenada en el API' })
  async obtenerImagen(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const imagen = await this.uploadService.obtenerImagen(id);
    res.set({
      'Content-Type': imagen.contentType,
      'Content-Length': String(imagen.length),
      'Cache-Control': CACHE_INMUTABLE,
    });
    return new StreamableFile(imagen.stream);
  }
}
