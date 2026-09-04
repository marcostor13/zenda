import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsSocialIconComponent } from '../../shared/components/social-icon/rs-social-icon.component';
import { REDES_SOCIALES } from '../../shared/catalogos/redes-sociales.catalogo';
import { PLANES } from '../../shared/catalogos/planes.catalogo';
import { VERTICALES_PUBLICOS } from '../../shared/verticales/verticales.config';
import { BRAND, MOTIVOS_IMAGES } from '../../shared/media/images';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { RESPONSABLE } from '../legal/legal.datos';

/**
 * Landing de captación de comercios.
 *
 * Es la página a la que se enlaza desde fuera (redes, campañas, el pie de la
 * home) para explicarle a un profesional qué gana publicando en Doogking,
 * antes de pedirle un solo dato. El alta sigue viviendo en
 * `/auth/registro-comercio`: aquí sólo se argumenta y se enlaza.
 *
 * Todo lo que se promete sale de fuentes que ya existen en el producto —el
 * catálogo de planes, las categorías publicadas y las condiciones generales
 * del servicio— y no de copy inventado: si un plan cambia de precio o aparece
 * una categoría nueva, esta página cambia con ellos.
 */
@Component({
  selector: 'app-para-comercios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, AnimateOnScrollDirective, ImgFallbackDirective,
    RsIconComponent, RsSocialIconComponent, TraducirPipe,
  ],
  template: `
<div class="pc">

  <!-- ═══ CABECERA LIGERA ══════════════════════════════════════════
       No se usa la navbar de la aplicación a propósito: esta página se visita
       desde fuera y su único objetivo es el alta; el menú de categorías del
       cliente final sólo ofrecería salidas. -->
  <header class="pc-bar">
    <div class="pc-bar__inner rs-wrap rs-wrap--2xl">
      <a routerLink="/" class="pc-bar__brand" [attr.aria-label]="'Ir al inicio de Doogking' | t">
        <img [src]="logoD" alt="Doogking" />
        <span>Doogking</span>
      </a>
      <nav class="pc-bar__nav" [attr.aria-label]="'Secciones de la página' | t">
        <a href="#ventajas">{{ 'Ventajas' | t }}</a>
        <a href="#como-empezar">{{ 'Cómo empezar' | t }}</a>
        <a href="#planes">{{ 'Planes' | t }}</a>
        <a href="#preguntas">{{ 'Preguntas' | t }}</a>
      </nav>
      <div class="pc-bar__acciones">
        <a routerLink="/auth/login" class="pc-bar__login">{{ 'Iniciar sesión' | t }}</a>
        <a routerLink="/auth/registro-comercio" class="rs-btn rs-btn--gold rs-btn--sm">
          {{ 'Registrar mi negocio' | t }}
        </a>
      </div>
    </div>
  </header>

  <!-- ═══ HERO ═════════════════════════════════════════════════════ -->
  <section class="pc-hero">
    <div class="pc-hero__glow" aria-hidden="true"></div>
    <div class="pc-hero__orb pc-hero__orb--1" aria-hidden="true"></div>
    <div class="pc-hero__orb pc-hero__orb--2" aria-hidden="true"></div>

    <div class="pc-hero__inner rs-wrap rs-wrap--2xl">
      <div class="pc-hero__copy">
        <span class="pc-hero__eyebrow pc-in pc-in--1">
          <rs-icon name="crown" [size]="14" [stroke]="2" />
          {{ 'Para profesionales del mundo animal' | t }}
        </span>

        <h1 class="pc-hero__title pc-in pc-in--2">
          {{ 'Llena tu agenda con clientes que' | t }}
          <span class="pc-hero__title-gold">{{ 'ya están buscando tu servicio' | t }}</span>
        </h1>

        <p class="pc-hero__text pc-in pc-in--3">
          {{ 'Publica tu negocio en Doogking, recibe reservas pagadas online y lleva agenda, clientes y cobros desde un solo panel. Sin cuota de alta y sin permanencia.' | t }}
        </p>

        <div class="pc-hero__cta pc-in pc-in--4">
          <a routerLink="/auth/registro-comercio" class="rs-btn rs-btn--gold rs-btn--lg">
            {{ 'Registrar mi negocio gratis' | t }}
            <rs-icon name="arrow-right" [size]="17" [stroke]="2.25" />
          </a>
          <a href="#planes" class="pc-hero__cta-alt">
            {{ 'Ver planes y comisiones' | t }}
            <rs-icon name="chevron-down" [size]="16" [stroke]="2.25" />
          </a>
        </div>

        <ul class="pc-hero__chips pc-in pc-in--5">
          @for (g of ganchos; track g) {
            <li><rs-icon name="check" [size]="13" [stroke]="3" /> {{ g | t }}</li>
          }
        </ul>
      </div>

      <figure class="pc-hero__art pc-in pc-in--3">
        <img [src]="fotoHero" [alt]="'Profesional canina mostrando el sello de verificación de Doogking' | t"
             fetchpriority="high" rsImg />

        <!-- Dos avisos del panel real: la promesa de la página es justamente
             que las reservas entran solas y llegan cobradas. -->
        <div class="pc-float pc-float--reserva">
          <span class="pc-float__ico pc-float__ico--ok"><rs-icon name="check" [size]="15" [stroke]="3" /></span>
          <div>
            <strong>{{ 'Nueva reserva confirmada' | t }}</strong>
            <small>{{ 'Peluquería · mañana 10:30' | t }}</small>
          </div>
        </div>

        <div class="pc-float pc-float--ingresos">
          <span class="pc-float__ico pc-float__ico--gold"><rs-icon name="trending-up" [size]="15" [stroke]="2.5" /></span>
          <div>
            <strong>{{ 'Cobro online' | t }}</strong>
            <small>{{ 'Liquidación con detalle' | t }}</small>
          </div>
        </div>
      </figure>
    </div>

    <!-- ═══ FRANJA DE CIFRAS ═══════════════════════════════════════ -->
    <div class="pc-cifras">
      <div class="rs-wrap rs-wrap--2xl pc-cifras__inner">
        @for (c of cifras; track c.dato) {
          <div class="pc-cifra" rsAnim="scale" [rsAnimDelay]="$index * 80">
            <rs-icon [name]="c.icon" [size]="22" [stroke]="1.9" />
            <strong>{{ c.dato | t }}</strong>
            <span>{{ c.texto | t }}</span>
          </div>
        }
      </div>
    </div>
  </section>

  <!-- ═══ CATEGORÍAS PUBLICABLES ═══════════════════════════════════ -->
  <section class="rs-section rs-section--sm pc-cats">
    <div class="rs-wrap rs-wrap--2xl">
      <header class="pc-head" rsAnim>
        <p class="pc-head__eyebrow">{{ 'Qué puedes publicar' | t }}</p>
        <h2 class="pc-head__title">{{ 'Sea cual sea tu servicio, tiene su sitio' | t }}</h2>
        <p class="pc-head__text">
          {{ 'Doogking reúne en un mismo buscador todas las categorías del cuidado animal. Publica una o todas: ningún plan limita cuántos servicios puedes tener activos.' | t }}
        </p>
      </header>

      <ul class="pc-cats__grid">
        @for (v of verticales; track v.key) {
          <li class="pc-cat" rsAnim="scale" [rsAnimDelay]="$index * 60">
            <img [src]="v.icono" alt="" aria-hidden="true" class="pc-cat__ico" loading="lazy" />
            <h3>{{ v.labelCorto | t }}</h3>
            <p>{{ v.claim | t }}</p>
          </li>
        }
      </ul>
    </div>
  </section>

  <!-- ═══ VENTAJAS ═════════════════════════════════════════════════ -->
  <section class="rs-section pc-ventajas" id="ventajas">
    <div class="rs-wrap rs-wrap--2xl">
      <header class="pc-head" rsAnim>
        <p class="pc-head__eyebrow">{{ 'Ventajas' | t }}</p>
        <h2 class="pc-head__title">{{ 'Todo lo que dejas de hacer a mano' | t }}</h2>
        <p class="pc-head__text">
          {{ 'La agenda en papel, el teléfono que suena a deshora y el cobro que se reclama después. Doogking se ocupa de esa parte para que tú te ocupes del animal.' | t }}
        </p>
      </header>

      <ul class="pc-ventajas__grid">
        @for (b of ventajas; track b.titulo) {
          <li class="pc-ventaja" rsAnim [rsAnimDelay]="$index * 70">
            <span class="pc-ventaja__ico"><rs-icon [name]="b.icon" [size]="24" [stroke]="1.85" /></span>
            <h3>{{ b.titulo | t }}</h3>
            <p>{{ b.texto | t }}</p>
          </li>
        }
      </ul>
    </div>
  </section>

  <!-- ═══ EL PANEL POR DENTRO ══════════════════════════════════════ -->
  <section class="rs-section rs-section--sm pc-panel">
    <div class="rs-wrap rs-wrap--2xl pc-panel__inner">
      <figure class="pc-panel__foto" rsAnim="from-left">
        <img [src]="fotoPanel" [alt]="'Reservando un servicio de Doogking desde el móvil' | t"
             loading="lazy" rsImg />
      </figure>

      <div class="pc-panel__body" rsAnim="from-right">
        <p class="pc-head__eyebrow">{{ 'Tu panel de control' | t }}</p>
        <h2 class="pc-head__title">{{ 'Un solo sitio para llevar el negocio' | t }}</h2>
        <p class="pc-head__text pc-head__text--left">
          {{ 'Desde el alta tienes el panel entero. No hay funciones de gestión bloqueadas detrás de un plan de pago.' | t }}
        </p>

        <ul class="pc-panel__lista">
          @for (f of panelFunciones; track f.titulo) {
            <li>
              <rs-icon [name]="f.icon" [size]="18" [stroke]="2" />
              <div>
                <strong>{{ f.titulo | t }}</strong>
                <span>{{ f.texto | t }}</span>
              </div>
            </li>
          }
        </ul>
      </div>
    </div>
  </section>

  <!-- ═══ CÓMO EMPEZAR ═════════════════════════════════════════════ -->
  <section class="rs-section pc-pasos" id="como-empezar">
    <div class="rs-wrap rs-wrap--lg">
      <header class="pc-head pc-head--claro" rsAnim>
        <p class="pc-head__eyebrow">{{ 'Cómo empezar' | t }}</p>
        <h2 class="pc-head__title">{{ 'De cero a recibir reservas' | t }}</h2>
        <p class="pc-head__text">{{ 'Tres pasos. El alta no pide datos fiscales ni bancarios: esos llegan cuando decides publicar.' | t }}</p>
      </header>

      <ol class="pc-pasos__grid">
        @for (p of pasos; track p.titulo) {
          <li class="pc-paso" rsAnim [rsAnimDelay]="$index * 110">
            <span class="pc-paso__num">{{ $index + 1 }}</span>
            <rs-icon [name]="p.icon" [size]="26" [stroke]="1.85" class="pc-paso__ico" />
            <h3>{{ p.titulo | t }}</h3>
            <p>{{ p.texto | t }}</p>
          </li>
        }
      </ol>

      <div class="pc-pasos__cta" rsAnim>
        <a routerLink="/auth/registro-comercio" class="rs-btn rs-btn--gold rs-btn--lg">
          {{ 'Empezar ahora' | t }}
          <rs-icon name="arrow-right" [size]="17" [stroke]="2.25" />
        </a>
        <p>{{ 'Menos de 2 minutos · Sin tarjeta' | t }}</p>
      </div>
    </div>
  </section>

  <!-- ═══ PLANES ═══════════════════════════════════════════════════ -->
  <section class="rs-section pc-planes" id="planes">
    <div class="rs-wrap rs-wrap--lg">
      <header class="pc-head" rsAnim>
        <p class="pc-head__eyebrow">{{ 'Planes' | t }}</p>
        <h2 class="pc-head__title">{{ 'Publica gratis. Crece cuando quieras' | t }}</h2>
        <p class="pc-head__text">
          {{ 'Ningún plan limita cuántos servicios publicas. El Pro no te deja publicar más: te da más visibilidad y más herramientas para crecer.' | t }}
        </p>
      </header>

      <div class="pc-planes__grid">
        @for (plan of planes; track plan.clave) {
          <article class="pc-plan" [class.pc-plan--destacado]="plan.recomendado"
                   rsAnim="scale" [rsAnimDelay]="$index * 120">
            @if (plan.recomendado) {
              <span class="pc-plan__cinta">
                <rs-icon name="star" [size]="12" [stroke]="2.5" [filled]="true" />
                {{ 'Recomendado' | t }}
              </span>
            }

            <span class="pc-plan__ico"><rs-icon [name]="plan.icono" [size]="26" [stroke]="1.75" /></span>
            <h3 class="pc-plan__nombre">{{ plan.nombre | t }}</h3>
            <p class="pc-plan__gancho">{{ plan.gancho | t }}</p>

            <p class="pc-plan__precio">
              <strong>{{ plan.precioMensual === 0 ? ('Gratis' | t) : plan.precioMensual + ' €' }}</strong>
              @if (plan.precioMensual > 0) {
                <span>{{ 'al mes' | t }}</span>
              }
            </p>

            <ul class="pc-plan__lista">
              @if (plan.incluye) {
                <li class="pc-plan__hereda">
                  <rs-icon name="plus" [size]="14" [stroke]="2.5" />
                  {{ 'Todo lo del Plan Básico, más:' | t }}
                </li>
              }
              @for (b of plan.beneficios; track b) {
                <li><rs-icon name="check" [size]="14" [stroke]="3" /> {{ b | t }}</li>
              }
            </ul>

            <a routerLink="/auth/registro-comercio"
               class="rs-btn rs-btn--block"
               [class.rs-btn--gold]="plan.recomendado"
               [class.rs-btn--outline]="!plan.recomendado">
              {{ plan.recomendado ? ('Quiero crecer con Pro' | t) : ('Empezar gratis' | t) }}
            </a>
          </article>
        }
      </div>

      <!-- ═══ TRANSPARENCIA DE COBROS ══════════════════════════════
           Es la parte que más desconfianza genera en un alta, así que se
           cuenta entera y con enlace al texto que se firma, en vez de
           esconderla detrás de un "consulta condiciones". -->
      <div class="pc-comision" rsAnim>
        <div class="pc-comision__head">
          <rs-icon name="percent" [size]="22" [stroke]="1.9" />
          <h3>{{ 'Y la comisión, con las cartas boca arriba' | t }}</h3>
        </div>
        <ul class="pc-comision__lista">
          @for (c of comision; track c) {
            <li><rs-icon name="check" [size]="14" [stroke]="3" /> {{ c | t }}</li>
          }
        </ul>
        <a routerLink="/condiciones" class="pc-comision__link">
          {{ 'Leer las condiciones generales del servicio' | t }}
          <rs-icon name="arrow-right" [size]="15" [stroke]="2.25" />
        </a>
      </div>
    </div>
  </section>

  <!-- ═══ PREGUNTAS FRECUENTES ═════════════════════════════════════ -->
  <section class="rs-section rs-section--sm pc-faq" id="preguntas">
    <div class="rs-wrap rs-wrap--lg">
      <header class="pc-head" rsAnim>
        <p class="pc-head__eyebrow">{{ 'Preguntas frecuentes' | t }}</p>
        <h2 class="pc-head__title">{{ 'Lo que suelen preguntarnos' | t }}</h2>
      </header>

      <ul class="pc-faq__lista">
        @for (f of preguntas; track f.pregunta) {
          <li class="pc-faq__item" [class.is-abierta]="abierta() === $index" rsAnim [rsAnimDelay]="$index * 50">
            <h3>
              <button type="button" class="pc-faq__boton"
                      [attr.aria-expanded]="abierta() === $index"
                      (click)="alternar($index)">
                <span>{{ f.pregunta | t }}</span>
                <rs-icon name="chevron-down" [size]="18" [stroke]="2.25" class="pc-faq__chevron" />
              </button>
            </h3>
            @if (abierta() === $index) {
              <p class="pc-faq__respuesta">{{ f.respuesta | t }}</p>
            }
          </li>
        }
      </ul>
    </div>
  </section>

  <!-- ═══ CTA FINAL ════════════════════════════════════════════════ -->
  <section class="pc-final">
    <div class="rs-wrap rs-wrap--lg pc-final__inner" rsAnim>
      <img [src]="logoFooter" alt="Doogking" class="pc-final__logo" />
      <h2>{{ 'Tu próximo cliente ya está buscando' | t }}</h2>
      <p>{{ 'Únete a la plataforma que está transformando la forma de reservar servicios para mascotas. El alta es gratuita y puedes darte de baja cuando quieras.' | t }}</p>
      <a routerLink="/auth/registro-comercio" class="rs-btn rs-btn--gold rs-btn--xl">
        {{ 'Registrar mi negocio' | t }}
        <rs-icon name="arrow-right" [size]="18" [stroke]="2.25" />
      </a>
      <p class="pc-final__nota">
        {{ '¿Ya tienes cuenta?' | t }}
        <a routerLink="/auth/login">{{ 'Entra en tu panel' | t }}</a>
      </p>
    </div>
  </section>

  <!-- ═══ PIE ══════════════════════════════════════════════════════ -->
  <footer class="pc-pie">
    <div class="rs-wrap rs-wrap--2xl pc-pie__inner">
      <div class="pc-pie__marca">
        <a routerLink="/"><img [src]="logoD" alt="Doogking" /></a>
        <p>{{ 'El marketplace de servicios para mascotas en Europa.' | t }}</p>
        <div class="pc-pie__social" [attr.aria-label]="'Redes sociales de Doogking' | t">
          @for (red of redesSociales; track red.nombre) {
            <a [href]="red.url" target="_blank" rel="noopener" [attr.title]="red.nombre">
              <rs-social-icon [name]="red.icono" [size]="17" [etiqueta]="red.nombre" />
            </a>
          }
        </div>
      </div>

      <nav class="pc-pie__enlaces" [attr.aria-label]="'Enlaces del pie' | t">
        <a routerLink="/auth/registro-comercio">{{ 'Registrar negocio' | t }}</a>
        <a routerLink="/condiciones">{{ 'Condiciones del servicio' | t }}</a>
        <a routerLink="/privacidad">{{ 'Privacidad' | t }}</a>
        <a [href]="'mailto:' + emailSoporte">{{ emailSoporte }}</a>
      </nav>
    </div>

    <p class="pc-pie__legal">{{ '© 2026 Doogking · Todos los derechos reservados' | t }}</p>
  </footer>
</div>
  `,
  styles: [`
:host { display: block; background: var(--c-base); }

/* ══ ANIMACIÓN DE ENTRADA ═══════════════════════════════════════════
   El hero ya está en pantalla al cargar, así que entra con una animación
   encadenada en lugar de con la directiva rsAnim, que sólo dispara cuando
   el elemento entra en el viewport. El modo backwards mantiene el estado
   inicial durante el retardo: sin él, el texto parpadea visible antes de
   empezar a subir. */
.pc-in { animation: fadeUp .72s cubic-bezier(.22,1,.36,1) backwards; }
.pc-in--1 { animation-delay: .05s; }
.pc-in--2 { animation-delay: .14s; }
.pc-in--3 { animation-delay: .24s; }
.pc-in--4 { animation-delay: .34s; }
.pc-in--5 { animation-delay: .44s; }

/* ══ CABECERA ══════════════════════════════════════════════════════ */
.pc-bar {
  position: sticky; top: 0; z-index: var(--z-3);
  background: rgba(0,19,93,.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255,255,255,.10);
  padding-top: env(safe-area-inset-top, 0px);
}
.pc-bar__inner { display: flex; align-items: center; gap: var(--sp-6); min-height: 64px; }
.pc-bar__brand {
  display: inline-flex; align-items: center; gap: var(--sp-3);
  color: #fff; font-family: var(--font-display); font-weight: var(--w-8);
  letter-spacing: -.02em; flex-shrink: 0;
}
.pc-bar__brand img { width: 34px; height: 34px; border-radius: 9px; }
/* En pantallas estrechas la barra sólo lleva la marca compacta y el botón de
   alta: con el nombre escrito, los dos no caben y el botón se partía. */
@media (max-width: 480px) { .pc-bar__brand span { display: none; } }
.pc-bar__nav { display: none; gap: var(--sp-6); margin-inline: auto; }
.pc-bar__nav a {
  font-size: var(--f-sm); font-weight: var(--w-6);
  color: rgba(255,255,255,.72); transition: color var(--d-2);
}
.pc-bar__nav a:hover { color: var(--dk-gold); }
.pc-bar__acciones { display: flex; align-items: center; gap: var(--sp-3); margin-left: auto; }
.pc-bar__login {
  display: none; font-size: var(--f-sm); font-weight: var(--w-6);
  color: rgba(255,255,255,.82); transition: color var(--d-2);
}
.pc-bar__login:hover { color: #fff; }
@media (min-width: 900px) {
  .pc-bar__nav { display: flex; }
  .pc-bar__login { display: inline-flex; }
  .pc-bar__acciones { margin-left: 0; }
}

/* ══ HERO ══════════════════════════════════════════════════════════ */
.pc-hero {
  position: relative;
  background: linear-gradient(165deg, #00135D 0%, #08258B 58%, #0A2CA6 100%);
  color: #fff;
  padding-top: var(--sp-16);
  overflow: hidden;
}
.pc-hero__glow {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse 70% 55% at 20% 0%, rgba(251,174,23,.20) 0%, transparent 62%);
}
.pc-hero__orb { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
.pc-hero__orb--1 {
  width: 520px; height: 520px; top: -180px; right: -120px;
  background: rgba(251,174,23,.22);
  animation: floatSlow 14s ease-in-out infinite;
}
.pc-hero__orb--2 {
  width: 420px; height: 420px; bottom: 80px; left: -160px;
  background: rgba(65,86,185,.35);
  animation: floatSlow 18s ease-in-out infinite reverse;
}

.pc-hero__inner {
  position: relative; z-index: 1;
  display: grid; gap: var(--sp-12);
  padding-bottom: var(--sp-20);
}
@media (min-width: 1024px) {
  .pc-hero { padding-top: var(--sp-20); }
  .pc-hero__inner { grid-template-columns: 1.05fr .95fr; align-items: center; gap: var(--sp-16); }
}

.pc-hero__eyebrow {
  display: inline-flex; align-items: center; gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  border: 1px solid rgba(251,174,23,.45);
  border-radius: var(--r-full);
  background: rgba(251,174,23,.12);
  color: var(--dk-gold-light);
  font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
  letter-spacing: .08em; text-transform: uppercase;
}

.pc-hero__title {
  margin-top: var(--sp-5);
  font-size: clamp(2.1rem, 5.4vw, 3.75rem);
  font-weight: var(--w-8); line-height: 1.08; color: #fff;
  text-wrap: balance;
}
.pc-hero__title-gold { display: block; color: var(--dk-gold); }

.pc-hero__text {
  margin-top: var(--sp-5); max-width: 34rem;
  font-size: var(--f-lg); line-height: 1.65;
  color: rgba(255,255,255,.80);
}

.pc-hero__cta {
  margin-top: var(--sp-8);
  display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-4);
}
.pc-hero__cta-alt {
  display: inline-flex; align-items: center; gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-5);
  font-size: var(--f-sm); font-weight: var(--w-6);
  color: rgba(255,255,255,.88);
  border-radius: var(--r-xl);
  border: 1px solid rgba(255,255,255,.22);
  transition: background var(--d-2), border-color var(--d-2);
}
.pc-hero__cta-alt:hover { background: rgba(255,255,255,.10); border-color: rgba(255,255,255,.4); }

.pc-hero__chips { margin-top: var(--sp-8); display: flex; flex-wrap: wrap; gap: var(--sp-3) var(--sp-6); }
.pc-hero__chips li {
  display: inline-flex; align-items: center; gap: var(--sp-2);
  font-size: var(--f-sm); font-weight: var(--w-5);
  color: rgba(255,255,255,.80);
}
.pc-hero__chips rs-icon { color: var(--dk-gold); }

/* Foto del hero con dos avisos flotando encima. */
.pc-hero__art { position: relative; }
.pc-hero__art img {
  width: 100%; aspect-ratio: 4 / 3.4; object-fit: cover;
  border-radius: var(--r-3xl);
  border: 1px solid rgba(255,255,255,.18);
  box-shadow: 0 32px 70px rgba(0,10,50,.45);
}
@media (min-width: 1024px) { .pc-hero__art img { aspect-ratio: 4 / 4.2; } }

.pc-float {
  position: absolute;
  display: flex; align-items: center; gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  background: var(--c-card);
  border-radius: var(--r-lg);
  box-shadow: 0 16px 40px rgba(0,10,50,.30);
  animation: float 7s ease-in-out infinite;
}
.pc-float strong { display: block; font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); }
.pc-float small { display: block; font-size: var(--f-xs); color: var(--t-400); }
.pc-float__ico { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0; }
.pc-float__ico--ok { background: rgba(4,120,87,.14); color: var(--c-success); }
.pc-float__ico--gold { background: rgba(251,174,23,.18); color: var(--dk-gold-text); }

.pc-float--reserva { top: 8%; left: -4%; animation-delay: .4s; }
.pc-float--ingresos { bottom: 10%; right: -3%; animation-delay: 2.2s; }
@media (max-width: 560px) {
  .pc-float--reserva { left: 0; }
  .pc-float--ingresos { right: 0; }
  .pc-float small { display: none; }
}

/* ══ FRANJA DE CIFRAS ══════════════════════════════════════════════ */
.pc-cifras {
  position: relative; z-index: 1;
  border-top: 1px solid rgba(255,255,255,.12);
  background: rgba(0,10,50,.35);
}
.pc-cifras__inner {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: var(--sp-6); padding-block: var(--sp-10);
}
@media (min-width: 860px) { .pc-cifras__inner { grid-template-columns: repeat(4, 1fr); } }

.pc-cifra { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--sp-1); }
.pc-cifra rs-icon { color: var(--dk-gold); }
.pc-cifra strong { font-family: var(--font-display); font-size: var(--f-2xl); font-weight: var(--w-8); color: #fff; }
.pc-cifra span { font-size: var(--f-sm); color: rgba(255,255,255,.68); }

/* ══ CABECERAS DE SECCIÓN ══════════════════════════════════════════ */
.pc-head { max-width: 46rem; margin: 0 auto var(--sp-12); text-align: center; }
.pc-head__eyebrow {
  font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
  letter-spacing: .1em; text-transform: uppercase; color: var(--dk-gold-text);
  margin-bottom: var(--sp-3);
}
.pc-head__title {
  font-size: clamp(1.6rem, 3.4vw, var(--f-4xl));
  font-weight: var(--w-8); color: var(--t-100); text-wrap: balance;
}
.pc-head__text { margin-top: var(--sp-4); font-size: var(--f-md); line-height: 1.7; color: var(--t-300); }
.pc-head__text--left { margin-inline: 0; }
.pc-head--claro .pc-head__eyebrow { color: var(--dk-gold); }
.pc-head--claro .pc-head__title { color: #fff; }
.pc-head--claro .pc-head__text { color: rgba(255,255,255,.72); }

/* ══ CATEGORÍAS ════════════════════════════════════════════════════ */
.pc-cats { background: var(--c-card); }
/* Columnas fijas y no auto-fit: las categorías son ocho, y con auto-fit el
   ancho de escritorio cabía seis y dejaba dos sueltas en una segunda fila
   medio vacía. Con cuatro columnas salen dos filas completas. */
.pc-cats__grid { display: grid; gap: var(--sp-4); grid-template-columns: repeat(2, 1fr); }
@media (min-width: 640px)  { .pc-cats__grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .pc-cats__grid { grid-template-columns: repeat(4, 1fr); } }
.pc-cat {
  padding: var(--sp-6);
  background: var(--c-base);
  border: 1px solid var(--b-1);
  border-radius: var(--r-xl);
  transition: transform var(--d-3), box-shadow var(--d-3), border-color var(--d-3);
}
.pc-cat:hover { transform: translateY(-4px); box-shadow: var(--sh-lg); border-color: var(--b-a); }
/* Con dos columnas en un móvil de 360px, el relleno de escritorio dejaba
   unos 110px de texto y los nombres largos se rompían letra a letra. */
@media (max-width: 640px) { .pc-cat { padding: var(--sp-4); } }
.pc-cat__ico { width: 42px; height: 42px; margin-bottom: var(--sp-4); }
.pc-cat h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); }
.pc-cat p { margin-top: var(--sp-2); font-size: var(--f-sm); line-height: 1.6; color: var(--t-400); }

/* ══ VENTAJAS ══════════════════════════════════════════════════════ */
/* Tres columnas por el mismo motivo que las categorías: son seis ventajas y
   auto-fit las repartía 4 + 2. */
.pc-ventajas__grid { display: grid; gap: var(--sp-6); grid-template-columns: 1fr; }
@media (min-width: 640px)  { .pc-ventajas__grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .pc-ventajas__grid { grid-template-columns: repeat(3, 1fr); } }
.pc-ventaja {
  padding: var(--sp-8);
  background: var(--c-card);
  border: 1px solid var(--b-1);
  border-radius: var(--r-2xl);
  box-shadow: var(--sh-card);
  transition: transform var(--d-3), box-shadow var(--d-3);
}
.pc-ventaja:hover { transform: translateY(-5px); box-shadow: var(--sh-xl); }
.pc-ventaja__ico {
  display: grid; place-items: center;
  width: 52px; height: 52px; margin-bottom: var(--sp-5);
  border-radius: var(--r-lg);
  background: var(--c-accent-lo); color: var(--dk-blue);
}
.pc-ventaja h3 { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); }
.pc-ventaja p { margin-top: var(--sp-3); font-size: var(--f-base); line-height: 1.7; color: var(--t-300); }

/* ══ PANEL POR DENTRO ══════════════════════════════════════════════ */
.pc-panel { background: var(--c-card); }
.pc-panel__inner { display: grid; gap: var(--sp-12); align-items: center; }
@media (min-width: 960px) { .pc-panel__inner { grid-template-columns: 1fr 1fr; gap: var(--sp-16); } }

.pc-panel__foto img {
  width: 100%; aspect-ratio: 4 / 3; object-fit: cover;
  border-radius: var(--r-2xl);
  box-shadow: var(--sh-xl);
}
.pc-panel__body .pc-head__eyebrow,
.pc-panel__body .pc-head__title { text-align: left; }
.pc-panel__lista { margin-top: var(--sp-8); display: grid; gap: var(--sp-5); }
@media (min-width: 600px) { .pc-panel__lista { grid-template-columns: 1fr 1fr; } }
.pc-panel__lista li { display: flex; gap: var(--sp-3); }
.pc-panel__lista rs-icon { color: var(--dk-gold-text); flex-shrink: 0; margin-top: 2px; }
.pc-panel__lista strong { display: block; font-size: var(--f-base); font-weight: var(--w-7); color: var(--t-100); }
.pc-panel__lista span { display: block; font-size: var(--f-sm); line-height: 1.6; color: var(--t-400); }

/* ══ PASOS ═════════════════════════════════════════════════════════ */
.pc-pasos {
  position: relative;
  background:
    linear-gradient(135deg, rgba(0,19,93,.94) 0%, rgba(8,37,139,.94) 100%),
    var(--dk-blue-deep);
  color: #fff;
}
.pc-pasos__grid { display: grid; gap: var(--sp-6); grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr)); }
.pc-paso {
  position: relative;
  padding: var(--sp-8);
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.14);
  border-radius: var(--r-2xl);
  backdrop-filter: blur(6px);
}
.pc-paso__num {
  position: absolute; top: calc(var(--sp-5) * -1); left: var(--sp-6);
  display: grid; place-items: center;
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--dk-gold); color: var(--dk-blue-deep);
  font-family: var(--font-display); font-weight: var(--w-8); font-size: var(--f-md);
  box-shadow: var(--sh-glow);
}
.pc-paso__ico { color: var(--dk-gold-light); margin-bottom: var(--sp-4); }
.pc-paso h3 { font-size: var(--f-lg); font-weight: var(--w-7); color: #fff; }
.pc-paso p { margin-top: var(--sp-3); font-size: var(--f-sm); line-height: 1.7; color: rgba(255,255,255,.74); }

.pc-pasos__cta { margin-top: var(--sp-12); text-align: center; }
.pc-pasos__cta p { margin-top: var(--sp-4); font-size: var(--f-sm); color: rgba(255,255,255,.62); }

/* ══ PLANES ════════════════════════════════════════════════════════ */
.pc-planes__grid {
  display: grid; gap: var(--sp-6);
  /* El min() evita el desbordamiento clásico de auto-fit: en un móvil más
     estrecho que el mínimo, la columna se quedaba en 290px y sacaba la
     tarjeta fuera de la pantalla. */
  grid-template-columns: repeat(auto-fit, minmax(min(290px, 100%), 1fr));
  align-items: stretch;
}
.pc-plan {
  position: relative;
  display: flex; flex-direction: column;
  padding: var(--sp-8);
  background: var(--c-card);
  border: 1px solid var(--b-1);
  border-radius: var(--r-2xl);
  box-shadow: var(--sh-card);
}
.pc-plan--destacado { border-color: var(--dk-gold); box-shadow: 0 0 0 1px var(--dk-gold), var(--sh-xl); }
.pc-plan__cinta {
  position: absolute; top: calc(var(--sp-3) * -1); left: 50%; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: var(--sp-2);
  padding: var(--sp-1) var(--sp-4);
  border-radius: var(--r-full);
  background: var(--g-warm); color: var(--dk-blue-deep);
  font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
  letter-spacing: .06em; text-transform: uppercase; white-space: nowrap;
}
.pc-plan__ico {
  display: grid; place-items: center;
  width: 52px; height: 52px; margin-bottom: var(--sp-4);
  border-radius: var(--r-lg);
  background: var(--c-accent-lo); color: var(--dk-blue);
}
.pc-plan--destacado .pc-plan__ico { background: rgba(251,174,23,.16); color: var(--dk-gold-text); }
.pc-plan__nombre { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); }
.pc-plan__gancho { margin-top: var(--sp-2); font-size: var(--f-sm); line-height: 1.6; color: var(--t-400); }
.pc-plan__precio {
  margin: var(--sp-5) 0;
  display: flex; align-items: baseline; gap: var(--sp-2);
  padding-bottom: var(--sp-5);
  border-bottom: 1px solid var(--b-1);
}
.pc-plan__precio strong {
  font-family: var(--font-display); font-size: var(--f-4xl); font-weight: var(--w-8);
  color: var(--t-100); line-height: 1;
}
.pc-plan__precio span { font-size: var(--f-sm); color: var(--t-400); }
.pc-plan__lista { display: grid; gap: var(--sp-3); margin-bottom: var(--sp-8); }
.pc-plan__lista li {
  display: flex; gap: var(--sp-3); align-items: flex-start;
  font-size: var(--f-sm); line-height: 1.55; color: var(--t-300);
}
.pc-plan__lista rs-icon { color: var(--c-success); flex-shrink: 0; margin-top: 3px; }
.pc-plan__hereda { font-weight: var(--w-7); color: var(--t-100); }
.pc-plan__hereda rs-icon { color: var(--dk-gold-text); }
.pc-plan .rs-btn { margin-top: auto; }

/* ══ COMISIÓN ══════════════════════════════════════════════════════ */
.pc-comision {
  margin-top: var(--sp-12);
  padding: var(--sp-8);
  border-radius: var(--r-2xl);
  background: var(--g-card);
  border: 1px solid var(--b-1);
}
.pc-comision__head { display: flex; align-items: center; gap: var(--sp-3); }
.pc-comision__head rs-icon { color: var(--dk-gold-text); }
.pc-comision__head h3 { font-size: var(--f-xl); font-weight: var(--w-7); color: var(--t-100); }
.pc-comision__lista { margin: var(--sp-6) 0; display: grid; gap: var(--sp-3); }
@media (min-width: 760px) { .pc-comision__lista { grid-template-columns: 1fr 1fr; gap: var(--sp-3) var(--sp-8); } }
.pc-comision__lista li {
  display: flex; gap: var(--sp-3); align-items: flex-start;
  font-size: var(--f-base); line-height: 1.6; color: var(--t-300);
}
.pc-comision__lista rs-icon { color: var(--c-success); flex-shrink: 0; margin-top: 4px; }
.pc-comision__link {
  display: inline-flex; align-items: center; gap: var(--sp-2);
  font-size: var(--f-sm); font-weight: var(--w-6); color: var(--dk-blue);
  transition: gap var(--d-2);
}
.pc-comision__link:hover { gap: var(--sp-3); }

/* ══ PREGUNTAS ═════════════════════════════════════════════════════ */
.pc-faq { background: var(--c-card); }
.pc-faq__lista { display: grid; gap: var(--sp-3); }
.pc-faq__item {
  background: var(--c-base);
  border: 1px solid var(--b-1);
  border-radius: var(--r-lg);
  overflow: hidden;
  transition: border-color var(--d-2), box-shadow var(--d-2);
}
.pc-faq__item.is-abierta { border-color: var(--b-a); box-shadow: var(--sh-md); }
.pc-faq__boton {
  width: 100%; min-height: 56px;
  display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5);
  text-align: left;
  font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100);
}
.pc-faq__chevron { color: var(--t-400); flex-shrink: 0; transition: transform var(--d-2); }
.is-abierta .pc-faq__chevron { transform: rotate(180deg); color: var(--dk-blue); }
.pc-faq__respuesta {
  padding: 0 var(--sp-5) var(--sp-5);
  font-size: var(--f-base); line-height: 1.75; color: var(--t-300);
  animation: fadeIn var(--d-3) backwards;
}

/* ══ CTA FINAL ═════════════════════════════════════════════════════ */
.pc-final {
  padding-block: var(--sp-24);
  background:
    radial-gradient(ellipse 70% 90% at 50% 0%, rgba(251,174,23,.20) 0%, transparent 60%),
    linear-gradient(160deg, #00135D 0%, #08258B 100%);
  color: #fff; text-align: center;
}
.pc-final__logo { height: 62px; width: auto; margin: 0 auto var(--sp-6); }
.pc-final h2 {
  font-size: clamp(1.75rem, 4vw, var(--f-4xl)); font-weight: var(--w-8); color: #fff;
  text-wrap: balance;
}
.pc-final p {
  max-width: 40rem; margin: var(--sp-4) auto var(--sp-8);
  font-size: var(--f-md); line-height: 1.7; color: rgba(255,255,255,.78);
}
.pc-final__nota { margin: var(--sp-6) auto 0; font-size: var(--f-sm); color: rgba(255,255,255,.62); }
.pc-final__nota a { color: var(--dk-gold); font-weight: var(--w-6); text-decoration: underline; }

/* ══ PIE ═══════════════════════════════════════════════════════════ */
.pc-pie { background: var(--dk-blue-deep); color: rgba(255,255,255,.72); padding-block: var(--sp-12) var(--sp-8); }
.pc-pie__inner { display: grid; gap: var(--sp-8); }
@media (min-width: 760px) { .pc-pie__inner { grid-template-columns: 1fr auto; align-items: start; } }
.pc-pie__marca img { width: 40px; height: 40px; border-radius: 10px; }
.pc-pie__marca p { margin-top: var(--sp-3); font-size: var(--f-sm); max-width: 26rem; }
.pc-pie__social { margin-top: var(--sp-4); display: flex; gap: var(--sp-3); }
.pc-pie__social a {
  display: grid; place-items: center; width: 34px; height: 34px;
  border-radius: 50%; background: rgba(255,255,255,.08); color: #fff;
  transition: background var(--d-2);
}
.pc-pie__social a:hover { background: rgba(251,174,23,.22); }
.pc-pie__enlaces { display: grid; gap: var(--sp-3); }
.pc-pie__enlaces a { font-size: var(--f-sm); transition: color var(--d-1); }
.pc-pie__enlaces a:hover { color: var(--dk-gold); }
.pc-pie__legal {
  margin-top: var(--sp-10); padding-top: var(--sp-6);
  border-top: 1px solid rgba(255,255,255,.10);
  text-align: center; font-size: var(--f-xs); color: rgba(255,255,255,.5);
}

/* Quien pide menos movimiento en su sistema no debe recibir ninguno: las
   animaciones de esta página son decorativas y nada depende de ellas. */
@media (prefers-reduced-motion: reduce) {
  .pc-in, .pc-float, .pc-hero__orb, .pc-faq__respuesta { animation: none; }
  .pc-cat, .pc-ventaja { transition: none; }
}
  `],
})
export class ParaComerciosComponent {
  readonly logoD = BRAND.logoD;
  readonly logoFooter = BRAND.logoFooter;
  readonly fotoHero = MOTIVOS_IMAGES.verificados;
  readonly fotoPanel = MOTIVOS_IMAGES.rapidez;
  readonly emailSoporte = RESPONSABLE.emailSoporte;
  readonly redesSociales = REDES_SOCIALES;

