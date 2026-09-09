import { SERVICIO_CLINICO_CATALOGO, ServicioClinicoTipo, VerticalKey } from 'shared';
import { FILTROS_POR_VERTICAL } from './filtros.config';

describe('FILTROS_POR_VERTICAL', () => {
  const grupos = (vertical: VerticalKey) => FILTROS_POR_VERTICAL[vertical] ?? [];
  const campos = (vertical: VerticalKey) => grupos(vertical).map((g) => g.campo).filter(Boolean);

  it('debería declarar filtros para todas las categorías del catálogo', () => {
    for (const vertical of Object.values(VerticalKey)) {
      expect(grupos(vertical).length).toBeGreaterThan(0);
    }
  });

  it('debería empezar siempre por el precio y la valoración', () => {
    for (const vertical of Object.values(VerticalKey)) {
      const tipos = grupos(vertical).map((g) => g.tipo);
      expect(tipos[0]).toBe('precio');
      expect(tipos[1]).toBe('valoracion');
    }
  });

  describe('veterinaria', () => {
    /**
     * Regresión (observación del cliente 09-09-2026): el panel filtraba por
     * «Especialidades» y ofrecía «Medicina general», «Cirugía» o «Cardiología».
     * Son cosas que el cliente no puede contratar ni saber lo que cuestan, y la
     * regla de `veterinarios.md` es que sólo se ofrece lo que tiene precio.
     */
    it('no debería ofrecer un filtro de especialidades', () => {
      expect(grupos(VerticalKey.VETERINARIA).map((g) => g.titulo)).not.toContain('Especialidades');
      expect(campos(VerticalKey.VETERINARIA)).not.toContain('especialidades');
    });

    it('debería filtrar por el servicio contratable', () => {
      expect(campos(VerticalKey.VETERINARIA)).toContain('tiposServicioClinico');
    });

    it('no debería ofrecer ninguna especialidad como opción', () => {
      const opciones = grupos(VerticalKey.VETERINARIA).flatMap((g) => g.opciones ?? []);
      const etiquetas = opciones.map((o) => o.etiqueta.toLowerCase());

      for (const especialidad of ['medicina general', 'cirugía', 'cardiología', 'dermatología']) {
        expect(etiquetas).not.toContain(especialidad);
      }
    });

    /** Cada opción debe existir en el catálogo cerrado; si no, no filtraría nada. */
    it('debería usar sólo tipos del catálogo clínico, con su etiqueta oficial', () => {
      const grupo = grupos(VerticalKey.VETERINARIA).find((g) => g.campo === 'tiposServicioClinico');
      const tipos = Object.values(ServicioClinicoTipo) as string[];

      expect(grupo?.opciones?.length).toBeGreaterThan(0);
      for (const opcion of grupo!.opciones!) {
        expect(tipos).toContain(opcion.valor);
        const delCatalogo = SERVICIO_CLINICO_CATALOGO.find((s) => s.tipo === opcion.valor);
        expect(opcion.etiqueta).toBe(delCatalogo?.label);
      }
    });

    it('debería conservar el filtro de urgencias', () => {
      const booleanos = grupos(VerticalKey.VETERINARIA)
        .filter((g) => g.tipo === 'booleanos')
        .flatMap((g) => g.opciones ?? [])
        .map((o) => o.valor);

      expect(booleanos).toContain('atiendeUrgencias');
    });
  });
});
