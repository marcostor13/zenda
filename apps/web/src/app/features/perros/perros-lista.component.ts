import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { PerrosService, PerroApi, IndiceComportamientoApi } from './perros.service';

@Component({
  selector: 'app-perros-lista',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, RsIconComponent],
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
                <img [src]="p.fotos[0]" [alt]="p.nombre" />
              } @else {
                <rs-icon name="paw" [size]="28" [stroke]="1.5"></rs-icon>
              }
            </div>
            <div class="perro-card__info">
              <h3>{{ p.nombre }}</h3>
              <p>{{ p.raza || 'Mestizo' }} @if (p.peso) { · {{ p.peso }} kg }</p>
              <div class="perro-card__badges">
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
              </div>
            </div>
            <div class="perro-card__actions">
              <a [routerLink]="['/perros', p._id, 'editar']" class="rs-btn rs-btn--outline rs-btn--sm">
                <rs-icon name="pencil" [size]="13" [stroke]="2"></rs-icon>
                Editar
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
    .perro-card__badges { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-2); }
    .perro-card__actions { display: flex; gap: var(--sp-2); margin-top: auto; }
  `],
})
export class PerrosListaComponent implements OnInit {
  private readonly perrosService = inject(PerrosService);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly perros = signal<PerroApi[]>([]);
  readonly eliminandoId = signal<string | null>(null);
  readonly indices = signal<Record<string, IndiceComportamientoApi>>({});

  async ngOnInit(): Promise<void> {
    try {
      const perros = await this.perrosService.misPerros();
      this.perros.set(perros);
      await this.cargarIndices(perros);
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