  /** Mismas categorías que el buscador público: se anuncia lo que existe. */
  readonly verticales = VERTICALES_PUBLICOS;

  /** Mismo catálogo que la pantalla de suscripción del panel de comercio. */
  readonly planes = PLANES;

  /** Índice de la pregunta abierta del acordeón; `null` = todas cerradas. */
  readonly abierta = signal<number | null>(0);

  alternar(indice: number): void {
    this.abierta.update((actual) => (actual === indice ? null : indice));
  }

  readonly ganchos = [
    'Alta en menos de 2 minutos',
    'Sin cuota de alta',
    'Sin permanencia',
  ];

  /**
   * Cifras verificables, no métricas de tracción: la plataforma acaba de abrir
   * y presumir de "miles de reservas" sería inventarlo. Se cuenta lo que sí es
   * cierto —cuántas categorías hay, qué cuesta entrar, cómo se cobra—, que
   * además es lo que decide a un profesional.
   */
  readonly cifras = [
    { icon: 'paw', dato: '8 categorías', texto: 'de servicio para publicar' },
    { icon: 'euro', dato: '0 €', texto: 'de cuota de alta' },
    { icon: 'clock', dato: '24/7', texto: 'reservas online, sin llamadas' },
    { icon: 'lock', dato: 'Stripe', texto: 'cobro seguro y liquidaciones' },
  ];

