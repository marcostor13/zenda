import {
  ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, computed, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  ACCION_NO_SHOW_LABELS, AMBITO_TRANSPORTE_LABELS, APLICACION_SUPLEMENTO_LABELS, AccionNoShow,
  AmbitoTransporte, AplicacionSuplemento, BASE_KILOMETRAJE_LABELS, BaseKilometraje,
  COMPARTIDO_TRANSPORTE_LABELS, CompartidoTransporte, EQUIPAJE_TRANSPORTE, EQUIPAMIENTO_VEHICULO,
  ESPECIES_TRANSPORTE, EXIGENCIA_REQUISITO_LABELS, ExigenciaRequisito, FINALIDAD_TRANSPORTE_LABELS,
  FORMA_CALCULO_SUPLEMENTO_LABELS, FRECUENCIA_RECURRENCIA_LABELS, FinalidadTransporte,
  FormaCalculoSuplemento, FrecuenciaRecurrencia, MODELO_PRECIO_LABELS, MODO_COBERTURA_LABELS,
  MODO_DISPONIBILIDAD_TRANSPORTE_LABELS, ModeloPrecio, ModoCobertura, ModoDisponibilidadTransporte,
  PLANTILLA_TRANSPORTE_DESCRIPCIONES, PLANTILLA_TRANSPORTE_LABELS, POLITICA_CANCELACION_TRANSPORTE_LABELS,
  POLITICA_CANCELACION_TRANSPORTE_TEXTOS, POLITICA_PARADAS_LABELS, POLITICA_PEAJES_LABELS,
  PRECIO_ACOMPANANTE_LABELS, PRECIO_ORIENTATIVO_LABELS, PUNTOS_TRAYECTO_LABELS, PlantillaTransporte,
  PoliticaCancelacionTransporte, PoliticaParadas, PoliticaPeajes, PrecioAcompanante, PrecioOrientativo,
  PuntosTrayecto, QUIEN_VIAJA_LABELS, QuienViaja, REDONDEO_DISTANCIA_LABELS, REQUISITOS_DOCUMENTALES,
  RedondeoDistancia, SITUACIONES_CONFIRMACION, SUPLEMENTOS_TRANSPORTE, TIPO_IDA_VUELTA_LABELS,
  TIPO_RECOGIDA_LABELS, TIPO_TRAYECTO_LABELS, TRAMOS_PESO_TRANSPORTE, TipoIdaVuelta, TipoRecogida,
  TipoTrayecto, UNIDAD_COBRO_LABELS, UnidadCobro, VENTANA_RECOGIDA_LABELS, VentanaRecogida,
  calcularPrecioTransporte, type ConfigTransporte,
} from 'shared';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { RsTagsInputComponent } from '../../../shared/components/tags-input/rs-tags-input.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { EurosPipe } from '../../../shared/pipes/euros.pipe';

/** Un paso del asistente, con su número y su título. */
interface PasoAlta {
  readonly numero: number;
  readonly titulo: string;
  readonly descripcion: string;
}

export const PASOS_ALTA_TRANSPORTE: readonly PasoAlta[] = [
  { numero: 1, titulo: 'Tipo', descripcion: 'Plantilla, quién viaja y modalidad' },
  { numero: 2, titulo: 'Cobertura', descripcion: 'Zonas, rutas y kilómetros facturables' },
  { numero: 3, titulo: 'Precio', descripcion: 'Reglas de tarifa y suplementos' },
  { numero: 4, titulo: 'Mascotas', descripcion: 'Capacidad, requisitos y equipamiento' },
  { numero: 5, titulo: 'Disponibilidad', descripcion: 'Calendario, confirmación y recurrencia' },
  { numero: 6, titulo: 'Publicar', descripcion: 'Condiciones, simulación y control' },
];

/** Una comprobación de la pantalla final: qué falta para poder publicar. */
export interface ComprobacionAlta {
  readonly clave: string;
  readonly etiqueta: string;
  readonly cumplida: boolean;
}

/**
 * Asistente de alta de un servicio de "Transporte de mascotas".
 *
 * Va en su propio componente y no dentro de `comercio-listado-form` por dos
 * razones. La primera es de tamaño: ese formulario ya lleva ocho verticales y
 * añadirle aquí veinte campos más lo dejaría imposible de leer. La segunda es
 * de responsabilidad: esto no es "unos campos más del listado", es un
 * asistente con pasos, reglas ordenadas y una simulación de precio, y tiene su
 * propia lógica que no comparte con ningún otro vertical.
 *
 * Trabaja sobre el `FormGroup` del padre (`[grupo]`), así que lo que se guarda
 * sigue saliendo de un único `getRawValue()` y el guardado no se entera de que
 * esta pantalla existe.
 *
 * **Los campos cambian según las opciones elegidas**: quien cobra por zonas no
 * ve tramos de kilómetros, y quien no admite acompañantes no ve el precio del
 * acompañante. Es lo que separa un alta que se termina de una que se abandona.
 */
