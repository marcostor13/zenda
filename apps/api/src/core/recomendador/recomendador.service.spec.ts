import { RecomendadorService } from './recomendador.service';

describe('RecomendadorService', () => {
  let service: RecomendadorService;

  beforeEach(() => {
    service = new RecomendadorService();
  });

  describe('recomendarAdiestramiento', () => {
    it('debería recomendar curso de cachorros para un perro de 4 meses con socialización', () => {
      const resultado = service.recomendarAdiestramiento({
        motivo: 'socializacion', intensidad: 'leve', edadMeses: 4,
      });

      expect(resultado.tipoRecomendado).toBe('curso_cachorros');
      expect(resultado.bloqueaGrupales).toBe(false);
    });

    it('debería recomendar valoración previa y bloquear grupales ante agresividad no leve', () => {
      const resultado = service.recomendarAdiestramiento({
        motivo: 'agresividad_perros', intensidad: 'grave',
      });

      expect(resultado.tipoRecomendado).toBe('valoracion_previa');
      expect(resultado.bloqueaGrupales).toBe(true);
    });

    it('no debería bloquear grupales ante agresividad leve, pero sí recomendar valoración', () => {
      const resultado = service.recomendarAdiestramiento({
        motivo: 'agresividad_personas', intensidad: 'leve',
      });

      expect(resultado.tipoRecomendado).toBe('valoracion_previa');
      expect(resultado.bloqueaGrupales).toBe(false);
    });

    it('debería permitir individual o grupal para tirones de correa en perro sociable', () => {
      const resultado = service.recomendarAdiestramiento({
        motivo: 'tirones_correa', intensidad: 'moderado',
      });

      expect(resultado.tipoRecomendado).toBe('individual_o_grupal');
      expect(resultado.bloqueaGrupales).toBe(false);
    });
  });

  describe('recomendarVeterinaria', () => {
    it('debería recomendar reserva directa para vacunación', () => {
      const resultado = service.recomendarVeterinaria({ motivo: 'vacunacion', gravedad: 'leve' });
      expect(resultado.accion).toBe('reserva_directa');
    });

    it('debería recomendar urgencias inmediatas ante vómitos con sangrado y apatía', () => {
      const resultado = service.recomendarVeterinaria({
        motivo: 'vomitos', gravedad: 'grave', sintomasAsociados: ['sangrado', 'apatia'],
      });
      expect(resultado.accion).toBe('urgencias_inmediatas');
    });

    it('debería recomendar urgencias inmediatas si hay un síntoma urgente aunque la gravedad declarada sea leve', () => {
      const resultado = service.recomendarVeterinaria({
        motivo: 'otro', gravedad: 'leve', sintomasAsociados: ['convulsiones'],
      });
      expect(resultado.accion).toBe('urgencias_inmediatas');
    });

    it('debería recomendar consulta general para cojera leve', () => {
      const resultado = service.recomendarVeterinaria({ motivo: 'cojera', gravedad: 'leve' });
      expect(resultado.accion).toBe('consulta_general');
    });
  });
});