  readonly ventajas = [
    {
      icon: 'search',
      titulo: 'Clientes que ya te buscan',
      texto: 'Tu ficha aparece en el buscador cuando alguien busca tu servicio en tu ciudad, con sus fechas y sus filtros. No compites por atención: apareces en el momento en que hay intención de reservar.',
    },
    {
      icon: 'calendar',
      titulo: 'Reservas mientras trabajas',
      texto: 'El cliente reserva y paga online a cualquier hora. Tú recibes la reserva confirmada en el panel, sin llamadas que interrumpen ni mensajes que contestar a las once de la noche.',
    },
    {
      icon: 'clock',
      titulo: 'Tu disponibilidad, tus reglas',
      texto: 'Marcas horarios, cupos, días cerrados y precios por temporada. Sólo se puede reservar lo que tú has abierto, así que no hay sobreventa ni cuadres a mano.',
    },
    {
      icon: 'credit-card',
      titulo: 'Cobras por adelantado',
      texto: 'El pago se hace con Stripe al reservar, así que el servicio te llega ya cobrado. Cada liquidación se abona en tu cuenta con el detalle de lo que se ha descontado.',
    },
    {
      icon: 'star',
      titulo: 'Reputación que se ve',
      texto: 'Las reseñas sólo las deja quien ha reservado de verdad, y puedes responder públicamente a todas. Tu trabajo bien hecho se convierte en el argumento de venta del siguiente cliente.',
    },
    {
      icon: 'bar-chart',
      titulo: 'Saber cómo va el negocio',
      texto: 'Reservas, ingresos, ocupación y valoraciones en el mismo panel. Dejas de reconstruir el mes con la agenda en una mano y el extracto del banco en la otra.',
    },
  ];

