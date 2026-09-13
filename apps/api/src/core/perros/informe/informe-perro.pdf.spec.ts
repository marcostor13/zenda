import { construirInformePdf } from './informe-perro.pdf';
import { InformePerro } from './informe-perro.tipos';

/** Informe mínimo al que cada prueba le cambia sólo lo que mira. */
const informe = (cambios: Partial<InformePerro> = {}): InformePerro => ({
  nombrePerro: 'Chispa',
  subtitulo: 'Mestiza · Hembra · 4 años',
  emitidoEl: '13 de septiembre de 2026',
  identidad: [{ etiqueta: 'Especie', valor: 'Perro' }],
  propietario: [],
  salud: [{ titulo: 'Alergias', items: ['Pollo'], acento: 'alerta' }],
  historial: [{
    fecha: '12 mar 2026',
    categoria: 'Historial veterinario',
    vertical: 'veterinaria',
    profesional: 'Clínica Els Ports',
    nota: 'Revisión anual.',
    detalles: [{ etiqueta: 'Peso', valor: '14,5 kg' }],
  }],
  ...cambios,
});

/** Cuántas páginas declara el PDF, leído del propio documento. */
const paginas = (pdf: Buffer): number =>
  Number(/\/Count (\d+)/.exec(pdf.toString('latin1'))?.[1] ?? 0);

describe('construirInformePdf', () => {
  it('debería devolver un PDF válido', async () => {
    const pdf = await construirInformePdf(informe());

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('debería caber en una página cuando el historial es corto', async () => {
    // Cada página que sobra es una página en blanco impresa. Los pies se
    // escriben por debajo del margen inferior y PDFKit abría una página nueva
    // por cada uno hasta que se bajó ese margen al pintarlos.
    const pdf = await construirInformePdf(informe());

    expect(paginas(pdf)).toBe(1);
  });

  it('debería pasar a otra página cuando el historial no cabe', async () => {
    const muchas = Array.from({ length: 40 }, () => informe().historial[0]);

    const pdf = await construirInformePdf(informe({ historial: muchas }));

    expect(paginas(pdf)).toBeGreaterThan(1);
  });

  it('debería generarse con la ficha recién creada, sin salud ni historial', async () => {
    // Un perro dado de alta hoy no tiene nada anotado, y la descarga no puede
    // fallar por eso: el informe sale igual, con lo que haya.
    const pdf = await construirInformePdf(informe({ salud: [], historial: [] }));

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('no debería romperse con un nombre vacío', async () => {
    // El monograma coge la primera letra del nombre; sin nombre no hay letra.
    const pdf = await construirInformePdf(informe({ nombrePerro: '' }));

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('debería admitir una nota larguísima sin cortarse', async () => {
    const nota = 'Detalle de la exploración. '.repeat(300);

    const pdf = await construirInformePdf(informe({
      historial: [{ ...informe().historial[0], nota }],
    }));

    expect(paginas(pdf)).toBeGreaterThan(1);
  });
});
