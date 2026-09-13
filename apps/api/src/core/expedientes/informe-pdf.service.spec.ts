import { InformePdfService } from './informe-pdf.service';
import { DatosInforme } from './expediente.types';

describe('InformePdfService', () => {
  const service = new InformePdfService();

  const datos = (extra: Partial<DatosInforme['expediente']> = {}, destinatario: DatosInforme['destinatario'] = 'comercio'): DatosInforme => ({
    emisor: 'Clínica Royal',
    destinatario,
    expediente: {
      perro: {
        nombre: 'Nala', raza: 'Beagle', sexo: 'hembra', fechaNacimiento: new Date('2021-04-02'), peso: 12.5,
        tamano: 'mediano', esterilizado: true, microchip: '941', vacunasDetalle: [{ tipo: 'antirrabica', fecha: new Date('2026-02-03') }],
        vacunas: ['Tos'], alergias: ['Pollo'], medicacion: ['Apoquel'], temperamento: 'Tranquila', miedos: ['Tormentas'],
        ansiedadSeparacion: true, seMarea: true,
      },
      propietario: { nombre: 'Ana Ruiz', email: 'ana@x.com', telefono: '600' },
      registros: Array.from({ length: 12 }, (_, i) => ({
        _id: String(i), vertical: i % 2 ? 'peluqueria' : 'veterinaria', origen: 'comercio' as const,
        titulo: `Registro ${i}`, nota: 'Observación larga '.repeat(20), esPropio: true,
        datosEstructurados: i % 2 ? { serviciosRealizados: 'Baño' } : { diagnostico: 'Sano', pesoKg: 12.5, temperaturaC: 38.6 },
        fechaServicio: new Date('2026-09-01'), profesional: 'Dra. Pérez', proximaCita: new Date('2027-01-01'), comercioNombre: 'Clínica Royal',
      })),
      servicios: [{ reservaId: 'r', codigo: 'RES-1', vertical: 'veterinaria', comercioId: 'c', fechaInicio: new Date(), estado: 'completada' }],
      ...extra,
    },
  });

  const esPdf = (buffer: Buffer) => buffer.subarray(0, 4).toString() === '%PDF';

  it('debería generar un PDF de varias páginas con un historial largo', async () => {
    const pdf = await service.generar(datos());
    expect(esPdf(pdf)).toBe(true);
    expect(pdf.toString('latin1')).toMatch(/\/Count [2-9]/);
  });

  it('debería generar el informe del dueño aunque la ficha esté vacía', async () => {
    const pdf = await service.generar(datos({ perro: { nombre: 'Toby', esMestizo: true }, registros: [], servicios: [], propietario: undefined }, 'propietario'));
    expect(esPdf(pdf)).toBe(true);
  });
});