  readonly panelFunciones = [
    { icon: 'calendar', titulo: 'Agenda', texto: 'Tu calendario con todo lo reservado' },
    { icon: 'list', titulo: 'Reservas', texto: 'Entrantes, confirmadas y canceladas' },
    { icon: 'store', titulo: 'Tus fichas', texto: 'Fotos, precios, horarios y publicación' },
    { icon: 'plus', titulo: 'Suplementos', texto: 'Extras y recargos que sumas al precio' },
    { icon: 'wallet', titulo: 'Ingresos', texto: 'Liquidaciones con su desglose' },
    { icon: 'star', titulo: 'Reseñas', texto: 'Lee y responde a tus clientes' },
    { icon: 'users', titulo: 'Equipo', texto: 'Invita a tu personal con su rol' },
    { icon: 'crown', titulo: 'Tu plan', texto: 'Cambia de plan cuando quieras' },
  ];

  readonly pasos = [
    {
      icon: 'user',
      titulo: 'Crea tu cuenta',
      texto: 'Nombre del negocio, categoría y correo. Nada más: los datos fiscales y bancarios se piden después, cuando ya has decidido publicar.',
    },
    {
      icon: 'camera',
      titulo: 'Publica tus servicios',
      texto: 'Describe lo que ofreces, pon tus precios y tu disponibilidad, y sube las fotos. La ficha queda en borrador hasta que tú la publicas.',
    },
    {
      icon: 'party-popper',
      titulo: 'Recibe reservas y cobra',
      texto: 'El cliente reserva y paga online. Tú prestas el servicio y recibes la liquidación en la cuenta bancaria que hayas declarado.',
    },
  ];

