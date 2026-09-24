import {
  ConfirmacionEntrega, ModalidadTransporte, ModoHorarioTransporte, SolicitudViajeDto, TamanoPerro,
  NecesidadTransporte,
} from 'shared';
import { datosEntregaValidos, solicitudValida } from './transporte.validacion';

const solicitud = {
  tipoServicio: NecesidadTransporte.SOLO_IDA,
  origen: { texto: 'Castellón', placeId: 'a' },
  destino: { texto: 'Valencia', lat: 39.47, lng: -0.37 },
  fecha: '2026-10-01',
  modoHorario: ModoHorarioTransporte.HORA_CONCRETA,
  hora: '10:30',
  mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }],
  necesidades: [],
  modalidad: ModalidadTransporte.COMPARTIDO,
  preferencias: [],
};

describe('transporte.validacion', () => {
  describe('solicitudValida', () => {
    it('debería devolver la solicitud como DTO cuando es válida', async () => {
      const resultado = await solicitudValida(solicitud);

      expect(resultado).toBeInstanceOf(SolicitudViajeDto);
      expect(resultado?.mascotas).toHaveLength(1);
    });

    it.each([undefined, null, 'texto', 42])('debería devolver null si no es un objeto (%p)', async (bruta) => {
      await expect(solicitudValida(bruta)).resolves.toBeNull();
    });

    it('debería devolver null si faltan mascotas', async () => {
      await expect(solicitudValida({ ...solicitud, mascotas: [] })).resolves.toBeNull();
    });

    it('debería devolver null con una fecha u hora rotas', async () => {
      await expect(solicitudValida({ ...solicitud, fecha: '01/10/2026' })).resolves.toBeNull();
      await expect(solicitudValida({ ...solicitud, hora: '25:00' })).resolves.toBeNull();
    });

    it('debería devolver null con una modalidad desconocida', async () => {
      await expect(solicitudValida({ ...solicitud, modalidad: 'teletransporte' })).resolves.toBeNull();
    });
  });

  describe('datosEntregaValidos', () => {
    const entrega = {
      recogida: { quien: 'yo' },
      entrega: { quien: 'otra', nombre: 'Ana', telefono: '+34 600 000 000' },
      confirmacionEntrega: ConfirmacionEntrega.NOTIFICACION_Y_FOTO,
    };

    it('debería aceptar que no vengan datos de entrega', async () => {
      await expect(datosEntregaValidos(undefined)).resolves.toBe(true);
      await expect(datosEntregaValidos(null)).resolves.toBe(true);
    });

    it('debería aceptar datos de entrega bien formados', async () => {
      await expect(datosEntregaValidos(entrega)).resolves.toBe(true);
    });

    it('debería rechazar lo que no es un objeto', async () => {
      await expect(datosEntregaValidos('yo')).resolves.toBe(false);
    });

    it('debería rechazar una confirmación de entrega desconocida', async () => {
      await expect(datosEntregaValidos({ ...entrega, confirmacionEntrega: 'paloma' })).resolves.toBe(false);
    });
  });
});
