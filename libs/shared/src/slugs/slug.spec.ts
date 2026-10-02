import { aSlug, claveDeFicha, esSlugValido, pareceObjectId, slugDeFicha, slugLibre } from './slug';

describe('slugs', () => {
  describe('aSlug', () => {
    it('debería quitar tildes, eñes y signos', () => {
      expect(aSlug('Peñíscola: Río Júcar & Co.')).toBe('peniscola-rio-jucar-co');
    });

    it('debería colapsar separadores y recortar guiones de los extremos', () => {
      expect(aSlug('  --Reino   Canino--  ')).toBe('reino-canino');
    });

    it('debería transliterar letras europeas sin descomposición', () => {
      expect(aSlug('Straße Ærø')).toBe('strasse-aero');
    });

    it('debería limitar la longitud sin dejar un guion al final', () => {
      const slug = aSlug(`${'a'.repeat(69)} bbb`);
      expect(slug.length).toBeLessThanOrEqual(70);
      expect(slug.endsWith('-')).toBe(false);
    });

    it('debería devolver cadena vacía para texto vacío o nulo', () => {
      expect(aSlug('')).toBe('');
      expect(aSlug(undefined as unknown as string)).toBe('');
    });
  });

  describe('slugDeFicha', () => {
    it('debería unir nombre y ciudad', () => {
      expect(slugDeFicha('Reino Canino', 'Valencia')).toBe('reino-canino-valencia');
    });

    it('no debería repetir la ciudad si el nombre ya termina con ella', () => {
      expect(slugDeFicha('Peluquería Canina Valencia', 'València')).toBe('peluqueria-canina-valencia');
    });

    it('no debería repetir la ciudad si el nombre ya la lleva en medio', () => {
      expect(slugDeFicha('PetTransfer Barcelona — Traslados', 'Barcelona')).toBe('pettransfer-barcelona-traslados');
    });

    it('debería añadir la ciudad si sólo coincide en parte de una palabra', () => {
      expect(slugDeFicha('Valenciana Pets', 'Valencia')).toBe('valenciana-pets-valencia');
    });

    it('debería usar el valor por defecto si no queda nada legible', () => {
      expect(slugDeFicha('¡¡!!', '')).toBe('ficha');
      expect(slugDeFicha('', undefined, 'servicio')).toBe('servicio');
    });
  });

  describe('slugLibre', () => {
    it('debería devolver la base si está libre', async () => {
      await expect(slugLibre('reino-canino', async () => false)).resolves.toBe('reino-canino');
    });

    it('debería añadir sufijo numérico ante colisión', async () => {
      const ocupados = new Set(['reino-canino', 'reino-canino-2']);
      await expect(slugLibre('reino-canino', async (c) => ocupados.has(c))).resolves.toBe('reino-canino-3');
    });

    it('debería tratar las palabras reservadas como ocupadas', async () => {
      await expect(slugLibre('empresas', async () => false)).resolves.toBe('empresas-2');
    });

    it('debería fallar si no encuentra hueco tras 50 intentos', async () => {
      await expect(slugLibre('x', async () => true)).rejects.toThrow('No se encontró un slug libre');
    });
  });

  describe('pareceObjectId / esSlugValido / claveDeFicha', () => {
    it('debería reconocer un ObjectId', () => {
      expect(pareceObjectId('6aa45f57779263b987ae2409')).toBe(true);
      expect(pareceObjectId('reino-canino-valencia')).toBe(false);
      expect(pareceObjectId(null)).toBe(false);
    });

    it('debería validar la forma de un slug', () => {
      expect(esSlugValido('reino-canino-valencia')).toBe(true);
      expect(esSlugValido('Reino Canino')).toBe(false);
      expect(esSlugValido('')).toBe(false);
    });

    it('debería preferir el slug y caer al id', () => {
      expect(claveDeFicha({ id: 'abc', slug: 'reino' })).toBe('reino');
      expect(claveDeFicha({ id: 'abc' })).toBe('abc');
      expect(claveDeFicha({ _id: 'def', slug: null })).toBe('def');
    });
  });
});
