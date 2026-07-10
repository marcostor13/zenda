import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { environment } from '../../../environments/environment';

interface Vertical {
  key: VerticalKey;
  label: string;
  icon: string;
  placeholder: string;
  mostrarFechas: boolean;
  mostrarFechaFin: boolean;
  labelFechaInicio: string;
}

interface SearchParams {
  vertical: string | null;
  ciudad: string | null;
  desde: string | null;
  hasta: string | null;
  presupuestoMax: number | null;
  pasajeros: number | null;
  extras: Record<string, string>;
  explicacion: string;
}

const VERTICAL_ROUTES: Record<string, string> = {
  alojamiento: '/alojamiento', transporte: '/transporte',
  veterinaria: '/veterinaria', peluqueria: '/peluqueria',
  adiestramiento: '/adiestramiento',
};

@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [ReactiveFormsModule, RsNavbarComponent, RsIconComponent],
  template: `
<div style="min-height:100vh;background:var(--g-hero)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-24) var(--sp-16);text-align:center">

    <p class="rs-label-caps" style="display:inline-flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-5)">
      <rs-icon name="paw" [size]="14" [stroke]="2"></rs-icon>
      Servicios caninos · España
    </p>

    <h1 style="font-size:var(--f-hero);font-weight:var(--w-9);letter-spacing:-.04em;line-height:1.05;color:var(--t-100);margin-bottom:var(--sp-4)">
      Todo para tu perro,<br><span class="rs-gradient-text">en un solo lugar</span>
    </h1>

    <p style="font-size:var(--f-lg);color:var(--t-300);max-width:56ch;margin-inline:auto;line-height:1.7;margin-bottom:var(--sp-10)">
      Alojamiento, transporte, veterinarios, peluquerías y adiestramiento canino
      en toda España. Encuentra el mejor cuidado y reserva en segundos.
    </p>

    <!-- ── AI SEARCH BAR ────────────────────────────────────────────── -->
    <div style="max-width:700px;margin-inline:auto;margin-bottom:var(--sp-8)">

      <div class="ai-bar" [class.ai-bar--focused]="aiBarFocused()" [class.ai-bar--loading]="aiLoading()">
        <div class="ai-bar__icon">
          <rs-icon name="sparkles" [size]="18" [stroke]="1.75" style="color:var(--c-accent)"></rs-icon>
        </div>
        <input
          class="ai-bar__input"
          placeholder="Describe lo que buscas… «Alojamiento en Madrid para mi perro este finde»"
          [formControl]="aiQueryControl"
          (focus)="aiBarFocused.set(true)"
          (blur)="aiBarFocused.set(false)"
          (keydown.enter)="buscarConIA()" />
        @if (aiQueryControl.value) {
          <button type="button" class="ai-bar__clear" (click)="limpiarAI()">
            <rs-icon name="x" [size]="14" [stroke]="2.5"></rs-icon>
          </button>
        }
        <button
          type="button"
          class="ai-bar__btn"
          [disabled]="aiLoading() || !aiQueryControl.value.trim()"
          (click)="buscarConIA()">
          @if (aiLoading()) {
            <div class="ai-spinner"></div>
          } @else {
            <rs-icon name="arrow-right" [size]="16" [stroke]="2.5"></rs-icon>
          }
        </button>
      </div>

      <!-- Sugerencias -->
      <div class="ai-hints">
        <span class="ai-hint-label">Prueba:</span>
        @for (s of sugerencias; track s) {
          <button class="ai-hint-chip" type="button" (click)="usarSugerencia(s)">{{ s }}</button>
        }
      </div>

      <!-- Resultado IA -->
      @if (aiRespuesta()) {
        <div class="ai-result">
          <div class="ai-result__head">
            <rs-icon name="sparkles" [size]="14" [stroke]="2" style="color:var(--c-accent)"></rs-icon>
            <span>{{ aiRespuesta()!.explicacion }}</span>
          </div>
          @if (aiRespuesta()!.vertical) {
            <button type="button" class="ai-result__cta" (click)="navigarDesdeIA()">
              Ir a {{ aiRespuesta()!.vertical }} →
            </button>
          }
        </div>
      }

      @if (aiError()) {
        <div class="ai-error">{{ aiError() }}</div>
      }
    </div>

    <!-- ── Divisor ──────────────────────────────────────────────────── -->
    <div class="divider-or"><span>o busca por categoría</span></div>

    <!-- ── Selector de vertical ──────────────────────────────────────── -->
    <div class="rs-vtabs" style="justify-content:center;margin-bottom:var(--sp-6)">
      @for (v of verticales; track v.key) {
        <button
          class="rs-vtab"
          [class.active]="verticalSeleccionado() === v.key"
          (click)="seleccionarVertical(v.key)">
          <rs-icon [name]="v.icon" [size]="16" [stroke]="2"></rs-icon>
          {{ v.label }}
        </button>
      }
    </div>

    <!-- ── Search box ─────────────────────────────────────────────────── -->
    <div class="rs-search" style="max-width:900px;margin-inline:auto">
      <form [formGroup]="formulario" (ngSubmit)="onBuscar()">
        <div class="rs-search__row">

          <div class="rs-field rs-field--grow">
            <label class="rs-lbl">{{ verticalActual().key === 'transporte' ? 'Ciudad de recogida' : 'Ciudad o zona' }}</label>
            <input formControlName="ciudad" class="rs-inp" [placeholder]="verticalActual().placeholder" />
          </div>

          @if (verticalActual().mostrarFechas) {
            <div class="rs-field">
              <label class="rs-lbl">{{ verticalActual().labelFechaInicio }}</label>
              <input formControlName="fechaInicio" type="date" class="rs-inp" />
            </div>
          }

          @if (verticalActual().mostrarFechaFin) {
            <div class="rs-field">
              <label class="rs-lbl">Check-out</label>
              <input formControlName="fechaFin" type="date" class="rs-inp" />
            </div>
          }

          <button type="submit" class="rs-btn rs-btn--primary rs-btn--lg" style="align-self:flex-end;display:inline-flex;align-items:center;gap:var(--sp-2);white-space:nowrap">
            <rs-icon name="search" [size]="18" [stroke]="2"></rs-icon>
            Buscar
          </button>

        </div>
      </form>
    </div>

    <!-- ── Stats ─────────────────────────────────────────────────────── -->
    <div style="display:flex;gap:var(--sp-10);margin-top:var(--sp-14);justify-content:center;flex-wrap:wrap">
      @for (stat of stats; track stat.label) {
        <div style="text-align:center">
          <div style="font-size:var(--f-3xl);font-weight:var(--w-9);letter-spacing:-.04em;color:var(--t-100)">{{ stat.valor }}</div>
          <div style="font-size:var(--f-sm);color:var(--t-400);margin-top:var(--sp-1)">{{ stat.label }}</div>
        </div>
      }
    </div>

  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    /* ─── AI Bar ─────────────────────────────────────────────────── */
    .ai-bar {
      display: flex; align-items: center; gap: var(--sp-3);
      background: rgba(255,255,255,.97); border: 1.5px solid rgba(11,27,51,.10);
      border-radius: 999px; padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-5);
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      transition: border-color .2s, box-shadow .2s;
    }
    .ai-bar--focused {
      border-color: var(--c-accent);
      box-shadow: 0 8px 40px rgba(0,0,0,.18), 0 0 0 4px rgba(79,114,248,.15);
    }
    .ai-bar--loading { opacity: .8; pointer-events: none; }

    .ai-bar__icon { flex-shrink: 0; display: flex; align-items: center; }

    .ai-bar__input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: var(--f-base); color: #0B1B33; min-width: 0;
      font-family: var(--font-sans);
      &::placeholder { color: #97A4B6; }
    }

    .ai-bar__clear {
      background: none; border: none; cursor: pointer; color: #97A4B6;
      display: flex; align-items: center; padding: var(--sp-1);
      &:hover { color: #0B1B33; }
    }

    .ai-bar__btn {
      width: 40px; height: 40px; border-radius: 999px; border: none;
      background: var(--g-accent); color: #fff; cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: opacity .2s, transform .15s;
      &:disabled { opacity: .45; cursor: not-allowed; }
      &:not(:disabled):hover { transform: scale(1.06); }
    }

    .ai-spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
      animation: spin .75s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .ai-hints {
      display: flex; align-items: center; flex-wrap: wrap;
      gap: var(--sp-2); margin-top: var(--sp-3); justify-content: center;
    }
    .ai-hint-label { font-size: var(--f-xs); color: rgba(255,255,255,.5); }
    .ai-hint-chip {
      background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.18);
      color: rgba(255,255,255,.70); border-radius: 999px;
      padding: var(--sp-1) var(--sp-3); font-size: var(--f-xs); cursor: pointer;
      transition: all .2s; backdrop-filter: blur(4px);
      &:hover { background: rgba(255,255,255,.20); color: #fff; border-color: rgba(255,255,255,.35); }
    }

    .ai-result {
      margin-top: var(--sp-3); background: rgba(255,255,255,.95);
      border-radius: var(--r-xl); padding: var(--sp-3) var(--sp-5);
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-4); border: 1px solid rgba(79,114,248,.25);
      box-shadow: 0 4px 16px rgba(0,0,0,.10);
      animation: fadeIn .25s ease;
    }
    .ai-result__head {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: #0B1B33; text-align: left;
    }
    .ai-result__cta {
      background: none; border: none; color: var(--c-accent);
      font-size: var(--f-sm); font-weight: var(--w-6); cursor: pointer;
      white-space: nowrap;
      &:hover { text-decoration: underline; }
    }
    .ai-error {
      font-size: var(--f-xs); color: rgba(255,255,255,.55);
      margin-top: var(--sp-2); text-align: center;
    }

    .divider-or {
      display: flex; align-items: center; gap: var(--sp-4);
      max-width: 380px; margin: var(--sp-6) auto;
      color: rgba(255,255,255,.35); font-size: var(--f-xs);
      text-transform: uppercase; letter-spacing: .1em;
      &::before, &::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,.15); }
    }

    /* ─── Search Box ───────────────────────────────────────────── */
    .rs-search {
      background: rgba(255,255,255,.97); backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(11,27,51,.10);
      box-shadow: var(--sh-xl); border-radius: var(--r-2xl);
      padding: var(--sp-5) var(--sp-6);
    }
    .rs-search__row {
      display: flex; gap: var(--sp-4); align-items: flex-end; flex-wrap: wrap;
    }
    .rs-field {
      display: flex; flex-direction: column; gap: var(--sp-1); flex: 1; min-width: 130px;
    }
    .rs-field--grow { flex: 2; }
    .rs-lbl {
      font-size: var(--f-xs); font-weight: var(--w-6); color: #5A6B82;
      letter-spacing: .04em; text-transform: uppercase;
    }
    .rs-inp {
      border: 1px solid #D1D9E6; border-radius: var(--r-lg);
      padding: var(--sp-3) var(--sp-4); font-size: var(--f-base); color: #0B1B33;
      background: transparent; outline: none;
      transition: border-color .2s, box-shadow .2s; font-family: var(--font-sans);
      &:focus { border-color: #4F72F8; box-shadow: 0 0 0 3px rgba(79,114,248,.15); }
      &::placeholder { color: #97A4B6; }
    }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  `],
})
export class BuscadorComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  readonly verticalSeleccionado = signal<VerticalKey>(VerticalKey.ALOJAMIENTO);
  readonly aiBarFocused = signal(false);
  readonly aiLoading = signal(false);
  readonly aiRespuesta = signal<SearchParams | null>(null);
  readonly aiError = signal('');

  readonly aiQueryControl = new FormControl('', { nonNullable: true });

  readonly verticales: Vertical[] = [
    { key: VerticalKey.ALOJAMIENTO,    label: 'Alojamiento canino',     icon: 'hotel',          placeholder: '¿En qué ciudad buscas alojamiento para tu perro?', mostrarFechas: true, mostrarFechaFin: true,  labelFechaInicio: 'Check-in' },
    { key: VerticalKey.TRANSPORTE,     label: 'Transporte de animales', icon: 'truck',          placeholder: 'Ciudad de recogida',                               mostrarFechas: true, mostrarFechaFin: false, labelFechaInicio: 'Fecha' },
    { key: VerticalKey.VETERINARIA,    label: 'Veterinarios',           icon: 'stethoscope',    placeholder: 'Ciudad de la clínica',                             mostrarFechas: true, mostrarFechaFin: false, labelFechaInicio: 'Fecha de la cita' },
    { key: VerticalKey.PELUQUERIA,     label: 'Peluquerías caninas',    icon: 'scissors',       placeholder: 'Ciudad',                                           mostrarFechas: true, mostrarFechaFin: false, labelFechaInicio: 'Fecha de la cita' },
    { key: VerticalKey.ADIESTRAMIENTO, label: 'Adiestramiento canino',  icon: 'graduation-cap', placeholder: 'Ciudad',                                           mostrarFechas: true, mostrarFechaFin: false, labelFechaInicio: 'Fecha de la sesión' },
  ];

  readonly sugerencias = [
    'Alojamiento en Madrid para mi golden este fin de semana',
    'Transporte para mi perro de Madrid a Valencia',
    'Veterinario en Barcelona para vacunación',
    'Peluquería canina en Sevilla para caniche',
  ];

  readonly stats = [
    { valor: '+2,400', label: 'Comercios caninos' },
    { valor: '+48K',   label: 'Reservas' },
    { valor: '4.8★',   label: 'Calificación' },
    { valor: '5',      label: 'Categorías' },
  ];

  readonly formulario = this.fb.group({
    ciudad:     [''],
    destino:    [''],
    fechaInicio:[''],
    fechaFin:   [''],
  });

  readonly verticalActual = computed(() =>
    this.verticales.find(v => v.key === this.verticalSeleccionado()) ?? this.verticales[0]
  );

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const vertical = qp.get('vertical');
    if (vertical && Object.values(VerticalKey).includes(vertical as VerticalKey)) {
      this.verticalSeleccionado.set(vertical as VerticalKey);
    }
    this.formulario.patchValue({
      ciudad: qp.get('ciudad') ?? '',
      fechaInicio: qp.get('desde') ?? '',
      fechaFin: qp.get('hasta') ?? '',
    });
  }

  seleccionarVertical(vertical: VerticalKey): void {
    this.verticalSeleccionado.set(vertical);
  }

  usarSugerencia(sugerencia: string): void {
    this.aiQueryControl.setValue(sugerencia);
    void this.buscarConIA();
  }

  limpiarAI(): void {
    this.aiQueryControl.setValue('');
    this.aiRespuesta.set(null);
    this.aiError.set('');
  }

  async buscarConIA(): Promise<void> {
    const query = this.aiQueryControl.value.trim();
    if (!query) return;
    this.aiLoading.set(true);
    this.aiError.set('');
    this.aiRespuesta.set(null);

    try {
      const resultado = await firstValueFrom(
        this.http.post<SearchParams>(`${environment.apiUrl}/ai-search`, { query }),
      );
      this.aiRespuesta.set(resultado);

      if (resultado.ciudad) this.formulario.patchValue({ ciudad: resultado.ciudad });
      if (resultado.desde)  this.formulario.patchValue({ fechaInicio: resultado.desde });
      if (resultado.hasta)  this.formulario.patchValue({ fechaFin: resultado.hasta });
      if (resultado.extras?.['destino']) this.formulario.patchValue({ destino: resultado.extras['destino'] });
      if (resultado.extras?.['origen'])  this.formulario.patchValue({ ciudad: resultado.extras['origen'] });

      const v = resultado.vertical;
      if (v && Object.values(VerticalKey).includes(v as VerticalKey)) {
        this.verticalSeleccionado.set(v as VerticalKey);
      }
    } catch {
      this.aiError.set('No se pudo conectar con el asistente. Usa el formulario de búsqueda.');
    } finally {
      this.aiLoading.set(false);
    }
  }

  navigarDesdeIA(): void {
    const params = this.aiRespuesta();
    if (!params) return;
    const ruta = VERTICAL_ROUTES[params.vertical ?? ''] ?? '/alojamiento';
    void this.router.navigate([ruta], {
      queryParams: {
        ciudad: params.ciudad ?? null,
        desde: params.desde ?? null,
        hasta: params.hasta ?? null,
        destino: params.extras?.['destino'] ?? null,
      },
    });
  }

  onBuscar(): void {
    const { ciudad, destino, fechaInicio, fechaFin } = this.formulario.value;
    const vertical = this.verticalSeleccionado();
    const ruta = VERTICAL_ROUTES[vertical] ?? '/alojamiento';
    void this.router.navigate([ruta], {
      queryParams: {
        ciudad: ciudad || null,
        destino: destino || null,
        desde: fechaInicio || null,
        hasta: fechaFin || null,
      },
    });
  }
}
