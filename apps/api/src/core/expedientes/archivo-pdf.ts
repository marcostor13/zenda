import { StreamableFile } from '@nestjs/common';
import { InformeDescargable } from '../perros/informe/informe-perro.service';

/**
 * Envuelve el informe como descarga. Mismas cabeceras que el informe del dueño:
 * `attachment` porque es un documento para guardar, y `no-store` porque es una
 * historia clínica que no debe quedarse en ninguna caché intermedia.
 */
export function archivoPdf(informe: InformeDescargable): StreamableFile {
  return new StreamableFile(informe.pdf, {
    type: 'application/pdf',
    disposition: `attachment; filename="${informe.nombreFichero}"`,
    length: informe.pdf.length,
  });
}
