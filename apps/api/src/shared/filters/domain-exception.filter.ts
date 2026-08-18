import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { DomainException } from '../exceptions/domain.exception';

/**
 * Traduce a HTTP los errores que llegan sin traducir.
 *
 * Se añaden los de Mongoose porque antes no los capturaba nadie: un id mal
 * formado en la ruta (`GET /reservas/loquesea`) produce un `CastError`, que
 * acababa en un 500 genérico. Un identificador inválido es un error de la
 * petición, no del servidor, y además llenaba los logs de ruido.
 */
@Catch(DomainException, HttpException, MongooseError.CastError, MongooseError.ValidationError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(
    exception: DomainException | HttpException | MongooseError.CastError | MongooseError.ValidationError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof MongooseError.CastError) {
      // Sin detallar el campo ni el valor: el mensaje de Mongoose expone nombres
      // internos del esquema y no le dice nada útil a quien llama.
      this.logger.warn(`Identificador no válido en ${exception.path}: ${String(exception.value)}`);
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'El identificador indicado no es válido.',
        error: 'BadRequest',
      });
      return;
    }

    if (exception instanceof MongooseError.ValidationError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Los datos enviados no son válidos.',
        error: 'BadRequest',
      });
      return;
    }

    response.status(exception.statusCode).json({
      statusCode: exception.statusCode,
      message: exception.message,
      error: exception.name,
    });
  }
}
