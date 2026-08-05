import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { Vacuna, VACUNA_LABELS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsTagsInputComponent } from '../../shared/components/tags-input/rs-tags-input.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import {
  ALERGIAS_FRECUENTES, MEDICACION_FRECUENTE, MIEDOS_FRECUENTES,
} from '../../shared/catalogos/tags.catalogo';
import { PerrosService, PerroPayload, VacunaAplicada } from './perros.service';

type Paso = 1 | 2 | 3 | 4 | 5 | 6;
const PASO_LABELS: Record<Paso, string> = {
  1: '🐶 Datos básicos',
  2: '📏 Físico y pelo',
  3: '🧠 Comportamiento',
  4: '❤️ Salud',
  5: '🏨 En un alojamiento',
  6: '📄 Documentación',
};
const TOTAL_PASOS: Paso = 6;

/** Catálogo cerrado de temperamentos (HU-8.2.3): sustituye al campo de texto libre. */
const TEMPERAMENTOS = ['Muy tranquilo', 'Activo', 'Nervioso', 'Protector', 'Sociable', 'Independiente'];

/** Selector gráfico de sociabilidad (HU-8.2.3): mismos 4 niveles del enum NivelSociabilidad. */
const NIVELES_SOCIABILIDAD = [
  { valor: 'alta', icon: '😊🟢', label: 'Alta' },
  { valor: 'media', icon: '😐🟡', label: 'Media' },
  { valor: 'baja', icon: '😟🟠', label: 'Baja' },
  { valor: 'no_tolera', icon: '😡🔴', label: 'No tolera' },
];

