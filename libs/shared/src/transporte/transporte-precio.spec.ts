import {
  CONFIG_TRANSPORTE_DEFECTO, ConfigTransporte, ReglaTarifa, configDesdeLegado,
  tieneConfigTransporte,
} from './transporte.config';
import {
  AplicacionSuplemento, BaseKilometraje, CondicionSuplemento, FormaCalculoSuplemento,
  ModeloPrecio, RedondeoDistancia, UnidadCobro,
} from './transporte.enums';
import {
  SolicitudTransporte, calcularKmFacturables, calcularPrecioTransporte, redondearDistancia,
} from './transporte-precio';

/** Solicitud mínima; cada prueba cambia solo lo que le importa. */
const solicitud = (parcial: Partial<SolicitudTransporte> = {}): SolicitudTransporte => ({
  distanciaKm: 74, mascotas: 1, pasajeros: 0, paradasExtra: 0,
  idaVuelta: false, esperaMinutos: 0, ...parcial,
});

const config = (parcial: Partial<ConfigTransporte> = {}): ConfigTransporte => ({
  ...CONFIG_TRANSPORTE_DEFECTO, ...parcial,
});

const regla = (parcial: Partial<ReglaTarifa>): ReglaTarifa => ({
  id: 'r1', nombre: 'Tarifa', modelo: ModeloPrecio.FIJO,
  unidadCobro: UnidadCobro.VEHICULO, ...parcial,
});

