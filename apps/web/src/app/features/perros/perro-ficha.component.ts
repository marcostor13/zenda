import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VERTICAL_LABELS, VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { iconoDeVertical } from '../../shared/verticales/verticales.config';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { IndiceBienestarApi, PerrosService, porcentajeCompletitud } from './perros.service';
import { ExpedienteApi, ExpedienteService, ServicioExpedienteApi } from './expediente.service';
import { HistorialTimelineComponent } from './componentes/historial-timeline.component';
import { RegistroServicioComponent } from './componentes/registro-servicio.component';
import { FichaPerroDatosComponent } from './componentes/ficha-perro-datos.component';
import { proximaCitaDe } from './componentes/proxima-cita';
import { edadLegible } from './edad';
import { FechaPipe } from '../../shared/pipes/fecha.pipe';

type Pestana = 'resumen' | 'historial' | 'salud' | 'comportamiento' | 'documentos';

const PESTANAS: ReadonlyArray<{ id: Pestana; etiqueta: string; icono: string }> = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'sparkles' },
  { id: 'historial', etiqueta: 'Historial', icono: 'clipboard-list' },
  { id: 'salud', etiqueta: 'Salud', icono: 'heart' },
  { id: 'comportamiento', etiqueta: 'Comportamiento', icono: 'brain' },
  { id: 'documentos', etiqueta: 'Documentos', icono: 'file-text' },
];

const ESTADOS_REALIZADOS = ['completada', 'pago_retenido', 'pago_liberado'];
const ESTADOS: Record<string, string> = {
  confirmada: 'Confirmada', en_curso: 'En curso', completada: 'Completada', no_show: 'No presentado',
  ajuste_solicitado: 'Ajuste solicitado', pago_retenido: 'Completada', pago_liberado: 'Completada', en_disputa: 'En disputa',
};

/**
 * Ficha completa del perro en la cuenta del cliente: sus datos, su salud, su
 * comportamiento y el historial de todo lo que le han hecho los profesionales
 * de Doogking, con lo que anotó cada uno. Se puede descargar en PDF para
 * llevarla a una clínica que no esté en la plataforma.
 */
