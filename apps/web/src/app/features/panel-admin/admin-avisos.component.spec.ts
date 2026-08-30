import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminAvisosComponent } from './admin-avisos.component';
import {
  AdminAvisosService, AvisoProgramado, EstadoPush, ResultadoAviso,
} from './services/admin-avisos.service';

const ESTADO: EstadoPush = {
  configurado: true,
  dispositivos: { todos: 12, clientes: 9, comercios: 3 },
};

const RESULTADO: ResultadoAviso = { enviados: 9, destinatarios: 12, omitido: false };

const AVISO: AvisoProgramado = {
  _id: 'av-1',
  nombre: 'Recordatorio de pago',
  disparador: 'pago_pendiente',
  segmento: 'comercios',
  titulo: 'Tienes un pago pendiente',
  cuerpo: 'Regulariza tu membresía',
  ruta: '/panel/cuenta',
  hora: '09:30',
  diasSemana: [1, 3],
  diasAntelacion: 5,
  activo: true,
  ultimoEnviados: 4,
};

describe('AdminAvisosComponent', () => {
  let fixture: ComponentFixture<AdminAvisosComponent>;
  let component: AdminAvisosComponent;
  let api: jest.Mocked<AdminAvisosService>;

  const montar = async (): Promise<void> => {
    fixture = TestBed.createComponent(AdminAvisosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  };

  /** Deja el formulario de envío inmediato en un estado válido. */
  const rellenarEnvio = (): void =>
    component.formEnvio.patchValue({ segmento: 'clientes', titulo: 'Hola', cuerpo: 'Qué tal', ruta: '/inicio' });

  /** Deja el formulario del aviso programado en un estado válido. */
  const rellenarProgramado = (): void =>
    component.formProgramado.patchValue({ nombre: 'Aviso', titulo: 'Título', cuerpo: 'Cuerpo' });

  beforeEach(async () => {
    api = {
      estado: jest.fn().mockResolvedValue(ESTADO),
      listar: jest.fn().mockResolvedValue([AVISO]),
      enviar: jest.fn().mockResolvedValue(RESULTADO),
      crear: jest.fn().mockResolvedValue(AVISO),
      actualizar: jest.fn().mockResolvedValue(AVISO),
      ejecutar: jest.fn().mockResolvedValue(RESULTADO),
      eliminar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AdminAvisosService>;

    await TestBed.configureTestingModule({
      imports: [AdminAvisosComponent],
      providers: [{ provide: AdminAvisosService, useValue: api }],
    }).compileComponents();
  });

  describe('carga inicial', () => {
    it('debería pedir el estado del envío y los avisos programados', async () => {
      await montar();

      expect(component.estado()).toEqual(ESTADO);
      expect(component.programados()).toEqual([AVISO]);
      expect(component.cargando()).toBe(false);
    });

    it('debería avisar si la carga falla', async () => {
      api.estado.mockRejectedValue(new Error('500'));

      await montar();

      expect(component.error()).toBe('No se pudieron cargar los avisos.');
      expect(component.cargando()).toBe(false);
    });
  });

  describe('envío inmediato', () => {
    it('no debería enviar con el formulario incompleto', async () => {
      await montar();

      await component.enviar();

      expect(api.enviar).not.toHaveBeenCalled();
    });

    it('debería enviar y limpiar el mensaje, conservando destinatarios y ruta', async () => {
      await montar();
      rellenarEnvio();

      await component.enviar();

      expect(api.enviar).toHaveBeenCalledWith({
        segmento: 'clientes', titulo: 'Hola', cuerpo: 'Qué tal', ruta: '/inicio',
      });
      expect(component.resultado()).toEqual(RESULTADO);
      expect(component.formEnvio.getRawValue()).toMatchObject({ titulo: '', cuerpo: '', segmento: 'clientes' });
      expect(component.enviando()).toBe(false);
    });

    it('debería avisar si el envío falla', async () => {
      await montar();
      rellenarEnvio();
      api.enviar.mockRejectedValue(new Error('500'));

      await component.enviar();

      expect(component.error()).toBe('No se pudo enviar la notificación.');
      expect(component.enviando()).toBe(false);
    });
  });

  describe('avisos programados', () => {
    it('debería abrir y cerrar el formulario, limpiándolo al cerrar', async () => {
      await montar();
      component.editar(AVISO);

      component.alternarFormulario();

      expect(component.mostrandoFormulario()).toBe(false);
      expect(component.editandoId()).toBeNull();
      expect(component.diasElegidos()).toEqual([]);
    });

    it('debería abrir el formulario vacío al alternarlo desde cerrado', async () => {
      await montar();

      component.alternarFormulario();

      expect(component.mostrandoFormulario()).toBe(true);
      expect(component.editandoId()).toBeNull();
    });

    it('debería volcar el aviso en el formulario al editarlo', async () => {
      await montar();

      component.editar(AVISO);

      expect(component.editandoId()).toBe('av-1');
      expect(component.mostrandoFormulario()).toBe(true);
      expect(component.diasElegidos()).toEqual([1, 3]);
      expect(component.formProgramado.getRawValue()).toMatchObject({
        nombre: 'Recordatorio de pago', disparador: 'pago_pendiente', hora: '09:30', diasAntelacion: 5,
      });
    });

    it('debería tratar un aviso sin días como "todos los días" al editarlo', async () => {
      await montar();

      component.editar({ ...AVISO, diasSemana: undefined as unknown as number[] });

      expect(component.diasElegidos()).toEqual([]);
    });

    it('no debería guardar con el formulario incompleto', async () => {
      await montar();

      await component.guardarProgramado();

      expect(api.crear).not.toHaveBeenCalled();
      expect(api.actualizar).not.toHaveBeenCalled();
    });

    it('debería crear el aviso cuando no se está editando ninguno', async () => {
      await montar();
      rellenarProgramado();
      component.alternarDia(2);

      await component.guardarProgramado();

      expect(api.crear).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Aviso', diasSemana: [2] }));
      expect(api.actualizar).not.toHaveBeenCalled();
      expect(component.mostrandoFormulario()).toBe(false);
      expect(api.listar).toHaveBeenCalledTimes(2);
    });

    it('debería actualizar el aviso que se está editando', async () => {
      await montar();
      component.editar(AVISO);

      await component.guardarProgramado();

      expect(api.actualizar).toHaveBeenCalledWith('av-1', expect.objectContaining({ diasSemana: [1, 3] }));
      expect(api.crear).not.toHaveBeenCalled();
      expect(component.editandoId()).toBeNull();
    });

    it('debería avisar si guardar falla, dejando el formulario abierto', async () => {
      await montar();
      rellenarProgramado();
      component.mostrandoFormulario.set(true);
      api.crear.mockRejectedValue(new Error('500'));

      await component.guardarProgramado();

      expect(component.error()).toBe('No se pudo guardar el aviso.');
      expect(component.mostrandoFormulario()).toBe(true);
      expect(component.guardando()).toBe(false);
    });

    it('debería alternar el activo y recargar', async () => {
      await montar();

      await component.alternarActivo(AVISO);

      expect(api.actualizar).toHaveBeenCalledWith('av-1', { activo: false });
      expect(api.listar).toHaveBeenCalledTimes(2);
    });

    it('debería ejecutar el aviso de prueba y quedarse con el resultado', async () => {
      await montar();

      await component.probar(AVISO);

      expect(api.ejecutar).toHaveBeenCalledWith('av-1');
      expect(component.resultado()).toEqual(RESULTADO);
    });
  });

  describe('borrado', () => {
    afterEach(() => {
      (globalThis.confirm as unknown) = undefined;
    });

    it('debería eliminar tras confirmar', async () => {
      await montar();
      globalThis.confirm = jest.fn().mockReturnValue(true);

      await component.eliminar(AVISO);

      expect(api.eliminar).toHaveBeenCalledWith('av-1');
      expect(api.listar).toHaveBeenCalledTimes(2);
    });

    it('no debería eliminar si se cancela la confirmación', async () => {
      await montar();
      globalThis.confirm = jest.fn().mockReturnValue(false);

      await component.eliminar(AVISO);

      expect(api.eliminar).not.toHaveBeenCalled();
    });
  });

  describe('días de la semana', () => {
    it('debería añadir y quitar un día al alternarlo', async () => {
      await montar();

      component.alternarDia(4);
      expect(component.tieneDia(4)).toBe(true);

      component.alternarDia(4);
      expect(component.tieneDia(4)).toBe(false);
    });
  });

  describe('etiquetas', () => {
    it('debería traducir disparador y segmento conocidos', async () => {
      await montar();

      expect(component.etiquetaDisparador('difusion')).toContain('Difusión');
      expect(component.etiquetaSegmento('comercios')).toBe('Comercios');
    });

    it('debería devolver el valor crudo si no lo conoce', async () => {
      await montar();

      expect(component.etiquetaDisparador('inventado')).toBe('inventado');
      expect(component.etiquetaSegmento('inventado')).toBe('inventado');
    });

    it('debería listar los días elegidos ordenados y en iniciales', async () => {
      await montar();

      expect(component.etiquetaDias([3, 1])).toBe('L X');
    });

    it.each([
      ['sin lista', undefined],
      ['con la lista vacía', []],
    ])('debería decir "todos los días" %s', async (_caso, dias) => {
      await montar();

      expect(component.etiquetaDias(dias)).toBe('todos los días');
    });
  });

  describe('días de antelación', () => {
    it('no debería pedirlos en una difusión', async () => {
      await montar();

      expect(component.pideDias()).toBe(false);
    });

    it('debería pedirlos en un disparador con condición', async () => {
      await montar();

      component.formProgramado.patchValue({ disparador: 'reserva_proxima' });

      expect(component.pideDias()).toBe(true);
    });

    it('no debería pedirlos ante un disparador desconocido', async () => {
      await montar();

      component.formProgramado.patchValue({ disparador: 'inventado' });

      expect(component.pideDias()).toBe(false);
    });
  });
});
