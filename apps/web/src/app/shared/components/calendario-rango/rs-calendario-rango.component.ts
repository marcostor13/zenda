import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { DiaCalendarioApi } from 'shared';
import { RsIconComponent } from '../icon/rs-icon.component';

/** Mes que se está viendo. `mes` es 1-12, no el 0-11 de `Date`. */
export interface MesVisible {
  anio: number;
  mes: number;
}

export interface RangoFechas {
  entrada: string | null;
  salida: string | null;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Empieza en lunes: es la semana europea, y el calendario es para el mercado europeo. */
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** `Date` → `YYYY-MM-DD` en UTC. Todo el calendario razona por fecha, no por instante. */
const clave = (fecha: Date): string => fecha.toISOString().slice(0, 10);

const sumarDias = (fecha: string, dias: number): string =>
  clave(new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * MS_POR_DIA));

interface Celda {
  fecha: string;
  numero: number;
  /** Se puede elegir como entrada (o como salida, según en qué punto va la selección). */
  seleccionable: boolean;
  esEntrada: boolean;
  esSalida: boolean;
  /** Dentro del rango elegido, sin ser ninguno de los dos extremos. */
  enRango: boolean;
  plazasLibres: number;
}

/**
 * Calendario de un mes para elegir un rango de noches, con los días sin plaza
 * deshabilitados.
 *
 * Es presentacional a propósito: no sabe pedir nada al API. Recibe los días ya
 * resueltos y avisa cuando el cliente cambia de mes, para que quien lo usa
 * decida cómo se cargan. Así vive en `shared/` sin arrastrar el servicio de una
 * feature concreta.
 *
 * **La noche de salida no se ocupa**: una estancia del 1 al 4 usa las noches
 * 1, 2 y 3. Por eso el día de salida puede estar lleno y seguir siendo elegible
 * — te vas esa mañana.
 */
