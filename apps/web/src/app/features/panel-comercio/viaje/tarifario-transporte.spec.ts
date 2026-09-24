import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import { tarifarioDeFichaAntigua, zonaPrecioGrupo } from './tarifario-transporte';

describe('tarifario-transporte', () => {
  describe('tarifarioDeFichaAntigua', () => {
    it('debería ofrecer compartido por defecto y sólo perros', () => {
      expect(tarifarioDeFichaAntigua({})).toEqual({
        modalidades: ['compartido'], especiesAceptadas: ['perro'], incluidos: [],
      });
    });

    it('debería deducir exclusivo solo si la ficha sólo hacía exclusivos', () => {
      expect(tarifarioDeFichaAntigua({ tiposTransporteOfrecidos: ['exclusivo'] })['modalidades']).toEqual(['exclusivo']);
      expect(tarifarioDeFichaAntigua({ tiposTransporteOfrecidos: ['exclusivo', 'compartido'] })['modalidades'])
        .toEqual(['compartido', 'exclusivo']);
    });

    it('debería añadir exclusivo si tenía precio de exclusivo', () => {
      expect(tarifarioDeFichaAntigua({ precioExclusivo: 30 })['modalidades']).toEqual(['compartido', 'exclusivo']);
    });

    it('debería aceptar gatos si la ficha no era sólo de perros', () => {
      expect(tarifarioDeFichaAntigua({ soloPerros: false })['especiesAceptadas']).toEqual(['perro', 'gato']);
    });

    it('debería traducir las características del vehículo a incluidos sin repetir', () => {
      const incluidos = tarifarioDeFichaAntigua({
        caracteristicasVehiculo: ['climatizacion', 'gps', 'seguimiento_gps', 'puerta_a_puerta', 'desconocida'],
        tipoVehiculo: 'furgon_climatizado',
        jaulasIncluidas: true,
      })['incluidos'];

      expect(incluidos).toEqual(['climatizacion', 'seguimiento', 'puerta_a_puerta', 'transportin_incluido']);
    });

    it('no debería pisar lo que el comercio ya guardó con el formulario nuevo', () => {
      expect(tarifarioDeFichaAntigua({
        modalidades: ['exclusivo'], especiesAceptadas: ['gato'], incluidos: ['seguimiento'], soloPerros: false,
      })).toEqual({});
    });
  });

  describe('zonaPrecioGrupo', () => {
    let fb: NonNullableFormBuilder;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      fb = TestBed.inject(NonNullableFormBuilder);
    });

    it('debería crear una fila vacía e inválida', () => {
      const grupo = zonaPrecioGrupo(fb);
      expect(grupo.getRawValue()).toEqual({ origen: '', destino: '', precio: null });
      expect(grupo.valid).toBe(false);
    });

    it('debería rellenar la fila guardada y validar el precio', () => {
      const grupo = zonaPrecioGrupo(fb, { origen: 'Madrid', destino: 'Toledo', precio: 60 });
      expect(grupo.valid).toBe(true);

      grupo.patchValue({ precio: -1 });
      expect(grupo.valid).toBe(false);
    });
  });
});
