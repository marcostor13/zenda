import { EspecieMascota, ModalidadTransporte, ModoPrecioTransporte, PreferenciaTransporte } from 'shared';
import { Transporte } from './transporte.schema';
import {
  CANCELACION_POR_DEFECTO, cancelacionDe, especiesDe, incluidosDe, modalidadesDe, tarifarioDe,
} from './transporte.tarifario';

const ficha = (extra: Partial<Transporte> = {}): Partial<Transporte> => ({
  tarifaBase: 12, tarifaKm: 1.2, capacidadPerros: 4, ...extra,
});

describe('transporte.tarifario', () => {
  describe('tarifarioDe', () => {
    it('debería rellenar los valores por defecto de una ficha antigua', () => {
      const tarifario = tarifarioDe({});

      expect(tarifario).toMatchObject({
        modoPrecio: ModoPrecioTransporte.POR_KM,
        tarifaBase: 0,
        tarifaKm: 0,
        capacidadPerros: 1,
        plazasPasajeros: 0,
        modalidades: [ModalidadTransporte.COMPARTIDO],
        especiesAceptadas: [EspecieMascota.PERRO],
      });
    });

    it('debería respetar lo que declaró el transportista', () => {
      const tarifario = tarifarioDe(ficha({
        modoPrecio: ModoPrecioTransporte.FIJO, precioFijo: 80, plazasPasajeros: 2, antelacionMinimaHoras: 12,
        modalidades: [ModalidadTransporte.EXCLUSIVO], especiesAceptadas: ['gato'],
      }));

      expect(tarifario).toMatchObject({
        modoPrecio: ModoPrecioTransporte.FIJO, precioFijo: 80, tarifaBase: 12, tarifaKm: 1.2, capacidadPerros: 4,
        plazasPasajeros: 2, antelacionMinimaHoras: 12,
        modalidades: [ModalidadTransporte.EXCLUSIVO], especiesAceptadas: ['gato'],
      });
    });
  });

  describe('modalidadesDe', () => {
    it('debería usar las modalidades declaradas si las hay', () => {
      expect(modalidadesDe({ modalidades: [ModalidadTransporte.CON_PROPIETARIO] })).toEqual([ModalidadTransporte.CON_PROPIETARIO]);
    });

    it('debería deducir sólo exclusivo si la ficha antigua sólo ofrecía exclusivo', () => {
      expect(modalidadesDe({ tiposTransporteOfrecidos: ['exclusivo'] })).toEqual([ModalidadTransporte.EXCLUSIVO]);
    });

    it('debería deducir compartido y exclusivo si ofrecía los dos', () => {
      expect(modalidadesDe({ tiposTransporteOfrecidos: ['compartido', 'exclusivo'] }))
        .toEqual([ModalidadTransporte.COMPARTIDO, ModalidadTransporte.EXCLUSIVO]);
    });

    it('debería añadir exclusivo si tenía precio de exclusividad y viajar con el dueño si tiene plazas', () => {
      expect(modalidadesDe({ precioExclusivo: 0, plazasPasajeros: 2 }))
        .toEqual([ModalidadTransporte.COMPARTIDO, ModalidadTransporte.EXCLUSIVO, ModalidadTransporte.CON_PROPIETARIO]);
    });
  });

  describe('especiesDe', () => {
    it('debería usar las especies declaradas', () => {
      expect(especiesDe({ especiesAceptadas: ['perro', 'ave'] })).toEqual(['perro', 'ave']);
    });

    it('debería deducir perro y gato si la ficha antigua no era sólo de perros', () => {
      expect(especiesDe({ soloPerros: false })).toEqual([EspecieMascota.PERRO, EspecieMascota.GATO]);
    });

    it('debería suponer sólo perros en el resto de casos', () => {
      expect(especiesDe({})).toEqual([EspecieMascota.PERRO]);
      expect(especiesDe({ soloPerros: true })).toEqual([EspecieMascota.PERRO]);
    });
  });

  describe('incluidosDe', () => {
    it('debería usar los incluidos declarados', () => {
      expect(incluidosDe({ incluidos: [PreferenciaTransporte.AVISO_ENTREGA] })).toEqual([PreferenciaTransporte.AVISO_ENTREGA]);
    });

    it('debería deducirlos de las características antiguas del vehículo sin repetir', () => {
      const incluidos = incluidosDe({
        caracteristicasVehiculo: ['climatizacion', 'gps', 'seguimiento_gps', 'puerta_a_puerta', 'wifi'],
        tipoVehiculo: 'furgon_climatizado',
        jaulasIncluidas: true,
      });

      expect(incluidos).toEqual([
        PreferenciaTransporte.CLIMATIZACION,
        PreferenciaTransporte.SEGUIMIENTO,
        PreferenciaTransporte.PUERTA_A_PUERTA,
        PreferenciaTransporte.TRANSPORTIN_INCLUIDO,
      ]);
    });

    it('debería devolver una lista vacía si no hay nada que deducir', () => {
      expect(incluidosDe({})).toEqual([]);
    });
  });

  describe('cancelacionDe', () => {
    it('debería aplicar la política por defecto si la ficha no declara una', () => {
      expect(cancelacionDe({})).toEqual(CANCELACION_POR_DEFECTO);
      expect(CANCELACION_POR_DEFECTO).toEqual({ gratisHastaHoras: 24, reembolsoTardioPct: 0 });
    });

    it('debería completar con los valores por defecto lo que falte', () => {
      expect(cancelacionDe({ cancelacion: { gratisHastaHoras: 48 } } as Partial<Transporte>))
        .toEqual({ gratisHastaHoras: 48, reembolsoTardioPct: 0 });
      expect(cancelacionDe({ cancelacion: { gratisHastaHoras: 12, reembolsoTardioPct: 50 } } as Partial<Transporte>))
        .toEqual({ gratisHastaHoras: 12, reembolsoTardioPct: 50 });
    });
  });
});
