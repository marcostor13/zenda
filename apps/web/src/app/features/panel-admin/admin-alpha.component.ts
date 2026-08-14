import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { etiquetaAlphaNivel } from 'shared';
import { AdminApiService, AlphaNivel, ComercioAdmin } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

/**
 * Programa Doogking Alpha en su propio apartado (TCK-8040 §4). Es fidelización
 * de los clientes que reservan: las empresas no tienen nivel, su escalera es el
 * plan Básico / Pro / Premium.
 */
@Component({
  selector: 'app-admin-alpha',
  standalone: true,
  imports: [RsIconComponent],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <rs-icon name="crown" [size]="22" [stroke]="2"></rs-icon>
          Programa Doogking Alpha
        </h1>
        <p class="page-sub">
          Fidelización de los clientes que reservan. Las empresas no tienen nivel Alpha:
          su escalera es el plan Básico / Pro / Premium.
        </p>
      </div>
      <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="guardarNiveles()">
        <rs-icon name="save" [size]="14" [stroke]="2"></rs-icon> Guardar cambios
      </button>
    </div>

    <!-- Escalera de niveles -->
    <div class="rs-card admin-panel">
      <h3 class="panel-titulo">La escalera de niveles</h3>

      @if (cargando()) {
        <p style="color:var(--t-400)">Cargando la escalera…</p>
      } @else {
        <div class="niveles">
          @for (n of niveles(); track n.nivel) {
            <div class="nivel">
              <div class="nivel__cabecera">
                <span class="nivel__insignia">{{ etiquetaNivel(n.nivel) }}</span>
                <label class="campo campo--ancho">
                  <span>Nombre visible</span>
                  <input type="text" class="rs-inp" [value]="n.nombre"
                         (input)="n.nombre = $any($event).target.value" />
                </label>
                <label class="campo">
                  <span>Reservas requeridas</span>
                  <input type="number" class="rs-inp" [value]="n.reservasRequeridas"
                         (input)="n.reservasRequeridas = +$any($event).target.value" />
                </label>
                <label class="campo">
                  <span>Descuento (%)</span>
                  <input type="number" class="rs-inp" [value]="(n.descuentoPct * 100).toFixed(0)"
                         (input)="n.descuentoPct = +$any($event).target.value / 100" />
                </label>
              </div>

              <!-- Beneficios uno a uno: en un campo con comas era imposible
                   escribir un beneficio que llevara coma (TCK-8030 §10). -->
              <div class="beneficios">
                <span class="beneficios__titulo">Beneficios de este nivel</span>
                @for (b of n.beneficios; track $index) {
                  <div class="beneficio">
                    <input type="text" class="rs-inp" [value]="b"
                           (input)="editarBeneficio(n, $index, $any($event).target.value)" />
                    <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                            (click)="quitarBeneficio(n, $index)" aria-label="Quitar beneficio">
                      <rs-icon name="x" [size]="13" [stroke]="2.5"></rs-icon>
                    </button>
                  </div>
                }
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="anadirBeneficio(n)">
                  <rs-icon name="plus" [size]="13" [stroke]="2.5"></rs-icon> Añadir beneficio
                </button>
              </div>
            </div>
          }
        </div>
      }

      @if (guardadoMsg()) {
        <div class="rs-alert rs-alert--success" style="margin-top:var(--sp-4)">
          <rs-icon name="check-circle" [size]="15" [stroke]="2"></rs-icon> Programa Alpha actualizado exitosamente
        </div>
      }
      @if (errorMsg()) {
        <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-4)">{{ errorMsg() }}</div>
      }
    </div>

    <!-- Empresas adheridas: se gestiona dentro del programa, no en la ficha del
         comercio, porque Alpha no es un atributo de la empresa (TCK-8034). -->
    <div class="rs-card admin-panel">
      <h3 class="panel-titulo">Empresas que aplican descuentos Alpha</h3>
      <p class="panel-nota">
        No es un nivel del comercio: sólo indica que acepta aplicar el descuento Alpha
        a los clientes del programa.
      </p>

      <div class="buscador">
        <input type="text" class="rs-inp" placeholder="Buscar una empresa por nombre o CIF…"
               [value]="busqueda()" (input)="busqueda.set($any($event).target.value)"
               (keyup.enter)="buscarComercios()" />
        <button class="rs-btn rs-btn--secondary rs-btn--sm" (click)="buscarComercios()">
          <rs-icon name="search" [size]="14" [stroke]="2"></rs-icon> Buscar
        </button>
      </div>

      @if (resultados().length > 0) {
        <div class="adheridos">
          @for (c of resultados(); track c._id) {
            <div class="adherido">
              <span class="adherido__nombre">{{ c.nombreComercial }}</span>
              <span class="adherido__vat">{{ c.vatNumber }}</span>
              <button class="rs-btn rs-btn--sm"
                [class.rs-btn--ghost]="!c.alphaAdherido"
                [class.rs-btn--primary]="c.alphaAdherido"
                [disabled]="accionando() === c._id"
                (click)="alternarAdhesion(c)">
                {{ c.alphaAdherido ? 'Dar de baja' : 'Adherir' }}
              </button>
            </div>
          }
        </div>
      } @else {
        <p class="vacio">
          {{ buscado()
             ? 'Ninguna empresa coincide con la búsqueda.'
             : 'Todavía no hay empresas adheridas al programa. Búscalas por nombre para darlas de alta.' }}
        </p>
      }

      @if (adhesionError()) {
        <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-3)">{{ adhesionError() }}</div>
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--sp-4); }
    .page-title { display: inline-flex; align-items: center; gap: var(--sp-3); font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); max-width: 70ch; }

    .admin-panel { padding: var(--sp-6); }
    .panel-titulo { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-2); }
    .panel-nota { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); max-width: 70ch; }

    .niveles { display: flex; flex-direction: column; gap: var(--sp-4); }
    .nivel { background: var(--c-raised); border-radius: var(--r-xl); padding: var(--sp-5); }
    .nivel__cabecera { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--sp-4); margin-bottom: var(--sp-4); }
    .nivel__insignia {
      display: inline-flex; align-items: center; justify-content: center;
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      background: var(--g-warm, var(--c-amber)); color: #00135D;
      font-family: var(--font-accent); font-size: var(--f-sm); font-weight: var(--w-8);
      letter-spacing: .06em;
    }
    .campo { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 130px; }
    .campo--ancho { flex: 1; min-width: 200px; }
    .campo > span { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em; }

    .beneficios { display: flex; flex-direction: column; gap: var(--sp-2); align-items: flex-start; }
    .beneficios__titulo { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em; }
    .beneficio { display: flex; align-items: center; gap: var(--sp-2); width: 100%; max-width: 520px; }

    .buscador { display: flex; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-4); }
    .buscador .rs-inp { flex: 1; min-width: 240px; }
    .adheridos { display: flex; flex-direction: column; gap: var(--sp-2); }
    .adherido {
      display: flex; align-items: center; gap: var(--sp-4); flex-wrap: wrap;
      padding: var(--sp-3) var(--sp-4); background: var(--c-raised); border-radius: var(--r-lg);
    }
    .adherido__nombre { flex: 1; min-width: 160px; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .adherido__vat { font-size: var(--f-xs); color: var(--t-400); }
    .vacio { font-size: var(--f-sm); color: var(--t-400); }
  `],
})
export class AdminAlphaComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly cargando = signal(true);
  readonly niveles = signal<AlphaNivel[]>([]);
  readonly guardadoMsg = signal(false);
  readonly errorMsg = signal('');

  readonly resultados = signal<ComercioAdmin[]>([]);
  readonly busqueda = signal('');
  readonly buscado = signal(false);
  readonly accionando = signal<string | null>(null);
  readonly adhesionError = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.niveles.set(await firstValueFrom(this.adminApi.getAlphaNiveles()));
    } catch {
      this.errorMsg.set('Error cargando el programa Alpha. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
    await this.cargarAdheridos();
  }

  etiquetaNivel(nivel: number): string {
    return etiquetaAlphaNivel(nivel);
  }

  anadirBeneficio(nivel: AlphaNivel): void {
    nivel.beneficios = [...nivel.beneficios, ''];
    this.niveles.update((lista) => [...lista]);
  }

  editarBeneficio(nivel: AlphaNivel, indice: number, valor: string): void {
    nivel.beneficios = nivel.beneficios.map((b, i) => (i === indice ? valor : b));
  }

  quitarBeneficio(nivel: AlphaNivel, indice: number): void {
    nivel.beneficios = nivel.beneficios.filter((_, i) => i !== indice);
    this.niveles.update((lista) => [...lista]);
  }

  async guardarNiveles(): Promise<void> {
    this.errorMsg.set('');
    this.guardadoMsg.set(false);
    try {
      await Promise.all(
        this.niveles().map((n) =>
          firstValueFrom(this.adminApi.updateAlphaNivel({
            nivel: n.nivel,
            nombre: n.nombre,
            reservasRequeridas: n.reservasRequeridas,
            descuentoPct: n.descuentoPct,
            // Un beneficio vacío es un campo a medio escribir, no un beneficio.
            beneficios: n.beneficios.map((b) => b.trim()).filter(Boolean),
          })),
        ),
      );
      this.guardadoMsg.set(true);
      setTimeout(() => this.guardadoMsg.set(false), 3000);
    } catch {
      this.errorMsg.set('Error al guardar el programa Alpha. Inténtalo de nuevo.');
    }
  }

  /** Sin búsqueda se listan las adheridas: es el estado que interesa ver. */
  private async cargarAdheridos(): Promise<void> {
    try {
      const res = await firstValueFrom(this.adminApi.getComercios({ limite: 50, alphaAdherido: true }));
      this.resultados.set(res.items);
      this.buscado.set(false);
    } catch {
      this.resultados.set([]);
    }
  }

  async buscarComercios(): Promise<void> {
    const termino = this.busqueda().trim();
    if (!termino) {
      await this.cargarAdheridos();
      return;
    }
    try {
      const res = await firstValueFrom(this.adminApi.getComercios({ limite: 20, buscar: termino }));
      this.resultados.set(res.items);
      this.buscado.set(true);
    } catch {
      this.adhesionError.set('No se pudo buscar empresas.');
      setTimeout(() => this.adhesionError.set(''), 3000);
    }
  }

  async alternarAdhesion(comercio: ComercioAdmin): Promise<void> {
    this.accionando.set(comercio._id);
    try {
      await firstValueFrom(this.adminApi.fijarAlphaAdherido(comercio._id, !comercio.alphaAdherido));
      if (this.buscado()) {
        this.resultados.update((items) =>
          items.map((c) => (c._id === comercio._id ? { ...c, alphaAdherido: !comercio.alphaAdherido } : c)),
        );
      } else {
        await this.cargarAdheridos();
      }
    } catch {
      this.adhesionError.set('No se pudo cambiar la adhesión al programa Alpha.');
      setTimeout(() => this.adhesionError.set(''), 3000);
    } finally {
      this.accionando.set(null);
    }
  }
}