@Component({
  selector: 'app-perro-form',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, RsIconComponent, RsTagsInputComponent, RsImageUploadComponent],
  template: `
    <div class="page-wrap">
      <div class="page-header">
        <a routerLink="/perros" class="back-link">
          <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
          Volver a mis perros
        </a>
        <h1>{{ esEdicion() ? 'Editar ficha' : 'Crea la ficha inteligente de tu mascota' }}</h1>
        <p>Complétala una sola vez: peluquerías, residencias, veterinarios y adiestradores de Doogking adaptarán el servicio automáticamente a tu perro, sin volver a rellenar formularios en cada reserva.</p>
      </div>

      @if (cargando()) {
        <div class="rs-card" style="padding:var(--sp-16);text-align:center;color:var(--t-400)">Cargando…</div>
      } @else {
      <div class="form-card rs-card">

        <!-- Progreso del wizard (HU-8.2.2) -->
        <div class="wizard-progress">
          <div class="wizard-progress__head">
            <span>Paso {{ paso() }} de {{ totalPasos }} · {{ pasoLabels[paso()] }}</span>
            <span>{{ completitud() }}% completada</span>
          </div>
          <div class="wizard-progress__track">
            <div class="wizard-progress__fill" [style.width.%]="(paso() / totalPasos) * 100"></div>
          </div>
          @if (autoguardadoMsg()) {
            <p class="wizard-progress__autosave">✓ {{ autoguardadoMsg() }}</p>
          }
        </div>

        <div class="privacy-box">
          🔒 <strong>Privacidad:</strong> Doogking solo compartirá la información necesaria con los
          profesionales que tú autorices mediante una reserva.
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()">

          @if (paso() === 1) {
          <h2 class="section-title">Datos básicos</h2>
          <div class="rs-field">
            <span class="rs-lbl">Foto de tu perro</span>
            <span class="rs-field-hint">Ayuda a los profesionales a identificar y preparar la visita de tu mascota.</span>
            <rs-image-upload formControlName="fotos" [multiple]="true" [maxFiles]="4" />
          </div>
          <div class="form-row">
            <div class="rs-field">
              <label class="rs-lbl" for="nombre">Nombre *</label>
              <input id="nombre" class="rs-inp" formControlName="nombre" [class.rs-inp--error]="hasError('nombre')" />
              @if (hasError('nombre')) { <span class="rs-field-err">El nombre es obligatorio.</span> }
            </div>
            <div class="rs-field">
              <label class="rs-lbl" for="raza">Raza</label>
              <input id="raza" class="rs-inp" formControlName="raza" placeholder="Mestizo si no lo sabes" />
            </div>
          </div>
          <div class="form-row">
            <div class="rs-field">
              <label class="rs-lbl" for="fechaNacimiento">Fecha de nacimiento</label>
              <input id="fechaNacimiento" type="date" class="rs-inp" formControlName="fechaNacimiento" />
            </div>
            <div class="rs-field">
              <label class="rs-lbl" for="peso">Peso (kg)</label>
              <input id="peso" type="number" min="0" max="120" step="0.1" class="rs-inp" formControlName="peso"
                     [class.rs-inp--error]="hasError('peso')" />
              @if (hasError('peso')) { <span class="rs-field-err">Introduce un peso válido (0-120 kg).</span> }
            </div>
            <div class="rs-field">
              <label class="rs-lbl" for="sexo">Sexo</label>
              <select id="sexo" class="rs-inp" formControlName="sexo">
                <option value="">—</option>
                <option value="macho">Macho</option>
                <option value="hembra">Hembra</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="rs-field">
              <label class="rs-lbl" for="ciudad">Ciudad</label>
              <input id="ciudad" class="rs-inp" formControlName="ciudad" placeholder="Madrid" />
            </div>
          </div>
          <div class="form-row">
            <label class="filter-check">
              <input type="checkbox" formControlName="esterilizado" />
              Esterilizado/a
            </label>
            <label class="filter-check">
              <input type="checkbox" formControlName="esMestizo" />
              Es mestizo
            </label>
          </div>
          }

          @if (paso() === 2) {
          <h2 class="section-title">Físico y pelo</h2>
          <div class="form-row">
            <div class="rs-field">
              <label class="rs-lbl" for="tamano">Tamaño</label>
              <select id="tamano" class="rs-inp" formControlName="tamano">
                <option value="">—</option>
                <option value="mini">Mini (0-5 kg)</option>
                <option value="pequeno">Pequeño (5-10 kg)</option>
                <option value="mediano">Mediano (10-25 kg)</option>
                <option value="grande">Grande (25-40 kg)</option>
                <option value="gigante">Gigante (+40 kg)</option>
              </select>
            </div>
            <div class="rs-field">
              <label class="rs-lbl" for="estadoManto">Estado del manto</label>
              <input id="estadoManto" class="rs-inp" formControlName="estadoManto"
                     placeholder="Ej. mantenimiento habitual, nudos leves…" />
            </div>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Tipo de pelo</label>
            <span class="rs-field-hint">Ayuda a las peluquerías a preparar tiempo y material para el corte.</span>
            <div class="checks-grid">
              @for (t of tiposPelo; track t) {
                <label class="filter-check">
                  <input type="checkbox" [checked]="tienePelo(t)" (change)="togglePelo(t)" />
                  {{ t }}
                </label>
              }
            </div>
          </div>
          }

          @if (paso() === 3) {
          <h2 class="section-title">Comportamiento</h2>
          <p class="rs-field-hint" style="margin-bottom:var(--sp-3)">
            Permite recomendar el profesional más adecuado para tu perro.
          </p>
          <div class="rs-field">
            <label class="rs-lbl">Temperamento</label>
            <div class="chip-row">
              @for (t of catalogoTemperamentos; track t) {
                <button type="button" class="chip" [class.chip--activo]="form.controls.temperamento.value === t"
                        (click)="elegirTemperamento(t)">
                  {{ t }}
                </button>
              }
            </div>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Sociabilidad con perros</label>
            <div class="nivel-row">
              @for (n of nivelesSociabilidad; track n.valor) {
                <button type="button" class="nivel-btn"
                        [class.nivel-btn--activo]="form.controls.sociabilidadPerros.value === n.valor"
                        (click)="elegirNivel('sociabilidadPerros', n.valor)">
                  {{ n.icon }} {{ n.label }}
                </button>
              }
            </div>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Sociabilidad con personas</label>
            <div class="nivel-row">
              @for (n of nivelesSociabilidad; track n.valor) {
                <button type="button" class="nivel-btn"
                        [class.nivel-btn--activo]="form.controls.sociabilidadPersonas.value === n.valor"
                        (click)="elegirNivel('sociabilidadPersonas', n.valor)">
                  {{ n.icon }} {{ n.label }}
                </button>
              }
            </div>
          </div>
          <div class="form-row">
            <label class="filter-check">
              <input type="checkbox" formControlName="puedeQuedarseSolo" />
              Puede quedarse solo
            </label>
            <label class="filter-check">
              <input type="checkbox" formControlName="ansiedadSeparacion" />
              Ansiedad por separación
            </label>
            <label class="filter-check">
              <input type="checkbox" formControlName="seMarea" />
              Se marea en coche
            </label>
            <label class="filter-check">
              <input type="checkbox" formControlName="requiereTransportin" />
              Requiere transportín
            </label>
          </div>
          <div class="rs-field">
            <span class="rs-lbl">Miedos</span>
            <rs-tags-input formControlName="miedos" etiqueta="Miedos de tu perro"
                           [opciones]="catalogoMiedos" placeholder="Ej. tormentas, petardos…" />
          </div>
          }

          @if (paso() === 4) {
          <h2 class="section-title">Salud</h2>
          <div class="rs-field">
            <span class="rs-lbl">Alergias</span>
            <rs-tags-input formControlName="alergias" etiqueta="Alergias de tu perro"
                           [opciones]="catalogoAlergias" placeholder="Ej. pollo, polen…" />
          </div>
          <div class="rs-field">
            <span class="rs-lbl">Medicación actual</span>
            <rs-tags-input formControlName="medicacion" etiqueta="Medicación actual"
                           [opciones]="catalogoMedicacion" placeholder="Ej. antiinflamatorio…" />
          </div>
          <div class="rs-field">
            <span class="rs-lbl">Vacunas</span>
            <span class="rs-field-hint">
              Marca las que tiene puestas. Muchas residencias y guarderías las exigen para admitir a tu perro.
            </span>
            <ul class="vacunas">
              @for (v of vacunasCatalogo; track v.tipo) {
                <li class="vacuna" [class.is-on]="tieneVacuna(v.tipo)">
                  <label class="vacuna__check">
                    <input type="checkbox" [checked]="tieneVacuna(v.tipo)" (change)="alternarVacuna(v.tipo)" />
                    <span>{{ v.label }}</span>
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
            <label class="rs-lbl" for="dieta">Dieta especial</label>
            <input id="dieta" class="rs-inp" formControlName="dieta" />
          </div>
          }

          @if (paso() === 5) {
          <h2 class="section-title">En un alojamiento</h2>
          <p class="rs-field-hint" style="margin-bottom:var(--sp-3)">
            Decirlo por adelantado evita sorpresas y suplementos en recepción: el alojamiento prepara la
            estancia sabiendo qué esperar.
          </p>
          <div class="checks-grid">
            <label class="filter-check">
              <input type="checkbox" formControlName="orinaEnInterior" />
              Se orina dentro de casa
            </label>
            <label class="filter-check">
              <input type="checkbox" formControlName="ladraAlQuedarseSolo" />
              Ladra al quedarse solo
            </label>
            <label class="filter-check">
              <input type="checkbox" formControlName="destructivoEnSoledad" />
              Muerde o rompe cosas al quedarse solo
            </label>
          </div>
          <div class="rs-field" style="margin-top:var(--sp-4)">
            <label class="rs-lbl" for="notasAlojamiento">Otras cosas que debería saber el alojamiento</label>
            <input id="notasAlojamiento" class="rs-inp" formControlName="notasAlojamiento"
                   placeholder="Ej. duerme en su propia cama, no sube a los sofás" />
          </div>

          <label class="filter-check" style="margin-top:var(--sp-4)">
            <input type="checkbox" formControlName="autorizaCompartirHistorial" />
            Autorizo compartir el historial de servicios de mi perro con los profesionales que reserve en Doogking
          </label>
          }

          @if (paso() === 6) {
          <h2 class="section-title">Documentación</h2>
          <p class="rs-field-hint" style="margin-bottom:var(--sp-3)">
            Las residencias y hoteles podrán comprobar automáticamente si tu mascota cumple sus requisitos antes de la llegada. Todos estos documentos son opcionales.
          </p>
          <div class="rs-field">
            <label class="rs-lbl">Cartilla sanitaria</label>
            <rs-image-upload formControlName="cartillaSanitariaUrl" [multiple]="false" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Pasaporte europeo para mascotas</label>
            <rs-image-upload formControlName="pasaporteEuropeoUrl" [multiple]="false" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Otros certificados (vacunación internacional, seguro…)</label>
            <rs-image-upload formControlName="certificadosUrl" [multiple]="true" [maxFiles]="4" />
          </div>

          <div class="resumen-final">
            <strong>📋 Ficha Inteligente completada al {{ completitud() }}%</strong>
            <p>Tu mascota ya está preparada para:</p>
            <div class="resumen-final__chips">
              @for (d of disponibilidadPorVertical(); track d.label) {
                <span class="rs-badge" [class]="d.lista ? 'rs-badge--success' : 'rs-badge--neutral'">
                  {{ d.lista ? '✅' : '⚠' }} {{ d.label }}
                </span>
              }
            </div>
          </div>
          }

          @if (errorMsg()) { <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div> }
          @if (exitoMsg()) { <div class="rs-alert rs-alert--success">{{ exitoMsg() }}</div> }

          <div class="form-actions">
            @if (paso() > 1) {
              <button type="button" class="rs-btn rs-btn--ghost" (click)="atras()">← Atrás</button>
            }
            <div class="form-actions__spacer"></div>
            @if (paso() < totalPasos) {
              <button type="button" class="rs-btn rs-btn--primary" [disabled]="autoguardando()" (click)="siguiente()">
                {{ autoguardando() ? 'Guardando…' : 'Siguiente →' }}
              </button>
            } @else {
              <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardando()">
                {{ guardando() ? 'Guardando…' : (esEdicion() ? 'Guardar cambios' : '🐶 Crear ficha inteligente') }}
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

    .form-card { padding: var(--sp-8); }
    .section-title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin: var(--sp-6) 0 var(--sp-4); }
    .section-title:first-child { margin-top: 0; }

    .form-row { display: flex; gap: var(--sp-4); flex-wrap: wrap; margin-bottom: var(--sp-4); }
    .form-row .rs-field { flex: 1; min-width: 180px; }

    .rs-field-err { color: var(--c-danger, #ef4444); font-size: var(--f-xs); margin-top: var(--sp-1); display: block; }

    .checks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--sp-2); }
    .filter-check { display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; font-size: var(--f-sm); color: var(--t-200); }

    /* Vacunas: casillas en vez de texto libre, con fecha opcional al marcarlas. */
    .vacunas { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: var(--sp-2); margin-top: var(--sp-2); }
    .vacuna {
      display: flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--b-2); border-radius: var(--r-md);
      transition: border-color var(--d-2), background var(--d-2);
      &.is-on { border-color: var(--c-accent); background: var(--c-accent-lo); }
    }
    .vacuna__check { display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; font-size: var(--f-sm); color: var(--t-200); flex: 1; min-width: 0; }
    .vacuna__fecha { width: 132px; flex-shrink: 0; padding: var(--sp-1) var(--sp-2); font-size: var(--f-xs); }

    .form-actions { margin-top: var(--sp-6); display: flex; align-items: center; gap: var(--sp-3); }
    .form-actions__spacer { flex: 1; }

    .wizard-progress { margin-bottom: var(--sp-6); }
    .wizard-progress__head { display: flex; justify-content: space-between; font-size: var(--f-sm); color: var(--t-300); margin-bottom: var(--sp-2); }
    .wizard-progress__track { height: 6px; border-radius: var(--r-full); background: var(--c-raised); overflow: hidden; }
    .wizard-progress__fill { height: 100%; background: var(--c-accent); border-radius: var(--r-full); transition: width var(--d-3); }
    .wizard-progress__autosave { margin-top: var(--sp-2); font-size: var(--f-xs); color: var(--c-success); }

    /* HU-8.2.6: privacidad, visible en todos los pasos */
    .privacy-box {
      background: var(--c-accent-lo); border-radius: var(--r-lg);
      padding: var(--sp-3) var(--sp-4); margin-bottom: var(--sp-5);
      font-size: var(--f-xs); color: var(--t-300);
      strong { color: var(--t-100); }
    }

    /* HU-8.2.3: temperamento en chips */
    .chip-row { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-2); }
    .chip {
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      border: 1px solid var(--b-2); background: var(--c-raised); color: var(--t-300);
      font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
      &.chip--activo { background: var(--c-accent); border-color: var(--c-accent); color: #fff; }
      &:hover:not(.chip--activo) { border-color: var(--c-accent); }
    }

    /* HU-8.2.3: selector gráfico de sociabilidad */
    .nivel-row { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-2); }
    .nivel-btn {
      padding: var(--sp-2) var(--sp-3); border-radius: var(--r-md);
      border: 1px solid var(--b-2); background: var(--c-raised); color: var(--t-300);
      font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
      &.nivel-btn--activo { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--t-100); font-weight: var(--w-6); }
      &:hover:not(.nivel-btn--activo) { border-color: var(--c-accent); }
    }

    /* HU-8.2.8: resumen final de disponibilidad */
    .resumen-final {
      margin-top: var(--sp-6); padding: var(--sp-5); border-radius: var(--r-lg);
      background: var(--c-raised);
      strong { font-size: var(--f-md); color: var(--t-100); }
      p { font-size: var(--f-sm); color: var(--t-300); margin: var(--sp-2) 0 var(--sp-3); }
    }
    .resumen-final__chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
  `],
})
export class PerroFormComponent implements OnInit {
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
  readonly pasoLabels = PASO_LABELS;
  readonly autoguardando = signal(false);
  readonly autoguardadoMsg = signal('');

