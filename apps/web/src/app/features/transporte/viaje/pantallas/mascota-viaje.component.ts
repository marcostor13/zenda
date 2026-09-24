import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ESPECIE_MASCOTA_LABELS, EspecieMascota, MAX_MASCOTAS_SOLICITUD, ModalidadTransporte, TamanoPerro,
  calcularTamanoPorPeso, nombreTamanoPerro, especieMascotaDe,
} from 'shared';
import { MarcoViajeComponent } from '../componentes/marco-viaje.component';
import { RsOpcionesComponent } from '../../../../shared/components/opciones/rs-opciones.component';
import { RsContadorComponent } from '../../../../shared/components/contador/rs-contador.component';
import { RsBarraCtaComponent } from '../../../../shared/components/barra-cta/rs-barra-cta.component';
import { RsIconComponent } from '../../../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../../../core/i18n/traducir.pipe';
import { AuthService } from '../../../../core/auth/auth.service';
import { PerroApi, PerrosService } from '../../../perros/perros.service';
import { MascotaElegida, TransporteViajeStore } from '../transporte-viaje.store';
import {
  OPCIONES_COMPORTAMIENTO, OPCIONES_EQUIPAJE, OPCIONES_ESPECIE, OPCIONES_MODALIDAD, OPCIONES_NECESIDADES,
  OPCIONES_PERSONAS, OPCIONES_PREFERENCIAS, OPCIONES_TAMANO,
} from '../transporte-viaje.opciones';

/** Tamaño de una mascota guardada: el de su ficha o, sin él, el que corresponde a su peso. */
function tamanoDe(perro: PerroApi): TamanoPerro {
  if (perro.tamano && (Object.values(TamanoPerro) as string[]).includes(perro.tamano)) return perro.tamano as TamanoPerro;
  return perro.peso ? calcularTamanoPorPeso(perro.peso) : TamanoPerro.MEDIANO;
}

/**
 * Pantalla 2 del flujo (diapositivas 03 y 04, pantalla 2 del mockup): quién
 * viaja —mascotas guardadas o descritas a mano— y cómo —modalidad, acompañantes,
 * necesidades—. Lo que ya sabe la ficha de la mascota (transportín, se marea)
 * se precarga como necesidad para no preguntarlo otra vez.
 */
