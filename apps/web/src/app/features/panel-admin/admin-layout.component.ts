import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { NAV_ADMIN } from '../../shared/navegacion-paneles';


@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    TraducirPipe, RouterOutlet, RouterLink, RouterLinkActive, RsNavbarComponent, RsIconComponent
  ],
  template: `
<div class="dk-pagina">
  <rs-navbar />

  <div class="admin-layout">

    <!-- SIDEBAR -->
    <aside class="admin-sidebar">
      <div class="admin-sidebar__title">
        <span class="rs-badge rs-badge--danger">{{ 'ADMIN' | t }}</span>
        {{ 'Panel de control' | t }}
      </div>

      <nav>
        @for (section of navSections; track section.title) {
          <div class="nav-section">
            <div class="nav-section__title">{{ section.title }}</div>
            @for (item of section.items; track item.ruta) {
              <a
                [routerLink]="item.ruta"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.exact }"
                class="admin-nav-item">
                <rs-icon [name]="item.icon" [size]="16" [stroke]="2"></rs-icon>
                <span>{{ item.label | t }}</span>
              </a>
            }
          </div>
        }
      </nav>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="admin-main">
      <router-outlet />
    </main>

  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .admin-layout {
      display: grid;
      grid-template-columns: 240px 1fr;
      min-height: calc(100vh - 64px);
      min-height: calc(100dvh - 64px);
    }
        /* 768px y no 1024: es el ancho al que aparece el boton de hamburguesa, que
       es donde van a parar las secciones. Separar los dos breakpoints dejaba la
       franja de tablet (769-1024px) sin columna lateral y sin hamburguesa, o
       sea sin ninguna forma de navegar el panel. */
    @media (max-width: 768px) {
      .admin-layout { grid-template-columns: 1fr; }
    }

    .admin-sidebar {
      background: var(--c-card);
      border-right: 1px solid var(--b-1);
      padding: var(--sp-6);
      position: sticky;
      top: 64px;
      height: calc(100vh - 64px);
      height: calc(100dvh - 64px);
      overflow-y: auto;
    }
    /*
     * Mismo caso que el panel de comercio: por debajo de 1024px la columna
     * lateral se oculta y sus dieciocho secciones —con sus cuatro grupos— pasan
     * al menu hamburguesa de la navbar (ver navegacion-paneles.ts).
     *
     * La tira horizontal que habia aqui antes nunca se aplico: las mismas
     * reglas se redefinian mas abajo para escritorio, con igual especificidad,
     * y ganaban por ir despues. Se veia la columna entera en vertical tapando
     * el panel. En el menu, ademas, los titulos de grupo se conservan; en una
     * tira habia que quitarlos y dieciocho pastillas sueltas no se navegan.
     */
    @media (max-width: 768px) {
      .admin-sidebar { display: none; }
    }

    .admin-sidebar__title {
      font-size: var(--f-xs);
      color: var(--t-400);
      text-transform: uppercase;
      letter-spacing: .06em;
      margin-bottom: var(--sp-6);
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }

    .nav-section { margin-bottom: var(--sp-6); }
    .nav-section__title {
      font-size: var(--f-xs);
      color: var(--t-400);
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: var(--sp-2);
      padding: 0 var(--sp-4);
    }

    .admin-nav-item {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--r-lg);
      color: var(--t-300);
      font-size: var(--f-sm);
      text-decoration: none;
      transition: all .15s;
      margin-bottom: var(--sp-1);
    }
    .admin-nav-item:hover { background: var(--c-raised); color: var(--t-100); }
    .admin-nav-item.active { background: var(--c-accent-lo); color: var(--c-accent); }

    .admin-main {
      padding: var(--sp-8);
      display: flex;
      flex-direction: column;
      gap: var(--sp-6);
      min-width: 0;
    }
    @media (max-width: 768px) {
      .admin-main { padding: var(--sp-4); }
    }
  `],
})
export class AdminLayoutComponent {
  readonly navSections = NAV_ADMIN;
}
