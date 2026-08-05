import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import {
  PerrosService, PerroApi, IndiceComportamientoApi, IndiceBienestarApi, PerroHistorialApi,
  porcentajeCompletitud,
} from './perros.service';

@Component({
  selector: 'app-perros-lista',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, RsIconComponent, ImgFallbackDirective],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">
    <div class="page-header">
      <div>
        <h1 class="page-title">Mis perros</h1>
        <p class="page-sub">Su Ficha Inteligente: regístralos una vez y las peluquerías, residencias, veterinarios y
          adiestradores de Doogking adaptarán el servicio automáticamente a cada uno.</p>
      </div>
      <a routerLink="/perros/nuevo" class="rs-btn rs-btn--primary">
        <rs-icon name="plus" [size]="16" [stroke]="2"></rs-icon>
        Añadir perro
      </a>
    </div>

    @if (cargando()) {
      <div class="rs-card" style="padding:var(--sp-16);text-align:center;color:var(--t-400)">Cargando…</div>
    } @else if (perros().length === 0) {
      <div class="rs-card empty-state">
        <rs-icon name="paw" [size]="40" [stroke]="1.25" style="color:var(--t-400)"></rs-icon>
        <p>Aún no has registrado ningún perro.</p>
        <a routerLink="/perros/nuevo" class="rs-btn rs-btn--primary rs-btn--sm">Registrar mi primer perro</a>
      </div>
    } @else {
      <div class="perros-grid">
        @for (p of perros(); track p._id) {
          <div class="rs-card perro-card">
            <div class="perro-card__avatar">
              @if (p.fotos.length) {
                <img [src]="p.fotos[0]" [alt]="p.nombre" rsImg />
              } @else {
                <rs-icon name="paw" [size]="28" [stroke]="1.5"></rs-icon>
              }
            </div>
            <div class="perro-card__info">
              <h3>{{ p.nombre }}</h3>
              <p class="perro-card__linea">
                {{ p.raza || 'Mestizo' }}
                @if (p.peso) { · {{ p.peso }} kg }
                @if (edadDe(p)) { · {{ edadDe(p) }} }
                @if (p.sexo) { · {{ p.sexo === 'macho' ? 'Macho' : 'Hembra' }} }
                @if (p.ciudad) { · 📍 {{ p.ciudad }} }
              </p>
              <div class="perro-card__badges">
                @for (t of etiquetasEstado(p); track t.label) {
                  <span class="rs-badge" [class]="t.icon === '🟡' ? 'rs-badge--warning' : 'rs-badge--success'">{{ t.icon }} {{ t.label }}</span>
                }
                @if (p.tamano) { <span class="rs-badge">{{ p.tamano }}</span> }
                @if (p.temperamento) { <span class="rs-badge rs-badge--accent">{{ p.temperamento }}</span> }
                @if (indices()[p._id]?.totalValoraciones) {
                  <span class="rs-badge rs-badge--success">
                    ★ {{ indices()[p._id].puntuacionPromedio }} ({{ indices()[p._id].totalValoraciones }})
                  </span>
                }
                @if (p.nivelDoogking) {
                  <span class="rs-badge rs-badge--accent">🎓 Nivel Doogking {{ p.nivelDoogking }}/5</span>
                }
                @if (bienestar()[p._id]; as ib) {
                  <span class="rs-badge" [class]="'rs-badge--' + varianteBienestar(ib.nivel)">
                    {{ iconoBienestar(ib.nivel) }} Bienestar {{ ib.puntuacion }}/100
                  </span>
                }
              </div>
              <div class="perro-card__completitud">
                <div class="perro-card__completitud-track">
                  <div class="perro-card__completitud-fill" [style.width.%]="porcentajeCompletitud(p)"></div>
                </div>
                <span>Ficha inteligente: {{ porcentajeCompletitud(p) }}% completada</span>
              </div>

              @if (historialAbiertoId() === p._id) {
                <div class="perro-card__resumen">
                  <strong>Resumen de salud</strong>
                  <div class="perro-card__salud">
                    <span [class.ok]="p.vacunas.length > 0 || (p.vacunasDetalle?.length ?? 0) > 0">
                      {{ (p.vacunas.length > 0 || (p.vacunasDetalle?.length ?? 0) > 0) ? '✔' : '⚠' }} Vacunas registradas
                    </span>
                    <span [class.ok]="!!p.microchip">{{ p.microchip ? '✔' : '⚠' }} Microchip registrado</span>
                    <span [class.ok]="p.esterilizado">{{ p.esterilizado ? '✔' : '⚠' }} Esterilizado</span>
                  </div>
                  @if (indices()[p._id]; as ic) {
                    <strong>Estadísticas</strong>
                    <p class="perro-card__stats">★ {{ ic.puntuacionPromedio }} valoración media de profesionales · {{ ic.totalValoraciones }} servicios valorados</p>
                  }
                  <strong>Historial reciente</strong>
                  @if (historialCargando()) {
                    <p class="perro-card__stats">Cargando…</p>
                  } @else if ((historialPorPerro()[p._id] ?? []).length === 0) {
                    <p class="perro-card__stats">Todavía no hay notas de profesionales en el historial.</p>
                  } @else {
                    @for (h of (historialPorPerro()[p._id] ?? []).slice(0, 3); track h._id) {
                      <p class="perro-card__stats">{{ h.vertical }} · {{ h.nota }}</p>
                    }
                  }
                </div>
              }
            </div>
            <div class="perro-card__actions">
              <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="toggleHistorial(p)">
                <rs-icon name="check-circle" [size]="13" [stroke]="2"></rs-icon>
                {{ historialAbiertoId() === p._id ? 'Ocultar resumen' : 'Ver ficha completa' }}
              </button>
              <a [routerLink]="['/perros', p._id, 'editar']" class="rs-btn rs-btn--outline rs-btn--sm">
                <rs-icon name="pencil" [size]="13" [stroke]="2"></rs-icon>
                Editar
              </a>
              <a [routerLink]="['/perros', p._id, 'privacidad']" class="rs-btn rs-btn--outline rs-btn--sm">
                <rs-icon name="lock" [size]="13" [stroke]="2"></rs-icon>
                Privacidad
              </a>
              <button class="rs-btn rs-btn--ghost rs-btn--sm" [disabled]="eliminandoId() === p._id"
                      (click)="eliminar(p)">
                {{ eliminandoId() === p._id ? 'Eliminando…' : 'Eliminar' }}
              </button>
            </div>
          </div>
        }
      </div>
    }

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-4)">{{ errorMsg() }}</div>
    }
  </div>
