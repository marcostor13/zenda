import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { descargarFichero } from '../../shared/exportacion/descarga';
import { nombreInforme } from '../../shared/exportacion/descargar-archivo';
import {
  PerrosService, PerroApi, IndiceComportamientoApi, IndiceBienestarApi,
  porcentajeCompletitud,
} from './perros.service';

/** Etiqueta de estado de la ficha: icono Lucide + variante del badge (TCK-8010). */
interface EtiquetaEstado {
  readonly icon: string;
  readonly variante: 'success' | 'warning';
  readonly label: string;
}

@Component({
  selector: 'app-perros-lista',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, RsNavbarComponent, RsIconComponent, ImgFallbackDirective
  ],
  template: `
<div class="dk-pagina">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ 'Mis perros' | t }}</h1>
        <p class="page-sub">{{ 'Su Ficha Inteligente: regístralos una vez y las peluquerías, residencias, veterinarios y adiestradores de Doogking adaptarán el servicio automáticamente a cada uno.' | t }}</p>
      </div>
      <a routerLink="/perros/nuevo" class="rs-btn rs-btn--primary">
        <rs-icon name="plus" [size]="16" [stroke]="2"></rs-icon>
        {{ 'Añadir perro' | t }}
      </a>
    </div>

    @if (cargando()) {
      <div class="rs-card" style="padding:var(--sp-16);text-align:center;color:var(--t-400)">{{ 'Cargando…' | t }}</div>
    } @else if (perros().length === 0) {
      <div class="rs-card empty-state">
        <rs-icon name="paw" [size]="40" [stroke]="1.25" style="color:var(--t-400)"></rs-icon>
        <p>{{ 'Aún no has registrado ningún perro.' | t }}</p>
        <a routerLink="/perros/nuevo" class="rs-btn rs-btn--primary rs-btn--sm">{{ 'Registrar mi primer perro' | t }}</a>
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
              <h3><a [routerLink]="['/perros', p._id]" class="perro-card__nombre">{{ p.nombre }}</a></h3>
              <p class="perro-card__linea">
                {{ p.raza || 'Mestizo' }}
                @if (p.peso) { · {{ p.peso }} kg }
                @if (edadDe(p)) { · {{ edadDe(p) }} }
                @if (p.sexo) { · {{ p.sexo === 'macho' ? 'Macho' : 'Hembra' }} }
                @if (p.ciudad) {
                  · <rs-icon name="map-pin" [size]="13" [stroke]="2"></rs-icon> {{ p.ciudad }}
                }
              </p>
              <div class="perro-card__badges">
                @for (t of etiquetasEstado(p); track t.label) {
                  <span class="rs-badge" [class]="'rs-badge--' + t.variante">
                    <rs-icon [name]="t.icon" [size]="13" [stroke]="2.5"></rs-icon> {{ t.label | t }}
                  </span>
                }
                @if (p.tamano) { <span class="rs-badge">{{ p.tamano }}</span> }
                @if (p.temperamento) { <span class="rs-badge rs-badge--accent">{{ p.temperamento }}</span> }
                @if (indices()[p._id]?.totalValoraciones) {
                  <span class="rs-badge rs-badge--success">
                    <rs-icon name="star" [size]="13" [stroke]="2.5"></rs-icon>
                    {{ indices()[p._id].puntuacionPromedio }} ({{ indices()[p._id].totalValoraciones }})
                  </span>
                }
                @if (p.nivelDoogking) {
                  <span class="rs-badge rs-badge--accent">
                    <rs-icon name="graduation-cap" [size]="13" [stroke]="2"></rs-icon>
                    Nivel Doogking {{ p.nivelDoogking }}/5
                  </span>
                }
                @if (bienestar()[p._id]; as ib) {
                  <span class="rs-badge" [class]="'rs-badge--' + varianteBienestar(ib.nivel)">
                    <rs-icon [name]="iconoBienestar(ib.nivel)" [size]="13" [stroke]="2.5"></rs-icon>
                    Bienestar {{ ib.puntuacion }}/100
                  </span>
                }
              </div>
              <div class="perro-card__completitud">
                <div class="perro-card__completitud-track">
                  <div class="perro-card__completitud-fill" [style.width.%]="porcentajeCompletitud(p)"></div>
                </div>
                <span>Ficha inteligente: {{ porcentajeCompletitud(p) }}% completada</span>
              </div>

            </div>
            <div class="perro-card__actions">
              <a [routerLink]="['/perros', p._id]" class="rs-btn rs-btn--primary rs-btn--sm">
                <rs-icon name="clipboard-list" [size]="13" [stroke]="2"></rs-icon>
                {{ 'Ver ficha completa' | t }}
              </a>
              <button type="button" class="rs-btn rs-btn--outline rs-btn--sm"
                      [disabled]="descargandoId() === p._id"
                      (click)="descargarInforme(p)">
                <rs-icon name="download" [size]="13" [stroke]="2"></rs-icon>
                {{ descargandoId() === p._id ? ('Preparando…' | t) : ('Informe PDF' | t) }}
              </button>
              <a [routerLink]="['/perros', p._id, 'editar']" class="rs-btn rs-btn--outline rs-btn--sm">
                <rs-icon name="pencil" [size]="13" [stroke]="2"></rs-icon>
                {{ 'Editar' | t }}
              </a>
              <a [routerLink]="['/perros', p._id, 'privacidad']" class="rs-btn rs-btn--outline rs-btn--sm">
                <rs-icon name="lock" [size]="13" [stroke]="2"></rs-icon>
                {{ 'Privacidad' | t }}
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

    .perros-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: var(--sp-4); }
    .perro-card { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-4); }
    .perro-card__avatar {
      width: 56px; height: 56px; border-radius: 50%; background: var(--c-raised);
      display: flex; align-items: center; justify-content: center; color: var(--t-300); overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .perro-card__info h3 { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); }
    .perro-card__nombre { color: inherit; text-decoration: none; &:hover { color: var(--c-accent); } }
    .perro-card__info p { font-size: var(--f-sm); color: var(--t-400); margin-top: 2px; }
    .perro-card__linea { display: block; }
    .perro-card__badges { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-2); }
    .perro-card__completitud { margin-top: var(--sp-3); font-size: var(--f-xs); color: var(--t-400); }
    .perro-card__completitud-track { height: 4px; border-radius: var(--r-full); background: var(--c-raised); overflow: hidden; margin-bottom: var(--sp-1); }
    .perro-card__completitud-fill { height: 100%; background: var(--dk-gold); border-radius: var(--r-full); transition: width var(--d-3); }
    .perro-card__actions { display: flex; gap: var(--sp-2); margin-top: auto; flex-wrap: wrap; }
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

  /** Ficha cuyo informe se está preparando; el PDF se arma en el servidor. */
  readonly descargandoId = signal<string | null>(null);

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

  /** Icono Lucide del nivel de bienestar; el color lo pone la variante del badge. */
  iconoBienestar(nivel: IndiceBienestarApi['nivel']): string {
    return { inicial: 'circle', bueno: 'trending-up', muy_bueno: 'check-circle', excelente: 'award' }[nivel];
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
  etiquetasEstado(p: PerroApi): EtiquetaEstado[] {
    const tags: EtiquetaEstado[] = [];
    if (p.sociabilidadPerros === 'alta') tags.push({ icon: 'users', variante: 'success', label: 'Sociable' });
    if (p.vacunas.length > 0 || (p.vacunasDetalle?.length ?? 0) > 0) {
      tags.push({ icon: 'syringe', variante: 'success', label: 'Vacunada' });
    }
    if (p.esterilizado) tags.push({ icon: 'check-circle', variante: 'success', label: 'Esterilizada' });
    if (p.ansiedadSeparacion || /nervios/i.test(p.temperamento ?? '')) {
      tags.push({ icon: 'alert-triangle', variante: 'warning', label: 'Nerviosa' });
    }
    if (p.microchip) tags.push({ icon: 'radio-tower', variante: 'success', label: 'Microchip' });
    return tags;
  }

  /**
   * Descarga el informe de salud en PDF.
   *
   * Es el documento que el cliente se lleva a otro profesional: la ficha, la
   * salud y todas las anotaciones que le han dejado, no las tres que caben en
   * el resumen de esta pantalla.
   */
  async descargarInforme(p: PerroApi): Promise<void> {
    this.descargandoId.set(p._id);
    this.errorMsg.set('');
    try {
      const pdf = await this.perrosService.informePdf(p._id);
      descargarFichero(pdf, nombreInforme(p.nombre));
    } catch {
      this.errorMsg.set('No se pudo preparar el informe. Inténtalo de nuevo.');
    } finally {
      this.descargandoId.set(null);
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
