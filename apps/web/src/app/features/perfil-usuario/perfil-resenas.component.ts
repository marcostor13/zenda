import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { verticalUi } from '../../shared/verticales/verticales.config';
import { AspectoResenaUi, aspectosDeVertical } from '../../shared/verticales/resena-aspectos.config';
import { AuthService } from '../../core/auth/auth.service';
import { ReviewsService, ResenaApi, PendienteDeValorarApi } from '../reservas/services/reviews.service';

type Filtro = 'todas' | 'pendientes' | 'publicadas' | 'conRespuesta' | 'eliminadas';

interface FormularioAbierto {
  modo: 'crear' | 'editar';
  vertical: string;
  servicioTitulo: string;
  reservaId?: string;
  resenaId?: string;
}

const COMENTARIO_MINIMO = 10;

/**
 * Escalera de reconocimientos del reseñador (HU-11.5), de mayor a menor para
 * que el primer `find` que cumpla el umbral sea el nivel alcanzado.
 */
const RECONOCIMIENTOS = [
  { desde: 25, icono: 'trophy', label: 'Embajador Doogking', siguienteDesde: null, siguienteLabel: '' },
  { desde: 10, icono: 'award',  label: 'Experto',            siguienteDesde: 25,   siguienteLabel: 'Embajador Doogking' },
  { desde: 1,  icono: 'star',   label: 'Colaborador',        siguienteDesde: 10,   siguienteLabel: 'Experto' },
] as const;

