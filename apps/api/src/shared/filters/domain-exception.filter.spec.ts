import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Error as MongooseError } from 'mongoose';
import { DomainExceptionFilter } from './domain-exception.filter';
import { DomainException } from '../exceptions/domain.exception';

describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new DomainExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
  });

  it('debería responder con el código y el mensaje de la excepción de dominio', () => {
    filter.catch(new DomainException('El cupón ha caducado', 410), host);

    expect(status).toHaveBeenCalledWith(410);
    expect(json).toHaveBeenCalledWith({
      statusCode: 410,
      message: 'El cupón ha caducado',
      error: 'DomainException',
    });
  });

  it('debería usar 400 cuando la excepción de dominio no indica código', () => {
    filter.catch(new DomainException('Datos incompletos'), host);

    expect(status).toHaveBeenCalledWith(400);
  });

  it('debería delegar en la propia HttpException de Nest', () => {
    filter.catch(new NotFoundException('No existe'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('debería conservar el cuerpo de una HttpException', () => {
    const excepcion = new BadRequestException(['el email no es válido']);

    filter.catch(excepcion, host);

    expect(json).toHaveBeenCalledWith(excepcion.getResponse());
  });

  describe('errores de Mongoose', () => {
    it('debería traducir un CastError a 400, no a 500', () => {
      // `GET /reservas/loquesea` acababa en un 500 genérico: un id mal formado
      // es un error de quien llama, no del servidor.
      const castError = new MongooseError.CastError('ObjectId', 'loquesea', '_id');

      filter.catch(castError, host);

      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'El identificador indicado no es válido.' }),
      );
    });

    it('no debería filtrar el nombre del campo interno ni el valor recibido', () => {
      filter.catch(new MongooseError.CastError('ObjectId', 'xyz', 'comercioId'), host);

      const cuerpo = JSON.stringify(json.mock.calls[0][0]);
      expect(cuerpo).not.toContain('comercioId');
      expect(cuerpo).not.toContain('xyz');
    });

    it('debería traducir un ValidationError a 400', () => {
      filter.catch(new MongooseError.ValidationError(), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Los datos enviados no son válidos.' }),
      );
    });
  });
});