@Component({
  selector: 'app-mascota-viaje',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, MarcoViajeComponent, RsOpcionesComponent, RsContadorComponent,
    RsBarraCtaComponent, RsIconComponent, TraducirPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<app-marco-viaje [paso]="2" titulo="¿Quién viaja y cómo?" subtitulo="Selecciona tu mascota o añade una nueva." volverA="/transporte">
  <form class="mv2" [formGroup]="form" (ngSubmit)="continuar()" novalidate>
    <section class="mv2__bloque">
      @if (conSesion() && perros().length) {
        <fieldset class="mv2__perros">
          <legend class="mv2__leyenda">{{ 'Mascotas' | t }}</legend>
          @for (p of perros(); track p._id) {
            <label class="mv2__perro" [class.is-activa]="elegida(p._id)">
              <input type="checkbox" class="mv2__nativo" [checked]="elegida(p._id)" (change)="alternarPerro(p)" />
              @if (p.fotos[0]) {
                <img class="mv2__foto" [src]="p.fotos[0]" [alt]="p.nombre" loading="lazy" />
              } @else {
                <span class="mv2__foto mv2__foto--vacia"><rs-icon name="paw" [size]="22" [stroke]="1.8"></rs-icon></span>
              }
              <span class="mv2__perro-texto">
                <strong>{{ p.nombre }}</strong>
                <span>{{ descripcionPerro(p) }}</span>
              </span>
              <span class="mv2__check" aria-hidden="true">
                @if (elegida(p._id)) { <rs-icon name="check" [size]="14" [stroke]="3"></rs-icon> }
              </span>
            </label>
          }
        </fieldset>
      }

      @if (altaAbierta()) {
        <div class="mv2__alta" [formGroup]="alta">
          <p class="mv2__leyenda">{{ 'Nueva mascota' | t }}</p>
          <div class="rs-field">
            <label class="rs-lbl" for="alta-nombre">{{ 'Nombre' | t }}</label>
            <input id="alta-nombre" class="rs-inp" formControlName="nombre" maxlength="60" />
          </div>
          <rs-opciones formControlName="especie" leyenda="Tipo de animal" variante="chip" [opciones]="opcionesEspecie" />
          <rs-opciones formControlName="tamano" leyenda="Peso / tamaño" variante="chip" [opciones]="opcionesTamano" />
          @if (errorAlta()) { <p class="rs-field-err">{{ errorAlta() }}</p> }
          <div class="mv2__alta-acciones">
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="altaAbierta.set(false)">{{ 'Cancelar' | t }}</button>
            <button type="button" class="rs-btn rs-btn--primary rs-btn--sm" [disabled]="alta.invalid || guardandoAlta()" (click)="guardarAlta()">
              {{ (guardandoAlta() ? 'Guardando…' : 'Añadir mascota') | t }}
            </button>
          </div>
        </div>
      } @else if (conSesion()) {
        <button type="button" class="rs-btn rs-btn--outline rs-btn--block" (click)="altaAbierta.set(true)">
          <rs-icon name="plus" [size]="16" [stroke]="2.2"></rs-icon> {{ 'Añadir otra mascota' | t }}
        </button>
      }

      @if (!conSesion() || !perros().length) {
        <div class="mv2__manual">
          @if (!conSesion()) {
            <p class="mv2__aviso">
              <rs-icon name="user" [size]="15" [stroke]="2"></rs-icon>
              <span>{{ '¿Ya tienes cuenta?' | t }} <a [routerLink]="'/auth/login'" [queryParams]="{ volverA: '/transporte/viaje/mascota' }">{{ 'Inicia sesión' | t }}</a> {{ 'y elige tus mascotas guardadas.' | t }}</span>
            </p>
          }
          <rs-opciones formControlName="especie" leyenda="Tipo de animal" variante="chip" [opciones]="opcionesEspecie" />
          <rs-opciones formControlName="tamano" leyenda="Peso / tamaño" variante="chip" [opciones]="opcionesTamano" />
          <rs-contador formControlName="numero" etiqueta="Número de mascotas" [min]="1" [max]="maxMascotas" />
        </div>
      }
      @if (intento() && sinMascotas()) { <p class="rs-field-err">{{ 'Elige al menos una mascota.' | t }}</p> }
    </section>

    <section class="mv2__bloque">
      <rs-opciones formControlName="modalidad" leyenda="Tipo de transporte" [opciones]="opcionesModalidad" [columnas]="3" />
      @if (form.value.modalidad === 'con_propietario') {
        <rs-opciones formControlName="personas" leyenda="¿Cuántas personas viajáis?" variante="segmento" [opciones]="opcionesPersonas" />
        <rs-opciones formControlName="equipaje" leyenda="Equipaje" variante="chip" [opciones]="opcionesEquipaje" />
      }
    </section>

    <section class="mv2__bloque">
      <rs-opciones formControlName="necesidades" leyenda="Necesidades especiales (opcional)" variante="chip"
                   [multiple]="true" [opciones]="opcionesNecesidades" />
      @if (form.value.necesidades?.includes('otra')) {
        <div class="rs-field">
          <label class="rs-lbl" for="necesidad-otra">{{ '¿Qué necesita?' | t }}</label>
          <input id="necesidad-otra" class="rs-inp" formControlName="necesidadOtra" maxlength="200" />
        </div>
      }

      <details class="mv2__indicaciones" [open]="!!form.value.comportamiento || !!form.value.notaTransportista">
        <summary><rs-icon name="message-square" [size]="16" [stroke]="2"></rs-icon> {{ 'Añadir indicaciones' | t }}</summary>
        <rs-opciones formControlName="comportamiento" leyenda="¿Cómo se comporta en un vehículo?" variante="chip" [opciones]="opcionesComportamiento" />
        <div class="rs-field">
          <label class="rs-lbl" for="nota-transportista">{{ 'Información importante para el transportista' | t }}</label>
          <textarea id="nota-transportista" class="rs-inp" rows="3" maxlength="1000" formControlName="notaTransportista"
                    [placeholder]="'Ej.: cómo se comporta, punto de recogida, etc.' | t"></textarea>
        </div>
      </details>
    </section>

    <section class="mv2__bloque">
      <rs-opciones formControlName="preferencias" leyenda="Preferencias (opcional)" variante="chip"
                   [multiple]="true" [opciones]="opcionesPreferencias" />
    </section>

    <rs-barra-cta>
      <button type="submit" class="rs-btn rs-btn--gold rs-btn--lg">
        {{ 'Ver transportes disponibles' | t }} <rs-icon name="arrow-right" [size]="18" [stroke]="2.2"></rs-icon>
      </button>
    </rs-barra-cta>
  </form>
</app-marco-viaje>
  `,
  styles: [`
    :host { display: block; }
    .mv2 { display: flex; flex-direction: column; gap: var(--sp-5); }
    .mv2__bloque {
      display: flex; flex-direction: column; gap: var(--sp-4);
      padding: var(--sp-5); background: var(--c-card); border: 1px solid var(--b-2);
      border-radius: var(--r-2xl); box-shadow: var(--sh-sm);
    }
    .mv2__leyenda { margin: 0 0 var(--sp-2); padding: 0; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); }
    .mv2__perros { display: flex; flex-direction: column; gap: var(--sp-2); border: 0; margin: 0; padding: 0; }
    .mv2__nativo { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .mv2__perro {
      position: relative; display: flex; align-items: center; gap: var(--sp-3); cursor: pointer;
      padding: var(--sp-3); border: 1.5px solid var(--b-2); border-radius: var(--r-xl); background: var(--c-card);
      transition: border-color var(--d-2), background var(--d-2);
      &.is-activa { border-color: var(--dk-blue); background: var(--c-accent-lo); }
      &:has(.mv2__nativo:focus-visible) { box-shadow: 0 0 0 3px var(--c-accent-lo); }
    }
    .mv2__foto { width: 56px; height: 56px; border-radius: var(--r-lg); object-fit: cover; flex: 0 0 auto; }
    .mv2__foto--vacia { display: grid; place-items: center; background: var(--c-surface); color: var(--t-400); }
    .mv2__perro-texto { display: flex; flex-direction: column; min-width: 0; flex: 1;
      strong { color: var(--t-100); font-size: var(--f-md); }
      span { color: var(--t-400); font-size: var(--f-xs); }
    }
    .mv2__check {
      display: grid; place-items: center; width: 24px; height: 24px; border-radius: var(--r-sm);
      border: 1.5px solid var(--b-2); color: var(--c-card);
    }
    .is-activa .mv2__check { background: var(--dk-blue); border-color: var(--dk-blue); }
    .mv2__alta, .mv2__manual { display: flex; flex-direction: column; gap: var(--sp-4); }
    .mv2__alta { padding: var(--sp-4); border: 1px dashed var(--b-a); border-radius: var(--r-xl); }
    .mv2__alta-acciones { display: flex; justify-content: flex-end; gap: var(--sp-2); }
    .mv2__aviso {
      display: flex; align-items: flex-start; gap: var(--sp-2); margin: 0;
      padding: var(--sp-3); border-radius: var(--r-lg); background: var(--c-accent-lo);
      font-size: var(--f-sm); color: var(--t-200);
      a { color: var(--c-accent); font-weight: var(--w-6); text-decoration: underline; }
    }
    .mv2__indicaciones {
      display: flex; flex-direction: column; gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4); border-radius: var(--r-lg); background: var(--c-surface);
      summary { display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; font-weight: var(--w-6); color: var(--dk-blue); }
      &[open] summary { margin-bottom: var(--sp-3); }
    }
    @media (max-width: 480px) { .mv2__bloque { padding: var(--sp-4); } }
  `],
})
export class MascotaViajeComponent implements OnInit {
  private readonly store = inject(TransporteViajeStore);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly perrosService = inject(PerrosService);

  readonly opcionesEspecie = OPCIONES_ESPECIE;
  readonly opcionesTamano = OPCIONES_TAMANO;
  readonly opcionesModalidad = OPCIONES_MODALIDAD;
  readonly opcionesPersonas = OPCIONES_PERSONAS;
  readonly opcionesEquipaje = OPCIONES_EQUIPAJE;
  readonly opcionesNecesidades = OPCIONES_NECESIDADES;
  readonly opcionesComportamiento = OPCIONES_COMPORTAMIENTO;
  readonly opcionesPreferencias = OPCIONES_PREFERENCIAS;
  readonly maxMascotas = MAX_MASCOTAS_SOLICITUD;

  readonly conSesion = this.auth.estaAutenticado;
  readonly perros = signal<PerroApi[]>([]);
  readonly intento = signal(false);
  readonly altaAbierta = signal(false);
  readonly guardandoAlta = signal(false);
  readonly errorAlta = signal<string | null>(null);

  private readonly elegidas = computed(() => new Set(this.store.borrador().mascotas.map((m) => m.perroId)));
  readonly sinMascotas = computed(() => this.conSesion() && this.perros().length > 0 && !this.store.borrador().mascotas.length);

  readonly form = new FormGroup({
    especie: new FormControl<string>(EspecieMascota.PERRO, { nonNullable: true }),
    tamano: new FormControl<string>(TamanoPerro.MEDIANO, { nonNullable: true }),
    numero: new FormControl<number>(1, { nonNullable: true }),
    modalidad: new FormControl<string>(ModalidadTransporte.COMPARTIDO, { nonNullable: true }),
    personas: new FormControl<string>('1', { nonNullable: true }),
    equipaje: new FormControl<string>('sin_equipaje', { nonNullable: true }),
    necesidades: new FormControl<string[]>([], { nonNullable: true }),
    necesidadOtra: new FormControl<string>('', { nonNullable: true }),
    comportamiento: new FormControl<string>('', { nonNullable: true }),
    notaTransportista: new FormControl<string>('', { nonNullable: true }),
    preferencias: new FormControl<string[]>([], { nonNullable: true }),
  });

  readonly alta = new FormGroup({
    nombre: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(60)] }),
    especie: new FormControl<string>(EspecieMascota.PERRO, { nonNullable: true }),
    tamano: new FormControl<string>(TamanoPerro.MEDIANO, { nonNullable: true }),
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.volcarEnStore());
  }

  async ngOnInit(): Promise<void> {
    // Sin ruta completa no hay nada que describir: se vuelve a la pantalla 1.
    if (!this.store.rutaCompleta()) {
      void this.router.navigate(['/transporte']);
      return;
    }
    const b = this.store.borrador();
    this.form.patchValue({
      especie: b.especieManual,
      tamano: b.tamanoManual,
      numero: b.numeroManual,
      modalidad: b.modalidad,
      personas: String(Math.min(4, b.personas)),
      equipaje: b.equipaje,
      necesidades: b.necesidades,
      necesidadOtra: b.necesidadOtra,
      comportamiento: b.comportamiento,
      notaTransportista: b.notaTransportista,
      preferencias: b.preferencias,
    }, { emitEvent: false });

    if (this.conSesion()) await this.cargarPerros();
  }

  elegida(perroId: string): boolean {
    return this.elegidas().has(perroId);
  }

  descripcionPerro(p: PerroApi): string {
    const especie = ESPECIE_MASCOTA_LABELS[especieMascotaDe(p.especie)];
    return [p.raza || especie, p.peso ? `${p.peso} kg` : nombreTamanoPerro(tamanoDe(p))].filter(Boolean).join(' · ');
  }

  alternarPerro(p: PerroApi): void {
    const actuales = this.store.borrador().mascotas;
    const siguiente = this.elegida(p._id)
      ? actuales.filter((m) => m.perroId !== p._id)
      : [...actuales, this.aMascota(p)];
    this.store.actualizar({ mascotas: siguiente });
    if (!this.elegida(p._id)) return;
    this.precargarNecesidades(p);
  }

  async guardarAlta(): Promise<void> {
    if (this.alta.invalid) return;
    this.guardandoAlta.set(true);
    this.errorAlta.set(null);
    try {
      const { nombre, especie, tamano } = this.alta.getRawValue();
      const perro = await this.perrosService.crear({ nombre, especie, tamano });
      this.perros.update((lista) => [...lista, perro]);
      this.store.actualizar({ mascotas: [...this.store.borrador().mascotas, this.aMascota(perro)] });
      this.alta.reset({ nombre: '', especie: EspecieMascota.PERRO, tamano: TamanoPerro.MEDIANO });
      this.altaAbierta.set(false);
    } catch {
      this.errorAlta.set('No se pudo guardar la mascota. Revisa el nombre e inténtalo de nuevo.');
    } finally {
      this.guardandoAlta.set(false);
    }
  }

  continuar(): void {
    this.intento.set(true);
    if (this.sinMascotas()) return;
    void this.router.navigate(['/transporte/viaje/resultados']);
  }

  private async cargarPerros(): Promise<void> {
    try {
      const perros = await this.perrosService.misPerros();
      this.perros.set(perros);
      // Con una sola mascota guardada y nada elegido todavía, se da por hecha.
      if (perros.length === 1 && !this.store.borrador().mascotas.length) this.alternarPerro(perros[0]);
    } catch {
      this.perros.set([]);
    }
  }

  private aMascota(p: PerroApi): MascotaElegida {
    return {
      perroId: p._id, nombre: p.nombre, especie: especieMascotaDe(p.especie), tamano: tamanoDe(p),
      foto: p.fotos[0], raza: p.raza,
    };
  }

  /** Lo que la ficha ya sabe se marca solo; el cliente lo puede desmarcar. */
  private precargarNecesidades(p: PerroApi): void {
    const actuales = new Set(this.form.controls.necesidades.value);
    if (p.requiereTransportin) actuales.add('transportin');
    if (p.medicacion?.length) actuales.add('medicacion');
    this.form.controls.necesidades.setValue([...actuales]);
  }

  private volcarEnStore(): void {
    const v = this.form.getRawValue();
    this.store.actualizar({
      especieManual: v.especie as EspecieMascota,
      tamanoManual: v.tamano as TamanoPerro,
      numeroManual: v.numero,
      modalidad: v.modalidad as ModalidadTransporte,
      personas: Number(v.personas) || 1,
      equipaje: v.equipaje,
      necesidades: v.necesidades,
      necesidadOtra: v.necesidadOtra,
      comportamiento: v.comportamiento,
      notaTransportista: v.notaTransportista,
      preferencias: v.preferencias,
    });
  }
}
