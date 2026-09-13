import { VerticalKey } from 'shared';
import { escaparHtml, euros, fechaLarga, horaCorta } from './html-email';
import {
  DatosReservaConfirmada, asuntoReservaConfirmada, plantillaReservaConfirmada,
} from './reserva-confirmada.plantilla';
import { plantillaNuevaReservaComercio } from './nueva-reserva-comercio.plantilla';
import { construirIcs } from './evento-calendario';
import { detallesLegibles } from './detalles-reserva';

const cita: DatosReservaConfirmada = {
  urlBase: 'https://www.doogking.com',
  cliente: { nombre: 'Ana' },
  codigo: 'RES-7K2M9QXA',
  vertical: VerticalKey.VETERINARIA,
  servicio: { titulo: 'Clínica Royal', imagen: 'https://img/x.jpg', direccion: 'Calle Colón 12', ciudad: 'Valencia' },
  comercio: { nombre: 'Clínica Royal', telefono: '+34 961 234 567', email: 'citas@royal.es' },
  inicio: new Date('2026-09-21T08:00:00Z'),
  fin: new Date('2026-09-21T08:30:00Z'),
  conHora: true,
  perro: 'Nala',
  cantidad: 1,
  detalles: [['Servicio', 'Vacunación']],
  importes: { total: 38, baseImponible: 31.4, iva: 6.6, descuento: 4, cupon: 'BIENVENIDA' },
};