@Component({
  selector: 'dk-alta-transporte',
  standalone: true,
  imports: [ReactiveFormsModule, RsIconComponent, RsTagsInputComponent, TraducirPipe, EurosPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="alta" [formGroup]="grupo">

  <!-- Guía de los seis pasos. No navega: marca dónde está cada cosa, para que
       un alta larga no se sienta como un formulario infinito. -->
  <ol class="alta__pasos" [attr.aria-label]="'Pasos del alta' | t">
    @for (p of pasos; track p.numero) {
      <li class="alta__paso" [class.is-on]="pasoActivo() === p.numero">
        <button type="button" class="alta__paso-btn" (click)="irAPaso(p.numero)"
                [attr.aria-current]="pasoActivo() === p.numero ? 'step' : null">
          <span class="alta__paso-num">{{ p.numero }}</span>
          <span class="alta__paso-txt">
            <strong>{{ p.titulo | t }}</strong>
            <small>{{ p.descripcion | t }}</small>
          </span>
        </button>
      </li>
    }
  </ol>

  <!-- ── 1 · TIPO ───────────────────────────────────────────────────── -->
  @if (pasoActivo() === 1) {
    <section class="alta__seccion" data-testid="paso-tipo">
      <h3 class="alta__titulo">{{ 'Tipo principal de servicio' | t }}</h3>
      <p class="alta__ayuda">
        {{ 'Cada modalidad comercial se publica como un servicio distinto. Un mismo servicio puede contener varias reglas de precio.' | t }}
      </p>

      <div class="alta__plantillas">
        @for (p of plantillas; track p) {
          <button type="button" class="plantilla" [class.is-on]="grupo.get('plantilla')?.value === p"
                  (click)="elegirPlantilla(p)" [attr.data-testid]="'plantilla-' + p">
            <strong>{{ plantillaLabel(p) | t }}</strong>
            <small>{{ plantillaDescripcion(p) | t }}</small>
          </button>
        }
      </div>

      <div class="alta__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="tr-quien">{{ '¿Quién viaja?' | t }}</label>
          <select id="tr-quien" class="rs-inp" formControlName="quienViaja">
            @for (q of quienViajaOpciones; track q) {
              <option [value]="q">{{ quienViajaLabel(q) | t }}</option>
            }
          </select>
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-recogida">{{ 'Tipo de recogida' | t }}</label>
          <select id="tr-recogida" class="rs-inp" formControlName="tipoRecogida">
            @for (r of tiposRecogida; track r) {
              <option [value]="r">{{ tipoRecogidaLabel(r) | t }}</option>
            }
          </select>
        </div>
      </div>

      <div class="rs-field">
        <span class="rs-lbl">{{ 'Tipos de trayecto' | t }}</span>
        <div class="alta__checks">
          @for (t of tiposTrayecto; track t) {
            <label class="rs-checkbox">
              <input type="checkbox" [checked]="tiene('tiposTrayecto', t)"
                     (change)="alternar('tiposTrayecto', t)"> {{ tipoTrayectoLabel(t) | t }}
            </label>
          }
        </div>
      </div>

      <div class="rs-field">
        <span class="rs-lbl">{{ 'Ámbito del servicio' | t }}</span>
        <div class="alta__checks">
          @for (a of ambitos; track a) {
            <label class="rs-checkbox">
              <input type="checkbox" [checked]="tiene('ambitos', a)"
                     (change)="alternar('ambitos', a)"> {{ ambitoLabel(a) | t }}
            </label>
          }
        </div>
      </div>

      <div class="rs-field">
        <span class="rs-lbl">{{ 'Finalidad habitual' | t }}</span>
        <div class="alta__checks">
          @for (f of finalidades; track f) {
            <label class="rs-checkbox">
              <input type="checkbox" [checked]="tiene('finalidades', f)"
                     (change)="alternar('finalidades', f)"> {{ finalidadLabel(f) | t }}
            </label>
          }
        </div>
      </div>
    </section>
  }

  <!-- ── 2 · COBERTURA ──────────────────────────────────────────────── -->
  @if (pasoActivo() === 2) {
    <section class="alta__seccion" data-testid="paso-cobertura">
      <h3 class="alta__titulo">{{ 'Cobertura y puntos del trayecto' | t }}</h3>

      <div class="alta__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="tr-cobertura">{{ 'Cómo defines la cobertura' | t }}</label>
          <select id="tr-cobertura" class="rs-inp" formControlName="modoCobertura">
            @for (m of modosCobertura; track m) {
              <option [value]="m">{{ modoCoberturaLabel(m) | t }}</option>
            }
          </select>
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-base">{{ 'Dirección base' | t }}</label>
          <input id="tr-base" class="rs-inp" formControlName="direccionBase"
                 [placeholder]="'Calle y número, municipio' | t">
        </div>
      </div>

      <!-- Campos condicionales: un radio solo tiene sentido si la cobertura es
           un radio, y una lista de países solo si se sale del país. -->
      @if (grupo.get('modoCobertura')?.value === 'radio') {
        <div class="rs-field">
          <label class="rs-lbl" for="tr-radio">{{ 'Radio máximo (km)' | t }}</label>
          <input id="tr-radio" class="rs-inp" type="number" min="1" formControlName="radioKm" inputmode="numeric">
        </div>
      }
      @if (grupo.get('modoCobertura')?.value === 'municipios'
           || grupo.get('modoCobertura')?.value === 'provincias') {
        <div class="rs-field">
          <span class="rs-lbl">{{ 'Municipios o provincias que cubres' | t }}</span>
          <rs-tags-input formControlName="municipiosCobertura" [etiqueta]="'Cobertura' | t"
                         [placeholder]="'Ej. Castellón, Valencia…' | t" />
        </div>
      }
      @if (grupo.get('modoCobertura')?.value === 'paises') {
        <div class="rs-field">
          <span class="rs-lbl">{{ 'Países a los que llegas' | t }}</span>
          <rs-tags-input formControlName="paisesCobertura" [etiqueta]="'Países' | t"
                         [placeholder]="'Ej. Francia, Portugal…' | t" />
        </div>
      }

      <div class="alta__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="tr-dmax">{{ 'Distancia máxima del trayecto (km)' | t }}</label>
          <input id="tr-dmax" class="rs-inp" type="number" min="0" formControlName="distanciaMaximaKm" inputmode="numeric">
          <span class="rs-field-hint">{{ 'Vacío o 0 = sin límite. Por encima, el trayecto se ofrece como presupuesto.' | t }}</span>
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-puntos">{{ 'Origen y destino que puede introducir el cliente' | t }}</label>
          <select id="tr-puntos" class="rs-inp" formControlName="puntosTrayecto">
            @for (p of puntosTrayecto; track p) {
              <option [value]="p">{{ puntosTrayectoLabel(p) | t }}</option>
            }
          </select>
        </div>
      </div>

      <h3 class="alta__titulo">{{ 'Kilómetros facturables e ida y vuelta' | t }}</h3>
      <p class="alta__ayuda">
        {{ 'Doogking mostrará al cliente la distancia del trayecto y los kilómetros exactos usados para calcular el total.' | t }}
      </p>

      <div class="alta__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="tr-km">{{ 'Distancia utilizada para calcular el precio' | t }}</label>
          <select id="tr-km" class="rs-inp" formControlName="baseKilometraje">
            @for (b of basesKilometraje; track b) {
              <option [value]="b">{{ baseKilometrajeLabel(b) | t }}</option>
            }
          </select>
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-iv">{{ 'Tipo de ida y vuelta' | t }}</label>
          <select id="tr-iv" class="rs-inp" formControlName="tipoIdaVuelta">
            @for (t of tiposIdaVuelta; track t) {
              <option [value]="t">{{ tipoIdaVueltaLabel(t) | t }}</option>
            }
          </select>
        </div>
      </div>

      <div class="alta__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="tr-paradas">{{ 'Paradas intermedias' | t }}</label>
          <select id="tr-paradas" class="rs-inp" formControlName="politicaParadas">
            @for (p of politicasParadas; track p) {
              <option [value]="p">{{ politicaParadasLabel(p) | t }}</option>
            }
          </select>
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-espera">{{ 'Tiempo de espera incluido (minutos)' | t }}</label>
          <input id="tr-espera" class="rs-inp" type="number" min="0" step="5"
                 formControlName="esperaIncluidaMin" inputmode="numeric">
        </div>
      </div>

      <div class="rs-field">
        <label class="rs-lbl" for="tr-peajes">{{ 'Peajes, ferry y aparcamiento' | t }}</label>
        <select id="tr-peajes" class="rs-inp" formControlName="politicaPeajes">
          @for (p of politicasPeajes; track p) {
            <option [value]="p">{{ politicaPeajesLabel(p) | t }}</option>
          }
        </select>
      </div>
    </section>
  }

  <!-- ── 3 · PRECIO ─────────────────────────────────────────────────── -->
  @if (pasoActivo() === 3) {
    <section class="alta__seccion" data-testid="paso-precio">
      <h3 class="alta__titulo">{{ 'Reglas de tarifa' | t }}</h3>
      <p class="alta__ayuda">
        {{ 'Se aplica la primera regla que coincide con la zona, la distancia y el trayecto. Ejemplo: 25 € en Castellón, 0,85 €/km en la provincia y 95 € para el aeropuerto de Valencia.' | t }}
      </p>

      <div class="rs-field">
        <label class="rs-lbl" for="tr-redondeo">{{ 'Redondeo de distancia' | t }}</label>
        <select id="tr-redondeo" class="rs-inp" formControlName="redondeoDistancia">
          @for (r of redondeos; track r) {
            <option [value]="r">{{ redondeoLabel(r) | t }}</option>
          }
        </select>
        <span class="rs-field-hint">{{ 'El mapa calcula la ruta: no tendrás que escribir los kilómetros de cada reserva.' | t }}</span>
      </div>

      <div formArrayName="reglasTarifa" class="alta__reglas">
        @for (regla of reglas.controls; track $index; let i = $index; let primera = $first; let ultima = $last) {
          <div [formGroupName]="i" class="regla" [attr.data-testid]="'regla-' + i">
            <div class="regla__cab">
              <span class="regla__orden">{{ i + 1 }}</span>
              <input class="rs-inp regla__nombre" formControlName="nombre"
                     [placeholder]="'Nombre de la regla' | t" [attr.aria-label]="'Nombre de la regla' | t">
              <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" [disabled]="primera"
                      (click)="subirRegla(i)" [attr.aria-label]="'Subir la regla' | t">
                <rs-icon name="chevron-down" [size]="13" [stroke]="2.5" class="regla__subir" />
              </button>
              <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" [disabled]="ultima"
                      (click)="bajarRegla(i)" [attr.aria-label]="'Bajar la regla' | t">
                <rs-icon name="chevron-down" [size]="13" [stroke]="2.5" />
              </button>
              <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                      (click)="quitarRegla(i)" [attr.aria-label]="'Quitar la regla' | t">
                <rs-icon name="x" [size]="13" [stroke]="2" />
              </button>
            </div>

            <div class="alta__fila">
              <div class="rs-field">
                <label class="rs-lbl">{{ 'Cómo calculas este servicio' | t }}</label>
                <select class="rs-inp" formControlName="modelo">
                  @for (m of modelos; track m) {
                    <option [value]="m">{{ modeloLabel(m) | t }}</option>
                  }
                </select>
              </div>
              <div class="rs-field">
                <label class="rs-lbl">{{ 'Unidad de cobro' | t }}</label>
                <select class="rs-inp" formControlName="unidadCobro">
                  @for (u of unidades; track u) {
                    <option [value]="u">{{ unidadLabel(u) | t }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Cada modelo enseña solo sus campos: un precio por zona no tiene
                 tramos, y una ruta fija no tiene precio por kilómetro. -->
            @switch (regla.get('modelo')?.value) {
              @case ('fijo') {
                <div class="alta__fila">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Precio solo ida (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioIda" inputmode="decimal">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Precio ida y vuelta (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioIdaVuelta" inputmode="decimal">
                    <span class="rs-field-hint">{{ 'Vacío = el doble de la ida.' | t }}</span>
                  </div>
                </div>
              }
              @case ('zona') {
                <div class="rs-field">
                  <span class="rs-lbl">{{ 'Municipios o códigos postales de la zona' | t }}</span>
                  <rs-tags-input formControlName="zonas" [etiqueta]="'Zona' | t"
                                 [placeholder]="'Ej. Castellón ciudad' | t" />
                </div>
                <div class="alta__fila">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Precio solo ida (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioIda" inputmode="decimal">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Precio ida y vuelta (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioIdaVuelta" inputmode="decimal">
                  </div>
                </div>
              }
              @case ('km') {
                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Precio por km (€)' | t }}</label>
                  <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioKm" inputmode="decimal">
                </div>
              }
              @case ('base_mas_km') {
                <div class="alta__fila">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Tarifa de salida (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="tarifaSalida" inputmode="decimal">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Precio por km (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioKm" inputmode="decimal">
                  </div>
                </div>
              }
              @case ('tramos') {
                <div formArrayName="tramos" class="alta__tramos">
                  <div class="tramo tramo--cab" aria-hidden="true">
                    <span>{{ 'Desde' | t }}</span><span>{{ 'Hasta' | t }}</span><span>{{ '€/km' | t }}</span><span></span>
                  </div>
                  @for (t of tramosDe(i).controls; track $index; let j = $index) {
                    <div class="tramo" [formGroupName]="j">
                      <input class="rs-inp" type="number" min="0" formControlName="desdeKm"
                             [attr.aria-label]="'Desde (km)' | t" inputmode="numeric">
                      <input class="rs-inp" type="number" min="0" formControlName="hastaKm"
                             [attr.aria-label]="'Hasta (km)' | t" [placeholder]="'Sin límite' | t" inputmode="numeric">
                      <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioKm"
                             [attr.aria-label]="'Precio por km' | t" inputmode="decimal">
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                              (click)="quitarTramo(i, j)" [attr.aria-label]="'Quitar el tramo' | t">
                        <rs-icon name="x" [size]="13" [stroke]="2" />
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="anadirTramo(i)">
                  <rs-icon name="plus" [size]="14" [stroke]="2" /> {{ 'Añadir tramo' | t }}
                </button>
              }
              @case ('hora') {
                <div class="alta__fila">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Precio por hora (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioHora" inputmode="decimal">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Duración mínima (horas)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.5" formControlName="duracionMinimaHoras" inputmode="decimal">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Fracción adicional (minutos)' | t }}</label>
                    <input class="rs-inp" type="number" min="1" step="5" formControlName="fraccionMinutos" inputmode="numeric">
                  </div>
                </div>
              }
              @case ('ruta_fija') {
                <div class="alta__fila">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Origen' | t }}</label>
                    <input class="rs-inp" formControlName="rutaOrigen" [placeholder]="'Ej. Madrid' | t">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Destino' | t }}</label>
                    <input class="rs-inp" formControlName="rutaDestino" [placeholder]="'Ej. Barcelona' | t">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Precio (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioRuta" inputmode="decimal">
                  </div>
                </div>
              }
              @case ('presupuesto') {
                <p class="alta__nota">
                  {{ 'Los trayectos que lleguen a esta regla no mostrarán precio: el cliente pedirá presupuesto y tú responderás con un importe.' | t }}
                </p>
              }
            }

            @if (regla.get('modelo')?.value !== 'presupuesto') {
              <div class="alta__fila">
                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Importe mínimo (€)' | t }}</label>
                  <input class="rs-inp" type="number" min="0" step="0.01" formControlName="importeMinimo" inputmode="decimal">
                </div>
                @if (regla.get('modelo')?.value === 'fijo' || regla.get('modelo')?.value === 'zona') {
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Mascotas incluidas' | t }}</label>
                    <input class="rs-inp" type="number" min="1" formControlName="mascotasIncluidas" inputmode="numeric">
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      @if (!reglas.length) {
        <p class="alta__aviso" data-testid="sin-reglas">
          {{ 'Todavía no has añadido ninguna regla de tarifa: sin al menos una, el servicio no puede publicarse.' | t }}
        </p>
      }

      <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="anadirRegla()"
              data-testid="anadir-regla">
        <rs-icon name="plus" [size]="14" [stroke]="2" /> {{ 'Añadir regla de tarifa' | t }}
      </button>

      <h3 class="alta__titulo">{{ 'Extras y suplementos' | t }}</h3>
      <p class="alta__ayuda">
        {{ 'Marca lo que cobras aparte. Los automáticos se suman solos cuando toca; los demás, solo si el cliente los pide.' | t }}
      </p>

      <div class="alta__checks">
        @for (s of catalogoSuplementos; track s.valor) {
          <label class="rs-checkbox">
            <input type="checkbox" [checked]="tieneSuplemento(s.valor)"
                   (change)="alternarSuplemento(s.valor)"
                   [attr.data-testid]="'suplemento-' + s.valor"> {{ s.etiqueta | t }}
          </label>
        }
      </div>

      <div formArrayName="suplementos" class="alta__suplementos">
        @for (s of suplementos.controls; track $index; let i = $index) {
          <div [formGroupName]="i" class="suplemento">
            <strong class="suplemento__nombre">{{ s.get('nombre')?.value }}</strong>
            <div class="alta__fila">
              <div class="rs-field">
                <label class="rs-lbl">{{ 'Forma de cálculo' | t }}</label>
                <select class="rs-inp" formControlName="forma">
                  @for (f of formasCalculo; track f) {
                    <option [value]="f">{{ formaCalculoLabel(f) | t }}</option>
                  }
                </select>
              </div>
              <div class="rs-field">
                <label class="rs-lbl">{{ 'Importe' | t }}</label>
                <input class="rs-inp" type="number" min="0" step="0.01" formControlName="importe" inputmode="decimal">
              </div>
              <div class="rs-field">
                <label class="rs-lbl">{{ 'Se aplica' | t }}</label>
                <select class="rs-inp" formControlName="aplicacion">
                  @for (a of aplicaciones; track a) {
                    <option [value]="a">{{ aplicacionLabel(a) | t }}</option>
                  }
                </select>
              </div>
            </div>
          </div>
        }
      </div>

      @if (usaPresupuesto()) {
        <h3 class="alta__titulo">{{ 'Presupuesto personalizado' | t }}</h3>
        <div class="alta__fila">
          <div class="rs-field">
            <label class="rs-lbl" for="tr-orientativo">{{ 'Precio orientativo' | t }}</label>
            <select id="tr-orientativo" class="rs-inp" formControlName="precioOrientativo">
              @for (p of preciosOrientativos; track p) {
                <option [value]="p">{{ precioOrientativoLabel(p) | t }}</option>
              }
            </select>
          </div>
          <div class="rs-field">
            <label class="rs-lbl" for="tr-respuesta">{{ 'Tiempo máximo para responder (horas)' | t }}</label>
            <input id="tr-respuesta" class="rs-inp" type="number" min="1"
                   formControlName="horasRespuestaPresupuesto" inputmode="numeric">
          </div>
          <div class="rs-field">
            <label class="rs-lbl" for="tr-validez">{{ 'Validez del presupuesto (horas)' | t }}</label>
            <input id="tr-validez" class="rs-inp" type="number" min="1"
                   formControlName="validezPresupuestoHoras" inputmode="numeric">
          </div>
        </div>
      }
    </section>
  }

  <!-- ── 4 · MASCOTAS Y VEHÍCULO ────────────────────────────────────── -->
  @if (pasoActivo() === 4) {
    <section class="alta__seccion" data-testid="paso-mascotas">
      <h3 class="alta__titulo">{{ 'Mascotas admitidas' | t }}</h3>

      <div class="rs-field">
        <span class="rs-lbl">{{ 'Especies admitidas' | t }}</span>
        <div class="alta__checks">
          @for (e of especies; track e.valor) {
            <label class="rs-checkbox">
              <input type="checkbox" [checked]="tiene('especiesAdmitidas', e.valor)"
                     (change)="alternar('especiesAdmitidas', e.valor)"> {{ e.etiqueta | t }}
            </label>
          }
        </div>
      </div>

      <div class="rs-field">
        <span class="rs-lbl">{{ 'Tamaños admitidos' | t }}</span>
        <div class="alta__checks">
          @for (t of tamanos; track t.valor) {
            <label class="rs-checkbox">
              <input type="checkbox" [checked]="tiene('tamanosAdmitidos', t.valor)"
                     (change)="alternar('tamanosAdmitidos', t.valor)"> {{ t.etiqueta | t }}
            </label>
          }
        </div>
        <span class="rs-field-hint">{{ 'Sin marcar ninguno se entiende que admites todos.' | t }}</span>
      </div>

      <div class="alta__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="tr-max">{{ 'Máximo de mascotas por reserva' | t }}</label>
          <input id="tr-max" class="rs-inp" type="number" min="1" formControlName="maxMascotasPorReserva" inputmode="numeric">
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-compartido">{{ 'Transporte compartido' | t }}</label>
          <select id="tr-compartido" class="rs-inp" formControlName="compartido">
            @for (c of compartidos; track c) {
              <option [value]="c">{{ compartidoLabel(c) | t }}</option>
            }
          </select>
        </div>
      </div>

      <div class="rs-field">
        <span class="rs-lbl">{{ 'Situaciones que requieren confirmación' | t }}</span>
        <p class="alta__ayuda">
          {{ 'No bloquean la reserva: la dejan pendiente de que la aceptes tú.' | t }}
        </p>
        <div class="alta__checks">
          @for (s of situaciones; track s.valor) {
            <label class="rs-checkbox">
              <input type="checkbox" [checked]="tiene('situacionesConfirmacion', s.valor)"
                     (change)="alternar('situacionesConfirmacion', s.valor)"> {{ s.etiqueta | t }}
            </label>
          }
        </div>
      </div>

      <h3 class="alta__titulo">{{ 'Acompañantes y vehículo' | t }}</h3>

      <div class="alta__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="tr-plazas">{{ 'Plazas para personas' | t }}</label>
          <input id="tr-plazas" class="rs-inp" type="number" min="0" formControlName="plazasAcompanantes" inputmode="numeric">
        </div>
        @if (admiteAcompanantes()) {
          <div class="rs-field">
            <label class="rs-lbl" for="tr-precio-acomp">{{ 'Precio del acompañante' | t }}</label>
            <select id="tr-precio-acomp" class="rs-inp" formControlName="precioAcompanante">
              @for (p of preciosAcompanante; track p) {
                <option [value]="p">{{ precioAcompananteLabel(p) | t }}</option>
              }
            </select>
          </div>
        }
      </div>

      @if (admiteAcompanantes()) {
        <div class="rs-field">
          <span class="rs-lbl">{{ 'Equipaje admitido' | t }}</span>
          <div class="alta__checks">
            @for (e of equipajes; track e.valor) {
              <label class="rs-checkbox">
                <input type="checkbox" [checked]="tiene('equipajeAdmitido', e.valor)"
                       (change)="alternar('equipajeAdmitido', e.valor)"> {{ e.etiqueta | t }}
              </label>
            }
          </div>
        </div>
      }

      <div class="rs-field">
        <span class="rs-lbl">{{ 'Vehículo y equipamiento' | t }}</span>
        <div class="alta__checks">
          @for (e of equipamientos; track e.valor) {
            <label class="rs-checkbox">
              <input type="checkbox" [checked]="tiene('equipamientoVehiculo', e.valor)"
                     (change)="alternar('equipamientoVehiculo', e.valor)"> {{ e.etiqueta | t }}
            </label>
          }
        </div>
      </div>

      <h3 class="alta__titulo">{{ 'Documentación de la mascota' | t }}</h3>
      <p class="alta__ayuda">
        {{ 'El cliente no podrá confirmar mientras falte un requisito marcado como obligatorio.' | t }}
      </p>

      <div class="alta__requisitos" formArrayName="requisitosDocumentales">
        @for (r of catalogoRequisitos; track r.valor) {
          <div class="requisito">
            <label class="rs-checkbox">
              <input type="checkbox" [checked]="tieneRequisito(r.valor)"
                     (change)="alternarRequisito(r.valor)"
                     [attr.data-testid]="'requisito-' + r.valor"> {{ r.etiqueta | t }}
            </label>
            @if (indiceRequisito(r.valor) >= 0) {
              <div [formGroupName]="indiceRequisito(r.valor)" class="requisito__cuando">
                <select class="rs-inp rs-inp--sm" formControlName="exigencia"
                        [attr.aria-label]="'Cuándo se exige' | t">
                  @for (e of exigencias; track e) {
                    <option [value]="e">{{ exigenciaLabel(e) | t }}</option>
                  }
                </select>
              </div>
            }
          </div>
        }
      </div>
    </section>
  }

  <!-- ── 5 · DISPONIBILIDAD ─────────────────────────────────────────── -->
  @if (pasoActivo() === 5) {
    <section class="alta__seccion" data-testid="paso-disponibilidad">
      <h3 class="alta__titulo">{{ 'Disponibilidad y confirmación' | t }}</h3>

      <div class="alta__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="tr-modo">{{ 'Cómo gestionas la disponibilidad' | t }}</label>
          <select id="tr-modo" class="rs-inp" formControlName="modoDisponibilidad">
            @for (m of modosDisponibilidad; track m) {
              <option [value]="m">{{ modoDisponibilidadLabel(m) | t }}</option>
            }
          </select>
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-antelacion">{{ 'Antelación mínima (horas)' | t }}</label>
          <input id="tr-antelacion" class="rs-inp" type="number" min="0"
                 formControlName="antelacionMinimaHoras" inputmode="numeric">
        </div>
      </div>

      <div class="alta__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="tr-ventana">{{ 'Hora de recogida' | t }}</label>
          <select id="tr-ventana" class="rs-inp" formControlName="ventanaRecogida">
            @for (v of ventanas; track v) {
              <option [value]="v">{{ ventanaLabel(v) | t }}</option>
            }
          </select>
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-confirmacion">{{ 'Confirmación de la reserva (horas)' | t }}</label>
          <input id="tr-confirmacion" class="rs-inp" type="number" min="0"
                 formControlName="confirmacionHoras" inputmode="numeric">
          <span class="rs-field-hint">{{ '0 = confirmación inmediata.' | t }}</span>
        </div>
      </div>

      @if (ofreceRecurrente()) {
        <h3 class="alta__titulo">{{ 'Servicio recurrente' | t }}</h3>
        <div class="rs-field">
          <span class="rs-lbl">{{ 'Frecuencias que aceptas' | t }}</span>
          <div class="alta__checks">
            @for (f of frecuencias; track f) {
              <label class="rs-checkbox">
                <input type="checkbox" [checked]="tiene('frecuenciasRecurrencia', f)"
                       (change)="alternar('frecuenciasRecurrencia', f)"> {{ frecuenciaLabel(f) | t }}
              </label>
            }
          </div>
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-periodo">{{ 'Periodo máximo (semanas)' | t }}</label>
          <input id="tr-periodo" class="rs-inp" type="number" min="1"
                 formControlName="periodoMaximoSemanas" inputmode="numeric">
        </div>
      }

      @if (ofreceUrgente()) {
        <h3 class="alta__titulo">{{ 'Servicio urgente' | t }}</h3>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-urgente">{{ 'Tiempo de respuesta (horas)' | t }}</label>
          <input id="tr-urgente" class="rs-inp" type="number" min="0" step="0.5"
                 formControlName="respuestaUrgenteHoras" inputmode="decimal">
          <span class="rs-field-hint">{{ 'El recargo por urgencia se configura como suplemento, en el paso de precio.' | t }}</span>
        </div>
      }

      @if (ofreceRutaProgramada()) {
        <h3 class="alta__titulo">{{ 'Salidas programadas' | t }}</h3>
        <div formArrayName="salidas" class="alta__salidas">
          @for (s of salidas.controls; track $index; let i = $index) {
            <div [formGroupName]="i" class="salida">
              <div class="alta__fila">
                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Fecha y hora de salida' | t }}</label>
                  <input class="rs-inp" type="datetime-local" formControlName="fechaSalida">
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Plazas totales' | t }}</label>
                  <input class="rs-inp" type="number" min="1" formControlName="plazasTotales" inputmode="numeric">
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Cierre de reservas (horas antes)' | t }}</label>
                  <input class="rs-inp" type="number" min="0" formControlName="cierreHoras" inputmode="numeric">
                </div>
              </div>
              <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarSalida(i)">
                <rs-icon name="x" [size]="13" [stroke]="2" /> {{ 'Quitar salida' | t }}
              </button>
            </div>
          }
        </div>
        <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="anadirSalida()">
          <rs-icon name="plus" [size]="14" [stroke]="2" /> {{ 'Añadir salida' | t }}
        </button>
      }
    </section>
  }

  <!-- ── 6 · CONDICIONES, SIMULACIÓN Y PUBLICACIÓN ──────────────────── -->
  @if (pasoActivo() === 6) {
    <section class="alta__seccion" data-testid="paso-publicar">
      <h3 class="alta__titulo">{{ 'Condiciones de reserva' | t }}</h3>

      <div class="alta__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="tr-cancelacion">{{ 'Política de cancelación' | t }}</label>
          <select id="tr-cancelacion" class="rs-inp" formControlName="politicaCancelacionTransporte">
            @for (p of politicasCancelacion; track p) {
              <option [value]="p">{{ politicaCancelacionLabel(p) | t }}</option>
            }
          </select>
          <span class="rs-field-hint">{{ textoCancelacion() | t }}</span>
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-cortesia">{{ 'Tiempo de cortesía (minutos)' | t }}</label>
          <input id="tr-cortesia" class="rs-inp" type="number" min="0" step="5"
                 formControlName="cortesiaMinutos" inputmode="numeric">
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="tr-noshow">{{ 'Si el cliente no se presenta' | t }}</label>
          <select id="tr-noshow" class="rs-inp" formControlName="accionNoShow">
            @for (a of accionesNoShow; track a) {
              <option [value]="a">{{ accionNoShowLabel(a) | t }}</option>
            }
          </select>
        </div>
      </div>

      <div class="alta__obligatorias">
        <h4>{{ 'Reglas que aplica Doogking en todos los transportes' | t }}</h4>
        <ul>
          <li>{{ 'Si cancelas tú, el cliente recibe la devolución completa.' | t }}</li>
          <li>{{ 'Cualquier coste adicional requiere que el cliente lo acepte antes.' | t }}</li>
          <li>{{ 'Si la entrega resulta imposible, se activa el protocolo de contingencia.' | t }}</li>
          <li>{{ 'Si la mascota no es apta, hay que registrar el motivo y la decisión.' | t }}</li>
        </ul>
      </div>

      <h3 class="alta__titulo">{{ 'Simulación de precio' | t }}</h3>
      <p class="alta__ayuda">
        {{ 'Comprueba con un trayecto de ejemplo lo que pagaría un cliente. Es el mismo cálculo que se cobrará.' | t }}
      </p>

      <div class="alta__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="sim-origen">{{ 'Origen' | t }}</label>
          <input id="sim-origen" class="rs-inp" [value]="simOrigen()"
                 (input)="simOrigen.set($any($event.target).value)" [placeholder]="'Ej. Castellón' | t">
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="sim-destino">{{ 'Destino' | t }}</label>
          <input id="sim-destino" class="rs-inp" [value]="simDestino()"
                 (input)="simDestino.set($any($event.target).value)" [placeholder]="'Ej. Valencia' | t">
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="sim-km">{{ 'Distancia (km)' | t }}</label>
          <input id="sim-km" class="rs-inp" type="number" min="1" [value]="simKm()"
                 (input)="simKm.set(+$any($event.target).value)" inputmode="numeric">
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="sim-mascotas">{{ 'Mascotas' | t }}</label>
          <input id="sim-mascotas" class="rs-inp" type="number" min="1" [value]="simMascotas()"
                 (input)="simMascotas.set(+$any($event.target).value)" inputmode="numeric">
        </div>
      </div>

      <div class="alta__checks">
        <label class="rs-checkbox">
          <input type="checkbox" [checked]="simIdaVuelta()" (change)="simIdaVuelta.set(!simIdaVuelta())">
          {{ 'Ida y vuelta' | t }}
        </label>
        <label class="rs-checkbox">
          <input type="checkbox" [checked]="simNocturno()" (change)="simNocturno.set(!simNocturno())">
          {{ 'Horario nocturno' | t }}
        </label>
        <label class="rs-checkbox">
          <input type="checkbox" [checked]="simUrgente()" (change)="simUrgente.set(!simUrgente())">
          {{ 'Urgente' | t }}
        </label>
      </div>

      <div class="simulacion" data-testid="simulacion">
        @if (simulacion(); as s) {
          @if (s.requierePresupuesto) {
            <p class="simulacion__presupuesto">
              <rs-icon name="alert-circle" [size]="16" [stroke]="2" />
              {{ 'Este trayecto saldría por presupuesto:' | t }} {{ s.motivoPresupuesto ?? '' | t }}
            </p>
          } @else {
            <dl class="simulacion__lineas">
              <div><dt>{{ 'Distancia del trayecto' | t }}</dt><dd>{{ s.distanciaKm }} km</dd></div>
              <div><dt>{{ 'Kilómetros facturables' | t }}</dt><dd>{{ s.kmFacturables }} km</dd></div>
              @for (l of s.lineas; track l.concepto) {
                <div><dt>{{ l.concepto | t }}</dt><dd>{{ l.importe | euros }}</dd></div>
              }
              <div class="simulacion__total">
                <dt>{{ 'Total' | t }}</dt><dd data-testid="simulacion-total">{{ s.total | euros }}</dd>
              </div>
            </dl>
          }
        }
      </div>

      <h3 class="alta__titulo">{{ 'Comprobaciones antes de publicar' | t }}</h3>
      <ul class="alta__checklist" data-testid="checklist">
        @for (c of comprobaciones(); track c.clave) {
          <li [class.is-ok]="c.cumplida">
            <rs-icon [name]="c.cumplida ? 'check' : 'x'" [size]="14" [stroke]="2.5" />
            {{ c.etiqueta | t }}
          </li>
        }
      </ul>
      @if (!puedePublicar()) {
        <p class="alta__aviso">
          {{ 'Puedes guardar el borrador, pero el servicio no se publicará hasta completar lo que falta.' | t }}
        </p>
      }
    </section>
  }

  <nav class="alta__nav">
    <button type="button" class="rs-btn rs-btn--outline rs-btn--sm"
            [disabled]="pasoActivo() === 1" (click)="irAPaso(pasoActivo() - 1)">
      {{ 'Anterior' | t }}
    </button>
    <button type="button" class="rs-btn rs-btn--secondary rs-btn--sm"
            [disabled]="pasoActivo() === pasos.length" (click)="irAPaso(pasoActivo() + 1)"
            data-testid="siguiente-paso">
      {{ 'Siguiente' | t }}
    </button>
  </nav>
</div>
  `,
  styles: [`
    .alta { display: flex; flex-direction: column; gap: var(--sp-5); }

    /* ── Guía de pasos ───────────────────────────────────────────── */
    .alta__pasos {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--sp-2);
      list-style: none; margin: 0; padding: 0;
    }
    @media (max-width: 900px) { .alta__pasos { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 520px) { .alta__pasos { grid-template-columns: repeat(2, 1fr); } }

    .alta__paso-btn {
      width: 100%; display: flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-card); color: var(--t-300);
      font: var(--w-5) var(--f-sm) var(--font); text-align: start; cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);
    }
    .alta__paso.is-on .alta__paso-btn {
      border-color: var(--c-accent); background: var(--c-accent-lo); color: var(--t-100);
    }
    .alta__paso-num {
      flex: none; display: grid; place-items: center;
      width: 22px; height: 22px; border-radius: var(--r-full);
      background: var(--c-surface); color: var(--t-300);
      font: var(--w-7) var(--f-xs) var(--font);
    }
    .alta__paso.is-on .alta__paso-num { background: var(--c-accent); color: #fff; }
    .alta__paso-txt { display: flex; flex-direction: column; min-width: 0; }
    .alta__paso-txt small { color: var(--t-400); font-size: var(--f-xs); }
    @media (max-width: 1100px) { .alta__paso-txt small { display: none; } }

    /* ── Secciones ───────────────────────────────────────────────── */
    .alta__seccion { display: flex; flex-direction: column; gap: var(--sp-4); }
    .alta__titulo {
      margin: var(--sp-2) 0 0;
      font: var(--w-7) var(--f-lg) var(--font-display); color: var(--t-100);
    }
    .alta__ayuda { margin: 0; color: var(--t-400); font-size: var(--f-sm); }
    .alta__nota {
      margin: 0; padding: var(--sp-3);
      border-radius: var(--r-md); background: var(--c-accent-lo);
      color: var(--t-200); font-size: var(--f-sm);
    }
    .alta__aviso {
      margin: 0; padding: var(--sp-3);
      border-radius: var(--r-md); background: var(--c-warning-lo);
      color: var(--c-warning); font-size: var(--f-sm);
    }

    .alta__fila {
      display: grid; gap: var(--sp-3);
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    .alta__checks { display: flex; flex-wrap: wrap; gap: var(--sp-2) var(--sp-4); }

    /* ── Plantillas ──────────────────────────────────────────────── */
    .alta__plantillas {
      display: grid; gap: var(--sp-3);
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }
    .plantilla {
      display: flex; flex-direction: column; gap: var(--sp-1);
      padding: var(--sp-4);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-card); text-align: start; cursor: pointer;
      transition: border-color var(--d-2), box-shadow var(--d-2);
    }
    .plantilla:hover { border-color: var(--b-a); }
    .plantilla.is-on {
      border-color: var(--c-accent); box-shadow: 0 0 0 1px var(--c-accent) inset;
      background: var(--c-accent-lo);
    }
    .plantilla strong { font: var(--w-7) var(--f-base) var(--font); color: var(--t-100); }
    .plantilla small { color: var(--t-400); font-size: var(--f-sm); }

    /* ── Reglas de tarifa ────────────────────────────────────────── */
    .alta__reglas { display: flex; flex-direction: column; gap: var(--sp-3); }
    .regla {
      display: flex; flex-direction: column; gap: var(--sp-3);
      padding: var(--sp-4);
      border: 1px solid var(--b-1); border-radius: var(--r-lg); background: var(--c-card);
    }
    .regla__cab { display: flex; align-items: center; gap: var(--sp-2); }
    .regla__orden {
      flex: none; display: grid; place-items: center;
      width: 24px; height: 24px; border-radius: var(--r-full);
      background: var(--c-accent); color: #fff;
      font: var(--w-7) var(--f-xs) var(--font);
    }
    .regla__nombre { flex: 1; min-width: 0; }
    /* La flecha de "subir" es la de bajar del revés: un icono, dos usos. */
    .regla__subir, .parada__subir { transform: rotate(180deg); }

    .alta__tramos { display: flex; flex-direction: column; gap: var(--sp-2); }
    .tramo {
      display: grid; gap: var(--sp-2);
      grid-template-columns: 1fr 1fr 1fr auto; align-items: center;
    }
    .tramo--cab {
      color: var(--t-400); font: var(--w-6) var(--f-xs) var(--font);
      text-transform: uppercase; letter-spacing: .04em;
    }

    .alta__suplementos { display: flex; flex-direction: column; gap: var(--sp-3); }
    .suplemento {
      display: flex; flex-direction: column; gap: var(--sp-2);
      padding: var(--sp-3);
      border: 1px solid var(--b-1); border-radius: var(--r-md); background: var(--c-raised);
    }
    .suplemento__nombre { font: var(--w-6) var(--f-base) var(--font); color: var(--t-100); }

    /* ── Requisitos ──────────────────────────────────────────────── */
    .alta__requisitos { display: flex; flex-direction: column; gap: var(--sp-2); }
    .requisito {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-3); padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--b-1); border-radius: var(--r-md); background: var(--c-card);
    }
    .requisito__cuando { flex: none; min-width: 200px; }
    @media (max-width: 640px) {
      .requisito { flex-direction: column; align-items: stretch; }
      .requisito__cuando { min-width: 0; }
    }

    .alta__salidas { display: flex; flex-direction: column; gap: var(--sp-3); }
    .salida {
      display: flex; flex-direction: column; gap: var(--sp-2);
      padding: var(--sp-3);
      border: 1px solid var(--b-1); border-radius: var(--r-md); background: var(--c-card);
    }

    /* ── Condiciones y simulación ────────────────────────────────── */
    .alta__obligatorias {
      padding: var(--sp-4);
      border-radius: var(--r-lg); background: var(--c-raised);
    }
    .alta__obligatorias h4 {
      margin: 0 0 var(--sp-2);
      font: var(--w-7) var(--f-base) var(--font); color: var(--t-100);
    }
    .alta__obligatorias ul { margin: 0; padding-inline-start: var(--sp-5); color: var(--t-300); font-size: var(--f-sm); }
    .alta__obligatorias li + li { margin-top: var(--sp-1); }

    .simulacion {
      padding: var(--sp-4);
      border: 1px solid var(--b-1); border-radius: var(--r-lg); background: var(--c-card);
    }
    .simulacion__lineas { margin: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
    .simulacion__lineas > div { display: flex; justify-content: space-between; gap: var(--sp-4); }
    .simulacion__lineas dt { color: var(--t-300); font-size: var(--f-sm); }
    .simulacion__lineas dd { margin: 0; color: var(--t-100); font: var(--w-6) var(--f-sm) var(--font); }
    .simulacion__total {
      padding-top: var(--sp-2); border-top: 1px solid var(--b-1);
    }
    .simulacion__total dt, .simulacion__total dd {
      font: var(--w-7) var(--f-lg) var(--font-display); color: var(--t-100);
    }
    .simulacion__presupuesto {
      display: flex; align-items: center; gap: var(--sp-2);
      margin: 0; color: var(--c-warning); font-size: var(--f-sm);
    }

    .alta__checklist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
    .alta__checklist li {
      display: flex; align-items: center; gap: var(--sp-2);
      color: var(--c-error); font-size: var(--f-sm);
    }
    .alta__checklist li.is-ok { color: var(--c-success); }

    .alta__nav { display: flex; justify-content: space-between; gap: var(--sp-3); }
  `],
})
export class AltaTransporteComponent implements OnInit {
  /** El grupo `transporte` del formulario del listado; no se crea aquí. */
  @Input({ required: true }) grupo!: FormGroup;

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    /*
     * Un `FormGroup` no es una señal: sin escuchar sus cambios, la simulación y
     * la lista de comprobaciones se quedaban con el primer valor. La empresa
     * escribía un precio y el total simulado seguía marcando el anterior, que
     * es peor que no enseñar ninguno.
     */
    this.grupo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tocado());
  }

  readonly pasos = PASOS_ALTA_TRANSPORTE;
  readonly pasoActivo = signal(1);

  // Catálogos y etiquetas. Se exponen como propiedades y no se leen del enum en
  // la plantilla porque Angular no puede indexar un enum desde el template.
  readonly plantillas = Object.values(PlantillaTransporte);
  readonly quienViajaOpciones = Object.values(QuienViaja);
  readonly tiposTrayecto = Object.values(TipoTrayecto);
  readonly ambitos = Object.values(AmbitoTransporte);
  readonly tiposRecogida = Object.values(TipoRecogida);
  readonly finalidades = Object.values(FinalidadTransporte);
  readonly modosCobertura = Object.values(ModoCobertura);
  readonly puntosTrayecto = Object.values(PuntosTrayecto);
  readonly basesKilometraje = Object.values(BaseKilometraje);
  readonly tiposIdaVuelta = Object.values(TipoIdaVuelta);
  readonly politicasParadas = Object.values(PoliticaParadas);
  readonly politicasPeajes = Object.values(PoliticaPeajes);
  readonly modelos = Object.values(ModeloPrecio);
  readonly unidades = Object.values(UnidadCobro);
  readonly redondeos = Object.values(RedondeoDistancia);
  readonly formasCalculo = Object.values(FormaCalculoSuplemento);
  readonly aplicaciones = Object.values(AplicacionSuplemento);
  readonly preciosOrientativos = Object.values(PrecioOrientativo);
  readonly compartidos = Object.values(CompartidoTransporte);
  readonly preciosAcompanante = Object.values(PrecioAcompanante);
  readonly exigencias = Object.values(ExigenciaRequisito);
  readonly modosDisponibilidad = Object.values(ModoDisponibilidadTransporte);
  readonly ventanas = Object.values(VentanaRecogida);
  readonly frecuencias = Object.values(FrecuenciaRecurrencia);
  readonly politicasCancelacion = Object.values(PoliticaCancelacionTransporte);
  readonly accionesNoShow = Object.values(AccionNoShow);

  readonly catalogoSuplementos = SUPLEMENTOS_TRANSPORTE;
  readonly catalogoRequisitos = REQUISITOS_DOCUMENTALES;
  readonly especies = ESPECIES_TRANSPORTE;
  readonly tamanos = TRAMOS_PESO_TRANSPORTE;
  readonly situaciones = SITUACIONES_CONFIRMACION;
  readonly equipamientos = EQUIPAMIENTO_VEHICULO;
  readonly equipajes = EQUIPAJE_TRANSPORTE;

  plantillaLabel(p: PlantillaTransporte): string { return PLANTILLA_TRANSPORTE_LABELS[p]; }
  plantillaDescripcion(p: PlantillaTransporte): string { return PLANTILLA_TRANSPORTE_DESCRIPCIONES[p]; }
  quienViajaLabel(q: QuienViaja): string { return QUIEN_VIAJA_LABELS[q]; }
  tipoTrayectoLabel(t: TipoTrayecto): string { return TIPO_TRAYECTO_LABELS[t]; }
  ambitoLabel(a: AmbitoTransporte): string { return AMBITO_TRANSPORTE_LABELS[a]; }
  tipoRecogidaLabel(r: TipoRecogida): string { return TIPO_RECOGIDA_LABELS[r]; }
  finalidadLabel(f: FinalidadTransporte): string { return FINALIDAD_TRANSPORTE_LABELS[f]; }
  modoCoberturaLabel(m: ModoCobertura): string { return MODO_COBERTURA_LABELS[m]; }
  puntosTrayectoLabel(p: PuntosTrayecto): string { return PUNTOS_TRAYECTO_LABELS[p]; }
  baseKilometrajeLabel(b: BaseKilometraje): string { return BASE_KILOMETRAJE_LABELS[b]; }
  tipoIdaVueltaLabel(t: TipoIdaVuelta): string { return TIPO_IDA_VUELTA_LABELS[t]; }
  politicaParadasLabel(p: PoliticaParadas): string { return POLITICA_PARADAS_LABELS[p]; }
  politicaPeajesLabel(p: PoliticaPeajes): string { return POLITICA_PEAJES_LABELS[p]; }
  modeloLabel(m: ModeloPrecio): string { return MODELO_PRECIO_LABELS[m]; }
  unidadLabel(u: UnidadCobro): string { return UNIDAD_COBRO_LABELS[u]; }
  redondeoLabel(r: RedondeoDistancia): string { return REDONDEO_DISTANCIA_LABELS[r]; }
  formaCalculoLabel(f: FormaCalculoSuplemento): string { return FORMA_CALCULO_SUPLEMENTO_LABELS[f]; }
  aplicacionLabel(a: AplicacionSuplemento): string { return APLICACION_SUPLEMENTO_LABELS[a]; }
  precioOrientativoLabel(p: PrecioOrientativo): string { return PRECIO_ORIENTATIVO_LABELS[p]; }
  compartidoLabel(c: CompartidoTransporte): string { return COMPARTIDO_TRANSPORTE_LABELS[c]; }
  precioAcompananteLabel(p: PrecioAcompanante): string { return PRECIO_ACOMPANANTE_LABELS[p]; }
  exigenciaLabel(e: ExigenciaRequisito): string { return EXIGENCIA_REQUISITO_LABELS[e]; }
  modoDisponibilidadLabel(m: ModoDisponibilidadTransporte): string { return MODO_DISPONIBILIDAD_TRANSPORTE_LABELS[m]; }
  ventanaLabel(v: VentanaRecogida): string { return VENTANA_RECOGIDA_LABELS[v]; }
  frecuenciaLabel(f: FrecuenciaRecurrencia): string { return FRECUENCIA_RECURRENCIA_LABELS[f]; }
  politicaCancelacionLabel(p: PoliticaCancelacionTransporte): string { return POLITICA_CANCELACION_TRANSPORTE_LABELS[p]; }
  accionNoShowLabel(a: AccionNoShow): string { return ACCION_NO_SHOW_LABELS[a]; }

  irAPaso(numero: number): void {
    if (numero >= 1 && numero <= this.pasos.length) this.pasoActivo.set(numero);
  }

  /** Marca de cambio del formulario; es lo que hace reaccionar a los `computed`. */
  private readonly revision = signal(0);
  private tocado(): void { this.revision.update((v) => v + 1); }

  get reglas(): FormArray<FormGroup> {
    return this.grupo.get('reglasTarifa') as FormArray<FormGroup>;
  }
  get suplementos(): FormArray<FormGroup> {
    return this.grupo.get('suplementos') as FormArray<FormGroup>;
  }
  get requisitos(): FormArray<FormGroup> {
    return this.grupo.get('requisitosDocumentales') as FormArray<FormGroup>;
  }
  get salidas(): FormArray<FormGroup> {
    return this.grupo.get('salidas') as FormArray<FormGroup>;
  }

  tramosDe(indice: number): FormArray<FormGroup> {
    return this.reglas.at(indice).get('tramos') as FormArray<FormGroup>;
  }

  // ── Listas de valores sueltos (checkboxes sobre un control de array) ──

  tiene(control: string, valor: string): boolean {
    return ((this.grupo.get(control)?.value as string[]) ?? []).includes(valor);
  }

  alternar(control: string, valor: string): void {
    const actual = (this.grupo.get(control)?.value as string[]) ?? [];
    const siguiente = actual.includes(valor)
      ? actual.filter((v) => v !== valor)
      : [...actual, valor];
    this.grupo.get(control)?.setValue(siguiente);
    this.grupo.get(control)?.markAsDirty();
    this.tocado();
  }

  /**
   * Elegir plantilla no es solo guardar un valor: arrastra la modalidad, quién
   * viaja y las plazas de acompañante. Quien elige «taxi pet-friendly» está
   * diciendo que viajan personas, y volver a preguntárselo campo a campo es
   * hacerle rellenar lo que ya ha dicho.
   */
  elegirPlantilla(plantilla: PlantillaTransporte): void {
    this.grupo.patchValue({ plantilla });

    if (plantilla === PlantillaTransporte.TAXI_PETFRIENDLY) {
      this.grupo.patchValue({ quienViaja: QuienViaja.MASCOTA_Y_RESPONSABLE });
      if (Number(this.grupo.get('plazasAcompanantes')?.value ?? 0) === 0) {
        this.grupo.patchValue({ plazasAcompanantes: 1 });
      }
    }
    if (plantilla === PlantillaTransporte.EXCLUSIVO) {
      this.grupo.patchValue({ compartido: CompartidoTransporte.MISMA_FAMILIA });
    }
    if (plantilla === PlantillaTransporte.COMPARTIDO) {
      this.grupo.patchValue({ compartido: CompartidoTransporte.DISTINTAS_SEPARADAS });
    }
    if (plantilla === PlantillaTransporte.RUTA_PROGRAMADA) {
      this.grupo.patchValue({ modoDisponibilidad: ModoDisponibilidadTransporte.SALIDAS_PROGRAMADAS });
    }
    if (plantilla === PlantillaTransporte.ESPECIAL) {
      this.grupo.patchValue({ modoCobertura: ModoCobertura.PRESUPUESTO });
    }
    this.grupo.markAsDirty();
    this.tocado();
  }

  // ── Reglas de tarifa ──────────────────────────────────────────────

  private nuevaReglaGroup(valores: Record<string, unknown> = {}): FormGroup {
    return this.fb.group({
      id: [valores['id'] ?? `r-${Date.now()}-${this.reglas?.length ?? 0}`],
      nombre: [valores['nombre'] ?? 'Tarifa general'],
      modelo: [valores['modelo'] ?? ModeloPrecio.BASE_MAS_KM],
      unidadCobro: [valores['unidadCobro'] ?? UnidadCobro.VEHICULO],
      zonas: [(valores['zonas'] as string[]) ?? []],
      precioIda: [valores['precioIda'] ?? 0],
      precioIdaVuelta: [valores['precioIdaVuelta'] ?? null],
      mascotasIncluidas: [valores['mascotasIncluidas'] ?? 1],
      precioKm: [valores['precioKm'] ?? 0],
      tarifaSalida: [valores['tarifaSalida'] ?? 0],
      tramos: this.fb.array(
        ((valores['tramos'] as Array<Record<string, unknown>>) ?? []).map((t) => this.nuevoTramoGroup(t)),
      ),
      precioHora: [valores['precioHora'] ?? 0],
      duracionMinimaHoras: [valores['duracionMinimaHoras'] ?? 1],
      fraccionMinutos: [valores['fraccionMinutos'] ?? 15],
      rutaOrigen: [valores['rutaOrigen'] ?? ''],
      rutaDestino: [valores['rutaDestino'] ?? ''],
      precioRuta: [valores['precioRuta'] ?? 0],
      importeMinimo: [valores['importeMinimo'] ?? 0],
    });
  }

  private nuevoTramoGroup(valores: Record<string, unknown> = {}): FormGroup {
    return this.fb.group({
      desdeKm: [valores['desdeKm'] ?? 0],
      hastaKm: [valores['hastaKm'] ?? null],
      precioKm: [valores['precioKm'] ?? 0],
    });
  }

  anadirRegla(): void {
    this.reglas.push(this.nuevaReglaGroup());
    this.grupo.markAsDirty();
    this.tocado();
  }

  quitarRegla(indice: number): void {
    this.reglas.removeAt(indice);
    this.grupo.markAsDirty();
    this.tocado();
  }

  /** El orden **es** el dato: mover una regla cambia lo que cobra la empresa. */
  subirRegla(indice: number): void { this.moverRegla(indice, indice - 1); }
  bajarRegla(indice: number): void { this.moverRegla(indice, indice + 1); }

  private moverRegla(desde: number, hasta: number): void {
    if (hasta < 0 || hasta >= this.reglas.length) return;
    const regla = this.reglas.at(desde);
    this.reglas.removeAt(desde);
    this.reglas.insert(hasta, regla);
    this.grupo.markAsDirty();
    this.tocado();
  }

  anadirTramo(indice: number): void {
    const tramos = this.tramosDe(indice);
    const ultimo = tramos.length ? Number(tramos.at(tramos.length - 1).get('hastaKm')?.value ?? 0) : 0;
    tramos.push(this.nuevoTramoGroup({ desdeKm: ultimo + 1, hastaKm: null }));
    this.grupo.markAsDirty();
    this.tocado();
  }

  quitarTramo(regla: number, tramo: number): void {
    this.tramosDe(regla).removeAt(tramo);
    this.grupo.markAsDirty();
    this.tocado();
  }

  // ── Suplementos ───────────────────────────────────────────────────

  private indiceSuplemento(clave: string): number {
    return this.suplementos.controls.findIndex((c) => c.get('clave')?.value === clave);
  }

  tieneSuplemento(clave: string): boolean { return this.indiceSuplemento(clave) >= 0; }

  alternarSuplemento(clave: string): void {
    const indice = this.indiceSuplemento(clave);
    if (indice >= 0) {
      this.suplementos.removeAt(indice);
    } else {
      const definicion = SUPLEMENTOS_TRANSPORTE.find((s) => s.valor === clave);
      if (!definicion) return;
      this.suplementos.push(this.fb.group({
        clave: [definicion.valor],
        nombre: [definicion.etiqueta],
        condicion: [definicion.condicion],
        forma: [definicion.formaSugerida],
        importe: [0],
        // Lo que no se dispara solo se pide: así el cliente no se encuentra un
        // cargo que no eligió ni la empresa deja de cobrar lo que sí avisó.
        aplicacion: [definicion.condicion === 'siempre'
          ? AplicacionSuplemento.A_PETICION
          : AplicacionSuplemento.AUTOMATICA],
      }));
    }
    this.grupo.markAsDirty();
    this.tocado();
  }

  // ── Requisitos documentales ───────────────────────────────────────

  indiceRequisito(clave: string): number {
    return this.requisitos.controls.findIndex((c) => c.get('clave')?.value === clave);
  }

  tieneRequisito(clave: string): boolean { return this.indiceRequisito(clave) >= 0; }

  alternarRequisito(clave: string): void {
    const indice = this.indiceRequisito(clave);
    if (indice >= 0) {
      this.requisitos.removeAt(indice);
    } else {
      const definicion = REQUISITOS_DOCUMENTALES.find((r) => r.valor === clave);
      if (!definicion) return;
      this.requisitos.push(this.fb.group({
        clave: [definicion.valor],
        exigencia: [definicion.exigenciaSugerida],
      }));
    }
    this.grupo.markAsDirty();
    this.tocado();
  }

  // ── Salidas programadas ───────────────────────────────────────────

  anadirSalida(): void {
    this.salidas.push(this.fb.group({
      id: [`s-${Date.now()}`],
      fechaSalida: [''],
      paradas: [[] as string[]],
      plazasTotales: [6],
      plazasOcupadas: [0],
      cierreHoras: [24],
    }));
    this.grupo.markAsDirty();
    this.tocado();
  }

  quitarSalida(indice: number): void {
    this.salidas.removeAt(indice);
    this.grupo.markAsDirty();
    this.tocado();
  }

  // ── Campos condicionales ──────────────────────────────────────────

  admiteAcompanantes(): boolean {
    this.revision();
    return Number(this.grupo.get('plazasAcompanantes')?.value ?? 0) > 0;
  }

  ofreceRecurrente(): boolean { return this.tiene('tiposTrayecto', TipoTrayecto.RECURRENTE); }
  ofreceUrgente(): boolean { return this.tiene('tiposTrayecto', TipoTrayecto.URGENTE); }

  ofreceRutaProgramada(): boolean {
    return this.grupo.get('plantilla')?.value === PlantillaTransporte.RUTA_PROGRAMADA
      || this.grupo.get('modoDisponibilidad')?.value === ModoDisponibilidadTransporte.SALIDAS_PROGRAMADAS;
  }

  usaPresupuesto(): boolean {
    this.revision();
    return this.reglas.controls.some((c) => c.get('modelo')?.value === ModeloPrecio.PRESUPUESTO)
      || this.grupo.get('modoCobertura')?.value === ModoCobertura.PRESUPUESTO;
  }

  textoCancelacion(): string {
    const politica = this.grupo.get('politicaCancelacionTransporte')?.value as PoliticaCancelacionTransporte;
    return POLITICA_CANCELACION_TRANSPORTE_TEXTOS[politica] ?? '';
  }

  // ── Simulación ────────────────────────────────────────────────────

  readonly simOrigen = signal('Castellón');
  readonly simDestino = signal('Valencia');
  readonly simKm = signal(74);
  readonly simMascotas = signal(1);
  readonly simIdaVuelta = signal(true);
  readonly simNocturno = signal(false);
  readonly simUrgente = signal(false);

  /**
   * El precio que vería el cliente, calculado con el mismo motor que cobra.
   *
   * No es un adorno: es lo que permite a la empresa darse cuenta de que su
   * tarifa mínima se come el descuento o de que un trayecto entero se le va
   * por presupuesto, **antes** de publicarlo.
   */
  readonly simulacion = computed(() => {
    this.revision();
    const config = this.configActual();
    if (!config.reglasTarifa.length) return null;

    return calcularPrecioTransporte(config, {
      distanciaKm: Math.max(1, this.simKm()),
      mascotas: Math.max(1, this.simMascotas()),
      pasajeros: 0,
      paradasExtra: 0,
      idaVuelta: this.simIdaVuelta(),
      esperaMinutos: 0,
      municipioOrigen: this.simOrigen(),
      municipioDestino: this.simDestino(),
      nocturno: this.simNocturno(),
      urgente: this.simUrgente(),
    });
  });

  /** Lo que hay escrito ahora mismo, en el formato que entiende el motor. */
  private configActual(): ConfigTransporte {
    const valor = this.grupo.getRawValue() as Record<string, unknown>;
    return {
      ...(valor as unknown as ConfigTransporte),
      politicaCancelacion: valor['politicaCancelacionTransporte'] as PoliticaCancelacionTransporte,
      reglasTarifa: ((valor['reglasTarifa'] as Array<Record<string, unknown>>) ?? []).map((r) => ({
        ...r,
        // Los campos numéricos de un input llegan como texto cuando se teclean.
        precioIda: Number(r['precioIda'] ?? 0),
        precioIdaVuelta: r['precioIdaVuelta'] === null || r['precioIdaVuelta'] === ''
          ? undefined : Number(r['precioIdaVuelta']),
        precioKm: Number(r['precioKm'] ?? 0),
        tarifaSalida: Number(r['tarifaSalida'] ?? 0),
        precioHora: Number(r['precioHora'] ?? 0),
        precioRuta: Number(r['precioRuta'] ?? 0),
        importeMinimo: Number(r['importeMinimo'] ?? 0),
        tramos: ((r['tramos'] as Array<Record<string, unknown>>) ?? []).map((t) => ({
          desdeKm: Number(t['desdeKm'] ?? 0),
          hastaKm: t['hastaKm'] === null || t['hastaKm'] === '' ? null : Number(t['hastaKm']),
          precioKm: Number(t['precioKm'] ?? 0),
        })),
      })) as unknown as ConfigTransporte['reglasTarifa'],
      suplementos: ((valor['suplementos'] as Array<Record<string, unknown>>) ?? []).map((s) => ({
        ...s, importe: Number(s['importe'] ?? 0),
      })) as unknown as ConfigTransporte['suplementos'],
      esperaIncluidaMin: Number(valor['esperaIncluidaMin'] ?? 0),
      distanciaMaximaKm: Number(valor['distanciaMaximaKm'] ?? 0) || null,
    };
  }

  // ── Comprobaciones de publicación ─────────────────────────────────

  /**
   * Lo que falta para publicar. Los errores bloquean la publicación, **no el
   * guardado del borrador**: obligar a terminarlo de una sentada es la forma
   * más segura de que la empresa lo deje a medias y no vuelva.
   */
  readonly comprobaciones = computed<readonly ComprobacionAlta[]>(() => {
    this.revision();
    const valor = this.grupo.getRawValue() as Record<string, unknown>;
    const reglas = (valor['reglasTarifa'] as Array<Record<string, unknown>>) ?? [];

    return [
      {
        clave: 'tipo',
        etiqueta: 'Tipo de servicio y trayectos definidos',
        cumplida: !!valor['plantilla'] && ((valor['tiposTrayecto'] as string[]) ?? []).length > 0,
      },
      {
        clave: 'cobertura',
        etiqueta: 'Cobertura definida',
        cumplida: this.coberturaCompleta(valor),
      },
      {
        clave: 'tarifa',
        etiqueta: 'Al menos una regla de tarifa con importe',
        cumplida: reglas.length > 0 && reglas.some((r) => this.reglaTieneImporte(r)),
      },
      {
        clave: 'capacidad',
        etiqueta: 'Capacidad y especies configuradas',
        cumplida: Number(valor['maxMascotasPorReserva'] ?? 0) > 0
          && ((valor['especiesAdmitidas'] as string[]) ?? []).length > 0,
      },
      {
        clave: 'condiciones',
        etiqueta: 'Condiciones de cancelación aceptadas',
        cumplida: !!valor['politicaCancelacionTransporte'],
      },
    ];
  });

  readonly puedePublicar = computed(() => this.comprobaciones().every((c) => c.cumplida));

  private coberturaCompleta(valor: Record<string, unknown>): boolean {
    switch (valor['modoCobertura']) {
      case ModoCobertura.RADIO:
        return Number(valor['radioKm'] ?? 0) > 0;
      case ModoCobertura.MUNICIPIOS:
      case ModoCobertura.PROVINCIAS:
        return ((valor['municipiosCobertura'] as string[]) ?? []).length > 0;
      case ModoCobertura.PAISES:
        return ((valor['paisesCobertura'] as string[]) ?? []).length > 0;
      default:
        return true;
    }
  }

  private reglaTieneImporte(regla: Record<string, unknown>): boolean {
    switch (regla['modelo']) {
      case ModeloPrecio.FIJO:
      case ModeloPrecio.ZONA:
        return Number(regla['precioIda'] ?? 0) > 0;
      case ModeloPrecio.KM:
        return Number(regla['precioKm'] ?? 0) > 0;
      case ModeloPrecio.BASE_MAS_KM:
        return Number(regla['tarifaSalida'] ?? 0) > 0 || Number(regla['precioKm'] ?? 0) > 0;
      case ModeloPrecio.TRAMOS:
        return ((regla['tramos'] as Array<Record<string, unknown>>) ?? [])
          .some((t) => Number(t['precioKm'] ?? 0) > 0);
      case ModeloPrecio.HORA:
        return Number(regla['precioHora'] ?? 0) > 0;
      case ModeloPrecio.RUTA_FIJA:
        return Number(regla['precioRuta'] ?? 0) > 0;
      // Una regla de presupuesto no lleva importe por definición: el precio lo
      // pone la empresa cuando responde.
      case ModeloPrecio.PRESUPUESTO:
        return true;
      default:
        return false;
    }
  }
}
