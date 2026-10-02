import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import {
  Vacuna, VACUNA_LABELS, TAMANOS_PERRO, ESPECIE_MASCOTA_LABELS, EspecieMascota, especieMascotaDe,
  TIPO_MANTO_LABELS, TipoPelo, ESTADO_MANTO_LABELS, EstadoManto, esEstadoMantoConocido,
  MICROCHIP_DIGITOS, MICROCHIP_OPCIONAL_REGEX,
} from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsTagsInputComponent } from '../../shared/components/tags-input/rs-tags-input.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import {
  ALERGIAS_FRECUENTES, MEDICACION_FRECUENTE, MIEDOS_FRECUENTES,
} from '../../shared/catalogos/tags.catalogo';
import { PerrosService, PerroPayload, VacunaAplicada } from './perros.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { mensajeDeError } from '../../shared/mensaje-error';

type Paso = 1 | 2 | 3 | 4 | 5 | 6;

/** Título de cada bloque del wizard, con su icono Lucide (TCK-8010). */
const PASOS: Record<Paso, { icono: string; texto: string }> = {
  1: { icono: 'dog', texto: 'Datos básicos' },
  2: { icono: 'ruler', texto: 'Físico y pelo' },
  3: { icono: 'brain', texto: 'Comportamiento' },
  4: { icono: 'heart', texto: 'Salud' },
  5: { icono: 'hotel', texto: 'En un alojamiento' },
  6: { icono: 'file-text', texto: 'Documentación' },
};
const TOTAL_PASOS: Paso = 6;

/**
 * Campos con validación de cada paso. Se comprueban antes de avanzar: si no,
 * un nombre vacío del paso 1 sólo se descubría al pulsar «Crear» en el paso 6,
 * con el error fuera de la vista, y en el móvil parecía que el alta no se
 * podía terminar.
 */
const CAMPOS_VALIDADOS_POR_PASO: Partial<Record<Paso, readonly CampoValidado[]>> = {
  1: ['nombre', 'peso', 'microchip'],
};
type CampoValidado = 'nombre' | 'peso' | 'microchip';

/** Catálogo cerrado de temperamentos (HU-8.2.3): sustituye al campo de texto libre. */
const TEMPERAMENTOS = ['Muy tranquilo', 'Activo', 'Nervioso', 'Protector', 'Sociable', 'Independiente'];

/**
 * Selector gráfico de sociabilidad (HU-8.2.3): mismos 4 niveles del enum
 * NivelSociabilidad. El nivel se distingue por la cara y por el color del token,
 * no por un emoji de semáforo (TCK-8010).
 */
const NIVELES_SOCIABILIDAD = [
  { valor: 'alta', icon: 'smile', tono: 'ok', label: 'Alta' },
  { valor: 'media', icon: 'meh', tono: 'medio', label: 'Media' },
  { valor: 'baja', icon: 'frown', tono: 'bajo', label: 'Baja' },
  { valor: 'no_tolera', icon: 'angry', tono: 'malo', label: 'No tolera' },
];

/**
 * Problemas de conducta que se preguntan en el wizard. «¡Es muy bueno!» es la
 * respuesta positiva a todos ellos y por eso los excluye (observación del
 * cliente 01-10: «dar la opción de hablar bien del perro si no hay problema»).
 */
const PROBLEMAS_CONDUCTA = [
  'ansiedadSeparacion', 'seMarea',
  'orinaEnInterior', 'ladraAlQuedarseSolo', 'destructivoEnSoledad', 'tendenciaEscapar',
] as const;