describe('correos de reserva', () => {
  describe('formato', () => {
    it('debería escapar lo que escribe un usuario', () => {
      expect(escaparHtml('<a href="x">Tom & Jerry\'s</a>')).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
    });

    it('debería escribir fechas, horas e importes como en España', () => {
      expect(fechaLarga(new Date('2026-09-20T22:30:00Z'))).toBe('lunes, 21 de septiembre de 2026');
      expect(horaCorta(new Date('2026-12-21T09:00:00Z'))).toBe('10:00');
      expect(euros(1234.5)).toBe('1.234,50 €');
    });
  });

  describe('confirmación al cliente', () => {
    it('debería llevar en el asunto el servicio, el día y la hora de la cita', () => {
      expect(asuntoReservaConfirmada(cita)).toBe('✔ Reserva confirmada: Clínica Royal · lun 21 sept a las 10:00 (RES-7K2M9QXA)');
      expect(asuntoReservaConfirmada({ ...cita, conHora: false })).toBe('✔ Reserva confirmada: Clínica Royal · lun 21 sept (RES-7K2M9QXA)');
    });

    it('debería incluir todo lo necesario para ir: código, cuándo, dónde, importe y contacto', () => {
      const html = plantillaReservaConfirmada(cita);

      for (const texto of [
        'RES-7K2M9QXA', 'Lunes, 21 de septiembre de 2026', '10:00 – 10:30', 'Calle Colón 12, Valencia',
        'google.com/maps', 'Nala', 'Vacunación', '31,40 €', '6,60 €', '−4,00 €'.replace('−', '&minus;'), '38,00 €',
        'BIENVENIDA', '+34 961 234 567', 'citas@royal.es', 'https://www.doogking.com/reservas/RES-7K2M9QXA',
        'Llega 10 minutos antes', 'logo-doogking-footer.png',
      ]) {
        expect(html).toContain(texto);
      }
    });

    it('debería describir una estancia con entrada, salida, noches y la política del comercio', () => {
      const html = plantillaReservaConfirmada({
        ...cita,
        vertical: VerticalKey.ALOJAMIENTO,
        conHora: false,
        inicio: new Date('2026-10-02T00:00:00Z'),
        fin: new Date('2026-10-05T00:00:00Z'),
        servicio: { ...cita.servicio, checkIn: '10:00', checkOut: '12:00', politicaCancelacion: 'Gratis hasta 48 h antes.' },
        importes: { total: 135, baseImponible: 111.57, iva: 23.43, descuento: 0 },
      });

      expect(html).toContain('Viernes, 2 de octubre de 2026 · desde las 10:00');
      expect(html).toContain('Lunes, 5 de octubre de 2026 · hasta las 12:00');
      expect(html).toContain('3 noches');
      expect(html).toContain('Gratis hasta 48 h antes.');
      expect(html).not.toContain('Descuento');
    });

    it('no debería meter una imagen que no sea https ni texto sin escapar', () => {
      const html = plantillaReservaConfirmada({
        ...cita,
        cliente: { nombre: '<script>alert(1)</script>' },
        servicio: { ...cita.servicio, imagen: 'javascript:alert(1)' },
      });

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('javascript:');
    });
  });

  describe('aviso al comercio', () => {
    it('debería resumir cliente, mascota y cita con enlace al panel', () => {
      const html = plantillaNuevaReservaComercio({ ...cita, clienteNombre: 'Ana Ruiz' });

      expect(html).toContain('Tienes una nueva reserva');
      expect(html).toContain('Ana Ruiz');
      expect(html).toContain('10:00–10:30');
      expect(html).toContain('/comercio/reservas');
    });
  });

  describe('evento de calendario', () => {
    it('debería crear una cita con hora en UTC y un aviso dos horas antes', () => {
      const ics = construirIcs({
        uid: 'RES-1', titulo: 'Vacunación, Nala', descripcion: 'Reserva; ver detalles', lugar: 'Clínica Royal',
        inicio: cita.inicio, fin: cita.fin, diaCompleto: false,
      }, new Date('2026-09-13T10:00:00Z'));

      expect(ics).toContain('DTSTART:20260921T080000Z');
      expect(ics).toContain('DTEND:20260921T083000Z');
      expect(ics).toContain('SUMMARY:Vacunación\\, Nala');
      expect(ics).toContain('DESCRIPTION:Reserva\\; ver detalles');
      expect(ics).toContain('TRIGGER:-PT2H');
      expect(ics.split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75)).toBe(true);
    });

    it('debería crear una estancia de días completos y dar un fin por defecto', () => {
      const ics = construirIcs({
        uid: 'RES-2', titulo: 'Residencia', descripcion: 'x'.repeat(200),
        inicio: new Date('2026-10-02T00:00:00Z'), diaCompleto: true,
      });

      expect(ics).toContain('DTSTART;VALUE=DATE:20261002');
      expect(ics).toContain('DTEND;VALUE=DATE:20261003');
    });
  });

  describe('casos con pocos datos', () => {
    const minimo: DatosReservaConfirmada = {
      ...cita,
      vertical: VerticalKey.FUNERARIOS,
      servicio: { titulo: 'Despedida' },
      comercio: { nombre: 'Crematorio Sereno' },
      fin: undefined,
      perro: undefined,
      cantidad: 2,
      detalles: [],
      importes: { total: 90, baseImponible: 74.38, iva: 15.62, descuento: 5 },
    };

    it('debería componer el correo sin dirección, contacto, mascota ni consejos', () => {
      const html = plantillaReservaConfirmada(minimo);

      expect(html).toContain('10:00 <span');
      expect(html).not.toContain('Cómo llegar');
      expect(html).not.toContain('Antes de ir');
      expect(html).toContain('Cantidad');
      expect(html).toContain('Descuento</td>');
      expect(html).toContain('Puedes cancelar desde «Mis reservas»');
    });

    it('debería describir una estancia sin salida ni horas de entrada', () => {
      const html = plantillaReservaConfirmada({ ...minimo, vertical: VerticalKey.ALOJAMIENTO, conHora: false });

      expect(html).toContain('Entrada');
      expect(html).not.toContain('Salida');
      expect(html).not.toContain('desde las');
    });

    it('debería avisar al comercio también de estancias y sin cliente ni mascota', () => {
      const estancia = plantillaNuevaReservaComercio({
        ...minimo, conHora: false, fin: new Date('2026-09-24T00:00:00Z'), detalles: [['Servicio', 'Suite']],
      });
      expect(estancia).toContain('→');
      expect(estancia).toContain('Cliente');
      expect(estancia).not.toContain('Mascota');

      const sinFin = plantillaNuevaReservaComercio({ ...minimo, conHora: false, vertical: 'otra' });
      expect(sinFin).not.toContain('→');
      expect(sinFin).toContain('otra');
    });

    it('debería pintar botones secundarios y escapar valores vacíos', () => {
      expect(escaparHtml(null)).toBe('');
      expect(plantillaReservaConfirmada({ ...minimo, vertical: 'desconocida' })).toContain('desconocida');
    });
  });

  describe('detalles legibles', () => {
    it('debería usar el valor tal cual cuando no reconoce el formato y no repetir etiquetas', () => {
      expect(detallesLegibles({
        servicio: 'Baño', servicioNombre: 'Otro nombre', modalidad: 'sesion', franja: 'madrugada', extras: 'Urna',
      })).toEqual([['Servicio', 'Baño'], ['Modalidad', 'Sesión'], ['Franja', 'madrugada'], ['Extras', 'Urna']]);
      expect(detallesLegibles({ modalidad: 'intensivo', franja: 'manana', extras: [null, ''] }))
        .toEqual([['Modalidad', 'intensivo'], ['Franja', 'Mañana']]);
    });

    it('debería enseñar sólo lo útil, con etiqueta y formato', () => {
      expect(detallesLegibles({
        hora: '10:00', servicio: 'Baño', modalidad: 'programa', distanciaKm: 12, franja: 'tarde',
        extras: [{ nombre: 'Urna' }, 'Huella'], necesitaRecogida: true, observaciones: '',
      })).toEqual([
        ['Servicio', 'Baño'], ['Modalidad', 'Programa completo'], ['Distancia', '12 km'], ['Franja', 'Tarde'], ['Extras', 'Urna, Huella'],
      ]);
      expect(detallesLegibles(undefined)).toEqual([]);
    });
  });
});
