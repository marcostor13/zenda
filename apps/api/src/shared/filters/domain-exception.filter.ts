import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from '../exceptions/domain.exception';

@Catch(DomainException, HttpException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException | HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    response.status(exception.statusCode).json({
      statusCode: exception.statusCode,
      message: exception.message,
      error: exception.name,
    });
  }
}