@Component({
  selector: 'app-perro-form',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, ReactiveFormsModule, RsIconComponent, RsTagsInputComponent, RsImageUploadComponent
  ],
  template: `
    <div class="page-wrap">
      <div class="page-header">
        <a routerLink="/perros" class="back-link">
          <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
          {{ 'Volver a mis perros' | t }}
        </a>
        <h1>{{ (esEdicion() ? 'Editar ficha' : 'Crea la ficha inteligente de tu mascota') | t }}</h1>
        <p>{{ 'Complétala una sola vez: peluquerías, residencias, veterinarios y adiestradores de Doogking adaptarán el servicio automáticamente a tu perro, sin volver a rellenar formularios en cada reserva.' | t }}</p>
      </div>

      @if (cargando()) {
        <div class="rs-card form-cargando">{{ 'Cargando…' | t }}</div>
      } @else {
      <div class="form-card rs-card">

        <!-- Progreso del wizard (HU-8.2.2) -->
        <div class="wizard-progress">
          <div class="wizard-progress__head">
            <span class="wizard-progress__paso">
              {{ 'Paso {n} de {total}' | t: { n: paso(), total: totalPasos } }} ·
              <rs-icon [name]="pasos[paso()].icono" [size]="14" [stroke]="2"></rs-icon>
              {{ pasos[paso()].texto | t }}
            </span>
            <span>{{ '{n}% completada' | t: { n: completitud() } }}</span>
          </div>
          <div class="wizard-progress__track">
            <div class="wizard-progress__fill" [style.width.%]="(paso() / totalPasos) * 100"></div>
          </div>
          @if (autoguardadoMsg()) {
            <p class="wizard-progress__autosave">
              <rs-icon name="check" [size]="13" [stroke]="3"></rs-icon> {{ autoguardadoMsg() | t }}
            </p>
          }
        </div>

        <div class="privacy-box">
          <rs-icon name="lock" [size]="15" [stroke]="2"></rs-icon>
          <span><strong>{{ 'Privacidad:' | t }}</strong> {{ 'Doogking solo compartirá la información necesaria con los profesionales que tú autorices mediante una reserva.' | t }}</span>
        </div>

        <form [formGroup]="form" (ngSubmit)="alEnviar()">

          @if (paso() === 1) {
          <div class="paso">
            <h2 class="section-title">{{ 'Datos básicos' | t }}</h2>
            <div class="rs-field">
              <span class="rs-lbl">{{ 'Foto de tu perro' | t }}</span>
              <span class="rs-field-hint">{{ 'Ayuda a los profesionales a identificar y preparar la visita de tu mascota.' | t }}</span>
              <rs-image-upload origen="perro/fotos" formControlName="fotos" [multiple]="true" [maxFiles]="4" />
            </div>
            <div class="form-row">
              <div class="rs-field">
                <label class="rs-lbl" for="nombre">{{ 'Nombre *' | t }}</label>
                <input id="nombre" class="rs-inp" formControlName="nombre" autocomplete="off"
                       enterkeyhint="next" [class.rs-inp--error]="hasError('nombre')" />
                @if (hasError('nombre')) { <span class="rs-field-err">{{ 'El nombre es obligatorio.' | t }}</span> }
              </div>
              <div class="rs-field">
                <label class="rs-lbl" for="especie">{{ 'Tipo de animal' | t }}</label>
                <select id="especie" class="rs-inp" formControlName="especie">
                  @for (e of especies; track e.valor) { <option [value]="e.valor">{{ e.etiqueta | t }}</option> }
                </select>
              </div>
            </div>
            <div class="rs-field">
              <label class="rs-lbl" for="raza">{{ 'Raza' | t }}</label>
              <input id="raza" class="rs-inp" formControlName="raza" [placeholder]="'Mestizo si no lo sabes' | t" />
            </div>
            <div class="form-row">
              <div class="rs-field">
                <label class="rs-lbl" for="fechaNacimiento">{{ 'Fecha de nacimiento' | t }}</label>
                <input id="fechaNacimiento" type="date" class="rs-inp" formControlName="fechaNacimiento" />
              </div>
              <div class="rs-field">
                <label class="rs-lbl" for="peso">{{ 'Peso (kg)' | t }}</label>
                <input id="peso" type="number" min="0" max="120" step="0.1" class="rs-inp" formControlName="peso"
                       [class.rs-inp--error]="hasError('peso')" inputmode="decimal" />
                @if (hasError('peso')) { <span class="rs-field-err">{{ 'Introduce un peso válido (0-120 kg).' | t }}</span> }
              </div>
              <div class="rs-field">
                <label class="rs-lbl" for="sexo">{{ 'Sexo' | t }}</label>
                <select id="sexo" class="rs-inp" formControlName="sexo">
                  <option value="">—</option>
                  <option value="macho">{{ 'Macho' | t }}</option>
                  <option value="hembra">{{ 'Hembra' | t }}</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="rs-field">
                <label class="rs-lbl" for="ciudad">{{ 'Ciudad' | t }}</label>
                <input id="ciudad" class="rs-inp" formControlName="ciudad" [placeholder]="'Madrid' | t" />
              </div>
              <div class="rs-field">
                <label class="rs-lbl" for="microchip">{{ 'Número de microchip' | t }}</label>
                <input id="microchip" class="rs-inp" formControlName="microchip"
                       inputmode="numeric" autocomplete="off" [attr.maxlength]="microchipDigitos"
                       [placeholder]="'15 dígitos' | t" [class.rs-inp--error]="hasError('microchip')"
                       aria-describedby="microchip-ayuda" (input)="limpiarMicrochip()" />
                @if (hasError('microchip')) {
                  <span class="rs-field-err">
                    {{ 'El microchip tiene 15 dígitos (llevas {n}).' | t: { n: form.controls.microchip.value.length } }}
                  </span>
                } @else {
                  <span id="microchip-ayuda" class="rs-field-hint">
                    {{ 'Opcional. Lo encontrarás en la cartilla o el pasaporte europeo.' | t }}
                  </span>
                }
              </div>
            </div>
            <div class="checks-fila">
              <label class="filter-check">
                <input type="checkbox" formControlName="esterilizado" />
                {{ 'Esterilizado/a' | t }}
              </label>
              <label class="filter-check">
                <input type="checkbox" formControlName="esMestizo" />
                {{ 'Es mestizo' | t }}
              </label>
            </div>
          </div>
          }

          @if (paso() === 2) {
          <div class="paso">
            <h2 class="section-title">{{ 'Físico y pelo' | t }}</h2>
            <div class="rs-field">
              <label class="rs-lbl" for="tamano">{{ 'Tamaño' | t }}</label>
              <select id="tamano" class="rs-inp" formControlName="tamano">
                <option value="">—</option>
                @for (tamano of tamanosPerro; track tamano.valor) {
                  <option [value]="tamano.valor">{{ tamano.etiqueta | t }}</option>
                }
              </select>
            </div>
            <div class="form-row">
              <div class="rs-field">
                <label class="rs-lbl" for="tipoManto">{{ 'Tipo de manto' | t }}</label>
                <select id="tipoManto" class="rs-inp" formControlName="tipoManto">
                  <option value="">—</option>
                  @for (tipo of tiposManto; track tipo.valor) {
                    <option [value]="tipo.valor">{{ tipo.etiqueta | t }}</option>
                  }
                </select>
                <span class="rs-field-hint">{{ 'Cómo es su pelo por naturaleza. Ayuda a las peluquerías a preparar tiempo y material.' | t }}</span>
              </div>
              <div class="rs-field">
                <label class="rs-lbl" for="estadoManto">{{ 'Estado del manto' | t }}</label>
                <select id="estadoManto" class="rs-inp" formControlName="estadoManto">
                  <option value="">—</option>
                  @for (estado of estadosManto; track estado.valor) {
                    <option [value]="estado.valor">{{ estado.etiqueta | t }}</option>
                  }
                  @if (estadoMantoLibre(); as libre) {
                    <option [value]="libre">{{ libre }}</option>
                  }
                </select>
                <span class="rs-field-hint">{{ 'Cómo está ahora: nudos, muda o piel sensible pueden necesitar más tiempo.' | t }}</span>
              </div>
            </div>
          </div>
          }

          @if (paso() === 3) {
          <div class="paso">
            <div>
              <h2 class="section-title">{{ 'Comportamiento' | t }}</h2>
              <p class="rs-field-hint">{{ 'Permite recomendar el profesional más adecuado para tu perro.' | t }}</p>
            </div>
            <div class="rs-field">
              <span class="rs-lbl">{{ 'Temperamento' | t }}</span>
              <div class="chip-row">
                @for (t of catalogoTemperamentos; track t) {
                  <button type="button" class="chip" [class.chip--activo]="form.controls.temperamento.value === t"
                          [attr.aria-pressed]="form.controls.temperamento.value === t"
                          (click)="elegirTemperamento(t)">
                    {{ t | t }}
                  </button>
                }
              </div>
            </div>
            <div class="rs-field">
              <span class="rs-lbl">{{ 'Sociabilidad con perros' | t }}</span>
              <div class="nivel-row">
                @for (n of nivelesSociabilidad; track n.valor) {
                  <button type="button" class="nivel-btn"
                          [class.nivel-btn--activo]="form.controls.sociabilidadPerros.value === n.valor"
                          [attr.aria-pressed]="form.controls.sociabilidadPerros.value === n.valor"
                          [attr.data-tono]="n.tono"
                          (click)="elegirNivel('sociabilidadPerros', n.valor)">
                    <rs-icon [name]="n.icon" [size]="18" [stroke]="2"></rs-icon> {{ n.label | t }}
                  </button>
                }
              </div>
            </div>
            <div class="rs-field">
              <span class="rs-lbl">{{ 'Sociabilidad con personas' | t }}</span>
              <div class="nivel-row">
                @for (n of nivelesSociabilidad; track n.valor) {
                  <button type="button" class="nivel-btn"
                          [class.nivel-btn--activo]="form.controls.sociabilidadPersonas.value === n.valor"
                          [attr.aria-pressed]="form.controls.sociabilidadPersonas.value === n.valor"
                          [attr.data-tono]="n.tono"
                          (click)="elegirNivel('sociabilidadPersonas', n.valor)">
                    <rs-icon [name]="n.icon" [size]="18" [stroke]="2"></rs-icon> {{ n.label | t }}
                  </button>
                }
              </div>
            </div>
            <div class="rs-field">
              <span class="rs-lbl">{{ '¿Algo a tener en cuenta?' | t }}</span>
              <label class="opcion-positiva" [class.is-on]="form.controls.esMuyBueno.value">
                <input type="checkbox" formControlName="esMuyBueno" (change)="alMarcarMuyBueno()" />
                <rs-icon name="heart" [size]="16" [stroke]="2"></rs-icon>
                <span>{{ '¡Es muy bueno! No da ningún problema' | t }}</span>
              </label>
              <div class="checks-grid">
                <label class="filter-check">
                  <input type="checkbox" formControlName="puedeQuedarseSolo" />
                  {{ 'Puede quedarse solo' | t }}
                </label>
                <label class="filter-check">
                  <input type="checkbox" formControlName="ansiedadSeparacion" (change)="alMarcarProblema()" />
                  {{ 'Ansiedad por separación' | t }}
                </label>
                <label class="filter-check">
                  <input type="checkbox" formControlName="seMarea" (change)="alMarcarProblema()" />
                  {{ 'Se marea en coche' | t }}
                </label>
                <label class="filter-check">
                  <input type="checkbox" formControlName="requiereTransportin" />
                  {{ 'Requiere transportín' | t }}
                </label>
              </div>
            </div>
            <div class="rs-field">
              <span class="rs-lbl">{{ 'Miedos' | t }}</span>
              <rs-tags-input (focusin)="acercarDesplegable($event)" formControlName="miedos" [etiqueta]="'Miedos de tu perro' | t"
                             [opciones]="catalogoMiedos" [placeholder]="'Ej. tormentas, petardos…' | t" />
            </div>
          </div>
          }

          @if (paso() === 4) {
          <div class="paso">
            <h2 class="section-title">{{ 'Salud' | t }}</h2>
            <div class="rs-field">
              <span class="rs-lbl">{{ 'Alergias' | t }}</span>
              <rs-tags-input (focusin)="acercarDesplegable($event)" formControlName="alergias" [etiqueta]="'Alergias de tu perro' | t"
                             [opciones]="catalogoAlergias" [placeholder]="'Ej. pollo, polen…' | t" />
            </div>
            <div class="rs-field">
              <span class="rs-lbl">{{ 'Medicación actual' | t }}</span>
              <rs-tags-input (focusin)="acercarDesplegable($event)" formControlName="medicacion" [etiqueta]="'Medicación actual' | t"
                             [opciones]="catalogoMedicacion" [placeholder]="'Ej. antiinflamatorio…' | t" />
            </div>
            <div class="rs-field">
              <span class="rs-lbl">{{ 'Vacunas' | t }}</span>
              <span class="rs-field-hint">
                {{ 'Marca las que tiene puestas. Muchas residencias y guarderías las exigen para admitir a tu perro.' | t }}
              </span>
              <ul class="vacunas">
                @for (v of vacunasCatalogo; track v.tipo) {
                  <li class="vacuna" [class.is-on]="tieneVacuna(v.tipo)">
                    <label class="vacuna__check">
                      <input type="checkbox" [checked]="tieneVacuna(v.tipo)" (change)="alternarVacuna(v.tipo)" />
                      <span>{{ v.label | t }}</span>
                    </label>
                    @if (tieneVacuna(v.tipo)) {
                      <input type="date" class="rs-inp vacuna__fecha"
                             [attr.aria-label]="'Fecha de ' + v.label"
                             [value]="fechaVacuna(v.tipo)"
                             (change)="cambiarFechaVacuna(v.tipo, $event)" />
                    }
                  </li>
                }
              </ul>
            </div>
            <div class="rs-field">
              <label class="rs-lbl" for="dieta">{{ 'Dieta especial' | t }}</label>
              <input id="dieta" class="rs-inp" formControlName="dieta" />
            </div>
          </div>
          }

          @if (paso() === 5) {
          <div class="paso">
            <div>
              <h2 class="section-title">{{ 'En un alojamiento' | t }}</h2>
              <p class="rs-field-hint">
                {{ 'Decirlo por adelantado evita sorpresas y suplementos en recepción: el alojamiento prepara la estancia sabiendo qué esperar.' | t }}
              </p>
            </div>
            <div class="rs-field">
              <label class="opcion-positiva" [class.is-on]="form.controls.esMuyBueno.value">
                <input type="checkbox" formControlName="esMuyBueno" (change)="alMarcarMuyBueno()" />
                <rs-icon name="heart" [size]="16" [stroke]="2"></rs-icon>
                <span>{{ '¡Es muy bueno! No da ningún problema' | t }}</span>
              </label>
              <div class="checks-grid">
                <label class="filter-check">
                  <input type="checkbox" formControlName="orinaEnInterior" (change)="alMarcarProblema()" />
                  {{ 'Se orina dentro de casa' | t }}
                </label>
                <label class="filter-check">
                  <input type="checkbox" formControlName="ladraAlQuedarseSolo" (change)="alMarcarProblema()" />
                  {{ 'Ladra al quedarse solo' | t }}
                </label>
                <label class="filter-check">
                  <input type="checkbox" formControlName="destructivoEnSoledad" (change)="alMarcarProblema()" />
                  {{ 'Muerde o rompe cosas al quedarse solo' | t }}
                </label>
                <label class="filter-check">
                  <input type="checkbox" formControlName="tendenciaEscapar" (change)="alMarcarProblema()" />
                  {{ 'Tiene tendencia a escaparse' | t }}
                </label>
              </div>
            </div>
            <div class="rs-field">
              <label class="rs-lbl" for="notasAlojamiento">{{ 'Otras cosas que debería saber el alojamiento' | t }}</label>
              <input id="notasAlojamiento" class="rs-inp" formControlName="notasAlojamiento"
                     [placeholder]="'Ej. duerme en su propia cama, no sube a los sofás' | t" />
            </div>

            <label class="filter-check filter-check--largo">
              <input type="checkbox" formControlName="autorizaCompartirHistorial" />
              {{ 'Autorizo compartir el historial de servicios de mi perro con los profesionales que reserve en Doogking' | t }}
            </label>
          </div>
          }

          @if (paso() === 6) {
          <div class="paso">
            <div>
              <h2 class="section-title">{{ 'Documentación' | t }}</h2>
              <p class="rs-field-hint">
                {{ 'Las residencias y hoteles podrán comprobar automáticamente si tu mascota cumple sus requisitos antes de la llegada. Todos estos documentos son opcionales.' | t }}
              </p>
            </div>
            <div class="rs-field">
              <span class="rs-lbl">{{ 'Cartilla sanitaria' | t }}</span>
              <rs-image-upload origen="perro/cartilla" formControlName="cartillaSanitariaUrl" [multiple]="false" />
            </div>
            <div class="rs-field">
              <span class="rs-lbl">{{ 'Pasaporte europeo para mascotas' | t }}</span>
              <rs-image-upload origen="perro/pasaporte" formControlName="pasaporteEuropeoUrl" [multiple]="false" />
            </div>
            <div class="rs-field">
              <span class="rs-lbl">{{ 'Otros certificados (vacunación internacional, seguro…)' | t }}</span>
              <rs-image-upload origen="perro/certificados" formControlName="certificadosUrl" [multiple]="true" [maxFiles]="4" />
            </div>

            <div class="resumen-final">
              <strong>
                <rs-icon name="clipboard-list" [size]="16" [stroke]="2"></rs-icon>
                {{ 'Ficha Inteligente completada al {n}%' | t: { n: completitud() } }}
              </strong>
              <p>{{ 'Tu mascota ya está preparada para:' | t }}</p>
              <div class="resumen-final__chips">
                @for (d of disponibilidadPorVertical(); track d.label) {
                  <span class="rs-badge" [class]="d.lista ? 'rs-badge--success' : 'rs-badge--neutral'">
                    <rs-icon [name]="d.lista ? 'check-circle' : 'alert-triangle'" [size]="15" [stroke]="2"></rs-icon>
                    {{ d.label | t }}
                  </span>
                }
              </div>
            </div>
          </div>
          }

          @if (errorMsg()) { <div class="rs-alert rs-alert--error form-aviso" role="alert">{{ errorMsg() | t }}</div> }
          @if (exitoMsg()) { <div class="rs-alert rs-alert--success form-aviso" role="status">{{ exitoMsg() | t }}</div> }

          <div class="form-actions dk-barra-wizard">
            @if (paso() > 1) {
              <button type="button" class="rs-btn rs-btn--ghost" (click)="atras()">
                <rs-icon name="arrow-left" [size]="16" [stroke]="2"></rs-icon>
                {{ 'Atrás' | t }}
              </button>
            }
            <div class="form-actions__spacer"></div>
            @if (paso() < totalPasos) {
              <button type="button" class="rs-btn rs-btn--primary" [disabled]="autoguardando()" (click)="siguiente()">
                {{ (autoguardando() ? 'Guardando…' : 'Siguiente') | t }}
                @if (!autoguardando()) { <rs-icon name="arrow-right" [size]="16" [stroke]="2"></rs-icon> }
              </button>
            } @else {
              <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardando()">
                @if (!guardando() && !esEdicion()) {
                  <rs-icon name="dog" [size]="16" [stroke]="2"></rs-icon>
                }
                {{ (guardando() ? 'Guardando…' : (esEdicion() ? 'Guardar cambios' : 'Crear ficha inteligente')) | t }}
              </button>
            }
          </div>
        </form>
      </div>
      }
    </div>
  `,
  styles: [`
    .page-wrap { max-width: 760px; margin: 0 auto; padding: var(--sp-10) var(--sp-4); }
    .page-header { margin-bottom: var(--sp-6); }
    .back-link { display: inline-flex; align-items: center; gap: var(--sp-2); color: var(--t-400); font-size: var(--f-sm); text-decoration: none; margin-bottom: var(--sp-4); }
    .page-header h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-header p { color: var(--t-400); font-size: var(--f-sm); }

    .form-cargando { padding: var(--sp-16); text-align: center; color: var(--t-400); }

    /*
      .rs-card recorta lo que sobresale (overflow: hidden) y aquí dentro viven
      desplegables posicionados en absoluto —la lista de «Miedos» es el último
      campo del paso 3—: con el recorte la lista quedaba oculta bajo el borde de
      la tarjeta y en el móvil no había forma de elegir nada.
    */
    .form-card { padding: var(--sp-8); overflow: visible; }

    /* Cada paso apila sus bloques con el mismo aire: antes iban pegados. */
    .paso { display: flex; flex-direction: column; gap: var(--sp-6); }
    .section-title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin: 0 0 var(--sp-1); }

    .form-row { display: flex; gap: var(--sp-4); flex-wrap: wrap; }
    /* Deja sitio a la cabecera fija al subir un campo con desplegable. */
    rs-tags-input { scroll-margin-top: var(--sp-24); }
    .form-row .rs-field { flex: 1 1 180px; min-width: 0; }

    .rs-field-err { color: var(--c-error); font-size: var(--f-xs); margin-top: var(--sp-1); display: block; }

    .checks-fila { display: flex; flex-wrap: wrap; gap: var(--sp-3) var(--sp-6); }
    .checks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr)); gap: var(--sp-3); }
    .filter-check {
      display: flex; align-items: center; gap: var(--sp-2); cursor: pointer;
      font-size: var(--f-sm); color: var(--t-200); min-height: 32px;
      input { flex: none; width: 18px; height: 18px; accent-color: var(--c-accent); }
    }
    .filter-check--largo { align-items: flex-start; line-height: 1.5; input { margin-top: 2px; } }

    /* Respuesta positiva a la lista de problemas (obs. 01-10). */
    .opcion-positiva {
      display: flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-4); border-radius: var(--r-lg);
      border: 1px dashed var(--c-success); background: var(--c-card);
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); cursor: pointer;
      transition: background var(--d-2), border-color var(--d-2);
      input { flex: none; width: 18px; height: 18px; accent-color: var(--c-success); }
      rs-icon { color: var(--c-success); flex: none; }
      &.is-on { border-style: solid; background: var(--c-success-lo); color: var(--c-success); }
    }

    /* Vacunas: casillas en vez de texto libre, con fecha opcional al marcarlas. */
    .vacunas { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr)); gap: var(--sp-2); margin: var(--sp-2) 0 0; padding: 0; }
    .vacuna {
      display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--b-2); border-radius: var(--r-md);
      transition: border-color var(--d-2), background var(--d-2);
      &.is-on { border-color: var(--c-accent); background: var(--c-accent-lo); }
    }
    .vacuna__check { display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; font-size: var(--f-sm); color: var(--t-200); flex: 1 1 120px; min-width: 0; min-height: 32px; }
    .vacuna__fecha { width: 140px; flex: 0 0 auto; padding: var(--sp-1) var(--sp-2); font-size: var(--f-xs); }

    .form-aviso { margin-top: var(--sp-6); }
    .form-actions { margin-top: var(--sp-6); display: flex; align-items: center; gap: var(--sp-3); }
    .form-actions__spacer { flex: 1; }

    .wizard-progress { margin-bottom: var(--sp-6); }
    .wizard-progress__head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--sp-1) var(--sp-3); font-size: var(--f-sm); color: var(--t-300); margin-bottom: var(--sp-2); }
    .wizard-progress__track { height: 6px; border-radius: var(--r-full); background: var(--c-raised); overflow: hidden; }
    .wizard-progress__fill { height: 100%; background: var(--c-accent); border-radius: var(--r-full); transition: width var(--d-3); }
    .wizard-progress__autosave {
      margin-top: var(--sp-2); font-size: var(--f-xs); color: var(--c-success);
      display: inline-flex; align-items: center; gap: var(--sp-1);
    }
    .wizard-progress__paso { display: inline-flex; align-items: center; flex-wrap: wrap; gap: var(--sp-1); }

    /* HU-8.2.6: privacidad, visible en todos los pasos */
    .privacy-box {
      background: var(--c-accent-lo); border-radius: var(--r-lg);
      padding: var(--sp-3) var(--sp-4); margin-bottom: var(--sp-6);
      font-size: var(--f-xs); color: var(--t-300);
      display: flex; align-items: flex-start; gap: var(--sp-2);
      strong { color: var(--t-100); }
      rs-icon { flex: 0 0 auto; margin-top: 1px; color: var(--c-accent); }
    }

    /* HU-8.2.3: temperamento en chips */
    .chip-row { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .chip {
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full); min-height: 40px;
      border: 1px solid var(--b-2); background: var(--c-raised); color: var(--t-300);
      font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
      &.chip--activo { background: var(--c-accent); border-color: var(--c-accent); color: var(--c-card); }
      &:hover:not(.chip--activo) { border-color: var(--c-accent); }
    }

    /* HU-8.2.3: selector gráfico de sociabilidad */
    .nivel-row { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .nivel-btn {
      padding: var(--sp-2) var(--sp-3); border-radius: var(--r-md); min-height: 40px;
      border: 1px solid var(--b-2); background: var(--c-raised); color: var(--t-300);
      font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
      display: inline-flex; align-items: center; gap: var(--sp-2);
      &.nivel-btn--activo { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--t-100); font-weight: var(--w-6); }
      &:hover:not(.nivel-btn--activo) { border-color: var(--c-accent); }
      /* El color del icono es lo que distingue el nivel ahora que no hay semáforo. */
      &[data-tono='ok'] rs-icon { color: var(--c-success); }
      &[data-tono='medio'] rs-icon { color: var(--c-warning); }
      &[data-tono='bajo'] rs-icon { color: var(--c-amber); }
      &[data-tono='malo'] rs-icon { color: var(--c-error); }
    }

    /* HU-8.2.8: resumen final de disponibilidad */
    .resumen-final {
      padding: var(--sp-5); border-radius: var(--r-lg);
      background: var(--c-raised);
      strong { font-size: var(--f-md); color: var(--t-100); display: inline-flex; align-items: center; gap: var(--sp-2); }
      p { font-size: var(--f-sm); color: var(--t-300); margin: var(--sp-2) 0 var(--sp-3); }
    }
    .resumen-final__chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .resumen-final__chips span { display: inline-flex; align-items: center; gap: var(--sp-1); }

    /*
      Móvil (desde 320 px): menos relleno para que los campos respiren, cada
      fila de campos en una sola columna y la botonera fija abajo —por encima
      de la navegación de la app— para que «Siguiente» y «Crear» estén siempre
      a mano aunque el paso sea largo.
    */
    @media (max-width: 640px) {
      .page-wrap { padding: var(--sp-5) var(--sp-4) var(--sp-8); }
      .page-header { margin-bottom: var(--sp-4); }
      .page-header h1 { font-size: var(--f-xl); }
      .form-card { padding: var(--sp-5) var(--sp-4) 0; }
      .form-row { flex-direction: column; }
      .form-row .rs-field { flex-basis: auto; }
      .privacy-box { margin-bottom: var(--sp-5); }

      .form-actions {
        position: sticky; bottom: var(--dk-nav-inferior-h, 0px); z-index: var(--z-2);
        margin: var(--sp-6) calc(-1 * var(--sp-4)) 0;
        padding: var(--sp-3) var(--sp-4) calc(var(--sp-3) + env(safe-area-inset-bottom, 0px));
        background: var(--c-card); border-top: 1px solid var(--b-1);
        border-radius: 0 0 var(--r-xl) var(--r-xl);
      }
      .form-actions { gap: var(--sp-2); }
      .form-actions__spacer { display: none; }
      .form-actions .rs-btn { min-height: 44px; min-width: 0; white-space: normal; text-align: center; line-height: 1.2; }
      .form-actions .rs-btn--ghost { flex: 0 0 auto; padding-inline: var(--sp-3); }
      /* «Crear ficha inteligente» no cabía en 320 px sin partir línea. */
      .form-actions .rs-btn--primary { flex: 1 1 0; justify-content: center; padding-inline: var(--sp-3); }
    }
  `],
})
export class PerroFormComponent implements OnInit {
  /** Escala de tamaños del dominio; ver `TAMANOS_PERRO` en shared. */
  readonly tamanosPerro = TAMANOS_PERRO;

