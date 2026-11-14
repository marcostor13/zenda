import { Types } from 'mongoose';
import { PagoConLineas, filtroPagosDeReservas, lineasDePago, lineasDeReservas } from './lineas-pago';

describe('lineas-pago', () => {
  const r1 = new Types.ObjectId();
  const r2 = new Types.ObjectId();
  const normal: PagoConLineas = {
    reservaId: r1, montoTotal: 121, montoSubtotal: 100, ivaMonto: 21,
    comisionPlataforma: 15, stripeFee: 2, montoLiquidacion: 104,
  };
  const viaje: PagoConLineas = {
    ...normal,
    montoTotal: 242,
    lineas: [
      { reservaId: r1, montoTotal: 121, montoSubtotal: 100, ivaMonto: 21, comisionPlataforma: 15, stripeFee: 2, montoLiquidacion: 104 },
      { reservaId: r2, montoTotal: 121, montoSubtotal: 100, ivaMonto: 21, comisionPlataforma: 10, stripeFee: 1.8, montoLiquidacion: 109.2 },
    ],
  };

  it('debería tratar un pago normal como su única línea', () => {
    expect(lineasDePago(normal)).toEqual([expect.objectContaining({ reservaId: r1, montoLiquidacion: 104, importeReembolsado: 0 })]);
  });

  it('debería repartir un pago de viaje en sus líneas', () => {
    expect(lineasDePago(viaje)).toHaveLength(2);
  });

  it('debería quedarse sólo con la parte de las reservas pedidas', () => {
    const lineas = lineasDeReservas([viaje], [r2]);
    expect(lineas).toEqual([expect.objectContaining({ reservaId: r2, montoLiquidacion: 109.2 })]);
  });

  it('debería buscar los pagos tanto por reserva principal como por línea', () => {
    expect(filtroPagosDeReservas([r1])).toEqual({
      $or: [{ reservaId: { $in: [r1] } }, { 'lineas.reservaId': { $in: [r1] } }],
    });
  });
});
