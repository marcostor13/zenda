import { StreamableFile } from '@nestjs/common';

/** Envuelve el PDF como descarga, con un nombre de archivo legible y seguro. */
export function archivoPdf(pdf: Buffer, nombreMascota: unknown): StreamableFile {
  return new StreamableFile(pdf, {
    type: 'application/pdf',
    disposition: `attachment; filename="${nombreArchivo(nombreMascota)}"`,
    length: pdf.length,
  });
}

export function nombreArchivo(nombreMascota: unknown): string {
  const base = String(nombreMascota ?? 'mascota')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `historial-${base || 'mascota'}.pdf`;
}
