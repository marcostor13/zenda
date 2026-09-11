import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsSearchBarComponent } from '../../shared/components/search-bar/rs-search-bar.component';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { seoPrivada } from '../../core/seo/plantillas-seo';
import { VERTICALES_PUBLICOS } from '../../shared/verticales/verticales.config';

/**
 * Página 404.
 *
 * Sustituye al `{ path: '**', redirectTo: '' }` que había antes, que llevaba a
 * la portada sin decir nada: quien escribía mal una dirección o seguía un
 * enlace viejo acababa en el inicio sin entender por qué, y Google recibía un
 * 200 con la portada dentro por cada dirección inexistente —lo que le hace
 * pensar que esas URL existen y merecen estar en el índice—.
 *
 * No es sólo un mensaje de error: trae el buscador y las categorías, porque
 * quien llega aquí venía buscando algo y lo normal es que siga en la web.
 */
@Component({
  selector: 'app-no-encontrado',
  standalone: true,
  imports: [RouterLink, TraducirPipe, RsNavbarComponent, RsIconComponent, RsSearchBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<rs-navbar />

<main class="dk-pagina ne">
  <div class="rs-container rs-container--md">
    <div class="ne__cab">
      <span class="ne__codigo" aria-hidden="true">404</span>
      <h1 class="ne__titulo">{{ 'Esta página no existe' | t }}</h1>
      <p class="ne__texto">
        {{ 'Puede que la dirección esté mal escrita o que el enlace ya no esté disponible. Desde aquí puedes seguir buscando lo que necesita tu perro.' | t }}
      </p>
    </div>

    <section class="ne__buscador" [attr.aria-label]="'Buscar un servicio' | t">
      <rs-search-bar [categorias]="false" />
    </section>

    <section class="ne__cats" [attr.aria-label]="'Categorías de servicio' | t">
      <h2 class="ne__sub">{{ 'O entra directamente en una categoría' | t }}</h2>
      <nav class="ne__rejilla">
        @for (v of verticales; track v.key) {
          <a [routerLink]="v.route" class="ne__cat">
            <rs-icon [name]="v.icon" [size]="20" [stroke]="2"></rs-icon>
            <span>{{ v.labelCorto | t }}</span>
          </a>
        }
      </nav>
    </section>

    <p class="ne__volver">
      <a routerLink="/" class="rs-btn rs-btn--primary rs-btn--lg">
        <rs-icon name="home" [size]="18" [stroke]="2"></rs-icon>
        {{ 'Volver a la portada' | t }}
      </a>
    </p>
  </div>
</main>
  `,
  styles: [`
    .ne { padding-block: var(--s-16) var(--s-20); }

    .ne__cab { text-align: center; max-width: 34rem; margin: 0 auto var(--s-10); }

    /*
     * El número es decoración, no información: el mensaje de debajo ya dice lo
     * que pasa, y "404" no significa nada para quien no es técnico. Por eso va
     * con aria-hidden y muy claro de color.
     */
    .ne__codigo {
      display: block;
      font-family: var(--font-display);
      font-size: var(--text-6xl);
      font-weight: var(--fw-extrabold);
      line-height: 1;
      color: var(--c-accent);
      opacity: .16;
    }

    .ne__titulo {
      font-family: var(--font-display);
      font-size: var(--text-3xl);
      font-weight: var(--fw-bold);
      color: var(--dk-blue-text);
      margin: var(--s-3) 0 var(--s-3);
    }

    .ne__texto { color: var(--text-secondary); font-size: var(--text-base); margin: 0; }

    .ne__buscador { margin-bottom: var(--s-12); }

    .ne__sub {
      font-family: var(--font-accent);
      font-size: var(--text-sm);
      font-weight: var(--fw-bold);
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--text-muted);
      text-align: center;
      margin: 0 0 var(--s-5);
    }

    .ne__rejilla {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: var(--s-3);
    }

    .ne__cat {
      display: flex;
      align-items: center;
      gap: var(--s-3);
      padding: var(--s-4);
      border: 1px solid var(--c-surface);
      border-radius: var(--r-lg);
      background: var(--c-card);
      color: var(--dk-blue-text);
      font-weight: var(--fw-semibold);
      text-decoration: none;
      box-shadow: var(--shadow-sm);
      transition: border-color var(--t-fast), transform var(--t-fast);
    }

    .ne__cat:hover { border-color: var(--c-accent); transform: translateY(-2px); }

    .ne__volver { text-align: center; margin: var(--s-12) 0 0; }

    @media (max-width: 640px) {
      .ne { padding-block: var(--s-10) var(--s-14); }
      .ne__titulo { font-size: var(--text-2xl); }
    }
  `],
})
export class NoEncontradoComponent implements OnInit {
  private readonly seo = inject(SeoService);

  readonly verticales = VERTICALES_PUBLICOS;

  ngOnInit(): void {
    /*
     * Dos cosas distintas y las dos necesarias:
     *
     * - `seoPrivada` marca la página como `noindex`, para que Google no meta en
     *   su índice una dirección que no existe.
     * - `noEncontrado()` fija el **código de estado 404** de la respuesta. Es lo
     *   que de verdad le dice al buscador que la URL no existe, y sólo se puede
     *   hacer desde el render de servidor.
     */
    this.seo.aplicar(seoPrivada(
      'Página no encontrada',
      'La dirección que has abierto no existe en Doogking.',
    ));
    this.seo.noEncontrado();
  }
}