describe('calcularPrecioTransporte', () => {
  describe('modelos de precio', () => {
    it('debería cobrar el importe cerrado de una tarifa fija', () => {
      const r = calcularPrecioTransporte(
        config({ reglasTarifa: [regla({ modelo: ModeloPrecio.FIJO, precioIda: 25 })] }),
        solicitud(),
      );

      expect(r.total).toBe(25);
      expect(r.modelo).toBe(ModeloPrecio.FIJO);
      expect(r.requierePresupuesto).toBe(false);
    });

    /** Sin precio propio de ida y vuelta se cobra el doble, no la ida sola. */
    it('debería duplicar la tarifa fija en ida y vuelta si no hay precio propio', () => {
      const conPrecioPropio = calcularPrecioTransporte(
        config({ reglasTarifa: [regla({ precioIda: 25, precioIdaVuelta: 45 })] }),
        solicitud({ idaVuelta: true }),
      );
      const sinPrecioPropio = calcularPrecioTransporte(
        config({ reglasTarifa: [regla({ precioIda: 25 })] }),
        solicitud({ idaVuelta: true }),
      );

      expect(conPrecioPropio.total).toBe(45);
      expect(sinPrecioPropio.total).toBe(50);
    });

    it('debería cobrar por kilómetro facturable', () => {
      const r = calcularPrecioTransporte(
        config({
          redondeoDistancia: RedondeoDistancia.EXACTA,
          reglasTarifa: [regla({ modelo: ModeloPrecio.KM, precioKm: 0.85 })],
        }),
        solicitud({ distanciaKm: 100 }),
      );

      expect(r.total).toBe(85);
    });

    it('debería sumar tarifa de salida y kilómetros', () => {
      const r = calcularPrecioTransporte(
        config({
          redondeoDistancia: RedondeoDistancia.EXACTA,
          reglasTarifa: [regla({ modelo: ModeloPrecio.BASE_MAS_KM, tarifaSalida: 15, precioKm: 0.7 })],
        }),
        solicitud({ distanciaKm: 50 }),
      );

      expect(r.total).toBe(50);
    });

    it('debería aplicar el tramo de distancia que corresponde', () => {
      const tramos = config({
        redondeoDistancia: RedondeoDistancia.EXACTA,
        reglasTarifa: [regla({
          modelo: ModeloPrecio.TRAMOS,
          tramos: [
            { desdeKm: 0, hastaKm: 50, precioKm: 1 },
            { desdeKm: 51, hastaKm: 150, precioKm: 0.85 },
            { desdeKm: 151, hastaKm: null, precioKm: 0.65 },
          ],
        })],
      });

      expect(calcularPrecioTransporte(tramos, solicitud({ distanciaKm: 40 })).total).toBe(40);
      expect(calcularPrecioTransporte(tramos, solicitud({ distanciaKm: 100 })).total).toBe(85);
      expect(calcularPrecioTransporte(tramos, solicitud({ distanciaKm: 600 })).total).toBe(390);
    });

    it('debería cobrar la duración mínima aunque se pida menos tiempo', () => {
      const porHora = config({
        reglasTarifa: [regla({
          modelo: ModeloPrecio.HORA, precioHora: 30, duracionMinimaHoras: 1, fraccionMinutos: 15,
        })],
      });

      expect(calcularPrecioTransporte(porHora, solicitud({ horas: 0.5 })).total).toBe(30);
      expect(calcularPrecioTransporte(porHora, solicitud({ horas: 1.1 })).total).toBe(37.5);
    });

    it('debería cobrar la ruta fija en los dos sentidos', () => {
      const rutas = config({
        reglasTarifa: [regla({
          modelo: ModeloPrecio.RUTA_FIJA, rutaOrigen: 'Madrid', rutaDestino: 'Barcelona', precioRuta: 120,
        })],
      });

      expect(calcularPrecioTransporte(rutas, solicitud({ municipioOrigen: 'Madrid', municipioDestino: 'Barcelona' })).total).toBe(120);
      expect(calcularPrecioTransporte(rutas, solicitud({ municipioOrigen: 'Barcelona', municipioDestino: 'Madrid' })).total).toBe(120);
    });
  });

  describe('orden de las reglas', () => {
    /**
     * Es el ejemplo del documento: 25 € en Castellón, 0,85 €/km en la provincia
     * y 95 € para el aeropuerto. La primera que encaja gana.
     */
    it('debería aplicar la primera regla que encaja con el trayecto', () => {
      const empresa = config({
        redondeoDistancia: RedondeoDistancia.EXACTA,
        reglasTarifa: [
          regla({ id: 'z', nombre: 'Castellón ciudad', modelo: ModeloPrecio.ZONA, zonas: ['Castellón'], precioIda: 25 }),
          regla({ id: 'k', nombre: 'Provincia', modelo: ModeloPrecio.KM, precioKm: 0.85 }),
        ],
      });

      const enZona = calcularPrecioTransporte(empresa, solicitud({ municipioOrigen: 'Castellón', distanciaKm: 8 }));
      const fueraDeZona = calcularPrecioTransporte(empresa, solicitud({ municipioOrigen: 'Onda', distanciaKm: 40 }));

      expect(enZona.reglaAplicada).toBe('Castellón ciudad');
      expect(enZona.total).toBe(25);
      expect(fueraDeZona.reglaAplicada).toBe('Provincia');
      expect(fueraDeZona.total).toBe(34);
    });

    it('debería reconocer la zona sin tildes ni mayúsculas', () => {
      const r = calcularPrecioTransporte(
        config({ reglasTarifa: [regla({ modelo: ModeloPrecio.ZONA, zonas: ['Castellón'], precioIda: 25 })] }),
        solicitud({ municipioOrigen: 'castellon de la plana' }),
      );

      expect(r.total).toBe(25);
    });
  });

  describe('unidad de cobro', () => {
    it('debería multiplicar por mascota cuando se cobra por plaza', () => {
      const r = calcularPrecioTransporte(
        config({ reglasTarifa: [regla({ precioIda: 30, unidadCobro: UnidadCobro.PLAZA })] }),
        solicitud({ mascotas: 3 }),
      );

      expect(r.total).toBe(90);
    });

    it('no debería multiplicar cuando se cobra por vehículo', () => {
      const r = calcularPrecioTransporte(
        config({ reglasTarifa: [regla({ precioIda: 30, unidadCobro: UnidadCobro.VEHICULO })] }),
        solicitud({ mascotas: 3 }),
      );

      expect(r.total).toBe(30);
    });
  });

  describe('mínimos y suplementos', () => {
    it('debería subir al importe mínimo y decirlo', () => {
      const r = calcularPrecioTransporte(
        config({ reglasTarifa: [regla({ modelo: ModeloPrecio.KM, precioKm: 0.85, importeMinimo: 25 })] }),
        solicitud({ distanciaKm: 4 }),
      );

      expect(r.total).toBe(25);
      expect(r.minimoAplicado).toBe(true);
    });

    it('debería sumar los suplementos automáticos cuya condición se cumple', () => {
      const r = calcularPrecioTransporte(
        config({
          reglasTarifa: [regla({ precioIda: 100 })],
          suplementos: [
            { clave: 'urgencia', nombre: 'Urgencia', condicion: CondicionSuplemento.URGENCIA, forma: FormaCalculoSuplemento.IMPORTE_FIJO, importe: 20, aplicacion: AplicacionSuplemento.AUTOMATICA },
            { clave: 'nocturno', nombre: 'Nocturno', condicion: CondicionSuplemento.NOCTURNO, forma: FormaCalculoSuplemento.IMPORTE_FIJO, importe: 15, aplicacion: AplicacionSuplemento.AUTOMATICA },
          ],
        }),
        solicitud({ urgente: true }),
      );

      expect(r.total).toBe(120);
      expect(r.lineas.map((l) => l.concepto)).toEqual(['Tarifa', 'Urgencia']);
    });

    /** Un suplemento «por mascota adicional» no puede cobrar la primera. */
    it('debería cobrar solo las mascotas adicionales', () => {
      const r = calcularPrecioTransporte(
        config({
          reglasTarifa: [regla({ precioIda: 50 })],
          suplementos: [{
            clave: 'mascota_adicional', nombre: 'Mascota adicional',
            condicion: CondicionSuplemento.MASCOTA_ADICIONAL, forma: FormaCalculoSuplemento.POR_MASCOTA,
            importe: 10, aplicacion: AplicacionSuplemento.AUTOMATICA,
          }],
        }),
        solicitud({ mascotas: 3 }),
      );

      expect(r.total).toBe(70);
    });

    it('debería cobrar un porcentaje sobre el importe del servicio', () => {
      const r = calcularPrecioTransporte(
        config({
          reglasTarifa: [regla({ precioIda: 200 })],
          suplementos: [{
            clave: 'urgencia', nombre: 'Urgencia', condicion: CondicionSuplemento.URGENCIA,
            forma: FormaCalculoSuplemento.PORCENTAJE, importe: 25, aplicacion: AplicacionSuplemento.AUTOMATICA,
          }],
        }),
        solicitud({ urgente: true }),
      );

      expect(r.total).toBe(250);
    });

    it('solo debería sumar un suplemento a petición si el cliente lo pide', () => {
      const conExtra = config({
        reglasTarifa: [regla({ precioIda: 40 })],
        suplementos: [{
          clave: 'transportin_empresa', nombre: 'Transportín', condicion: CondicionSuplemento.SIEMPRE,
          forma: FormaCalculoSuplemento.IMPORTE_FIJO, importe: 8, aplicacion: AplicacionSuplemento.A_PETICION,
        }],
      });

      expect(calcularPrecioTransporte(conExtra, solicitud()).total).toBe(40);
      expect(calcularPrecioTransporte(conExtra, solicitud({ suplementosPedidos: ['transportin_empresa'] })).total).toBe(48);
    });

    /**
     * Lo que la empresa confirma después no puede entrar en el precio cerrado:
     * el cliente paga lo que vio, y lo demás pasa por el ciclo de ajuste.
     */
    it('no debería incluir suplementos que confirma la empresa después', () => {
      const r = calcularPrecioTransporte(
        config({
          reglasTarifa: [regla({ precioIda: 40 })],
          suplementos: [{
            clave: 'peaje_ferry', nombre: 'Peajes', condicion: CondicionSuplemento.SIEMPRE,
            forma: FormaCalculoSuplemento.IMPORTE_FIJO, importe: 12, aplicacion: AplicacionSuplemento.CONFIRMA_EMPRESA,
          }],
        }),
        solicitud(),
      );

      expect(r.total).toBe(40);
    });

    it('debería descontar la espera incluida antes de cobrar el tiempo parado', () => {
      const r = calcularPrecioTransporte(
        config({
          esperaIncluidaMin: 30,
          reglasTarifa: [regla({ precioIda: 40 })],
          suplementos: [{
            clave: 'espera', nombre: 'Espera', condicion: CondicionSuplemento.ESPERA,
            forma: FormaCalculoSuplemento.POR_HORA, importe: 12, aplicacion: AplicacionSuplemento.AUTOMATICA,
          }],
        }),
        solicitud({ esperaMinutos: 90 }),
      );

      // 90 − 30 incluidos = 1 h facturable.
      expect(r.total).toBe(52);
    });
  });

  describe('presupuesto', () => {
    it('debería pedir presupuesto cuando ninguna regla encaja', () => {
      const r = calcularPrecioTransporte(
        config({ reglasTarifa: [regla({ modelo: ModeloPrecio.ZONA, zonas: ['Castellón'], precioIda: 25 })] }),
        solicitud({ municipioOrigen: 'Sevilla' }),
      );

      expect(r.requierePresupuesto).toBe(true);
      expect(r.total).toBe(0);
    });

    it('debería pedir presupuesto cuando el servicio es a medida', () => {
      const r = calcularPrecioTransporte(
        config({ reglasTarifa: [regla({ modelo: ModeloPrecio.PRESUPUESTO })] }),
        solicitud(),
      );

      expect(r.requierePresupuesto).toBe(true);
      expect(r.motivoPresupuesto).toContain('a medida');
    });

    it('debería pedir presupuesto si el trayecto supera la distancia máxima', () => {
      const r = calcularPrecioTransporte(
        config({ distanciaMaximaKm: 300, reglasTarifa: [regla({ precioIda: 25 })] }),
        solicitud({ distanciaKm: 900 }),
      );

      expect(r.requierePresupuesto).toBe(true);
      expect(r.motivoPresupuesto).toContain('300');
    });

    it('debería quedarse sin precio cuando no hay ninguna regla', () => {
      expect(calcularPrecioTransporte(config(), solicitud()).requierePresupuesto).toBe(true);
    });
  });

  /** Ejemplo exacto de la simulación del documento de alta (pantalla 6B). */
  it('debería reproducir la simulación Castellón → Valencia del documento', () => {
    const r = calcularPrecioTransporte(
      config({
        baseKilometraje: BaseKilometraje.RECOGIDA_DESTINO,
        redondeoDistancia: RedondeoDistancia.EXACTA,
        reglasTarifa: [regla({ nombre: 'Provincia', modelo: ModeloPrecio.KM, precioKm: 0.8 })],
        suplementos: [{
          clave: 'nocturno', nombre: 'Suplemento nocturno', condicion: CondicionSuplemento.NOCTURNO,
          forma: FormaCalculoSuplemento.IMPORTE_FIJO, importe: 15, aplicacion: AplicacionSuplemento.AUTOMATICA,
        }],
      }),
      solicitud({ distanciaKm: 74, idaVuelta: true, nocturno: true }),
    );

    expect(r.kmFacturables).toBe(148);
    expect(r.total).toBe(133.4);
  });
});

