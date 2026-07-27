import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { Vacuna, VACUNA_LABELS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsTagsInputComponent } from '../../shared/components/tags-input/rs-tags-input.component';
import {
  ALERGIAS_FRECUENTES, MEDICACION_FRECUENTE, MIEDOS_FRECUENTES,
} from '../../shared/catalogos/tags.catalogo';
import { PerrosService, PerroPayload, VacunaAplicada } from './perros.service';

@Component({
  selector: 'app-perro-form',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, RsIconComponent, RsTagsInputComponent],
  template: `
    <div class="page-wrap">
      <div class="page-header">
        <a routerLink="/perros" class="back-link">
          <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
          Volver a mis perros
        </a>
        <h1>{{ esEdicion() ? 'Editar ficha' : 'Nuevo perro' }}</h1>
        <p>Cuanta más información des, mejor se adaptarán peluquerías, residencias, veterinarios y adiestradores al perfil de tu perro.</p>
      </div>

      @if (cargando()) {
        <div class="rs-card" style="padding:var(--sp-16);text-align:center;color:var(--t-400)">Cargando…</div>
      } @else {
      <div class="form-card rs-card">
        <form [formGroup]="form" (ngSubmit)="submit()">

          <h2 class="section-title">Datos básicos</h2>
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
            <label class="filter-check">
              <input type="checkbox" formControlName="esterilizado" />
              Esterilizado/a
            </label>
            <label class="filter-check">
              <input type="checkbox" formControlName="esMestizo" />
              Es mestizo
            </label>
          </div>

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
            <div class="checks-grid">
              @for (t of tiposPelo; track t) {
                <label class="filter-check">
                  <input type="checkbox" [checked]="tienePelo(t)" (change)="togglePelo(t)" />
                  {{ t }}
                </label>
              }
            </div>
          </div>

          <h2 class="section-title">Comportamiento</h2>
          <div class="form-row">
            <div class="rs-field">
              <label class="rs-lbl" for="temperamento">Temperamento</label>
              <input id="temperamento" class="rs-inp" formControlName="temperamento"
                     placeholder="Ej. muy tranquilo, nervioso, miedo al secador…" />
            </div>
            <div class="rs-field">
              <label class="rs-lbl" for="sociabilidadPerros">Sociabilidad con perros</label>
              <select id="sociabilidadPerros" class="rs-inp" formControlName="sociabilidadPerros">
                <option value="">—</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
                <option value="no_tolera">No tolera a otros perros</option>
              </select>
            </div>
            <div class="rs-field">
              <label class="rs-lbl" for="sociabilidadPersonas">Sociabilidad con personas</label>
              <select id="sociabilidadPersonas" class="rs-inp" formControlName="sociabilidadPersonas">
                <option value="">—</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
                <option value="no_tolera">No tolera desconocidos</option>
              </select>
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

          @if (errorMsg()) { <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div> }
          @if (exitoMsg()) { <div class="rs-alert rs-alert--success">{{ exitoMsg() }}</div> }

          <div class="form-actions">
            <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : (esEdicion() ? 'Guardar cambios' : 'Registrar perro') }}
            </button>
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

    .form-actions { margin-top: var(--sp-6); display: flex; justify-content: flex-end; }
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

  readonly tiposPelo = ['corto', 'medio', 'largo', 'rizado', 'duro', 'doble_capa'];
  private readonly tipoPeloSeleccionado = signal<string[]>([]);

  readonly catalogoMiedos = MIEDOS_FRECUENTES;
  readonly catalogoAlergias = ALERGIAS_FRECUENTES;
  readonly catalogoMedicacion = MEDICACION_FRECUENTE;

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(1)]],
    raza: [''],
    fechaNacimiento: [''],
    peso: [null as number | null, [Validators.min(0), Validators.max(120)]],
    sexo: [''],
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
  });

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
        raza: p.raza ?? '',
        fechaNacimiento: p.fechaNacimiento ? p.fechaNacimiento.slice(0, 10) : '',
        peso: p.peso ?? null,
        sexo: p.sexo ?? '',
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
      });
      this.vacunasDetalle.set(p.vacunasDetalle ?? []);
    } catch {
      this.errorMsg.set('No se pudo cargar la ficha del perro.');
    } finally {
      this.cargando.set(false);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.guardando.set(true);
    this.errorMsg.set('');
    this.exitoMsg.set('');

    const v = this.form.getRawValue();
    const payload: PerroPayload = {
      nombre: v.nombre,
      raza: v.raza || undefined,
      fechaNacimiento: v.fechaNacimiento || undefined,
      peso: v.peso ?? undefined,
      sexo: (v.sexo || undefined) as PerroPayload['sexo'],
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
    };

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
}
