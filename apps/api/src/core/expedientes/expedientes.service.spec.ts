import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { ExpedientesService } from './expedientes.service';
import { Perro } from '../perros/perro.schema';
import { PerroHistorial } from '../perros/perro-historial.schema';
import { Reserva } from '../bookings/reserva.schema';
import { Comercio } from '../comercios/comercio.schema';
import { Servicio } from '../catalog/servicio.schema';
import { UsersRepository } from '../users/users.repository';
import { PerrosService } from '../perros/perros.service';
import { InformePerroService } from '../perros/informe/informe-perro.service';

/** Consulta encadenable de Mongoose que resuelve con `valor` al hacer `exec()`. */
function consulta<TValor>(valor: TValor) {
  const q: Record<string, jest.Mock> = {};
  for (const metodo of ['select', 'lean', 'sort', 'limit']) q[metodo] = jest.fn(() => q);
  q['exec'] = jest.fn().mockResolvedValue(valor);
  return q;
}

describe('ExpedientesService', () => {
  let service: ExpedientesService;
  let perroModel: Record<string, jest.Mock>;
  let historialModel: Record<string, jest.Mock>;
  let reservaModel: Record<string, jest.Mock>;
  let comercioModel: Record<string, jest.Mock>;
  let servicioModel: Record<string, jest.Mock>;
  let usersRepo: { findContactosByIds: jest.Mock };
  let informes: { componer: jest.Mock };
  let perrosService: { asegurarRelacionComercio: jest.Mock; historialVisiblePara: jest.Mock; obtenerPropio: jest.Mock };

  const COMERCIO = new Types.ObjectId();
  const OTRO_COMERCIO = new Types.ObjectId();
  const PERRO = new Types.ObjectId();
  const DUENO = new Types.ObjectId();
  const USUARIO = new Types.ObjectId();

  const perro = {
    _id: PERRO, propietarioId: DUENO, nombre: 'Nala', fotos: ['f.jpg'], raza: 'Beagle',
    alergias: ['Pollo'], enfermedades: [], medicacion: ['Apoquel'],
  };
  const historial = (extra: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(), perroId: PERRO, comercioId: COMERCIO, vertical: 'veterinaria', origen: 'comercio',
    titulo: 'Consulta', nota: 'Consulta', datosEstructurados: {}, createdAt: new Date('2026-09-01'), ...extra,
  });

  beforeEach(async () => {
    perroModel = { find: jest.fn(), findById: jest.fn() };
    historialModel = {
      find: jest.fn(), aggregate: jest.fn(), create: jest.fn(), findOne: jest.fn(),
      findOneAndUpdate: jest.fn(), deleteOne: jest.fn(),
    };
    reservaModel = { aggregate: jest.fn(), find: jest.fn(), exists: jest.fn() };
    comercioModel = { find: jest.fn(), findById: jest.fn() };
    servicioModel = { find: jest.fn().mockReturnValue(consulta([])) };
    usersRepo = { findContactosByIds: jest.fn().mockResolvedValue([{ _id: DUENO, nombre: 'Ana Ruiz', email: 'ana@x.com' }]) };
    perrosService = {
      asegurarRelacionComercio: jest.fn().mockResolvedValue(undefined),
      historialVisiblePara: jest.fn().mockResolvedValue([]),
      obtenerPropio: jest.fn().mockResolvedValue({}),
    };

    informes = { componer: jest.fn().mockResolvedValue({ nombreFichero: 'x.pdf', pdf: Buffer.from('%PDF') }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpedientesService,
        { provide: getModelToken(Perro.name), useValue: perroModel },
        { provide: getModelToken(PerroHistorial.name), useValue: historialModel },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Comercio.name), useValue: comercioModel },
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
        { provide: UsersRepository, useValue: usersRepo },
        { provide: PerrosService, useValue: perrosService },
        { provide: InformePerroService, useValue: informes },
      ],
    }).compile();
    service = moduleRef.get(ExpedientesService);
  });

  describe('listarMascotasComercio', () => {
    it('debería devolver vacío si el comercio no tiene reservas con perro', async () => {
      reservaModel['aggregate'].mockReturnValue(consulta([]));
      await expect(service.listarMascotasComercio(COMERCIO.toString())).resolves.toEqual([]);
      expect(perroModel['find']).not.toHaveBeenCalled();
    });

    it('debería componer la tarjeta con dueño, conteos y alertas, y filtrar por búsqueda', async () => {
      const otroPerro = { ...perro, _id: new Types.ObjectId(), nombre: 'Toby', alergias: [], medicacion: [] };
      const borrado = new Types.ObjectId();
      reservaModel['aggregate'].mockReturnValue(consulta([
        { _id: PERRO, totalReservas: 3, serviciosCompletados: 2, ultimoServicio: new Date('2026-08-01'), verticales: ['veterinaria'] },
        { _id: otroPerro._id, totalReservas: 1, serviciosCompletados: 0, ultimoServicio: new Date('2026-09-01'), verticales: ['peluqueria'] },
        { _id: borrado, totalReservas: 1, serviciosCompletados: 0, verticales: [] },
      ]));
      perroModel['find'].mockReturnValue(consulta([perro, otroPerro]));
      historialModel['aggregate'].mockReturnValue(consulta([{ _id: PERRO, total: 4 }]));

      const todas = await service.listarMascotasComercio(COMERCIO.toString());
      expect(todas.map((m) => m.nombre)).toEqual(['Toby', 'Nala']);
      expect(todas[1]).toMatchObject({
        perroId: PERRO.toString(), foto: 'f.jpg', totalRegistros: 4, tieneMedicacion: true,
        propietario: { nombre: 'Ana Ruiz' }, serviciosCompletados: 2,
      });

      const filtradas = await service.listarMascotasComercio(COMERCIO.toString(), 'RUÍZ beagle'.split(' ')[0]);
      expect(filtradas).toHaveLength(2);
      const porNombre = await service.listarMascotasComercio(COMERCIO.toString(), 'tob');
      expect(porNombre.map((m) => m.nombre)).toEqual(['Toby']);
    });

    it('debería incluir los perros de un dueño que reservó sin ficha y la creó después', async () => {
      const creadoDespues = { ...perro, _id: new Types.ObjectId(), nombre: 'Luna' };
      reservaModel['aggregate']
        .mockReturnValueOnce(consulta([]))
        .mockReturnValueOnce(consulta([
          { _id: DUENO, totalReservas: 2, serviciosCompletados: 1, ultimoServicio: new Date('2026-09-10'), verticales: ['peluqueria'] },
        ]));
      perroModel['find'].mockReturnValue(consulta([creadoDespues]));
      historialModel['aggregate'].mockReturnValue(consulta([]));

      const mascotas = await service.listarMascotasComercio(COMERCIO.toString());

      expect(mascotas).toHaveLength(1);
      expect(mascotas[0]).toMatchObject({ nombre: 'Luna', totalReservas: 2, serviciosCompletados: 1, verticales: ['peluqueria'] });
      const filtro = perroModel['find'].mock.calls[0][0];
      expect(filtro.$or[1].propietarioId.$in.map(String)).toEqual([DUENO.toString()]);
    });

    it('debería rechazar un comercio con id mal formado', async () => {
      await expect(service.listarMascotasComercio('x')).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('expedienteParaComercio', () => {
    it('debería exigir relación, ocultar el propietarioId y unir lo propio con lo compartido', async () => {
      const propio = historial();
      const compartido = historial({ comercioId: OTRO_COMERCIO, titulo: 'Baño', vertical: 'peluqueria', createdAt: new Date('2026-09-05') });
      perroModel['findById'].mockReturnValue(consulta(perro));
      reservaModel['find'].mockReturnValue(consulta([
        { _id: new Types.ObjectId(), codigo: 'RES-1', vertical: 'veterinaria', servicioId: new Types.ObjectId(), comercioId: COMERCIO, fechaInicio: new Date(), estado: 'completada' },
      ]));
      historialModel['find'].mockReturnValue(consulta([propio]));
      comercioModel['findById'].mockReturnValue(consulta({ verticales: ['veterinaria', 'peluqueria'] }));
      perrosService.historialVisiblePara
        .mockResolvedValueOnce([{ toObject: () => propio }])
        .mockResolvedValueOnce([compartido]);
      comercioModel['find'].mockReturnValue(consulta([
        { _id: COMERCIO, nombreComercial: 'Clínica Royal' }, { _id: OTRO_COMERCIO, nombreComercial: 'Pelu' },
      ]));

      const exp = await service.expedienteParaComercio(COMERCIO.toString(), PERRO.toString());

      expect(perrosService.asegurarRelacionComercio).toHaveBeenCalledWith(PERRO.toString(), COMERCIO.toString());
      expect(exp.perro['propietarioId']).toBeUndefined();
      expect(exp.propietario?.nombre).toBe('Ana Ruiz');
      expect(exp.registros.map((r) => [r.titulo, r.esPropio, r.comercioNombre])).toEqual([
        ['Baño', false, 'Pelu'], ['Consulta', true, 'Clínica Royal'],
      ]);
      expect(exp.servicios[0].comercioNombre).toBe('Clínica Royal');
    });

    it('debería responder 404 si el perro ya no existe', async () => {
      perroModel['findById'].mockReturnValue(consulta(null));
      await expect(service.expedienteParaComercio(COMERCIO.toString(), PERRO.toString())).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('crearRegistro', () => {
    const autor = { comercioId: COMERCIO.toString(), usuarioId: USUARIO.toString() };
    const dto = {
      vertical: VerticalKey.VETERINARIA, titulo: ' Revisión ', profesional: 'Dra. Pérez', fechaServicio: '2026-09-10',
      proximaCita: '2027-03-01', datosEstructurados: { diagnostico: ' Sano ', pesoKg: '12,5', inventado: 'x' },
    };

    beforeEach(() => {
      perroModel['findById'].mockReturnValue(consulta({ propietarioId: DUENO }));
      comercioModel['findById'].mockReturnValue(consulta({ verticales: ['veterinaria'], nombreComercial: 'Clínica Royal' }));
      comercioModel['find'].mockReturnValue(consulta([{ _id: COMERCIO, nombreComercial: 'Clínica Royal' }]));
      historialModel['create'].mockImplementation(async (datos: Record<string, unknown>) => ({
        toObject: () => ({ _id: new Types.ObjectId(), createdAt: new Date(), ...datos }),
      }));
    });

    it('debería guardar el registro limpio, con tipo, autor y nota heredada del título', async () => {
      const registro = await service.crearRegistro(autor, PERRO.toString(), dto);

      const guardado = historialModel['create'].mock.calls[0][0];
      expect(guardado).toMatchObject({
        tipoHistorial: 'veterinario', origen: 'comercio', titulo: 'Revisión', nota: 'Revisión', profesional: 'Dra. Pérez',
        datosEstructurados: { diagnostico: 'Sano', pesoKg: 12.5 },
      });
      expect(guardado.autorId.toString()).toBe(USUARIO.toString());
      expect(guardado.fechaServicio).toBeInstanceOf(Date);
      expect(registro).toMatchObject({ esPropio: true, comercioNombre: 'Clínica Royal' });
    });

    it('debería rechazar categorías sin historial o en las que el negocio no opera', async () => {
      await expect(service.crearRegistro(autor, PERRO.toString(), { ...dto, vertical: VerticalKey.ALOJAMIENTO }))
        .rejects.toMatchObject({ statusCode: 400 });
      await expect(service.crearRegistro(autor, PERRO.toString(), { ...dto, vertical: VerticalKey.PELUQUERIA }))
        .rejects.toMatchObject({ statusCode: 403 });
      expect(historialModel['create']).not.toHaveBeenCalled();
    });

    it('debería comprobar que la reserva vinculada es de esta mascota y este negocio', async () => {
      reservaModel['exists'].mockReturnValue(consulta(null));
      await expect(service.crearRegistro(autor, PERRO.toString(), { ...dto, reservaId: new Types.ObjectId().toString() }))
        .rejects.toMatchObject({ statusCode: 400 });

      const reservaId = new Types.ObjectId().toString();
      reservaModel['exists'].mockReturnValue(consulta({ _id: reservaId }));
      await service.crearRegistro(autor, PERRO.toString(), { ...dto, reservaId });
      expect(historialModel['create'].mock.calls[0][0].reservaId.toString()).toBe(reservaId);
    });

    it('no debería escribir si el comercio no tiene relación con el perro', async () => {
      perrosService.asegurarRelacionComercio.mockRejectedValue(new Error('403'));
      await expect(service.crearRegistro(autor, PERRO.toString(), dto)).rejects.toThrow('403');
      expect(historialModel['create']).not.toHaveBeenCalled();
    });
  });

  describe('actualizarRegistro y eliminarRegistro', () => {
    const registroId = new Types.ObjectId().toString();

    it('debería responder 404 si el registro no es del comercio', async () => {
      historialModel['findOne'].mockReturnValue(consulta(null));
      await expect(service.actualizarRegistro(COMERCIO.toString(), PERRO.toString(), registroId, { titulo: 'x' }))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('debería actualizar sólo los campos enviados y conservar la nota', async () => {
      historialModel['findOne'].mockReturnValue(consulta({ vertical: 'peluqueria', titulo: 'Baño' }));
      historialModel['findOneAndUpdate'].mockReturnValue(consulta(historial({ vertical: 'peluqueria' })));
      comercioModel['find'].mockReturnValue(consulta([]));

      await service.actualizarRegistro(COMERCIO.toString(), PERRO.toString(), registroId, {
        datosEstructurados: { productos: 'Champú', inventado: 'x' }, profesional: '', proximaCita: '2027-01-01',
      });

      const [filtro, cambio] = historialModel['findOneAndUpdate'].mock.calls[0];
      expect(filtro).toMatchObject({ origen: 'comercio' });
      expect(filtro.comercioId.toString()).toBe(COMERCIO.toString());
      expect(cambio.$set).toEqual({
        datosEstructurados: { productos: 'Champú' }, profesional: undefined, proximaCita: new Date('2027-01-01'),
      });
    });

    it('debería heredar el título en la nota si se vacía', async () => {
      historialModel['findOne'].mockReturnValue(consulta({ vertical: 'veterinaria', titulo: 'Consulta' }));
      historialModel['findOneAndUpdate'].mockReturnValue(consulta(null));

      await expect(service.actualizarRegistro(COMERCIO.toString(), PERRO.toString(), registroId, { nota: '  ' }))
        .rejects.toMatchObject({ statusCode: 404 });
      expect(historialModel['findOneAndUpdate'].mock.calls[0][1].$set).toEqual({ nota: 'Consulta' });
    });

    it('debería eliminar o responder 404', async () => {
      historialModel['deleteOne'].mockReturnValueOnce(consulta({ deletedCount: 1 })).mockReturnValueOnce(consulta({ deletedCount: 0 }));
      await expect(service.eliminarRegistro(COMERCIO.toString(), PERRO.toString(), registroId)).resolves.toBeUndefined();
      await expect(service.eliminarRegistro(COMERCIO.toString(), PERRO.toString(), registroId)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('informeParaComercio', () => {
    it('debería componer el informe con el negocio como emisor y el contacto del dueño', async () => {
      const propio = historial({ titulo: 'Vacunación' });
      perroModel['findById'].mockReturnValue(consulta(perro));
      reservaModel['find'].mockReturnValue(consulta([]));
      historialModel['find'].mockReturnValue(consulta([propio]));
      comercioModel['findById'].mockReturnValue(consulta({ verticales: ['veterinaria'], nombreComercial: 'Clínica Royal' }));
      comercioModel['find'].mockReturnValue(consulta([{ _id: COMERCIO, nombreComercial: 'Clínica Royal' }]));

      const informe = await service.informeParaComercio(COMERCIO.toString(), PERRO.toString());

      expect(informe.nombreFichero).toBe('x.pdf');
      const origen = informes.componer.mock.calls[0][0];
      expect(origen.emisor).toBe('Clínica Royal');
      expect(origen.propietario).toMatchObject({ nombre: 'Ana Ruiz' });
      expect(origen.perro.nombre).toBe('Nala');
      expect(origen.entradas[0]).toMatchObject({ titulo: 'Vacunación', comercioNombre: 'Clínica Royal' });
    });
  });

  describe('nombreComercio', () => {
    it('debería usar Doogking como respaldo', async () => {
      comercioModel['findById'].mockReturnValueOnce(consulta({ nombreComercial: 'Clínica Royal' })).mockReturnValueOnce(consulta(null));
      await expect(service.nombreComercio(COMERCIO.toString())).resolves.toBe('Clínica Royal');
      await expect(service.nombreComercio(COMERCIO.toString())).resolves.toBe('Doogking');
    });
  });

  describe('expedienteParaPropietario', () => {
    it('debería exigir propiedad y devolver todo el historial sin contacto del dueño', async () => {
      perroModel['findById'].mockReturnValue(consulta(perro));
      historialModel['find'].mockReturnValue(consulta([historial({ origen: 'propietario', comercioId: undefined })]));
      reservaModel['find'].mockReturnValue(consulta([]));

      const exp = await service.expedienteParaPropietario(DUENO.toString(), PERRO.toString());

      expect(perrosService.obtenerPropio).toHaveBeenCalledWith(PERRO.toString(), DUENO.toString());
      expect(exp.propietario).toBeUndefined();
      expect(exp.registros[0]).toMatchObject({ origen: 'propietario', esPropio: false });
      expect(exp.servicios).toEqual([]);
      expect(reservaModel['find'].mock.calls[0][0].estado.$nin).toContain('cancelada');
    });
  });
});