describe('calcularKmFacturables', () => {
  it('debería cobrar solo el trayecto del cliente por defecto', () => {
    const km = calcularKmFacturables(
      { baseKilometraje: BaseKilometraje.RECOGIDA_DESTINO, redondeoDistancia: RedondeoDistancia.EXACTA },
      { distanciaKm: 30, distanciaBaseRecogidaKm: 40, idaVuelta: false },
    );

    expect(km).toBe(30);
  });

  it('debería sumar la ida a la recogida cuando la empresa la factura', () => {
    const km = calcularKmFacturables(
      { baseKilometraje: BaseKilometraje.BASE_RECOGIDA_DESTINO, redondeoDistancia: RedondeoDistancia.EXACTA },
      { distanciaKm: 30, distanciaBaseRecogidaKm: 40, idaVuelta: false },
    );

    expect(km).toBe(70);
  });

  it('debería cerrar el circuito con el regreso a la base', () => {
    const km = calcularKmFacturables(
      { baseKilometraje: BaseKilometraje.CIRCUITO_COMPLETO, redondeoDistancia: RedondeoDistancia.EXACTA },
      { distanciaKm: 30, distanciaBaseRecogidaKm: 40, distanciaDestinoBaseKm: 50, idaVuelta: false },
    );

    expect(km).toBe(120);
  });

  /**
   * La ida y vuelta duplica el trayecto del cliente, no el desplazamiento de la
   * empresa hasta la base: ese ya se ha contado una vez.
   */
  it('debería duplicar solo el trayecto del cliente en la ida y vuelta', () => {
    const km = calcularKmFacturables(
      { baseKilometraje: BaseKilometraje.BASE_RECOGIDA_DESTINO, redondeoDistancia: RedondeoDistancia.EXACTA },
      { distanciaKm: 30, distanciaBaseRecogidaKm: 40, idaVuelta: true },
    );

    expect(km).toBe(100);
  });
});

