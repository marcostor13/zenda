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

  const documento = {
    tipo: 'seguro_rc',
    nombre: 'Póliza RC 2026',
    url: 'https://cdn.doogking.com/doc.pdf',
    fechaCaducidad: '2027-01-31',
  };

  describe('documentación para verificación', () => {
    it('debería aceptar la lista de documentos', async () => {
      // El servicio ya sabía tratarla, pero el DTO no la declaraba y el panel
      // recibía 400 "property documentos should not exist" al guardar.
      await expect(errores({ documentos: [documento] })).resolves.toEqual([]);
    });

    it('debería aceptar un documento sin nombre ni caducidad', async () => {
      await expect(
        errores({ documentos: [{ tipo: 'otro', url: 'https://cdn.doogking.com/x.pdf' }] }),
      ).resolves.toEqual([]);
    });

    it('debería exigir la URL del documento', async () => {
      const mensajes = await errores({ documentos: [{ tipo: 'otro' }] });

      expect(mensajes.join(' ')).toContain('url');
    });

    it('debería rechazar un tipo de documento que no está en el catálogo', async () => {
      const mensajes = await errores({ documentos: [{ ...documento, tipo: 'inventado' }] });

      expect(mensajes.join(' ')).toContain('tipo');
    });

    it('no debería aceptar el estado del documento desde el cliente', async () => {
      // Si lo aceptara, un comercio marcaría sus propios papeles como
      // 'verificado' y se saltaría la revisión del administrador (HU J1).
      const mensajes = await errores({
        documentos: [{ ...documento, estado: 'verificado' }],
      });

      expect(mensajes.join(' ')).toContain('estado');
    });

    it('debería admitir una lista vacía para borrar toda la documentación', async () => {
      await expect(errores({ documentos: [] })).resolves.toEqual([]);
    });
  });

  describe('secciones que guarda el panel de comercio', () => {
    it('debería aceptar el perfil, la dirección y el contacto', async () => {
      await expect(errores({
        nombreComercial: 'Residencia Royal',
        descripcion: 'Suites con jardín.',
        direccion: { calle: 'Gran Via', numero: '1', ciudad: 'Valencia', lat: 39.47, lng: -0.37 },
        contacto: { nombreContacto: 'Ana', email: 'ana@royal.test', telefono: '600000000' },
      })).resolves.toEqual([]);
    });

    it('debería aceptar horarios, excepciones y política de cancelación', async () => {
      await expect(errores({
        horario: [{ dia: 'lunes', abre: '09:00', cierra: '18:00', cerrado: false }],
        excepcionesHorario: [{ fecha: '2026-12-25', cerrado: true }],
        politicaCancelacion: 'flexible',
      })).resolves.toEqual([]);
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
