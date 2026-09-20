import { TipoLugar, VerticalKey } from 'shared';
import { interpretarLocalmente, normalizar } from './interpretacion-local';

describe('interpretarLocalmente', () => {
  /** Miércoles 9 de septiembre de 2026, la fecha de las observaciones. */
  const HOY = new Date(2026, 8, 9);

  describe('categoría', () => {
    /**
     * Regresión de la observación del cliente: esta frase exacta acababa en
     * alojamiento y sin ciudad porque el asistente externo no estaba activo.
     */
    it('debería resolver «Peluquería canina en Valencia» a peluquería y Valencia', () => {
      const r = interpretarLocalmente('Peluquería canina en Valencia', HOY);

      expect(r.vertical).toBe(VerticalKey.PELUQUERIA);
      expect(r.ciudad).toBe('Valencia');
    });

    it.each([
      ['peluquería para mi caniche', VerticalKey.PELUQUERIA],
      ['dog grooming in Madrid', VerticalKey.PELUQUERIA],
      ['necesito un veterinario urgente', VerticalKey.VETERINARIA],
      ['vacunación de la rabia', VerticalKey.VETERINARIA],
      ['castración de mi perro', VerticalKey.VETERINARIA],
      ['adiestramiento de cachorros', VerticalKey.ADIESTRAMIENTO],
      ['clases de obediencia', VerticalKey.ADIESTRAMIENTO],
      ['transporte de mi perro a Barcelona', VerticalKey.TRANSPORTE],
      ['crematorio para mascotas', VerticalKey.FUNERARIOS],
      ['cremación individual', VerticalKey.FUNERARIOS],
      ['seguro de responsabilidad civil para perro', VerticalKey.SEGUROS],
      ['residencia canina en Sevilla', VerticalKey.ALOJAMIENTO],
      ['guardería para perros', VerticalKey.ALOJAMIENTO],
      ['dog boarding in Malaga', VerticalKey.ALOJAMIENTO],
    ])('debería reconocer «%s»', (frase, esperado) => {
      expect(interpretarLocalmente(frase, HOY).vertical).toBe(esperado);
    });

    /**
     * «Hotel» es ambiguo y el negocio distingue las dos cosas: un hotel PARA
     * perros es alojamiento canino; un hotel pet-friendly lo reserva la persona.
     */
    it('debería separar el hotel para perros del hotel pet-friendly', () => {
      expect(interpretarLocalmente('hotel para perros en Bilbao', HOY).vertical)
        .toBe(VerticalKey.ALOJAMIENTO);
      expect(interpretarLocalmente('hotel pet friendly en Bilbao', HOY).vertical)
        .toBe(VerticalKey.HOTELES);
    });

    it('debería devolver null cuando la frase no nombra ningún servicio', () => {
      expect(interpretarLocalmente('algo bonito para mi perro', HOY).vertical).toBeNull();
    });
  });

  describe('sitios de la comunidad', () => {
    /**
     * Regresión de la observación del cliente: «playa» contestaba que no se
     * sabía a qué categoría se refería, teniendo el mapa de playas caninas.
     */
    it('debería llevar «playa» a las playas y sin categoría reservable', () => {
      const r = interpretarLocalmente('playa', HOY);

      expect(r.tipoLugar).toBe(TipoLugar.PLAYA);
      expect(r.vertical).toBeNull();
    });

    it.each([
      ['playas caninas en Alicante', TipoLugar.PLAYA],
      ['dog friendly beach', TipoLugar.PLAYA],
      ['parque canino cerca', TipoLugar.PARQUE],
      ['pipican en Valencia', TipoLugar.PARQUE],
      ['restaurantes donde pueda ir con mi perro', TipoLugar.RESTAURANTE],
      ['rutas de senderismo con perro', TipoLugar.RUTA],
      ['un río donde bañar al perro', TipoLugar.RIO],
    ])('debería reconocer «%s»', (frase, esperado) => {
      expect(interpretarLocalmente(frase, HOY).tipoLugar).toBe(esperado);
    });

    /**
     * Se compara por palabra entera: «cala» dentro de «Calatayud» o «bar»
     * dentro de «Barcelona» convertirían una ciudad en un tipo de sitio.
     */
    it('no debería confundir un nombre de ciudad con un tipo de sitio', () => {
      expect(interpretarLocalmente('peluquería en Barcelona', HOY).tipoLugar).toBeNull();
      expect(interpretarLocalmente('veterinario en Calatayud', HOY).tipoLugar).toBeNull();
    });

    it('debería dejarlo vacío cuando la frase no nombra ningún sitio', () => {
      expect(interpretarLocalmente('residencia canina en Sevilla', HOY).tipoLugar).toBeNull();
    });
  });

  describe('ciudad', () => {
    it('debería reconocer la ciudad aunque venga sin tildes ni mayúsculas', () => {
      expect(interpretarLocalmente('peluqueria canina en malaga', HOY).ciudad).toBe('Málaga');
    });

    it('debería preferir el nombre largo cuando uno contiene al otro', () => {
      expect(interpretarLocalmente('veterinario en Palma de Mallorca', HOY).ciudad)
        .toBe('Palma de Mallorca');
    });

    it('debería aceptar una población que no está en el censo, por el patrón «en …»', () => {
      expect(interpretarLocalmente('peluquería en Villanueva', HOY).ciudad).toBe('Villanueva');
    });

    it('no debería confundir un mes ni «a domicilio» con una ciudad', () => {
      expect(interpretarLocalmente('adiestramiento a domicilio', HOY).ciudad).toBeNull();
    });

    it('debería devolver null si no hay ninguna población en la frase', () => {
      expect(interpretarLocalmente('quiero una peluquería barata', HOY).ciudad).toBeNull();
    });
  });

  describe('fechas', () => {
    it('debería resolver «este fin de semana» al sábado y domingo siguientes', () => {
      const r = interpretarLocalmente('alojamiento en Madrid este fin de semana', HOY);

      expect(r.desde).toBe('2026-09-12');
      expect(r.hasta).toBe('2026-09-13');
    });

    it('debería resolver «mañana»', () => {
      const r = interpretarLocalmente('veterinario mañana', HOY);

      expect(r.desde).toBe('2026-09-10');
      expect(r.hasta).toBe('2026-09-10');
    });

    it('debería resolver «la próxima semana» de lunes a domingo', () => {
      const r = interpretarLocalmente('residencia canina la próxima semana', HOY);

      expect(r.desde).toBe('2026-09-14');
      expect(r.hasta).toBe('2026-09-20');
    });

    it('debería resolver un mes por su nombre, y saltar de año si ya pasó', () => {
      expect(interpretarLocalmente('alojamiento en diciembre', HOY).desde).toBe('2026-12-01');
      expect(interpretarLocalmente('alojamiento en diciembre', HOY).hasta).toBe('2026-12-31');
      // Marzo ya pasó en septiembre: se entiende el del año que viene.
      expect(interpretarLocalmente('alojamiento en marzo', HOY).desde).toBe('2027-03-01');
    });

    it('debería dejar las fechas vacías si no se menciona ninguna', () => {
      const r = interpretarLocalmente('peluquería en Valencia', HOY);

      expect(r.desde).toBeNull();
      expect(r.hasta).toBeNull();
    });
  });

  describe('presupuesto y número de perros', () => {
    it.each([
      ['alojamiento por menos de 40 euros', 40],
      ['residencia hasta 60€', 60],
      ['peluquería con presupuesto de 35 eur', 35],
      ['dog boarding under 50 eur', 50],
    ])('debería leer el tope de «%s»', (frase, esperado) => {
      expect(interpretarLocalmente(frase, HOY).presupuestoMax).toBe(esperado);
    });

    it('debería contar los perros escritos con cifra o con letra', () => {
      expect(interpretarLocalmente('alojamiento para 2 perros', HOY).pasajeros).toBe(2);
      expect(interpretarLocalmente('alojamiento para tres perros', HOY).pasajeros).toBe(3);
    });

    it('no debería inventar un número si no se menciona', () => {
      expect(interpretarLocalmente('alojamiento en Madrid', HOY).pasajeros).toBeNull();
    });
  });

  describe('extras', () => {
    it('debería sacar origen y destino de un traslado', () => {
      const r = interpretarLocalmente('transporte de Madrid a Valencia', HOY);

      expect(r.vertical).toBe(VerticalKey.TRANSPORTE);
      expect(r.extras).toMatchObject({ origen: 'Madrid', destino: 'Valencia' });
    });

    it('debería marcar el servicio a domicilio y la urgencia', () => {
      expect(interpretarLocalmente('peluquería a domicilio', HOY).extras['aDomicilio']).toBe('si');
      expect(interpretarLocalmente('veterinario urgente', HOY).extras['urgencias']).toBe('si');
    });
  });

  describe('normalizar', () => {
    it('debería quitar tildes, bajar a minúsculas y comprimir espacios', () => {
      expect(normalizar('  Peluquería   CANINA ')).toBe('peluqueria canina');
    });
  });
});
