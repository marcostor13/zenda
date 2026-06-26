import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

interface MiResena {
  _id: string;
  servicioTitulo: string;
  vertical: string;
  puntuacion: number;
  comentario: string;
  createdAt: string;
  respuesta?: string | null;
}

@Component({
  selector: 'app-perfil-resenas',
  standalone: true,
  imports: [RouterLink, DatePipe, RsNavbarComponent, RsIconComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <a routerLink="/perfil" class="back-link">
      <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
      Volver al perfil
    </a>

    <div class="page-header">
      <h1>Mis reseñas</h1>
      <p>Reseñas que has escrito sobre los servicios que has utilizado.</p>
    </div>

    @if (cargando()) {
      <div class="rs-card" style="padding:var(--sp-8);text-align:center">
        <div class="spinner"></div>
      </div>
    } @else if (resenas().length === 0) {
      <div class="rs-card empty-card">
        <div class="empty-icon">
          <rs-icon name="star" [size]="32" [stroke]="1.25"></rs-icon>
        </div>
        <h2>Aún no has escrito ninguna reseña</h2>
        <p>Cuando completes una reserva, podrás valorar el servicio para ayudar a otros viajeros.</p>
        <a routerLink="/reservas/mis-reservas" class="rs-btn rs-btn--primary" style="margin-top:var(--sp-5)">
          Ver mis reservas
        </a>
      </div>
    } @else {
      <div class="resenas-list">
        @for (r of resenas(); track r._id) {
          <div class="rs-card resena-card">
            <div class="resena-header">
              <div>
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
            <p class="resena-texto">{{ r.comentario }}</p>
            @if (r.respuesta) {
              <div class="resena-respuesta">
                <rs-icon name="message-square" [size]="13" [stroke]="2"></rs-icon>
                <div>
                  <span class="respuesta-label">Respuesta del comercio</span>
                  <p>{{ r.respuesta }}</p>
                </div>
              </div>
            }
          </div>
        }
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
      margin-bottom: var(--sp-8);
      h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
      p { color: var(--t-400); font-size: var(--f-sm); }
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

    .resenas-list { display: flex; flex-direction: column; gap: var(--sp-4); max-width: 680px; }
    .resena-card { padding: var(--sp-5); }
    .resena-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-4); margin-bottom: var(--sp-3); }
    .resena-servicio { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .resena-fecha { font-size: var(--f-xs); color: var(--t-400); margin-top: 2px; }
    .stars { display: flex; gap: 2px; }
    .resena-texto { font-size: var(--f-sm); color: var(--t-300); line-height: 1.7; }

    .resena-respuesta {
      display: flex; gap: var(--sp-3);
      margin-top: var(--sp-4); padding: var(--sp-4);
      background: var(--c-raised); border-radius: var(--r-lg);
      border-left: 3px solid var(--c-accent);
      color: var(--t-300); font-size: var(--f-xs);
      .respuesta-label { font-weight: var(--w-6); color: var(--c-accent); display: block; margin-bottom: 4px; }
      p { line-height: 1.6; margin: 0; }
    }

    .spinner {
      width: 32px; height: 32px; border-radius: 50%;
      border: 3px solid var(--b-2); border-top-color: var(--c-accent);
      animation: spin .8s linear infinite; margin: 0 auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class PerfilResenasComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly cargando = signal(true);
  readonly resenas = signal<MiResena[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      const userId = this.auth.usuario()?.id;
      const data = await firstValueFrom(
        this.http.get<MiResena[]>(`${environment.apiUrl}/reviews?usuarioId=${userId}`),
      );
      this.resenas.set(data);
    } catch {
      // Reviews API not yet implemented — show empty state
    } finally {
      this.cargando.set(false);
    }
  }

  starsArray(puntuacion: number): Array<{ i: number; filled: boolean }> {
    return [1, 2, 3, 4, 5].map(i => ({ i, filled: i <= Math.round(puntuacion) }));
  }
}
