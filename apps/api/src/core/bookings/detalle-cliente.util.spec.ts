import { esClaveDelServidor, limpiarDetalleCliente } from './detalle-cliente.util';

describe('limpiarDetalleCliente', () => {
  it('debería quitar cualquier importe que mande el cliente', () => {
    expect(limpiarDetalleCliente({
      precioAcordado: 1, precioBase: 2, montoTotal: 3, importe: 4, comisionPct: 0, descuentoMonto: 9, total: 1,
      servicio: 'Baño', espacioId: 'esp-1', extras: ['Paseo'],
    })).toEqual({ servicio: 'Baño', espacioId: 'esp-1', extras: ['Paseo'] });
  });

  it('debería quitar la ficha del perro y las marcas internas', () => {
    expect(limpiarDetalleCliente({ perroEsPPP: false, perroPeso: 1, validarHorarioEstancia: false, tamanoPerro: 'mini' }))
      .toEqual({ tamanoPerro: 'mini' });
  });

  it('debería dejar pasar un detalle vacío o ausente', () => {
    expect(limpiarDetalleCliente(undefined)).toBeUndefined();
    expect(limpiarDetalleCliente({})).toEqual({});
  });

  it('esClaveDelServidor no debería confundir claves legítimas', () => {
    expect(esClaveDelServidor('horaEntrada')).toBe(false);
    expect(esClaveDelServidor('tramoPeso')).toBe(false);
    expect(esClaveDelServidor('precioAcordado')).toBe(true);
  });
});