</div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-4); flex-wrap: wrap; margin-bottom: var(--sp-8); }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); max-width: 560px; }

    .empty-state {
      padding: var(--sp-16); text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-4);
      p { color: var(--t-400); font-size: var(--f-md); }
    }

    .perros-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--sp-4); }
    .perro-card { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-4); }
    .perro-card__avatar {
      width: 56px; height: 56px; border-radius: 50%; background: var(--c-raised);
      display: flex; align-items: center; justify-content: center; color: var(--t-300); overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .perro-card__info h3 { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); }
    .perro-card__info p { font-size: var(--f-sm); color: var(--t-400); margin-top: 2px; }
    .perro-card__linea { display: block; }
    .perro-card__badges { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-2); }
    .perro-card__completitud { margin-top: var(--sp-3); font-size: var(--f-xs); color: var(--t-400); }
    .perro-card__completitud-track { height: 4px; border-radius: var(--r-full); background: var(--c-raised); overflow: hidden; margin-bottom: var(--sp-1); }
    .perro-card__completitud-fill { height: 100%; background: var(--dk-gold); border-radius: var(--r-full); transition: width var(--d-3); }
    .perro-card__actions { display: flex; gap: var(--sp-2); margin-top: auto; flex-wrap: wrap; }
    .perro-card__resumen {
      margin-top: var(--sp-3); padding: var(--sp-3); border-radius: var(--r-lg); background: var(--c-raised);
      display: flex; flex-direction: column; gap: var(--sp-1);
      strong { font-size: var(--f-xs); color: var(--t-200); margin-top: var(--sp-2); &:first-child { margin-top: 0; } }
    }
    .perro-card__salud { display: flex; flex-direction: column; gap: 2px; font-size: var(--f-xs); color: var(--t-400);
      span.ok { color: var(--c-success, #16A34A); }
    }
    .perro-card__stats { font-size: var(--f-xs); color: var(--t-400); margin: 0; }
  `],
})
export class PerrosListaComponent implements OnInit {
  private readonly perrosService = inject(PerrosService);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly perros = signal<PerroApi[]>([]);
  readonly eliminandoId = signal<string | null>(null);
  readonly indices = signal<Record<string, IndiceComportamientoApi>>({});
  readonly bienestar = signal<Record<string, IndiceBienestarApi>>({});
  readonly porcentajeCompletitud = porcentajeCompletitud;

  /** HU-8.1.3/8.1.4: resumen de salud/historial expandible por mascota. */
  readonly historialAbiertoId = signal<string | null>(null);
  readonly historialPorPerro = signal<Record<string, PerroHistorialApi[]>>({});
  readonly historialCargando = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const perros = await this.perrosService.misPerros();
      this.perros.set(perros);
      await this.cargarIndices(perros);
      await this.cargarBienestar(perros);
    } catch {
      this.errorMsg.set('No se pudieron cargar tus perros. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarIndices(perros: PerroApi[]): Promise<void> {
    const entradas = await Promise.all(
      perros.map(async (p) => [p._id, await this.perrosService.indiceComportamiento(p._id).catch(() => null)] as const),
    );
    const mapa: Record<string, IndiceComportamientoApi> = {};
    for (const [id, indice] of entradas) {
      if (indice) mapa[id] = indice;
    }
    this.indices.set(mapa);
  }

  /** Índice de Bienestar (HU-8.1.7): cuidado preventivo, no un juicio al propietario. */
  private async cargarBienestar(perros: PerroApi[]): Promise<void> {
    const entradas = await Promise.all(
      perros.map(async (p) => [p._id, await this.perrosService.bienestar(p._id).catch(() => null)] as const),
    );
    const mapa: Record<string, IndiceBienestarApi> = {};
    for (const [id, indice] of entradas) {
      if (indice) mapa[id] = indice;
    }
    this.bienestar.set(mapa);
  }

  iconoBienestar(nivel: IndiceBienestarApi['nivel']): string {
    return { inicial: '⚪', bueno: '🟡', muy_bueno: '🟢', excelente: '🟢' }[nivel];
  }

  varianteBienestar(nivel: IndiceBienestarApi['nivel']): 'neutral' | 'warning' | 'success' {
    return { inicial: 'neutral', bueno: 'warning', muy_bueno: 'success', excelente: 'success' }[nivel] as 'neutral' | 'warning' | 'success';
  }

  /** HU-8.1.1: edad legible desde la fecha de nacimiento. */
  edadDe(p: PerroApi): string | null {
    if (!p.fechaNacimiento) return null;
    const nacimiento = new Date(p.fechaNacimiento);
    if (Number.isNaN(nacimiento.getTime())) return null;
    const meses = (Date.now() - nacimiento.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
    if (meses < 12) return `${Math.max(1, Math.round(meses))} meses`;
    return `${Math.floor(meses / 12)} años`;
  }

  /** HU-8.1.1: etiquetas de estado a partir de datos reales, nunca texto manual. */
  etiquetasEstado(p: PerroApi): { icon: string; label: string }[] {
    const tags: { icon: string; label: string }[] = [];
    if (p.sociabilidadPerros === 'alta') tags.push({ icon: '🟢', label: 'Sociable' });
    if (p.vacunas.length > 0 || (p.vacunasDetalle?.length ?? 0) > 0) tags.push({ icon: '🟢', label: 'Vacunada' });
    if (p.esterilizado) tags.push({ icon: '🟢', label: 'Esterilizada' });
    if (p.ansiedadSeparacion || /nervios/i.test(p.temperamento ?? '')) tags.push({ icon: '🟡', label: 'Nerviosa' });
    if (p.microchip) tags.push({ icon: '🟢', label: 'Microchip' });
    return tags;
  }

  /** HU-8.1.3/8.1.4: abre/cierra el resumen de salud e historial, con carga perezosa. */
  async toggleHistorial(p: PerroApi): Promise<void> {
    if (this.historialAbiertoId() === p._id) {
      this.historialAbiertoId.set(null);
      return;
    }
    this.historialAbiertoId.set(p._id);
    if (this.historialPorPerro()[p._id]) return;
    this.historialCargando.set(true);
    try {
      const historial = await this.perrosService.historial(p._id);
      this.historialPorPerro.update((mapa) => ({ ...mapa, [p._id]: historial }));
    } catch {
      this.historialPorPerro.update((mapa) => ({ ...mapa, [p._id]: [] }));
    } finally {
      this.historialCargando.set(false);
    }
  }

  async eliminar(p: PerroApi): Promise<void> {
    if (!confirm(`¿Eliminar la ficha de ${p.nombre}? Esta acción no se puede deshacer.`)) return;
    this.eliminandoId.set(p._id);
    try {
      await this.perrosService.eliminar(p._id);
      this.perros.update((lista) => lista.filter((x) => x._id !== p._id));
    } catch {
      this.errorMsg.set('No se pudo eliminar el perro. Inténtalo de nuevo.');
    } finally {
      this.eliminandoId.set(null);
    }
  }
}
