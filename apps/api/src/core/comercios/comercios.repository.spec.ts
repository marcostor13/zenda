import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ComerciosRepository } from './comercios.repository';
import { Comercio, EstadoComercio } from './comercio.schema';

describe('ComerciosRepository', () => {
  let repo: ComerciosRepository;
  let comercioModel: any;
  let guardado: jest.Mock;

  /** Cadena `.exec()` con el valor que deba devolver la consulta. */
  const conExec = (valor: unknown) => ({ exec: jest.fn().mockResolvedValue(valor) });

  beforeEach(async () => {
    guardado = jest.fn().mockResolvedValue({ _id: 'c1' });

    // El modelo se usa como constructor (`new this.comercioModel(...)`) y como
    // objeto con métodos estáticos, así que el mock tiene que ser ambas cosas.
    comercioModel = jest.fn().mockImplementation((params: unknown) => ({
      ...(params as object),
      save: guardado,
    }));
    Object.assign(comercioModel, {
      syncIndexes: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockReturnValue(conExec(null)),
      findOne: jest.fn().mockReturnValue(conExec(null)),
      findByIdAndUpdate: jest.fn().mockReturnValue(conExec(null)),
      findByIdAndDelete: jest.fn().mockReturnValue(conExec(null)),
      find: jest.fn(),
      countDocuments: jest.fn().mockReturnValue(conExec(0)),
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ComerciosRepository,
        { provide: getModelToken(Comercio.name), useValue: comercioModel },
      ],
    }).compile();

    repo = moduleRef.get(ComerciosRepository);
  });

  describe('onModuleInit', () => {
    it('debería sincronizar los índices al arrancar', async () => {
      await repo.onModuleInit();

      expect(comercioModel.syncIndexes).toHaveBeenCalled();
    });

    it('no debería tumbar el arranque si la sincronización falla', async () => {
      // Un índice mal migrado no puede impedir que el API levante.
      comercioModel.syncIndexes.mockRejectedValue(new Error('índice duplicado'));

      await expect(repo.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('consultas básicas', () => {
    it('debería buscar por id', async () => {
      comercioModel.findById.mockReturnValue(conExec({ _id: 'c1' }));

      await expect(repo.findById('c1')).resolves.toEqual({ _id: 'c1' });
      expect(comercioModel.findById).toHaveBeenCalledWith('c1');
    });

    it('debería buscar por número de IVA', async () => {
      await repo.findByVatNumber('ESB123');

      expect(comercioModel.findOne).toHaveBeenCalledWith({ vatNumber: 'ESB123' });
    });

    it('debería crear guardando el documento', async () => {
      const res = await repo.crear({ nombreComercial: 'Canina' } as never);

      expect(guardado).toHaveBeenCalled();
      expect(res).toEqual({ _id: 'c1' });
    });

    it('debería devolver el documento posterior al actualizar', async () => {
      await repo.actualizar('c1', { nombreComercial: 'Nuevo' } as never);

      const [id, cambios, opciones] = comercioModel.findByIdAndUpdate.mock.calls[0];
      expect(id).toBe('c1');
      expect(cambios).toEqual({ $set: { nombreComercial: 'Nuevo' } });
      expect(opciones).toEqual({ new: true });
    });

    it('debería eliminar por id', async () => {
      await repo.eliminar('c1');

      expect(comercioModel.findByIdAndDelete).toHaveBeenCalledWith('c1');
    });

    it('debería cambiar el estado devolviendo el documento nuevo', async () => {
      await repo.actualizarEstado('c1', 'suspendido' as EstadoComercio);

      expect(comercioModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'c1', { estado: 'suspendido' }, { new: true },
      );
    });
  });

  describe('actualizarCampos', () => {
    it('debería borrar del documento los campos con valor indefinido', async () => {
      // Guardarlos como nulos dejaría restos de una congelación revocada que
      // podrían reactivarse por error.
      await repo.actualizarCampos('c1', {
        socioFundador: false,
        comisionPctCongelada: undefined,
        congelacionHasta: undefined,
      });

      expect(comercioModel.findByIdAndUpdate.mock.calls[0][1]).toEqual({
        $set: { socioFundador: false },
        $unset: { comisionPctCongelada: '', congelacionHasta: '' },
      });
    });

    it('no debería incluir $unset si no hay nada que borrar', async () => {
      await repo.actualizarCampos('c1', { alphaAdherido: true });

      expect(comercioModel.findByIdAndUpdate.mock.calls[0][1]).toEqual({
        $set: { alphaAdherido: true },
      });
    });

    it('no debería incluir $set si solo hay campos que borrar', async () => {
      await repo.actualizarCampos('c1', { comisionPctCongelada: undefined });

      expect(comercioModel.findByIdAndUpdate.mock.calls[0][1]).toEqual({
        $unset: { comisionPctCongelada: '' },
      });
    });
  });

  describe('listados', () => {
    function mockFind(items: unknown[]) {
      comercioModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(items),
      });
    }

    it('debería listar las congelaciones ya vencidas', async () => {
      comercioModel.find.mockReturnValue(conExec([]));

      await repo.listarCongelacionesVencidas();

      const filtro = comercioModel.find.mock.calls[0][0];
      expect(filtro.socioFundador).toBe(true);
      expect(filtro.congelacionHasta.$lte).toBeInstanceOf(Date);
    });

    it('debería listar ordenando de más reciente a más antiguo', async () => {
      mockFind([{ _id: 'c1' }]);

      await repo.listar({ estado: 'activo' as EstadoComercio });

      expect(comercioModel.find).toHaveBeenCalledWith({ estado: 'activo' });
    });

    it('debería paginar sin condiciones cuando no se filtra', async () => {
      mockFind([]);

      await repo.listarPaginado({});

      expect(comercioModel.find).toHaveBeenCalledWith({});
    });

    it('debería calcular el salto a partir de la página', async () => {
      mockFind([]);
      const cadena = comercioModel.find.mock.results;

      await repo.listarPaginado({}, 3, 20);

      const query = comercioModel.find.mock.results[0].value;
      expect(query.skip).toHaveBeenCalledWith(40);
      expect(query.limit).toHaveBeenCalledWith(20);
      expect(cadena.length).toBeGreaterThan(0);
    });

    it('debería incluir los documentos antiguos sin campo al filtrar por no adheridos', async () => {
      // Un comercio dado de alta antes de existir Alpha no tiene el campo; si se
      // filtrara por `false` estricto quedaría fuera del listado.
      mockFind([]);

      await repo.listarPaginado({ alphaAdherido: false });

      expect(comercioModel.find.mock.calls[0][0].alphaAdherido).toEqual({ $ne: true });
    });

    it('debería filtrar por adheridos con igualdad estricta', async () => {
      mockFind([]);

      await repo.listarPaginado({ alphaAdherido: true });

      expect(comercioModel.find.mock.calls[0][0].alphaAdherido).toBe(true);
    });

    it('debería buscar en nombre, razón social y CIF escapando la expresión regular', async () => {
      mockFind([]);

      await repo.listarPaginado({ buscar: 'a.b' });

      const query = comercioModel.find.mock.calls[0][0];
      expect(query.$or).toHaveLength(3);
      // Sin escapar, el punto convertiría la búsqueda en un comodín.
      expect(query.$or[0].nombreComercial.source).toBe('a\\.b');
    });

    it('debería devolver los elementos junto al total', async () => {
      mockFind([{ _id: 'c1' }]);
      comercioModel.countDocuments.mockReturnValue(conExec(7));

      await expect(repo.listarPaginado({})).resolves.toEqual({ items: [{ _id: 'c1' }], total: 7 });
    });
  });
});