@Component({
  selector: 'app-perro-ficha',
  standalone: true,
  imports: [
    FechaPipe, RouterLink, RsNavbarComponent, RsIconComponent, ImgFallbackDirective, TraducirPipe,
    HistorialTimelineComponent, RegistroServicioComponent, FichaPerroDatosComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div [class.dk-pagina]="!embebida()">
  @if (!embebida()) { <rs-navbar /> }

  <main class="ficha" [class.rs-wrap]="!embebida()" [class.ficha--embebida]="embebida()">
    @if (!embebida()) {
      <a routerLink="/perros" class="volver">
        <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon> {{ 'Mis mascotas' | t }}
      </a>
    }

    @if (cargando()) {
      <div class="rs-card cargando"><span class="rs-spinner"></span> {{ 'Cargando la ficha…' | t }}</div>
    } @else if (error()) {
      <div class="rs-alert rs-alert--error">{{ error() | t }}</div>
    } @else if (expediente(); as exp) {
      <!-- Cabecera -->
      <header class="hero">
        <div class="hero__fondo" aria-hidden="true"></div>
        <div class="hero__contenido">
          <div class="hero__avatar">
            @if (exp.perro.fotos.length) { <img [src]="exp.perro.fotos[0]" [alt]="exp.perro.nombre" rsImg /> }
            @else { <rs-icon name="dog" [size]="48" [stroke]="1.5"></rs-icon> }
          </div>
          <div class="hero__id">
            <span class="hero__eyebrow"><rs-icon name="crown" [size]="13" [stroke]="2"></rs-icon> {{ 'Ficha Inteligente' | t }}</span>
            <h1>{{ exp.perro.nombre }}</h1>
            <p class="hero__linea">
              {{ exp.perro.raza || ('Mestizo' | t) }}
              @if (edad(); as e) { <span>·</span> {{ e }} }
              @if (exp.perro.sexo) { <span>·</span> {{ (exp.perro.sexo === 'macho' ? 'Macho' : 'Hembra') | t }} }
              @if (exp.perro.peso) { <span>·</span> {{ exp.perro.peso }} kg }
              @if (exp.perro.ciudad) { <span>·</span> <rs-icon name="map-pin" [size]="13" [stroke]="2"></rs-icon> {{ exp.perro.ciudad }} }
            </p>
            <div class="hero__sellos">
              @for (s of sellos(); track s.etiqueta) {
                <span class="sello" [class.sello--no]="!s.ok">
                  <rs-icon [name]="s.ok ? 'check-circle' : 'circle'" [size]="13" [stroke]="2.5"></rs-icon> {{ s.etiqueta | t }}
                </span>
              }
            </div>
          </div>
          <div class="hero__completitud" [attr.aria-label]="'Ficha completada' | t">
            <div class="anillo" [style.--pct]="completitud()">
              <span>{{ completitud() }}%</span>
            </div>
            <small>{{ 'Ficha completada' | t }}</small>
          </div>
        </div>
        <div class="hero__acciones">
          <a [routerLink]="['/perros', exp.perro._id, 'editar']" class="rs-btn rs-btn--primary">
            <rs-icon name="pencil" [size]="15" [stroke]="2"></rs-icon> {{ 'Editar ficha' | t }}
          </a>
          <button type="button" class="rs-btn rs-btn--outline" [disabled]="descargando()" (click)="descargarPdf()">
            <rs-icon name="download" [size]="15" [stroke]="2"></rs-icon>
            {{ (descargando() ? 'Generando PDF…' : 'Descargar PDF') | t }}
          </button>
          <a [routerLink]="['/perros', exp.perro._id, 'privacidad']" class="rs-btn rs-btn--ghost">
            <rs-icon name="lock" [size]="15" [stroke]="2"></rs-icon> {{ 'Privacidad' | t }}
          </a>
        </div>
      </header>

      @if (avisoPdf()) { <div class="rs-alert rs-alert--error">{{ avisoPdf() | t }}</div> }

      <!-- Avisos de salud -->
      @if (exp.perro.alergias.length || exp.perro.medicacion.length) {
        <div class="aviso-salud">
          <rs-icon name="alert-triangle" [size]="18" [stroke]="2"></rs-icon>
          <div>
            @if (exp.perro.alergias.length) { <p><strong>{{ 'Alergias' | t }}:</strong> {{ exp.perro.alergias.join(', ') }}</p> }
            @if (exp.perro.medicacion.length) { <p><strong>{{ 'Medicación' | t }}:</strong> {{ exp.perro.medicacion.join(', ') }}</p> }
          </div>
        </div>
      }

      <!-- Indicadores -->
      <section class="kpis">
        <div class="rs-card kpi">
          <span class="kpi__icono"><rs-icon name="check-circle" [size]="18" [stroke]="2"></rs-icon></span>
          <span class="kpi__valor">{{ realizados().length }}</span>
          <span class="kpi__label">{{ 'Servicios realizados' | t }}</span>
        </div>
        <div class="rs-card kpi">
          <span class="kpi__icono"><rs-icon name="clipboard-list" [size]="18" [stroke]="2"></rs-icon></span>
          <span class="kpi__valor">{{ exp.registros.length }}</span>
          <span class="kpi__label">{{ 'Registros de profesionales' | t }}</span>
        </div>
        <div class="rs-card kpi">
          <span class="kpi__icono"><rs-icon name="stethoscope" [size]="18" [stroke]="2"></rs-icon></span>
          <span class="kpi__valor kpi__valor--texto">{{ ultimoVeterinario() ? (ultimoVeterinario()! | date:'d MMM yyyy') : ('Sin visitas' | t) }}</span>
          <span class="kpi__label">{{ 'Última visita al veterinario' | t }}</span>
        </div>
        <div class="rs-card kpi">
          <span class="kpi__icono"><rs-icon name="calendar-plus" [size]="18" [stroke]="2"></rs-icon></span>
          <span class="kpi__valor kpi__valor--texto">{{ proximaCita() ? (proximaCita()! | date:'d MMM yyyy') : ('Nada previsto' | t) }}</span>
          <span class="kpi__label">{{ 'Próxima cita' | t }}</span>
        </div>
      </section>

      <!-- Pestañas -->
      <nav class="pestanas" role="tablist" [attr.aria-label]="'Secciones de la ficha' | t">
        @for (p of pestanas; track p.id) {
          <button type="button" role="tab" class="pestana" [class.activa]="pestana() === p.id"
                  [attr.aria-selected]="pestana() === p.id" (click)="irA(p.id)">
            <rs-icon [name]="p.icono" [size]="15" [stroke]="2"></rs-icon> {{ p.etiqueta | t }}
            @if (p.id === 'historial' && exp.registros.length) { <span class="pestana__cuenta">{{ exp.registros.length }}</span> }
          </button>
        }
      </nav>

      @switch (pestana()) {
        @case ('resumen') {
          <div class="resumen">
            <section class="resumen__principal">
              <div class="bloque-cabecera">
                <h2>{{ 'Actividad reciente' | t }}</h2>
                @if (exp.registros.length > 3) {
                  <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="irA('historial')">
                    {{ 'Ver todo el historial' | t }} <rs-icon name="arrow-right" [size]="14" [stroke]="2"></rs-icon>
                  </button>
                }
              </div>
              @if (exp.registros.length) {
                <div class="recientes">
                  @for (r of exp.registros.slice(0, 3); track r._id) {
                    <app-registro-servicio [registro]="r" />
                  }
                </div>
              } @else {
                <div class="vacio">
                  <rs-icon name="clipboard-list" [size]="32" [stroke]="1.5"></rs-icon>
                  <p>{{ 'Cuando un veterinario, peluquero o adiestrador de Doogking atienda a tu perro, lo que anote aparecerá aquí.' | t }}</p>
                  <a routerLink="/" class="rs-btn rs-btn--primary rs-btn--sm">{{ 'Buscar un servicio' | t }}</a>
                </div>
              }

              @if (proximas().length) {
                <div class="bloque-cabecera"><h2>{{ 'Próximas reservas' | t }}</h2></div>
                <ul class="servicios">
                  @for (s of proximas(); track s.reservaId) {
                    <li class="rs-card servicio">
                      <span class="servicio__icono"><rs-icon [name]="icono(s.vertical)" [size]="18" [stroke]="2"></rs-icon></span>
                      <div class="servicio__info">
                        <strong>{{ s.servicioTitulo || (etiqueta(s.vertical) | t) }}</strong>
                        <span>{{ s.comercioNombre }} · {{ s.fechaInicio | date:'d MMM yyyy, HH:mm' }}</span>
                      </div>
                      <span class="rs-badge rs-badge--accent">{{ estado(s.estado) | t }}</span>
                    </li>
                  }
                </ul>
              }
            </section>

            <aside class="resumen__lateral">
              @if (bienestar(); as b) {
                <section class="rs-card bienestar">
                  <h3><rs-icon name="award" [size]="18" [stroke]="2"></rs-icon> {{ 'Índice de Bienestar' | t }}</h3>
                  <div class="bienestar__cifra"><strong>{{ b.puntuacion }}</strong><span>/100</span></div>
                  @for (eje of b.ejes; track eje.clave) {
                    <div class="eje">
                      <div class="eje__cabecera"><span>{{ eje.etiqueta | t }}</span><span>{{ eje.puntos }}/{{ eje.maximo }}</span></div>
                      <div class="eje__barra"><div [style.width.%]="eje.maximo ? (eje.puntos / eje.maximo) * 100 : 0"></div></div>
                    </div>
                  }
                </section>
              }
              <app-ficha-perro-datos [perro]="exp.perro" [secciones]="['general']" />
            </aside>
          </div>
        }
        @case ('historial') {
          <app-historial-timeline [registros]="exp.registros"
                                  vacio="Todavía no hay registros de profesionales en el historial de tu perro." />
          @if (realizados().length) {
            <section class="realizados">
              <div class="bloque-cabecera"><h2>{{ 'Servicios reservados en Doogking' | t }}</h2></div>
              <ul class="servicios">
                @for (s of realizados(); track s.reservaId) {
                  <li class="rs-card servicio">
                    <span class="servicio__icono"><rs-icon [name]="icono(s.vertical)" [size]="18" [stroke]="2"></rs-icon></span>
                    <div class="servicio__info">
                      <strong>{{ s.servicioTitulo || (etiqueta(s.vertical) | t) }}</strong>
                      <span>{{ s.comercioNombre }} · {{ s.fechaInicio | date:'d MMM yyyy' }} · {{ s.codigo }}</span>
                    </div>
                    <span class="rs-badge rs-badge--success">{{ 'Realizado' | t }}</span>
                  </li>
                }
              </ul>
            </section>
          }
        }
        @case ('salud') { <app-ficha-perro-datos [perro]="exp.perro" [secciones]="['salud']" /> }
        @case ('comportamiento') { <app-ficha-perro-datos [perro]="exp.perro" [secciones]="['comportamiento']" /> }
        @case ('documentos') { <app-ficha-perro-datos [perro]="exp.perro" [secciones]="['documentos']" /> }
      }
    }
  </main>
</div>
  `,
  styles: [`
    .ficha { padding-block: var(--sp-6) var(--sp-16); display: grid; gap: var(--sp-5); }
    /* Incrustada en /perros ya hay cabecera de página y ancho: la ficha solo aporta su contenido. */
    .ficha--embebida { padding-block: 0; }
    .volver { display: inline-flex; align-items: center; gap: var(--sp-2); color: var(--t-400); text-decoration: none; font-size: var(--f-sm); width: fit-content; }
    .volver:hover { color: var(--c-accent); }
    .cargando { padding: var(--sp-12); display: flex; justify-content: center; align-items: center; gap: var(--sp-3); color: var(--t-400); }

    /*
      El alto de la banda azul manda sobre dónde empieza el texto.

      Eran dos números sueltos que tenían que cuadrar y no cuadraban: la banda
      medía 120 px y el contenido arrancaba a 64. Con "align-items: end" el
      bloque del nombre sube cuanto más alto es —y con el "Ficha Inteligente",
      la línea de datos y los tres sellos mide más que el avatar—, así que el
      titular acababa dentro del azul, en azul oscuro sobre azul: invisible. Un
      nombre largo lo dejaba entero ahí dentro, cruzado por la línea dorada.

      Con la variable, el relleno superior no puede quedarse corto: el texto
      empieza siempre por debajo de la banda, mida lo que mida el nombre.
    */
    .hero {
      --hero-banda: 120px;
      position: relative; border-radius: var(--r-2xl); overflow: hidden;
      background: var(--c-card); box-shadow: var(--sh-md); border: 1px solid var(--b-1);
    }
    .hero__fondo { position: absolute; inset: 0 0 auto 0; height: var(--hero-banda); background: var(--g-accent); }
    .hero__fondo::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: var(--g-warm); }
    .hero__contenido {
      position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--sp-5); align-items: end;
      padding: calc(var(--hero-banda) + var(--sp-3)) var(--sp-8) var(--sp-5);
    }
    /* El avatar sí pisa la banda: sube por encima del relleno para quedar a
       caballo, como en el móvil, sin arrastrar consigo al texto. */
    .hero__avatar {
      align-self: start;
      margin-top: calc(var(--hero-banda) * -.62);
      width: 132px; height: 132px; border-radius: var(--r-full); overflow: hidden;
      background: var(--c-card); color: var(--c-accent); display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 0 5px var(--c-card), 0 0 0 8px var(--dk-gold), var(--sh-lg);
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .hero__id { min-width: 0; padding-bottom: var(--sp-1); }
    .hero__eyebrow { display: inline-flex; align-items: center; gap: var(--sp-1); font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7); letter-spacing: .1em; text-transform: uppercase; color: var(--dk-gold-text); }
    .hero__id h1 { font-family: var(--font-display); font-size: var(--f-4xl); font-weight: var(--w-8); color: var(--t-100); margin: 0; line-height: 1.05; overflow-wrap: anywhere; }
    .hero__linea { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); color: var(--t-400); font-size: var(--f-sm); margin: var(--sp-2) 0 0; }
    .hero__sellos { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); }
    .sello {
      display: inline-flex; align-items: center; gap: var(--sp-1); padding: var(--sp-1) var(--sp-3); border-radius: var(--r-full);
      background: var(--c-success-lo); color: var(--c-success); font-size: var(--f-xs); font-weight: var(--w-6);
      &.sello--no { background: var(--c-raised); color: var(--t-400); }
    }
    .hero__completitud { display: flex; flex-direction: column; align-items: center; gap: var(--sp-1); color: var(--t-400); font-size: var(--f-xs); }
    .anillo {
      --pct: 0; width: 76px; height: 76px; border-radius: var(--r-full); display: grid; place-items: center;
      background: conic-gradient(var(--dk-gold) calc(var(--pct) * 1%), var(--c-raised) 0);
      span { width: 60px; height: 60px; border-radius: var(--r-full); background: var(--c-card); display: grid; place-items: center; font-weight: var(--w-8); color: var(--t-100); font-size: var(--f-md); }
    }
    .hero__acciones { position: relative; display: flex; flex-wrap: wrap; gap: var(--sp-3); padding: 0 var(--sp-8) var(--sp-6); }

    .aviso-salud {
      display: flex; gap: var(--sp-3); align-items: flex-start; padding: var(--sp-4) var(--sp-5); border-radius: var(--r-lg);
      background: var(--c-error-lo); color: var(--c-error); border: 1px solid var(--c-error-lo);
      p { margin: 0; font-size: var(--f-sm); }
    }

    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-4); }
    .kpi { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-1); }
    .kpi__icono { width: 36px; height: 36px; border-radius: var(--r-md); background: var(--c-accent-lo); color: var(--c-accent); display: grid; place-items: center; margin-bottom: var(--sp-2); }
    .kpi__valor { font-family: var(--font-display); font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.1; }
    .kpi__valor--texto { font-size: var(--f-md); }
    .kpi__label { font-size: var(--f-xs); color: var(--t-400); }

    .pestanas { display: flex; gap: var(--sp-1); border-bottom: 1px solid var(--b-1); overflow-x: auto; scrollbar-width: none; }
    .pestana {
      display: inline-flex; align-items: center; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4); white-space: nowrap;
      border: none; background: none; font: inherit; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-400);
      cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1px;
      &.activa { color: var(--c-accent); border-bottom-color: var(--dk-gold); }
      &:hover { color: var(--c-accent); }
    }
    .pestana__cuenta { background: var(--c-accent); color: var(--c-card); border-radius: var(--r-full); padding: 0 var(--sp-2); font-size: var(--f-xs); }

    .resumen { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: var(--sp-6); align-items: start; }
    .resumen__principal { display: grid; gap: var(--sp-4); min-width: 0; }
    .resumen__lateral { display: grid; gap: var(--sp-4); }
    .bloque-cabecera { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); }
    .bloque-cabecera h2 { font-family: var(--font-display); font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); margin: 0; }
    .recientes { display: grid; gap: var(--sp-4); }
    .vacio {
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center;
      padding: var(--sp-10) var(--sp-6); color: var(--t-400); border: 1px dashed var(--b-2); border-radius: var(--r-lg);
      p { margin: 0; max-width: 420px; font-size: var(--f-sm); }
    }
    .servicios { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-3); }
    .servicio { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4); flex-wrap: wrap; }
    .servicio__icono { width: 40px; height: 40px; border-radius: var(--r-full); background: var(--c-accent-lo); color: var(--c-accent); display: grid; place-items: center; flex-shrink: 0; }
    .servicio__info { flex: 1; min-width: 160px; display: flex; flex-direction: column; font-size: var(--f-sm); }
    .servicio__info strong { color: var(--t-100); }
    .servicio__info span { color: var(--t-400); font-size: var(--f-xs); }
    .realizados { display: grid; gap: var(--sp-4); margin-top: var(--sp-8); }

    .bienestar { padding: var(--sp-5); display: grid; gap: var(--sp-3); }
    .bienestar h3 { display: flex; align-items: center; gap: var(--sp-2); margin: 0; font-family: var(--font-display); font-size: var(--f-md); color: var(--t-100); rs-icon { color: var(--dk-gold-text); } }
    .bienestar__cifra strong { font-family: var(--font-display); font-size: var(--f-4xl); font-weight: var(--w-8); color: var(--c-accent); }
    .bienestar__cifra span { color: var(--t-400); }
    .eje__cabecera { display: flex; justify-content: space-between; font-size: var(--f-xs); color: var(--t-300); margin-bottom: var(--sp-1); }
    .eje__barra { height: 6px; background: var(--c-raised); border-radius: var(--r-full); overflow: hidden; div { height: 100%; background: var(--g-warm); border-radius: var(--r-full); } }

    @media (max-width: 960px) {
      .resumen { grid-template-columns: 1fr; }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .hero { --hero-banda: 96px; }
      /* En una columna el avatar va arriba y el texto debajo, así que aquí el
         relleno sólo tiene que dejar sitio al medio avatar que asoma. */
      .hero__contenido {
        grid-template-columns: 1fr; justify-items: center; text-align: center;
        padding: calc(var(--hero-banda) * .42) var(--sp-5) var(--sp-4);
      }
      .hero__avatar { align-self: center; margin-top: 0; width: 108px; height: 108px; }
      .hero__id h1 { font-size: var(--f-3xl); }
      .hero__linea, .hero__sellos { justify-content: center; }
      .hero__completitud { flex-direction: row; gap: var(--sp-3); }
      .hero__acciones { padding: 0 var(--sp-5) var(--sp-5); justify-content: center; }
      .kpi { padding: var(--sp-4); }
    }
  `],
})
export class PerroFichaComponent implements OnInit {
  /**
   * Mascota a mostrar cuando la ficha no viene de su propia ruta. `/perros` la
   * incrusta para el cliente que solo tiene una: ahí no hay `:id` que leer.
   */
  readonly perroId = input('');

  /** Sin navbar, sin ancho propio y sin enlace de vuelta: la página ya los pone. */
  readonly embebida = input(false);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly expedientes = inject(ExpedienteService);
  private readonly perros = inject(PerrosService);
  private readonly i18n = inject(I18nService);

  readonly pestanas = PESTANAS;
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly expediente = signal<ExpedienteApi | null>(null);
  readonly bienestar = signal<IndiceBienestarApi | null>(null);
  readonly pestana = signal<Pestana>('resumen');
  readonly descargando = signal(false);
  readonly avisoPdf = signal('');

  readonly completitud = computed(() => {
    const perro = this.expediente()?.perro;
    return perro ? porcentajeCompletitud(perro) : 0;
  });
  readonly edad = computed(() => edadLegible(this.expediente()?.perro.fechaNacimiento, (t, p) => this.i18n.t(t, p)));
  readonly proximaCita = computed(() => proximaCitaDe(this.expediente()));

  readonly realizados = computed<ServicioExpedienteApi[]>(() =>
    (this.expediente()?.servicios ?? []).filter((s) => ESTADOS_REALIZADOS.includes(s.estado)),
  );

  readonly proximas = computed<ServicioExpedienteApi[]>(() =>
    (this.expediente()?.servicios ?? [])
      .filter((s) => !ESTADOS_REALIZADOS.includes(s.estado) && new Date(s.fechaInicio) >= new Date())
      .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()),
  );

  /** La visita al veterinario más reciente, sea un registro o una reserva realizada. */
  readonly ultimoVeterinario = computed(() => {
    const exp = this.expediente();
    if (!exp) return null;
    const fechas = [
      ...exp.registros.filter((r) => r.vertical === VerticalKey.VETERINARIA).map((r) => r.fechaServicio ?? r.createdAt),
      ...this.realizados().filter((s) => s.vertical === VerticalKey.VETERINARIA).map((s) => s.fechaInicio),
    ].filter((f): f is string => !!f);
    return fechas.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  });

  readonly sellos = computed(() => {
    const p = this.expediente()?.perro;
    if (!p) return [];
    return [
      { etiqueta: 'Vacunas', ok: p.vacunas.length > 0 || (p.vacunasDetalle?.length ?? 0) > 0 },
      { etiqueta: 'Microchip', ok: !!p.microchip },
      { etiqueta: 'Esterilizado', ok: p.esterilizado },
    ];
  });

  async ngOnInit(): Promise<void> {
    const id = this.perroId() || (this.route.snapshot.paramMap.get('id') ?? '');
    const tab = this.route.snapshot.queryParamMap.get('tab') as Pestana | null;
    if (tab && PESTANAS.some((p) => p.id === tab)) this.pestana.set(tab);

    try {
      // Las dos peticiones salen a la vez; el bienestar es accesorio y no tumba la ficha.
      const bienestar = this.perros.bienestar(id).catch(() => null);
      this.expediente.set(await this.expedientes.delPropietario(id));
      this.bienestar.set(await bienestar);
    } catch {
      this.error.set('No se pudo cargar la ficha de tu perro.');
    } finally {
      this.cargando.set(false);
    }
  }

  irA(pestana: Pestana): void {
    this.pestana.set(pestana);
    // La pestaña va en la URL para que "Atrás" y los enlaces compartidos vuelvan a ella.
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: { tab: pestana === 'resumen' ? null : pestana },
      queryParamsHandling: 'merge', replaceUrl: true,
    });
  }

  async descargarPdf(): Promise<void> {
    const exp = this.expediente();
    if (!exp) return;
    this.descargando.set(true);
    this.avisoPdf.set('');
    try {
      await this.expedientes.descargarInformePropietario(exp.perro._id, exp.perro.nombre);
    } catch {
      this.avisoPdf.set('No se pudo generar el PDF. Inténtalo de nuevo.');
    } finally {
      this.descargando.set(false);
    }
  }

  icono(vertical: string): string {
    return iconoDeVertical(vertical);
  }

  etiqueta(vertical: string): string {
    return VERTICAL_LABELS[vertical as VerticalKey] ?? vertical;
  }

  estado(estado: string): string {
    return ESTADOS[estado] ?? estado;
  }
}
