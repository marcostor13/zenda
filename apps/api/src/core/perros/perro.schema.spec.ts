import { model } from 'mongoose';
import { Vacuna } from 'shared';
import { Perro, PerroSchema } from './perro.schema';

/**
 * Regresión: el API devolvía fichas que su propio contrato rechazaba.
 *
 * Mongoose pone un `_id` a cada subdocumento, así que cada vacuna salía con uno
 * que `VacunaAplicadaDto` no admite. Quien releyera la ficha y la volviera a
 * guardar —el formulario del cliente— se comía un 400 al editar, nunca al
 * crear. Lo que se vigila aquí es que la vacuna sale con lo que el contrato
 * declara y nada más.
 */
describe('Esquema de Perro', () => {
  const PerroModel = model(Perro.name, PerroSchema);

  it('no debería añadir un id interno a cada vacuna', () => {
    const perro = new PerroModel({
      nombre: 'Nala',
      vacunasDetalle: [{ tipo: Vacuna.ANTIRRABICA, fecha: new Date('2025-03-01') }],
    });

    const [vacuna] = perro.toJSON().vacunasDetalle as Record<string, unknown>[];

    expect(Object.keys(vacuna).sort()).toEqual(['fecha', 'tipo']);
  });

  it('debería seguir guardando el tipo y la fecha de la vacuna', () => {
    const perro = new PerroModel({
      nombre: 'Nala',
      vacunasDetalle: [{ tipo: Vacuna.ANTIRRABICA, fecha: new Date('2025-03-01') }],
    });

    expect(perro.vacunasDetalle).toHaveLength(1);
    expect(perro.vacunasDetalle[0].tipo).toBe(Vacuna.ANTIRRABICA);
    expect(perro.vacunasDetalle[0].fecha).toEqual(new Date('2025-03-01'));
  });
});