describe('redondearDistancia', () => {
  it.each([
    [RedondeoDistancia.EXACTA, 73.4, 73.4],
    [RedondeoDistancia.KM_SUPERIOR, 73.4, 74],
    [RedondeoDistancia.BLOQUES_5, 73.4, 75],
    [RedondeoDistancia.BLOQUES_10, 73.4, 80],
  ])('debería redondear %s', (modo, km, esperado) => {
    expect(redondearDistancia(km, modo)).toBe(esperado);
  });
});

describe('configDesdeLegado', () => {
  /**
   * Regresión de compatibilidad: los transportistas dados de alta con el
   * formulario antiguo tienen que seguir cobrando exactamente lo mismo.
   */
  it('debería cobrar igual que la fórmula antigua tarifaBase + tarifaKm × km', () => {
    const cfg = configDesdeLegado({ tarifaBase: 15, tarifaKm: 0.7 });

    const r = calcularPrecioTransporte(cfg, solicitud({ distanciaKm: 50 }));

    expect(r.total).toBe(50);
  });

  it('debería convertir el suplemento de exclusividad en un extra a petición', () => {
    const cfg = configDesdeLegado({ tarifaBase: 10, tarifaKm: 1, precioExclusivo: 20 });

    expect(calcularPrecioTransporte(cfg, solicitud({ distanciaKm: 10 })).total).toBe(20);
    expect(calcularPrecioTransporte(cfg, solicitud({ distanciaKm: 10, suplementosPedidos: ['servicio_exclusivo'] })).total).toBe(40);
  });

  it('debería convertir la distancia mínima en un importe mínimo', () => {
    const cfg = configDesdeLegado({ tarifaBase: 10, tarifaKm: 1, distanciaMinimaKm: 20 });

    expect(calcularPrecioTransporte(cfg, solicitud({ distanciaKm: 5 })).total).toBe(30);
  });

  it('debería convertir los servicios adicionales en extras a petición', () => {
    const cfg = configDesdeLegado({
      tarifaBase: 10, tarifaKm: 0, serviciosAdicionales: [{ nombre: 'Recogida a domicilio', precio: 5 }],
    });

    expect(calcularPrecioTransporte(cfg, solicitud({ suplementosPedidos: ['Recogida a domicilio'] })).total).toBe(15);
  });
});

describe('tieneConfigTransporte', () => {
  it('debería distinguir un alta nueva de un borrador vacío', () => {
    expect(tieneConfigTransporte(undefined)).toBe(false);
    expect(tieneConfigTransporte({ reglasTarifa: [] })).toBe(false);
    expect(tieneConfigTransporte({ reglasTarifa: [regla({ precioIda: 10 })] })).toBe(true);
  });
});