  private readonly perrosService = inject(PerrosService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly errorMsg = signal('');
  readonly exitoMsg = signal('');

  readonly perroId = signal<string | null>(null);
  readonly esEdicion = computed(() => this.perroId() !== null);

  // Wizard por bloques (HU-8.2.2): mismo formulario de siempre, solo cambia
  // qué sección se muestra — submit() sigue validando el formulario entero.
  readonly paso = signal<Paso>(1);
  readonly totalPasos = TOTAL_PASOS;
  readonly pasos = PASOS;
  readonly autoguardando = signal(false);
  readonly autoguardadoMsg = signal('');

  /** Tipo de manto: cómo es el pelo por naturaleza (`tipoPelo` en el modelo). */
  readonly tiposManto = (Object.keys(TIPO_MANTO_LABELS) as TipoPelo[])
    .map((valor) => ({ valor, etiqueta: TIPO_MANTO_LABELS[valor] }));
  /** Estado del manto: cómo está ahora (nudos, muda…). */
  readonly estadosManto = (Object.keys(ESTADO_MANTO_LABELS) as EstadoManto[])
    .map((valor) => ({ valor, etiqueta: ESTADO_MANTO_LABELS[valor] }));
  /**
   * Fichas anteriores al desplegable guardaban el estado del manto como texto
   * libre: se ofrece como opción más para no perderlo al editar.
   */
  readonly estadoMantoLibre = signal<string | null>(null);

  readonly microchipDigitos = MICROCHIP_DIGITOS;

  readonly catalogoMiedos = MIEDOS_FRECUENTES;
  readonly catalogoAlergias = ALERGIAS_FRECUENTES;
  readonly catalogoMedicacion = MEDICACION_FRECUENTE;
  readonly catalogoTemperamentos = TEMPERAMENTOS;
  readonly nivelesSociabilidad = NIVELES_SOCIABILIDAD;
  readonly especies = (Object.values(EspecieMascota)).map((valor) => ({ valor, etiqueta: ESPECIE_MASCOTA_LABELS[valor] }));

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(1)]],
    // Doogking es canino, pero traslados y veterinaria atienden más especies (D1).
    especie: [EspecieMascota.PERRO as string],
    fotos: [[] as string[]],
    raza: [''],
    fechaNacimiento: [''],
    peso: [null as number | null, [Validators.min(0), Validators.max(120)]],
    sexo: [''],
    ciudad: [''],
    microchip: ['', [Validators.pattern(MICROCHIP_OPCIONAL_REGEX)]],
    esterilizado: [false],
    esMestizo: [false],
    tamano: [''],
    tipoManto: [''],
    estadoManto: [''],
    temperamento: [''],
    sociabilidadPerros: [''],
    sociabilidadPersonas: [''],
    puedeQuedarseSolo: [true],
    ansiedadSeparacion: [false],
    seMarea: [false],
    requiereTransportin: [false],
    esMuyBueno: [false],
    miedos: [[] as string[]],
    alergias: [[] as string[]],
    medicacion: [[] as string[]],
    dieta: [''],
    orinaEnInterior: [false],
    ladraAlQuedarseSolo: [false],
    destructivoEnSoledad: [false],
    tendenciaEscapar: [false],
    notasAlojamiento: [''],
    autorizaCompartirHistorial: [true],
    cartillaSanitariaUrl: [null as string | null],
    pasaporteEuropeoUrl: [null as string | null],
    certificadosUrl: [[] as string[]],
  });

  /** HU-8.2.3: temperamento como chip único (clic de nuevo para deseleccionar). */
  elegirTemperamento(valor: string): void {
    const actual = this.form.controls.temperamento.value;
    this.form.controls.temperamento.setValue(actual === valor ? '' : valor);
  }

  /** HU-8.2.3: selector gráfico de sociabilidad (clic de nuevo para deseleccionar). */
  elegirNivel(campo: 'sociabilidadPerros' | 'sociabilidadPersonas', valor: string): void {
    const control = this.form.controls[campo];
    control.setValue(control.value === valor ? '' : valor);
  }

  /** «¡Es muy bueno!» descarta los problemas marcados: no pueden ser ciertas las dos cosas. */
  alMarcarMuyBueno(): void {
    if (!this.form.controls.esMuyBueno.value) return;
    for (const problema of PROBLEMAS_CONDUCTA) this.form.controls[problema].setValue(false);
  }

  /** Marcar un problema retira el «¡Es muy bueno!». */
  alMarcarProblema(): void {
    const hayProblema = PROBLEMAS_CONDUCTA.some((problema) => this.form.controls[problema].value);
    if (hayProblema) this.form.controls.esMuyBueno.setValue(false);
  }

  /** Sólo dígitos: los lectores y las cartillas lo agrupan con espacios o guiones. */
  limpiarMicrochip(): void {
    const control = this.form.controls.microchip;
    const limpio = control.value.replace(/\D/g, '').slice(0, MICROCHIP_DIGITOS);
    if (limpio !== control.value) control.setValue(limpio);
  }

  /** Catálogo cerrado de vacunas; sustituye al antiguo campo de texto libre. */
  readonly vacunasCatalogo = Object.values(Vacuna).map((tipo) => ({
    tipo,
    label: VACUNA_LABELS[tipo],
  }));

  private readonly vacunasDetalle = signal<VacunaAplicada[]>([]);

  tieneVacuna(tipo: Vacuna): boolean {
    return this.vacunasDetalle().some((v) => v.tipo === tipo);
  }

  fechaVacuna(tipo: Vacuna): string {
    return this.vacunasDetalle().find((v) => v.tipo === tipo)?.fecha?.slice(0, 10) ?? '';
  }

  alternarVacuna(tipo: Vacuna): void {
    this.vacunasDetalle.update((lista) =>
      lista.some((v) => v.tipo === tipo)
        ? lista.filter((v) => v.tipo !== tipo)
        : [...lista, { tipo }],
    );
  }

  cambiarFechaVacuna(tipo: Vacuna, evento: Event): void {
    const fecha = (evento.target as HTMLInputElement).value;
    this.vacunasDetalle.update((lista) =>
      lista.map((v) => (v.tipo === tipo ? { ...v, fecha: fecha || undefined } : v)),
    );
  }

  hasError(campo: string): boolean {
    const control = this.form.get(campo);
    return !!(control && control.invalid && control.touched);
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.perroId.set(id);
    this.cargando.set(true);
    try {
      const p = await this.perrosService.obtener(id);
      const estadoManto = p.estadoManto ?? '';
      this.estadoMantoLibre.set(estadoManto && !esEstadoMantoConocido(estadoManto) ? estadoManto : null);
      this.form.patchValue({
        nombre: p.nombre,
        especie: especieMascotaDe(p.especie),
        fotos: p.fotos ?? [],
        raza: p.raza ?? '',
        fechaNacimiento: p.fechaNacimiento ? p.fechaNacimiento.slice(0, 10) : '',
        peso: p.peso ?? null,
        sexo: p.sexo ?? '',
        ciudad: p.ciudad ?? '',
        microchip: p.microchip ?? '',
        esterilizado: p.esterilizado,
        esMestizo: p.esMestizo,
        tamano: p.tamano ?? '',
        tipoManto: p.tipoPelo?.[0] ?? '',
        estadoManto,
        temperamento: p.temperamento ?? '',
        sociabilidadPerros: p.sociabilidadPerros ?? '',
        sociabilidadPersonas: p.sociabilidadPersonas ?? '',
        puedeQuedarseSolo: p.puedeQuedarseSolo,
        ansiedadSeparacion: p.ansiedadSeparacion,
        seMarea: p.seMarea,
        requiereTransportin: p.requiereTransportin,
        esMuyBueno: p.esMuyBueno ?? false,
        miedos: p.miedos ?? [],
        alergias: p.alergias ?? [],
        medicacion: p.medicacion ?? [],
        dieta: p.dieta ?? '',
        orinaEnInterior: p.orinaEnInterior ?? false,
        ladraAlQuedarseSolo: p.ladraAlQuedarseSolo ?? false,
        destructivoEnSoledad: p.destructivoEnSoledad ?? false,
        tendenciaEscapar: p.tendenciaEscapar ?? false,
        notasAlojamiento: p.notasAlojamiento ?? '',
        autorizaCompartirHistorial: p.autorizaCompartirHistorial,
        cartillaSanitariaUrl: p.cartillaSanitariaUrl ?? null,
        pasaporteEuropeoUrl: p.pasaporteEuropeoUrl ?? null,
        certificadosUrl: p.certificadosUrl ?? [],
      });
      this.vacunasDetalle.set(p.vacunasDetalle ?? []);
    } catch {
      this.errorMsg.set('No se pudo cargar la ficha del perro.');
    } finally {
      this.cargando.set(false);
    }
  }

  private construirPayload(): PerroPayload {
    const v = this.form.getRawValue();
    return {
      nombre: v.nombre,
      especie: v.especie,
      fotos: v.fotos,
      raza: v.raza || undefined,
      fechaNacimiento: v.fechaNacimiento || undefined,
      peso: v.peso ?? undefined,
      sexo: (v.sexo || undefined) as PerroPayload['sexo'],
      ciudad: v.ciudad || undefined,
      // Vacío se envía tal cual: es la forma de quitar un microchip mal puesto.
      // Omitirlo dejaría el anterior guardado sin remedio.
      microchip: v.microchip,
      esterilizado: v.esterilizado,
      esMestizo: v.esMestizo,
      tamano: v.tamano || undefined,
      estadoManto: v.estadoManto,
      tipoPelo: v.tipoManto ? [v.tipoManto] : [],
      temperamento: v.temperamento || undefined,
      sociabilidadPerros: v.sociabilidadPerros || undefined,
      sociabilidadPersonas: v.sociabilidadPersonas || undefined,
      puedeQuedarseSolo: v.puedeQuedarseSolo,
      ansiedadSeparacion: v.ansiedadSeparacion,
      seMarea: v.seMarea,
      requiereTransportin: v.requiereTransportin,
      esMuyBueno: v.esMuyBueno,
      miedos: v.miedos,
      alergias: v.alergias,
      medicacion: v.medicacion,
      // Sólo los campos del contrato, y no la vacuna tal cual llegó del API: las
      // guardadas vienen con el "_id" que Mongoose pone a cada subdocumento, y
      // devolverlo hacía que el API rechazara la ficha entera con un 400
      // ("property _id should not exist"). Pasaba sólo al editar, porque al
      // crear las vacunas nacen aquí y no traen ese campo.
      vacunasDetalle: this.vacunasDetalle().map(({ tipo, fecha }) => ({ tipo, fecha })),
      dieta: v.dieta || undefined,
      orinaEnInterior: v.orinaEnInterior,
      ladraAlQuedarseSolo: v.ladraAlQuedarseSolo,
      destructivoEnSoledad: v.destructivoEnSoledad,
      tendenciaEscapar: v.tendenciaEscapar,
      notasAlojamiento: v.notasAlojamiento || undefined,
      autorizaCompartirHistorial: v.autorizaCompartirHistorial,
      cartillaSanitariaUrl: v.cartillaSanitariaUrl ?? undefined,
      pasaporteEuropeoUrl: v.pasaporteEuropeoUrl ?? undefined,
      certificadosUrl: v.certificadosUrl,
    };
  }

  /** % de la ficha ya rellenado (HU-8.1.2/8.2.8), a partir de los mismos campos que `porcentajeCompletitud`. */
  completitud(): number {
    const v = this.form.getRawValue();
    const campos = [
      !!v.raza, !!v.fechaNacimiento, v.peso != null, !!v.sexo,
      !!v.tipoManto, !!v.tamano, !!v.estadoManto,
      this.vacunasDetalle().length > 0, !!v.sociabilidadPerros, !!v.sociabilidadPersonas,
      !!v.temperamento, !!v.microchip, !!v.dieta, v.fotos.length > 0, !!v.ciudad, !!v.cartillaSanitariaUrl,
    ];
    return Math.round((campos.filter(Boolean).length / campos.length) * 100);
  }

  /** HU-8.2.8: resumen final de qué categorías ya pueden atender bien a la mascota. */
  disponibilidadPorVertical(): { label: string; lista: boolean }[] {
    const v = this.form.getRawValue();
    const tieneVacunas = this.vacunasDetalle().length > 0;
    const tieneTamano = !!v.tamano;
    const tienePelo = !!v.tipoManto;
    return [
      { label: 'Hoteles y residencias', lista: tieneTamano && tieneVacunas },
      { label: 'Peluquerías', lista: tienePelo && tieneTamano },
      { label: 'Veterinarios', lista: tieneVacunas },
      { label: 'Adiestramiento', lista: true },
    ];
  }

  irAPaso(p: Paso): void {
    this.paso.set(p);
    this.subirAlInicio();
  }

  atras(): void {
    this.paso.update((p) => Math.max(1, p - 1) as Paso);
    this.subirAlInicio();
  }

  /**
   * Avanza de paso y guarda en segundo plano lo ya rellenado (HU-8.2.6). No
   * avanza si el paso actual tiene errores: se marcan para que se vean ya.
   */
  async siguiente(): Promise<void> {
    if (!this.validarPaso(this.paso())) return;
    this.errorMsg.set('');
    await this.guardarProgreso();
    this.paso.update((p) => Math.min(this.totalPasos, p + 1) as Paso);
    this.subirAlInicio();
  }

  /**
   * Intro en el teclado del móvil («Ir») envía el formulario. Antes de llegar
   * al último paso eso guardaba la ficha a medias y salía al listado: aquí
   * sólo avanza de paso.
   */
  async alEnviar(): Promise<void> {
    if (this.paso() < this.totalPasos) {
      await this.siguiente();
      return;
    }
    await this.submit();
  }

  private validarPaso(paso: Paso): boolean {
    const campos = CAMPOS_VALIDADOS_POR_PASO[paso] ?? [];
    const conError = campos.filter((campo) => this.form.controls[campo].invalid);
    conError.forEach((campo) => this.form.controls[campo].markAsTouched());
    return conError.length === 0;
  }

  /** Paso con el primer campo erróneo, para llevar al usuario hasta él. */
  private primerPasoConError(): Paso | null {
    const pasos = Object.keys(CAMPOS_VALIDADOS_POR_PASO).map(Number) as Paso[];
    return pasos.find((p) => (CAMPOS_VALIDADOS_POR_PASO[p] ?? [])
      .some((campo) => this.form.controls[campo].invalid)) ?? null;
  }

  /**
   * En el móvil, «Miedos» es el último campo del paso y su lista de sugerencias
   * se abría por debajo de la botonera fija y del teclado. Al enfocarlo se sube
   * el campo a la parte alta de la pantalla para que la lista quede a la vista.
   */
  acercarDesplegable(evento: FocusEvent): void {
    if (typeof window === 'undefined' || !window.matchMedia?.('(max-width: 640px)').matches) return;
    const campo = evento.currentTarget as HTMLElement | null;
    campo?.scrollIntoView?.({ block: 'start' });
  }

  /** Al cambiar de paso, el nuevo empieza arriba: en el móvil se quedaba a media altura. */
  private subirAlInicio(): void {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* jsdom no implementa scrollTo */ }
    }
  }

  /**
   * Guardado automático por bloque: sin nombre aún no hay nada que crear en
   * el servidor, así que ese paso solo avanza en local. Si el guardado falla,
   * no bloquea la navegación — el usuario siempre puede terminar y guardarlo
   * todo con el botón final.
   */
  private async guardarProgreso(): Promise<void> {
    if (!this.form.getRawValue().nombre || this.form.invalid) return;

    this.autoguardando.set(true);
    try {
      const payload = this.construirPayload();
      const id = this.perroId();
      if (id) {
        await this.perrosService.actualizar(id, payload);
      } else {
        const creado = await this.perrosService.crear(payload);
        this.perroId.set(creado._id);
      }
      this.autoguardadoMsg.set('Guardado automáticamente');
      setTimeout(() => this.autoguardadoMsg.set(''), 2500);
    } catch {
      // Autoguardado silencioso: un fallo aquí no debe impedir seguir editando.
    } finally {
      this.autoguardando.set(false);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg.set(this.motivoDeFormularioInvalido());
      const pasoConError = this.primerPasoConError();
      if (pasoConError) this.irAPaso(pasoConError);
      return;
    }

    this.guardando.set(true);
    this.errorMsg.set('');
    this.exitoMsg.set('');

    const payload = this.construirPayload();

    try {
      const id = this.perroId();
      if (id) {
        await this.perrosService.actualizar(id, payload);
        this.exitoMsg.set('¡Cambios guardados!');
      } else {
        await this.perrosService.crear(payload);
        this.exitoMsg.set('¡Perro registrado! Redirigiendo…');
      }
      setTimeout(() => void this.router.navigate(['/perros']), 1200);
    } catch (error) {
      // El motivo lo manda el API: un texto genérico escondía el porqué real y
      // dejaba al cliente revisando campos que estaban bien.
      this.errorMsg.set(mensajeDeError(
        error, 'Error al guardar la ficha. Verifica los datos e inténtalo de nuevo.',
      ));
    } finally {
      this.guardando.set(false);
    }
  }

  /**
   * Explica por qué no se puede guardar. La foto merece mensaje propio: está en
   * el paso 1 y el usuario puede pulsar "Guardar" desde el último paso sin ver
   * el aviso de la subida fallida (TCK-8012).
   */
  private motivoDeFormularioInvalido(): string {
    const fotos = this.form.controls.fotos;
    if (fotos.hasError('subidaEnCurso')) {
      return 'Espera a que termine de subirse la foto de tu perro.';
    }
    if (fotos.hasError('subidaFallida')) {
      return 'La foto de tu perro no se pudo subir. Reinténtala o quítala en el paso 1 para guardar la ficha.';
    }
    return 'Revisa los campos marcados en rojo antes de guardar.';
  }
}