@Component({
  selector: 'rs-calendario-rango',
  standalone: true,
  imports: [RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="cal" [class.cal--plano]="plano()" [class.cal--con-plazas]="conDisponibilidad()">
  <div class="cal__cabecera">
    <button type="button" class="cal__nav" (click)="mesAnterior()"
            [disabled]="!puedeRetroceder()" aria-label="Mes anterior">
      <rs-icon name="chevron-left" [size]="18" [stroke]="2.25" />
    </button>
    <strong class="cal__mes">{{ tituloMes() }}</strong>
    <button type="button" class="cal__nav" (click)="mesSiguiente()" aria-label="Mes siguiente">
      <rs-icon name="chevron-right" [size]="18" [stroke]="2.25" />
    </button>
  </div>

  <div class="cal__semana" aria-hidden="true">
    @for (dia of diasSemana; track $index) { <span>{{ dia }}</span> }
  </div>

  <div class="cal__rejilla" role="grid">
    @for (hueco of huecosIniciales(); track $index) { <span class="cal__hueco"></span> }

    @for (celda of celdas(); track celda.fecha) {
      <button type="button" class="cal__dia"
              [class.esta-libre]="celda.seleccionable"
              [class.es-extremo]="celda.esEntrada || celda.esSalida"
              [class.en-rango]="celda.enRango"
              [disabled]="!celda.seleccionable"
              [attr.aria-label]="etiquetaDia(celda)"
              [attr.aria-pressed]="celda.esEntrada || celda.esSalida"
              (click)="elegir(celda)">
        {{ celda.numero }}
      </button>
    }
  </div>

  @if (cargando()) {
    <p class="cal__estado"><span class="rs-spin"></span> Cargando disponibilidad…</p>
  } @else if (aviso()) {
    <p class="cal__estado cal__estado--aviso">
      <rs-icon name="alert-circle" [size]="14" [stroke]="2" /> {{ aviso() }}
    </p>
  } @else {
    <p class="cal__estado">{{ pista() }}</p>
  }

  @if (conDisponibilidad()) {
    <p class="cal__leyenda">
      <span class="cal__muestra cal__muestra--libre"></span> Con plaza
      <span class="cal__muestra cal__muestra--lleno"></span> Sin plaza
    </p>
  }
</div>
  `,
  styles: [`
    :host { display: block; }

    .cal {
      /*
       * Tope de ancho: las celdas son cuadradas y crecen con el contenedor, así
       * que sin él ocupaban el ancho entero de la columna del formulario y
       * salían de 104 px en escritorio (123 px justo por debajo de 1024, donde
       * el resumen lateral deja de estar y la columna se queda con todo).
       * 380 px dejan la celda en unos 47, que es el tamaño de un día.
       */
      max-width: 380px;
      border: 1px solid var(--b-2); border-radius: var(--r-xl);
      padding: var(--sp-4); background: var(--c-card);
    }
    .cal--plano {
      max-width: none;
      border: none; border-radius: 0; padding: 0; background: transparent;
    }

    .cal__cabecera {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-2); margin-bottom: var(--sp-3);
    }
    .cal__mes {
      font-family: var(--font-display, var(--font));
      font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100);
      text-transform: capitalize;
    }
    .cal__nav {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; flex-shrink: 0;
      border: 1px solid var(--b-2); border-radius: var(--r-full);
      background: var(--c-card); color: var(--dk-blue); cursor: pointer;
      transition: background var(--d-2), border-color var(--d-2);

      &:hover:not(:disabled) { background: var(--c-accent-lo); border-color: var(--c-accent); }
      &:disabled { opacity: .35; cursor: not-allowed; }
    }

    .cal__semana, .cal__rejilla {
      display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px;
    }
    .cal__semana {
      margin-bottom: var(--sp-1);
      span {
        text-align: center; font-size: var(--f-xs); font-weight: var(--w-6);
        color: var(--t-400); padding-block: var(--sp-1);
      }
    }

    .cal__dia {
      /*
       * width:100% es lo que fija el ancho a la columna de la rejilla. Sin
       * él, aspect-ratio deduce el ancho de la altura, y como min-height
       * levanta la altura, en pantallas estrechas las celdas se ensanchaban por
       * encima de su columna y se solapaban unas con otras.
       *
       * El mínimo de altura es por el pulgar: una celda cuadrada se queda en
       * 36 px a 386 de ancho y se falla al tocarla.
       */
      width: 100%; aspect-ratio: 1; min-width: 0; min-height: 40px;
      display: flex; align-items: center; justify-content: center;
      border: 1px solid transparent; border-radius: var(--r-md);
      background: transparent; color: var(--t-500);
      font-family: var(--font); font-size: var(--f-sm); font-weight: var(--w-5);
      cursor: not-allowed;
      transition: background var(--d-1), color var(--d-1);

      &:disabled { opacity: .55; }

      &.esta-libre {
        color: var(--t-100); cursor: pointer;
        &:hover { background: var(--c-accent-lo); }
      }
      &.en-rango { background: var(--c-accent-lo); color: var(--dk-blue); border-radius: 0; }
      &.es-extremo {
        background: var(--c-accent); color: #fff; font-weight: var(--w-7);
        border-radius: var(--r-md);
      }
    }

    /*
     * Sin plaza: tachado, para que se lea como "esta noche no", no como "este
     * día no existe". Solo donde hay plazas de las que hablar: en el buscador
     * un día apagado es uno ya pasado, y tacharlo lo hacía parecer agotado.
     */
    .cal--con-plazas .cal__dia:disabled { text-decoration: line-through; }

    /* Mismo alto que una celda: si no, la primera semana se descuadra. */
    .cal__hueco { width: 100%; aspect-ratio: 1; min-height: 40px; }

    .cal__estado {
      display: flex; align-items: center; gap: var(--sp-2);
      margin-top: var(--sp-3); font-size: var(--f-xs); color: var(--t-400);
    }
    /* Sin anidar: &--modificador no es CSS nativo y estos estilos no pasan por Sass. */
    .cal__estado--aviso { color: var(--c-error, #B91C1C); }

    .cal__leyenda {
      display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap;
      margin-top: var(--sp-2); font-size: var(--f-xs); color: var(--t-400);
    }
    .cal__muestra { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
    .cal__muestra--libre { background: var(--c-accent); }
    .cal__muestra--lleno { background: var(--b-2); }
    .cal__leyenda .cal__muestra:not(:first-child) { margin-left: var(--sp-3); }
  `],
})
export class RsCalendarioRangoComponent {
  readonly diasSemana = DIAS_SEMANA;

  /**
   * Días resueltos por el API.
   *
   * Los que no vengan **no** se bloquean: no saber si una noche está libre no
   * es lo mismo que saber que está llena. Bloquear lo desconocido dejaba el
   * calendario entero muerto cuando la consulta fallaba o cuando el cliente
   * navegaba a un mes todavía sin cargar. Lo que se elija se valida igual
   * contra el API antes de dejar avanzar de paso.
   */
  readonly dias = input<readonly DiaCalendarioApi[]>([]);
  readonly cargando = input(false);
  readonly entrada = input<string | null>(null);
  readonly salida = input<string | null>(null);
  /** Mínimo de noches de una estancia. */
  readonly minNoches = input(1);
  /**
   * Si el calendario habla de plazas. En el buscador todavía no hay servicio
   * elegido —no hay disponibilidad que consultar—, así que la leyenda y los
   * avisos de "sin plazas" sobran: sólo confundirían.
   */
  readonly conDisponibilidad = input(true);
  /**
   * Sin tarjeta propia: el calendario ya va dentro de otra superficie (el
   * desplegable del buscador) y su borde y su padding dibujarían un marco
   * doble.
   */
  readonly plano = input(false);
  /**
   * Una sola fecha en vez de un rango, para las categorías que reservan por
   * cita (peluquería, veterinaria…) en lugar de por noches.
   */
  readonly soloUnDia = input(false);

  readonly rangoElegido = output<RangoFechas>();
  readonly mesCambiado = output<MesVisible>();

  private readonly hoy = clave(new Date());
  private readonly mesVisible = signal<MesVisible>({
    anio: new Date().getUTCFullYear(),
    mes: new Date().getUTCMonth() + 1,
  });

  /** Mensaje puntual cuando la elección no se puede aceptar. */
  readonly aviso = signal<string | null>(null);

  private readonly porFecha = computed(
    () => new Map(this.dias().map((dia) => [dia.fecha, dia])),
  );

  readonly tituloMes = computed(() => {
    const { anio, mes } = this.mesVisible();
    return `${MESES[mes - 1]} ${anio}`;
  });

  /** No se navega a meses ya pasados: no hay nada reservable ahí. */
  readonly puedeRetroceder = computed(() => {
    const { anio, mes } = this.mesVisible();
    const ahora = new Date();
    return anio > ahora.getUTCFullYear()
      || (anio === ahora.getUTCFullYear() && mes > ahora.getUTCMonth() + 1);
  });

  /** Celdas vacías antes del día 1, para que el mes empiece en su día de la semana. */
  readonly huecosIniciales = computed(() => {
    const { anio, mes } = this.mesVisible();
    const diaSemana = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
    // getUTCDay(): 0 = domingo. La rejilla empieza en lunes.
    return Array.from({ length: (diaSemana + 6) % 7 });
  });

  readonly celdas = computed<Celda[]>(() => {
    const { anio, mes } = this.mesVisible();
    const entrada = this.entrada();
    const salida = this.salida();
    const tope = this.topeDeSalida();
    const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

    return Array.from({ length: diasDelMes }, (_, indice) => {
      const numero = indice + 1;
      const fecha = clave(new Date(Date.UTC(anio, mes - 1, numero)));
      const dia = this.porFecha().get(fecha);

      return {
        fecha,
        numero,
        seleccionable: this.esSeleccionable(fecha, entrada, salida, tope),
        esEntrada: fecha === entrada,
        esSalida: fecha === salida,
        enRango: !!entrada && !!salida && fecha > entrada && fecha < salida,
        plazasLibres: dia?.plazasLibres ?? 0,
      };
    });
  });

  /**
   * Qué se le dice al cliente bajo la rejilla.
   *
   * Los dos casos raros tenían que ser visibles: un mes entero sin plazas y un
   * mes sin datos se veían igual —todo apagado— y no había forma de saber si
   * el servicio está lleno o si la disponibilidad no se pudo consultar.
   */
  readonly pista = computed(() => {
    if (this.soloUnDia()) return 'Elige el día.';

    const futuras = this.celdas().filter((celda) => celda.fecha >= this.hoy);

    if (this.conDisponibilidad()
        && futuras.length && futuras.every((c) => this.estadoDe(c.fecha) === 'lleno')) {
      return `Sin plazas libres en ${this.tituloMes()}. Prueba con otro mes.`;
    }

    if (this.conDisponibilidad()
        && futuras.length && futuras.every((c) => this.estadoDe(c.fecha) === 'desconocido')) {
      return 'No hemos podido cargar la disponibilidad de este mes; se comprobará al continuar.';
    }

    return this.entrada() && !this.salida()
      ? 'Ahora elige el día de salida.'
      : 'Elige el día de entrada.';
  });

  /**
   * Hasta qué día se puede poner la salida: la primera noche llena después de
   * la entrada corta el rango. Null = no hay entrada elegida todavía.
   */
  private topeDeSalida(): string | null {
    const entrada = this.entrada();
    if (this.soloUnDia() || !entrada || this.salida()) return null;

    // Como mucho se mira un año: más allá no hay calendario cargado.
    for (let salto = 0; salto < 366; salto++) {
      const noche = sumarDias(entrada, salto);
      // Sólo corta una noche que el API dice que está llena. Una sin datos no
      // corta: cortar por lo desconocido impedía elegir cualquier salida.
      if (this.estadoDe(noche) === 'lleno') return noche;
    }
    return sumarDias(entrada, 366);
  }

  /**
   * Tres estados, no dos: una noche que el API no ha contestado no es una
   * noche llena. Esa diferencia es la que decide si se puede pinchar.
   */
  private estadoDe(fecha: string): 'libre' | 'lleno' | 'desconocido' {
    const dia = this.porFecha().get(fecha);
    if (!dia) return 'desconocido';
    return dia.disponible ? 'libre' : 'lleno';
  }

  private esSeleccionable(
    fecha: string,
    entrada: string | null,
    salida: string | null,
    tope: string | null,
  ): boolean {
    if (fecha < this.hoy) return false;

    // Eligiendo salida: vale cualquier día posterior a la entrada hasta el tope,
    // aunque ese día esté lleno — la noche de salida no se ocupa.
    if (!this.soloUnDia() && entrada && !salida) {
      if (fecha <= entrada) return this.estadoDe(fecha) !== 'lleno';
      return !!tope && fecha <= tope && fecha >= sumarDias(entrada, this.minNoches());
    }

    return this.estadoDe(fecha) !== 'lleno';
  }

  elegir(celda: Celda): void {
    if (!celda.seleccionable) return;
    this.aviso.set(null);

    if (this.soloUnDia()) {
      this.rangoElegido.emit({ entrada: celda.fecha, salida: null });
      return;
    }

    const entrada = this.entrada();
    const salida = this.salida();

    // Sin entrada, o con un rango ya cerrado: se empieza de nuevo.
    if (!entrada || salida || celda.fecha <= entrada) {
      this.rangoElegido.emit({ entrada: celda.fecha, salida: null });
      return;
    }

    this.rangoElegido.emit({ entrada, salida: celda.fecha });
  }

  etiquetaDia(celda: Celda): string {
    const [anio, mes, dia] = celda.fecha.split('-').map(Number);
    const fecha = `${dia} de ${MESES[mes - 1]} de ${anio}`;
    // Sin disponibilidad que consultar, un día apagado es uno ya pasado: decir
    // "sin plaza" ahí sería mentir al lector de pantalla.
    if (celda.seleccionable || !this.conDisponibilidad()) return fecha;
    return `${fecha}, sin plaza`;
  }

  mesAnterior(): void {
    if (!this.puedeRetroceder()) return;
    this.cambiarMes(-1);
  }

  mesSiguiente(): void {
    this.cambiarMes(1);
  }

  private cambiarMes(delta: number): void {
    const { anio, mes } = this.mesVisible();
    const referencia = new Date(Date.UTC(anio, mes - 1 + delta, 1));
    const nuevo = { anio: referencia.getUTCFullYear(), mes: referencia.getUTCMonth() + 1 };
    this.mesVisible.set(nuevo);
    this.mesCambiado.emit(nuevo);
  }
}