  readonly comision = [
    'Cero por publicar: el alta y el Plan Básico son gratuitos.',
    'Sólo se cobra comisión cuando hay una reserva pagada.',
    'El porcentaje depende de tu categoría y se te muestra antes de aceptar.',
    'Los precios los pones tú, con los impuestos incluidos.',
    'La liquidación descuenta comisión y coste de la pasarela, con el detalle a la vista.',
    'Sin permanencia: te das de baja desde el panel cuando quieras.',
  ];

  readonly preguntas = [
    {
      pregunta: '¿Cuánto cuesta publicar en Doogking?',
      respuesta: 'Nada. El alta no tiene cuota y el Plan Básico es gratuito, con los servicios publicados sin límite. Sólo pagas comisión cuando recibes una reserva pagada, y el Plan Pro es opcional si quieres más visibilidad y herramientas.',
    },
    {
      pregunta: '¿Qué comisión se aplica a cada reserva?',
      respuesta: 'Un porcentaje sobre el importe de la reserva que depende de tu categoría de servicio. El porcentaje vigente se te muestra antes de que aceptes las condiciones, y queda recogido en las condiciones generales del servicio.',
    },
    {
      pregunta: '¿Cuándo y cómo cobro?',
      respuesta: 'El cliente paga online al reservar, con Stripe. Doogking te abona la liquidación en la cuenta bancaria que declares, descontando la comisión de la plataforma y el coste de la pasarela de pago. El desglose de cada liquidación está en el panel, en la sección de ingresos.',
    },
    {
      pregunta: '¿Qué necesito para darme de alta?',
      respuesta: 'Operar legalmente y contar con los permisos, licencias, seguros y titulaciones que exija tu actividad. Para crear la cuenta basta con el nombre del negocio, la categoría y un correo; la documentación y los datos bancarios llegan en el paso de publicación.',
    },
    {
      pregunta: '¿Puedo ofrecer varios servicios o varias categorías?',
      respuesta: 'Sí. Un mismo negocio puede publicar en todas las categorías en las que trabaje, y ningún plan limita cuántas fichas puedes tener activas. Una peluquería que además hace transporte tiene las dos cosas en la misma cuenta.',
    },
    {
      pregunta: '¿Puedo darme de baja?',
      respuesta: 'Cuando quieras y desde el propio panel, sin permanencia ni penalización. Lo único que debes atender son las reservas ya confirmadas, o cancelarlas conforme a la política que hayas declarado en tu ficha.',
    },
  ];
}