  readonly tiposPelo = ['corto', 'medio', 'largo', 'rizado', 'duro', 'doble_capa'];
  private readonly tipoPeloSeleccionado = signal<string[]>([]);

  readonly catalogoMiedos = MIEDOS_FRECUENTES;
  readonly catalogoAlergias = ALERGIAS_FRECUENTES;
  readonly catalogoMedicacion = MEDICACION_FRECUENTE;
  readonly catalogoTemperamentos = TEMPERAMENTOS;
  readonly nivelesSociabilidad = NIVELES_SOCIABILIDAD;

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(1)]],
    fotos: [[] as string[]],
    raza: [''],
    fechaNacimiento: [''],
    peso: [null as number | null, [Validators.min(0), Validators.max(120)]],
    sexo: [''],
    ciudad: [''],
    esterilizado: [false],
    esMestizo: [false],
    tamano: [''],
    estadoManto: [''],
    temperamento: [''],
    sociabilidadPerros: [''],
    sociabilidadPersonas: [''],
    puedeQuedarseSolo: [true],
    ansiedadSeparacion: [false],
    seMarea: [false],
    requiereTransportin: [false],
    miedos: [[] as string[]],
    alergias: [[] as string[]],
    medicacion: [[] as string[]],
    dieta: [''],
    orinaEnInterior: [false],
    ladraAlQuedarseSolo: [false],
    destructivoEnSoledad: [false],
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

  tienePelo(t: string): boolean {
    return this.tipoPeloSeleccionado().includes(t);
  }

  togglePelo(t: string): void {
    this.tipoPeloSeleccionado.update((lista) =>
      lista.includes(t) ? lista.filter((x) => x !== t) : [...lista, t],
    );
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.perroId.set(id);
    this.cargando.set(true);
    try {
      const p = await this.perrosService.obtener(id);
      this.tipoPeloSeleccionado.set(p.tipoPelo ?? []);
      this.form.patchValue({
        nombre: p.nombre,
        fotos: p.fotos ?? [],
        raza: p.raza ?? '',
        fechaNacimiento: p.fechaNacimiento ? p.fechaNacimiento.slice(0, 10) : '',
        peso: p.peso ?? null,
        sexo: p.sexo ?? '',
        ciudad: p.ciudad ?? '',
        esterilizado: p.esterilizado,
        esMestizo: p.esMestizo,
        tamano: p.tamano ?? '',
        estadoManto: p.estadoManto ?? '',
        temperamento: p.temperamento ?? '',
        sociabilidadPerros: p.sociabilidadPerros ?? '',
        sociabilidadPersonas: p.sociabilidadPersonas ?? '',
        puedeQuedarseSolo: p.puedeQuedarseSolo,
        ansiedadSeparacion: p.ansiedadSeparacion,
        seMarea: p.seMarea,
        requiereTransportin: p.requiereTransportin,
        miedos: p.miedos ?? [],
        alergias: p.alergias ?? [],
        medicacion: p.medicacion ?? [],
        dieta: p.dieta ?? '',
        orinaEnInterior: p.orinaEnInterior ?? false,
        ladraAlQuedarseSolo: p.ladraAlQuedarseSolo ?? false,
        destructivoEnSoledad: p.destructivoEnSoledad ?? false,
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
      fotos: v.fotos,
      raza: v.raza || undefined,
      fechaNacimiento: v.fechaNacimiento || undefined,
      peso: v.peso ?? undefined,
      sexo: (v.sexo || undefined) as PerroPayload['sexo'],
      ciudad: v.ciudad || undefined,
      esterilizado: v.esterilizado,
      esMestizo: v.esMestizo,
      tamano: v.tamano || undefined,
      estadoManto: v.estadoManto || undefined,
      tipoPelo: this.tipoPeloSeleccionado(),
      temperamento: v.temperamento || undefined,
      sociabilidadPerros: v.sociabilidadPerros || undefined,
      sociabilidadPersonas: v.sociabilidadPersonas || undefined,
      puedeQuedarseSolo: v.puedeQuedarseSolo,
      ansiedadSeparacion: v.ansiedadSeparacion,
      seMarea: v.seMarea,
      requiereTransportin: v.requiereTransportin,
      miedos: v.miedos,
      alergias: v.alergias,
      medicacion: v.medicacion,
      vacunasDetalle: this.vacunasDetalle(),
      dieta: v.dieta || undefined,
      orinaEnInterior: v.orinaEnInterior,
      ladraAlQuedarseSolo: v.ladraAlQuedarseSolo,
      destructivoEnSoledad: v.destructivoEnSoledad,
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
      this.tipoPeloSeleccionado().length > 0, !!v.tamano, !!v.estadoManto,
      this.vacunasDetalle().length > 0, !!v.sociabilidadPerros, !!v.sociabilidadPersonas,
      !!v.temperamento, !!v.dieta, v.fotos.length > 0, !!v.ciudad, !!v.cartillaSanitariaUrl,
    ];
    return Math.round((campos.filter(Boolean).length / campos.length) * 100);
  }

  /** HU-8.2.8: resumen final de qué categorías ya pueden atender bien a la mascota. */
  disponibilidadPorVertical(): { label: string; lista: boolean }[] {
    const v = this.form.getRawValue();
    const tieneVacunas = this.vacunasDetalle().length > 0;
    const tieneTamano = !!v.tamano;
    const tienePelo = this.tipoPeloSeleccionado().length > 0;
    return [
      { label: 'Hoteles y residencias', lista: tieneTamano && tieneVacunas },
      { label: 'Peluquerías', lista: tienePelo && tieneTamano },
      { label: 'Veterinarios', lista: tieneVacunas },
      { label: 'Adiestramiento', lista: true },
    ];
  }

  irAPaso(p: Paso): void {
    this.paso.set(p);
  }

  atras(): void {
    this.paso.update((p) => Math.max(1, p - 1) as Paso);
  }

  /** Avanza de paso y guarda en segundo plano lo ya rellenado (HU-8.2.6). */
  async siguiente(): Promise<void> {
    await this.guardarProgreso();
    this.paso.update((p) => Math.min(this.totalPasos, p + 1) as Paso);
  }

  /**
   * Guardado automático por bloque: sin nombre aún no hay nada que crear en
   * el servidor, así que ese paso solo avanza en local. Si el guardado falla,
   * no bloquea la navegación — el usuario siempre puede terminar y guardarlo
   * todo con el botón final.
   */
  private async guardarProgreso(): Promise<void> {
    if (!this.form.getRawValue().nombre) return;

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
    } catch {
      this.errorMsg.set('Error al guardar la ficha. Verifica los datos e inténtalo de nuevo.');
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