@Component({
  selector: 'app-perfil-resenas',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, RsNavbarComponent, RsIconComponent, RsImageUploadComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <a routerLink="/perfil" class="back-link">
      <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
      Volver al perfil
    </a>

    <div class="page-header">
      <h1>Mis valoraciones</h1>
      <p>Comparte tu experiencia y ayuda a otros propietarios a elegir el mejor servicio para su mascota.</p>
    </div>

    @if (cargando()) {
      <div class="rs-card" style="padding:var(--sp-8);text-align:center">
        <div class="spinner"></div>
      </div>
    } @else if (huboAlgunaVez()) {
      <!-- Reputación del reseñador (HU-11.5) -->
      @if (reputacion(); as rep) {
        <div class="rs-card reputacion">
          <div class="reputacion__nivel">
            <span class="reputacion__icono" aria-hidden="true">
              <rs-icon [name]="rep.nivelIcono" [size]="24" [stroke]="2"></rs-icon>
            </span>
            <div>
              <strong>{{ rep.nivelLabel }}</strong>
              <span class="reputacion__sub">Tu reputación en Doogking</span>
            </div>
          </div>
          <div class="reputacion__datos">
            <div class="reputacion__dato">
              <strong>{{ rep.total }}</strong>
              <span>reseña{{ rep.total === 1 ? '' : 's' }} publicada{{ rep.total === 1 ? '' : 's' }}</span>
            </div>
            <div class="reputacion__dato">
              <strong>{{ rep.media }}</strong>
              <span>nota media que das</span>
            </div>
            <div class="reputacion__dato">
              <strong>{{ rep.conFotos }}</strong>
              <span>con fotos</span>
            </div>
          </div>
          @if (rep.siguiente; as sig) {
            <p class="reputacion__meta">
              <rs-icon name="trending-up" [size]="15" [stroke]="2"></rs-icon>
              Te {{ sig.falta === 1 ? 'falta' : 'faltan' }} {{ sig.falta }}
              reseña{{ sig.falta === 1 ? '' : 's' }} para llegar a <strong>{{ sig.label }}</strong>.
            </p>
          } @else {
            <p class="reputacion__meta">
              <rs-icon name="trophy" [size]="15" [stroke]="2"></rs-icon>
              Has alcanzado el máximo reconocimiento. ¡Gracias por ayudar a la comunidad!
            </p>
          }
        </div>
      }

      <div class="tabs">
        @for (t of tabs; track t.valor) {
          <button type="button" class="tab" [class.tab--activo]="filtro() === t.valor" (click)="filtro.set(t.valor)">
            {{ t.label }}
          </button>
        }
      </div>

      @if (mostrarPendientes() && pendientes().length > 0) {
        <div class="rs-card pendientes-banner">
          <rs-icon name="star" [size]="20" [stroke]="1.75" style="color:#F59E0B"></rs-icon>
          <p>Tienes {{ pendientes().length }} servicio{{ pendientes().length === 1 ? '' : 's' }} pendiente{{ pendientes().length === 1 ? '' : 's' }} de valorar.</p>
        </div>

        <div class="resenas-list">
          @for (p of pendientes(); track p.reservaId) {
            <div class="rs-card pendiente-card">
              <div class="pendiente-icon">
                @if (p.imagen) {
                  <img [src]="p.imagen" [alt]="p.servicioTitulo" />
                } @else {
                  <rs-icon [name]="verticalUi(p.vertical).icon" [size]="22" [stroke]="1.5"></rs-icon>
                }
              </div>
              <div class="pendiente-info">
                <div class="resena-servicio">{{ p.servicioTitulo || p.vertical }}</div>
                <div class="resena-fecha">{{ p.fechaInicio | date:'d MMM yyyy' }}</div>
              </div>
              <button type="button" class="rs-btn rs-btn--primary rs-btn--sm" (click)="abrirFormularioCrear(p)">
                Escribir reseña
              </button>
            </div>
          }
        </div>
      }

      @if (resenasVisibles().length > 0) {
        <div class="resenas-list">
          @for (r of resenasVisibles(); track r._id) {
            <div class="rs-card resena-card" [class.resena-card--eliminada]="r.eliminada">
              <div class="resena-header">
                <div class="resena-thumb">
                  @if (r.fotos && r.fotos.length > 0) {
                    <img [src]="r.fotos[0]" [alt]="r.servicioTitulo" />
                  } @else {
                    <rs-icon [name]="verticalUi(r.vertical).icon" [size]="20" [stroke]="1.5"></rs-icon>
                  }
                </div>
                <div class="resena-info">
                  <div class="resena-servicio">{{ r.servicioTitulo || r.vertical }}</div>
                  <div class="resena-fecha">{{ r.createdAt | date:'d MMM yyyy' }}</div>
                </div>
                <div class="stars">
                  @for (s of starsArray(r.puntuacion); track s.i) {
                    <rs-icon name="star" [size]="14" [stroke]="1.5"
                      [style.color]="s.filled ? '#F59E0B' : 'var(--b-2)'"></rs-icon>
                  }
                </div>
              </div>

              @if (r.eliminada) {
                <span class="rs-badge rs-badge--neutral">Eliminada</span>
              }

              <p class="resena-texto">{{ r.comentario }}</p>

              @if (r.aspectos && objectKeys(r.aspectos).length > 0) {
                <div class="aspectos-chips">
                  @for (a of aspectosDeVertical(r.vertical); track a.key) {
                    @if (r.aspectos[a.key]) {
                      <span class="rs-badge rs-badge--neutral">{{ a.label }}: {{ r.aspectos[a.key] }}/5</span>
                    }
                  }
                </div>
              }

              @if (r.fotos && r.fotos.length > 1) {
                <div class="fotos-grid">
                  @for (foto of r.fotos; track foto) {
                    <img [src]="foto" alt="Foto de la reseña" />
                  }
                </div>
              }

              @if (r.respuesta) {
                <div class="resena-respuesta">
                  <rs-icon name="message-square" [size]="13" [stroke]="2"></rs-icon>
                  <div>
                    <span class="respuesta-label">Respuesta del comercio</span>
                    <p>{{ r.respuesta }}</p>
                  </div>
                </div>
              }

              @if (!r.eliminada) {
                <div class="resena-acciones">
                  <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="abrirFormularioEditar(r)">Editar</button>
                  <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="eliminar(r)">Eliminar</button>
                </div>
              }
            </div>
          }
        </div>
      } @else if (!mostrarPendientes() || pendientes().length === 0) {
        <div class="rs-card" style="padding:var(--sp-8);text-align:center">
          <p style="color:var(--t-400);font-size:var(--f-sm)">Ninguna reseña coincide con este filtro.</p>
        </div>
      }
    } @else {
      <div class="rs-card empty-card">
        <div class="empty-icon">
          <rs-icon name="star" [size]="32" [stroke]="1.25"></rs-icon>
        </div>
        <h2>Aún no has escrito ninguna reseña</h2>
        <p>Cuando completes una reserva, podrás valorar el servicio para ayudar a otros propietarios a elegir el mejor servicio para su mascota.</p>
        <a routerLink="/reservas/mis-reservas" class="rs-btn rs-btn--primary" style="margin-top:var(--sp-5)">
          Valorar mis reservas
        </a>
      </div>
    }

    @if (formulario(); as f) {
      <div class="modal-overlay" (click)="cerrarFormulario()">
        <div class="rs-card modal-card" (click)="$event.stopPropagation()">
          <h2>{{ f.modo === 'crear' ? 'Valorar ' + f.servicioTitulo : 'Editar tu reseña' }}</h2>

          <div class="rs-form-group">
            <label class="rs-label">Puntuación general</label>
            <div class="stars stars--picker">
              @for (n of [1, 2, 3, 4, 5]; track n) {
                <button type="button" (click)="puntuacion.set(n)" [attr.aria-label]="n + ' estrellas'">
                  <rs-icon name="star" [size]="26" [stroke]="1.5" [style.color]="n <= puntuacion() ? '#F59E0B' : 'var(--b-2)'"></rs-icon>
                </button>
              }
            </div>
          </div>

          @if (aspectosDelFormulario().length > 0) {
            <div class="rs-form-group">
              <label class="rs-label">Valora aspectos específicos</label>
              @for (a of aspectosDelFormulario(); track a.key) {
                <div class="aspecto-row">
                  <span>{{ a.label }}</span>
                  <div class="stars stars--picker stars--picker-sm">
                    @for (n of [1, 2, 3, 4, 5]; track n) {
                      <button type="button" (click)="setAspecto(a.key, n)" [attr.aria-label]="a.label + ' ' + n + ' estrellas'">
                        <rs-icon name="star" [size]="18" [stroke]="1.5" [style.color]="n <= valorAspecto(a.key) ? '#F59E0B' : 'var(--b-2)'"></rs-icon>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <div class="rs-form-group">
            <label class="rs-label" for="comentario">Tu opinión</label>
            <textarea id="comentario" class="rs-input" rows="4" [formControl]="comentarioCtrl"
              placeholder="Cuéntanos cómo fue tu experiencia (mínimo 10 caracteres)"></textarea>
            @if (comentarioCtrl.touched && comentarioCtrl.invalid) {
              <span class="rs-field-error">Escribe al menos {{ comentarioMinimo }} caracteres.</span>
            }
          </div>

          <div class="rs-form-group">
            <label class="rs-label">Fotos (opcional)</label>
            <rs-image-upload [multiple]="true" [maxFiles]="6" [formControl]="fotosCtrl"></rs-image-upload>
          </div>

          @if (errorMsg()) {
            <p class="rs-field-error">{{ errorMsg() }}</p>
          }

          <div class="modal-acciones">
            <button type="button" class="rs-btn rs-btn--ghost" (click)="cerrarFormulario()">Cancelar</button>
            <button type="button" class="rs-btn rs-btn--primary" [disabled]="guardando()" (click)="guardar()">
              {{ guardando() ? 'Guardando…' : 'Publicar reseña' }}
            </button>
          </div>
        </div>
      </div>
    }

  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .back-link {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-400); text-decoration: none;
      margin-bottom: var(--sp-6); transition: color var(--d-2);
      &:hover { color: var(--c-accent); }
    }

    .page-header {
      margin-bottom: var(--sp-6);
      h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
      p { color: var(--t-400); font-size: var(--f-sm); }
    }

    .tabs { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-bottom: var(--sp-6); }
    .tab {
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full); border: 1px solid var(--b-2);
      background: var(--c-card); color: var(--t-300); font-size: var(--f-sm); cursor: pointer;
      transition: all var(--d-2);
    }
    .tab--activo { background: var(--c-accent); color: #fff; border-color: var(--c-accent); }

    .pendientes-banner {
      display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-4);
      max-width: 680px; margin-bottom: var(--sp-4);
      p { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    }

    /* Reputación del reseñador (HU-11.5) */
    .reputacion { padding: var(--sp-5); max-width: 680px; margin-bottom: var(--sp-5); }
    .reputacion__nivel { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); }
    .reputacion__icono {
      display: inline-flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; border-radius: var(--r-full);
      background: var(--c-raised); color: var(--dk-gold, #FBAE17); flex-shrink: 0;
    }
    .reputacion__nivel strong { display: block; font-size: var(--f-md); }
    .reputacion__sub { font-size: var(--f-xs); color: var(--t-400); }
    .reputacion__datos { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3); }
    .reputacion__dato {
      text-align: center; padding: var(--sp-3); background: var(--c-raised); border-radius: var(--r-md);
      strong { display: block; font-size: var(--f-lg); font-weight: var(--w-7); }
      span { font-size: var(--f-xs); color: var(--t-400); }
    }
    .reputacion__meta {
      display: flex; align-items: center; gap: var(--sp-2);
      margin-top: var(--sp-4); font-size: var(--f-sm); color: var(--t-300);
    }

    .empty-card {
      max-width: 480px; padding: var(--sp-10);
      text-align: center;
      h2 { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); margin: var(--sp-4) 0 var(--sp-2); }
      p { color: var(--t-400); font-size: var(--f-sm); line-height: 1.7; }
    }
    .empty-icon {
      width: 64px; height: 64px; border-radius: 50%;
      background: rgba(245,158,11,.1); display: flex; align-items: center; justify-content: center;
      color: #F59E0B; margin: 0 auto;
    }

    .resenas-list { display: flex; flex-direction: column; gap: var(--sp-4); max-width: 680px; margin-bottom: var(--sp-4); }

    .pendiente-card { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4); }
    .pendiente-icon, .resena-thumb {
      width: 48px; height: 48px; border-radius: var(--r-lg); background: var(--c-raised);
      display: flex; align-items: center; justify-content: center; color: var(--t-400);
      flex-shrink: 0; overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .pendiente-info { flex: 1; }

    .resena-card { padding: var(--sp-5); }
    .resena-card--eliminada { opacity: .6; }
    .resena-header { display: flex; align-items: flex-start; gap: var(--sp-3); margin-bottom: var(--sp-3); }
    .resena-info { flex: 1; }
    .resena-servicio { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .resena-fecha { font-size: var(--f-xs); color: var(--t-400); margin-top: 2px; }
    .stars { display: flex; gap: 2px; }
    .stars--picker button { background: none; border: none; cursor: pointer; padding: 2px; }
    .resena-texto { font-size: var(--f-sm); color: var(--t-300); line-height: 1.7; }

    .aspectos-chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); }
    .aspecto-row { display: flex; align-items: center; justify-content: space-between; padding-block: var(--sp-1); font-size: var(--f-sm); color: var(--t-300); }

    .fotos-grid { display: flex; gap: var(--sp-2); margin-top: var(--sp-3); flex-wrap: wrap;
      img { width: 72px; height: 72px; object-fit: cover; border-radius: var(--r-md); }
    }

    .resena-respuesta {
      display: flex; gap: var(--sp-3);
      margin-top: var(--sp-4); padding: var(--sp-4);
      background: var(--c-raised); border-radius: var(--r-lg);
      border-left: 3px solid var(--c-accent);
      color: var(--t-300); font-size: var(--f-xs);
      .respuesta-label { font-weight: var(--w-6); color: var(--c-accent); display: block; margin-bottom: 4px; }
      p { line-height: 1.6; margin: 0; }
    }

    .resena-acciones { display: flex; gap: var(--sp-3); margin-top: var(--sp-4); }

    .spinner {
      width: 32px; height: 32px; border-radius: 50%;
      border: 3px solid var(--b-2); border-top-color: var(--c-accent);
      animation: spin .8s linear infinite; margin: 0 auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      display: flex; align-items: center; justify-content: center; padding: var(--sp-5); z-index: 100;
    }
    .modal-card {
      max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto; padding: var(--sp-6);
      h2 { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-5); }
    }
    .modal-acciones { display: flex; justify-content: flex-end; gap: var(--sp-3); margin-top: var(--sp-5); }
  `],
})
export class PerfilResenasComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly reviewsService = inject(ReviewsService);

  readonly verticalUi = verticalUi;
  readonly aspectosDeVertical = aspectosDeVertical;
  readonly comentarioMinimo = COMENTARIO_MINIMO;
  readonly objectKeys = (o: Record<string, number>): string[] => Object.keys(o);

  readonly tabs: { valor: Filtro; label: string }[] = [
    { valor: 'todas', label: 'Todas' },
    { valor: 'pendientes', label: 'Pendientes' },
    { valor: 'publicadas', label: 'Publicadas' },
    { valor: 'conRespuesta', label: 'Con respuesta' },
    { valor: 'eliminadas', label: 'Eliminadas' },
  ];

  readonly cargando = signal(true);
  readonly resenas = signal<ResenaApi[]>([]);
  readonly pendientes = signal<PendienteDeValorarApi[]>([]);
  readonly filtro = signal<Filtro>('todas');

  readonly formulario = signal<FormularioAbierto | null>(null);
  readonly puntuacion = signal(5);
  readonly aspectos = signal<Record<string, number>>({});
  readonly guardando = signal(false);
  readonly errorMsg = signal('');

  readonly comentarioCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(COMENTARIO_MINIMO), Validators.maxLength(1000)],
  });
  readonly fotosCtrl = new FormControl<string[]>([], { nonNullable: true });

  readonly huboAlgunaVez = computed(() => this.resenas().length > 0 || this.pendientes().length > 0);
  readonly mostrarPendientes = computed(() => this.filtro() === 'todas' || this.filtro() === 'pendientes');

  readonly resenasVisibles = computed(() => {
    const filtro = this.filtro();
    if (filtro === 'pendientes') return [];
    if (filtro === 'publicadas') return this.resenas().filter((r) => !r.eliminada);
    if (filtro === 'conRespuesta') return this.resenas().filter((r) => !r.eliminada && !!r.respuesta);
    if (filtro === 'eliminadas') return this.resenas().filter((r) => r.eliminada);
    return this.resenas().filter((r) => !r.eliminada);
  });

  readonly aspectosDelFormulario = computed(() => {
    const f = this.formulario();
    return f ? aspectosDeVertical(f.vertical) : ([] as readonly AspectoResenaUi[]);
  });

  /**
   * Reputación del reseñador (HU-11.5). Todo sale de las reseñas publicadas del
   * usuario: nº, nota media que otorga y reconocimiento alcanzado.
   *
   * No se incluye el "% de reseñas útiles" que pide el documento: no existe
   * sistema de votos de utilidad en el backend y el dato sería inventado.
   */
  readonly reputacion = computed(() => {
    const publicadas = this.resenas().filter((r) => !r.eliminada);
    if (publicadas.length === 0) return null;

    const media = publicadas.reduce((s, r) => s + r.puntuacion, 0) / publicadas.length;
    const nivel = RECONOCIMIENTOS.find((n) => publicadas.length >= n.desde) ?? RECONOCIMIENTOS[RECONOCIMIENTOS.length - 1];

    return {
      total: publicadas.length,
      media: Math.round(media * 10) / 10,
      conFotos: publicadas.filter((r) => (r.fotos?.length ?? 0) > 0).length,
      nivelIcono: nivel.icono,
      nivelLabel: nivel.label,
      siguiente: nivel.siguienteDesde === null
        ? null
        : { falta: nivel.siguienteDesde - publicadas.length, label: nivel.siguienteLabel },
    };
  });

  async ngOnInit(): Promise<void> {
    try {
      const userId = this.auth.usuario()?.id;
      const [resenas, pendientes] = await Promise.all([
        this.reviewsService.misResenas(userId ?? ''),
        this.reviewsService.pendientesDeValorar(),
      ]);
      this.resenas.set(resenas);
      this.pendientes.set(pendientes);
    } catch {
      // Reviews API no disponible — se muestra el estado vacío
    } finally {
      this.cargando.set(false);
    }
  }

  starsArray(puntuacion: number): Array<{ i: number; filled: boolean }> {
    return [1, 2, 3, 4, 5].map((i) => ({ i, filled: i <= Math.round(puntuacion) }));
  }

  abrirFormularioCrear(p: PendienteDeValorarApi): void {
    this.errorMsg.set('');
    this.puntuacion.set(5);
    this.aspectos.set({});
    this.comentarioCtrl.reset('');
    this.fotosCtrl.reset([]);
    this.formulario.set({ modo: 'crear', vertical: p.vertical, servicioTitulo: p.servicioTitulo, reservaId: p.reservaId });
  }

  abrirFormularioEditar(r: ResenaApi): void {
    this.errorMsg.set('');
    this.puntuacion.set(r.puntuacion);
    this.aspectos.set({ ...(r.aspectos ?? {}) });
    this.comentarioCtrl.reset(r.comentario);
    this.fotosCtrl.reset(r.fotos ?? []);
    this.formulario.set({ modo: 'editar', vertical: r.vertical, servicioTitulo: r.servicioTitulo, resenaId: r._id });
  }

  cerrarFormulario(): void {
    this.formulario.set(null);
  }

  setAspecto(key: string, valor: number): void {
    this.aspectos.update((a) => ({ ...a, [key]: valor }));
  }

  /**
   * `aspectos` solo contiene entrada para las claves ya puntuadas: el mapa
   * arranca vacío y se rellena aspecto a aspecto, así que el valor de una
   * clave todavía no tocada es `undefined` en tiempo de ejecución aunque el
   * tipo del signal (para encajar con el payload de `ReviewsService`) diga
   * `Record<string, number>`. El cast a `Partial<...>` refleja esa realidad
   * sólo en la lectura, sin aflojar el tipo que se envía al guardar.
   */
  valorAspecto(key: string): number {
    return (this.aspectos() as Partial<Record<string, number>>)[key] ?? 0;
  }

  async guardar(): Promise<void> {
    const f = this.formulario();
    if (!f) return;
    this.comentarioCtrl.markAsTouched();
    if (this.comentarioCtrl.invalid) return;

    this.guardando.set(true);
    this.errorMsg.set('');
    try {
      if (f.modo === 'crear' && f.reservaId) {
        const creada = await this.reviewsService.crear({
          reservaId: f.reservaId,
          puntuacion: this.puntuacion(),
          comentario: this.comentarioCtrl.value,
          aspectos: this.aspectos(),
          fotos: this.fotosCtrl.value,
        });
        this.resenas.update((list) => [creada, ...list]);
        this.pendientes.update((list) => list.filter((p) => p.reservaId !== f.reservaId));
      } else if (f.modo === 'editar' && f.resenaId) {
        const actualizada = await this.reviewsService.actualizar(f.resenaId, {
          puntuacion: this.puntuacion(),
          comentario: this.comentarioCtrl.value,
          aspectos: this.aspectos(),
          fotos: this.fotosCtrl.value,
        });
        this.resenas.update((list) => list.map((r) => (r._id === f.resenaId ? actualizada : r)));
      }
      this.formulario.set(null);
    } catch {
      this.errorMsg.set('No se pudo guardar la reseña. Inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(r: ResenaApi): Promise<void> {
    const anterior = this.resenas();
    this.resenas.update((list) => list.map((x) => (x._id === r._id ? { ...x, eliminada: true } : x)));
    try {
      await this.reviewsService.eliminar(r._id);
    } catch {
      this.resenas.set(anterior);
    }
  }
}
