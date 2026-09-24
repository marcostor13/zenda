import { detallesLegibles } from './detalles-reserva';
import {
  plantillaAceptacionCliente, plantillaHitoViaje, plantillaPendienteAceptacion, plantillaPresupuestoRecibido,
  plantillaReembolso, plantillaSolicitudPresupuesto,
} from './viaje.plantillas';

const URL_BASE = 'https://doogking.test';
// 10:30 en Madrid (horario de verano).
const INICIO = new Date('2026-10-01T08:30:00Z');

describe('plantillas de viaje', () => {
  describe('plantillaHitoViaje', () => {
    const base = {
      urlBase: URL_BASE, nombre: 'María <b>', codigo: 'RES-1', servicio: 'Transportes Fido',
      hito: 'Mascota recogida', mensaje: 'tu mascota ya está con el transportista.',
    };

    it('debería escapar lo que escribe el usuario y enlazar al seguimiento', () => {
      const html = plantillaHitoViaje({ ...base, nota: '<script>alert(1)</script>' });

      expect(html).toContain('Mascota recogida');
      expect(html).toContain('María &lt;b&gt;');
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('Nota del transportista');
      expect(html).toContain(`${URL_BASE}/reservas/RES-1`);
    });

    it('debería incluir la foto sólo cuando la hay', () => {
      const conFoto = plantillaHitoViaje({ ...base, fotoUrl: 'https://cdn/foto.jpg?a=1&b=2' });
      const sinFoto = plantillaHitoViaje(base);

      expect(conFoto).toContain('src="https://cdn/foto.jpg?a=1&amp;b=2"');
      expect(sinFoto).not.toContain('<img src="https://cdn');
      expect(sinFoto).not.toContain('Nota del transportista');
    });
  });

  describe('plantillaAceptacionCliente', () => {
    const base = { urlBase: URL_BASE, nombre: 'María', codigo: 'RES-1', servicio: 'Fido', inicio: INICIO };

    it('debería confirmar el viaje aceptado con la hora de recogida', () => {
      const html = plantillaAceptacionCliente({ ...base, aceptada: true });

      expect(html).toContain('Tu viaje está aceptado');
      expect(html).toContain('10:30');
      expect(html).toContain(`${URL_BASE}/reservas/RES-1`);
    });

    it('debería explicar el rechazo con el motivo y el importe devuelto', () => {
      const html = plantillaAceptacionCliente({ ...base, aceptada: false, motivo: 'Sin <conductor>', importeDevuelto: 55 });

      expect(html).toContain('Tu viaje no se puede hacer');
      expect(html).toContain('Sin &lt;conductor&gt;');
      expect(html).toContain('55,00 €');
      expect(html).toContain(`${URL_BASE}/transporte`);
    });

    it('debería decir 0 € devueltos si no se indica importe', () => {
      const html = plantillaAceptacionCliente({ ...base, aceptada: false });
      expect(html).toContain('0,00 €');
    });
  });

  describe('plantillaPendienteAceptacion', () => {
    it('debería pedir al comercio que acepte antes del vencimiento con los detalles escapados', () => {
      const html = plantillaPendienteAceptacion({
        urlBase: URL_BASE, codigo: 'RES-1', servicio: 'Fido', inicio: INICIO,
        venceEn: new Date('2026-09-30T20:00:00Z'),
        detalles: [['Mascotas', 'Toby <perro>']],
      });

      expect(html).toContain('Tienes un viaje por aceptar');
      expect(html).toContain('22:00');
      expect(html).toContain('Toby &lt;perro&gt;');
      expect(html).toContain(`${URL_BASE}/comercio/reservas`);
    });
  });

  describe('plantillaReembolso', () => {
    const base = { urlBase: URL_BASE, nombre: 'María', codigo: 'RES-1', servicio: 'Fido', motivo: 'Cancelado por el cliente' };

    it('debería indicar el importe y el porcentaje devuelto', () => {
      const html = plantillaReembolso({ ...base, importe: 27.5, porcentaje: 50 });
      expect(html).toContain('27,50 €');
      expect(html).toContain('50 %');
      expect(html).toContain('Cancelado por el cliente');
    });

    it('debería explicar que no hay reembolso cuando el importe es 0', () => {
      const html = plantillaReembolso({ ...base, importe: 0, porcentaje: 0 });
      expect(html).toContain('no tiene reembolso');
    });
  });

  describe('plantillaSolicitudPresupuesto', () => {
    it('debería volcar el resumen de la solicitud y el comentario escapados', () => {
      const html = plantillaSolicitudPresupuesto({
        urlBase: URL_BASE, codigo: 'PRE-1', servicio: 'Transporte <urgente>', fechaServicio: INICIO,
        resumen: [['Recogida', 'Castellón'], ['Mascotas', 'Toby & Nala']], comentario: 'Llamar <antes>',
      });

      expect(html).toContain('Te piden un presupuesto');
      expect(html).toContain('Transporte &lt;urgente&gt;');
      expect(html).toContain('Toby &amp; Nala');
      expect(html).toContain('Llamar &lt;antes&gt;');
      expect(html).toContain(`${URL_BASE}/comercio/presupuestos`);
    });

    it('debería omitir el comentario si no lo hay', () => {
      const html = plantillaSolicitudPresupuesto({
        urlBase: URL_BASE, codigo: 'PRE-1', servicio: 'Fido', fechaServicio: INICIO, resumen: [],
      });
      expect(html).not.toContain('Comentario:');
    });
  });

  describe('plantillaPresupuestoRecibido', () => {
    const base = { urlBase: URL_BASE, nombre: 'María', codigo: 'PRE-1', empresa: 'Fido <SL>', importe: 1234.5, validoHasta: INICIO };

    it('debería mostrar el precio final, la empresa escapada y las condiciones', () => {
      const html = plantillaPresupuestoRecibido({ ...base, condiciones: 'Pago <previo>' });

      expect(html).toContain('1.234,50 €');
      expect(html).toContain('Fido &lt;SL&gt;');
      expect(html).toContain('Pago &lt;previo&gt;');
      expect(html).toContain(`${URL_BASE}/presupuestos`);
    });

    it('debería omitir las condiciones si no las hay', () => {
      expect(plantillaPresupuestoRecibido(base)).not.toContain('Condiciones');
    });
  });
});

describe('detallesLegibles — resumen de transporte', () => {
  it('debería usar el resumen que dejó el vertical, descartando filas mal formadas', () => {
    expect(detallesLegibles({ resumen: [['Recogida', 'Castellón'], ['suelta'], 'x', ['Mascotas', 2]], origen: 'ignorado' }))
      .toEqual([['Recogida', 'Castellón'], ['Mascotas', '2']]);
  });
});
