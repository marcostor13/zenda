import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarPerfilComercioDto } from './actualizar-perfil-comercio.dto';

/**
 * El API valida con `whitelist` y `forbidNonWhitelisted` (ver `main.ts`), así que
 * una propiedad que el DTO no declare no se ignora: tumba la petición entera con
 * un 400. Estas pruebas usan la misma configuración para que el DTO y lo que de
 * verdad envía el panel no se separen sin que salte nada.
 */
describe('ActualizarPerfilComercioDto', () => {
  /** Valida como lo haría el ValidationPipe del API y devuelve los mensajes. */
  async function errores(payload: Record<string, unknown>): Promise<string[]> {
    const dto = plainToInstance(ActualizarPerfilComercioDto, payload);
    const fallos = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: false,
    });

    return fallos.flatMap(function aplanar(f): string[] {
      return [
        ...Object.values(f.constraints ?? {}),
        ...(f.children ?? []).flatMap(aplanar),
      ];
    });
  }

  /*
   * Lo que el panel dejó de enviar y estas pruebas seguían dando por bueno:
   * la documentación de verificación (retirada del alta) y la dirección, el
   * horario y sus excepciones (el horario vive ahora en cada servicio, ver
   * `mover-horario-a-servicios`). El DTO ya no declara ninguno de los cuatro,
   * así que las pruebas llevaban desde entonces en rojo y se van con ellos.
   */

  describe('secciones que guarda el panel de comercio', () => {
    it('debería aceptar el perfil y el contacto', async () => {
      await expect(errores({
        nombreComercial: 'Residencia Royal',
        descripcion: 'Suites con jardín.',
        contacto: { nombreContacto: 'Ana', email: 'ana@royal.test', telefono: '600000000' },
      })).resolves.toEqual([]);
    });

    it('debería aceptar la política de cancelación', async () => {
      await expect(errores({ politicaCancelacion: 'flexible' })).resolves.toEqual([]);
    });

    it('debería rechazar una política de cancelación desconocida', async () => {
      const mensajes = await errores({ politicaCancelacion: 'a-medida' });

      expect(mensajes.join(' ')).toContain('politicaCancelacion');
    });

    it('debería rechazar una propiedad que el panel no debería enviar', async () => {
      // Es la red que detectó el fallo de `documentos`: si el frontend empieza a
      // mandar algo que el DTO no declara, se ve aquí y no en producción.
      const mensajes = await errores({ estado: 'activo' });

      expect(mensajes.join(' ')).toContain('estado');
    });
  });
});
