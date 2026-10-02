import { admitePerfilSocial, perfilesSocialesNoAdmitidos } from './compatibilidad-social';

describe('compatibilidad social', () => {
  it('debería usar el campo nuevo de no admitidos cuando existe', () => {
    expect(perfilesSocialesNoAdmitidos({ compatibilidadSocialNoAdmitida: ['individual'] })).toEqual(['individual']);
  });

  it('debería respetar un campo nuevo vacío aunque quede el antiguo', () => {
    expect(perfilesSocialesNoAdmitidos({
      compatibilidadSocialNoAdmitida: [], compatibilidadSocialAdmitida: ['cualquiera'],
    })).toEqual([]);
  });

  it('debería traducir la lista antigua de admitidos a su complemento', () => {
    expect(perfilesSocialesNoAdmitidos({ compatibilidadSocialAdmitida: ['cualquiera', 'solo_pequenos'] }))
      .toEqual(['solo_machos', 'solo_hembras', 'individual']);
  });

  it('debería admitir cualquier perfil si no hay nada declarado', () => {
    expect(perfilesSocialesNoAdmitidos({})).toEqual([]);
    expect(perfilesSocialesNoAdmitidos(null)).toEqual([]);
    expect(admitePerfilSocial({ compatibilidadSocialAdmitida: [] }, 'individual')).toBe(true);
  });

  it('debería rechazar un perfil marcado como no admitido', () => {
    expect(admitePerfilSocial({ compatibilidadSocialNoAdmitida: ['individual'] }, 'individual')).toBe(false);
    expect(admitePerfilSocial({ compatibilidadSocialNoAdmitida: ['individual'] }, 'cualquiera')).toBe(true);
    expect(admitePerfilSocial({ compatibilidadSocialNoAdmitida: ['individual'] }, '')).toBe(true);
  });
});
