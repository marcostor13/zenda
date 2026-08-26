import { idDeUnidad, localizarUnidad } from './unidad-reservable';

describe('idDeUnidad', () => {
  it('debería usar el id guardado cuando el comercio le puso uno', () => {
    expect(idDeUnidad({ id: 'suite-vip', cantidad: 2 }, 0)).toBe('suite-vip');
  });

  it('debería caer en la posición cuando el subdocumento no tiene id', () => {
    // `espacios` se guarda con `_id: false`: la mayoría no tiene ninguno.
    expect(idDeUnidad({ cantidad: 2 }, 0)).toBe('esp-0');
    expect(idDeUnidad({ cantidad: 2 }, 3)).toBe('esp-3');
  });
});

describe('localizarUnidad', () => {
  const espacios = [
    { cantidad: 0, precioNoche: 30 },
    { cantidad: 4, precioNoche: 45 },
  ];

  it('debería encontrar por el id de posición que reparte el catálogo', () => {
    // Este es el caso que rompía la reserva: el catálogo entrega "esp-1" y el
    // lado de la reserva buscaba por `espacio.id`, que no existe.
    expect(localizarUnidad(espacios, 'esp-1')).toEqual({
      unidad: espacios[1], idPublico: 'esp-1',
    });
  });

  it('debería encontrar por el id guardado cuando lo hay', () => {
    const conId = [{ id: 'suite-vip', cantidad: 1 }];
    expect(localizarUnidad(conId, 'suite-vip')?.idPublico).toBe('suite-vip');
  });

  it('debería devolver la primera unidad con cupo si no se pide ninguna', () => {
    expect(localizarUnidad(espacios)).toEqual({ unidad: espacios[1], idPublico: 'esp-1' });
  });

  it('debería devolver undefined si el id pedido no existe', () => {
    expect(localizarUnidad(espacios, 'no-existe')).toBeUndefined();
  });

  it('debería devolver undefined cuando no hay unidades', () => {
    expect(localizarUnidad([])).toBeUndefined();
  });
});
