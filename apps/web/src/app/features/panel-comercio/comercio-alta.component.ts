import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { VerticalKey } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsPhoneInputComponent } from '../../shared/components/phone-input/rs-phone-input.component';
import { verticalUi } from '../../shared/verticales/verticales.config';
import { ComercioApiService, MiComercio } from './comercio-api.service';
import { ComercioListadoFormComponent } from './comercio-listado-form.component';
import { ComercioSolicitudSegurosComponent } from './comercio-solicitud-seguros.component';

/** Pasos del alta guiada, en el orden del recorrido. */
type PasoAlta = 'elegir' | 'servicio' | 'creado' | 'negocio' | 'fin';

const PASOS: ReadonlyArray<{ clave: PasoAlta; label: string }> = [
  { clave: 'elegir',   label: 'Tu servicio' },
  { clave: 'servicio', label: 'Los detalles' },
  { clave: 'negocio',  label: 'Tu negocio' },
];

/**
 * Alta guiada del comercio, el recorrido que arranca al verificar el correo.
 *
 * Sigue el orden del extranet de Booking, y no el que teníamos: primero se
 * publica **lo que se vende** —el servicio, con sus fotos, su dirección y su
 * horario— y sólo al final se piden los papeles del negocio. Es deliberado: un
 * formulario fiscal como primera pantalla después de registrarse es donde se
 * caía la mitad de las altas, porque pide esfuerzo antes de haber enseñado nada
 * a cambio.
 *
 * El último paso se puede aparcar («todavía no tengo los datos»): el servicio
 * queda creado en borrador y el panel ofrece retomar el alta. Lo que no se
 * puede es publicar: sin datos de contacto ni consentimientos no hay ficha
 * pública, y eso se dice en pantalla en vez de dejar al comercio esperando.
 */
@Component({
  selector: 'app-comercio-alta',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule, RsIconComponent, RsPhoneInputComponent,
    ComercioListadoFormComponent, ComercioSolicitudSegurosComponent,
  ],
  template: `
    <div class="alta">
      @if (cargando()) {
        <div class="alta__cargando"><span class="rs-spin"></span></div>
      } @else {

      <header class="alta__cab">
        <a routerLink="/comercio" class="alta__salir">
          <rs-icon name="arrow-left" [size]="14" [stroke]="2" />
          Ir a mi panel
        </a>

        @if (paso() !== 'fin') {
          <p class="alta__eyebrow">
            Paso {{ indicePaso() + 1 }} de {{ pasos.length }} · {{ pasos[indicePaso()].label }}
          </p>
          <div class="alta__barra" role="progressbar" aria-label="Progreso del alta"
               [attr.aria-valuenow]="indicePaso() + 1" aria-valuemin="1"
               [attr.aria-valuemax]="pasos.length">
            <span class="alta__barra-fill" [style.width.%]="progreso()"></span>
          </div>
        }
      </header>

      <!-- ══ PASO 1 · Elegir qué se da de alta ══════════════════════════ -->
      @if (paso() === 'elegir') {
        <section class="alta__panel alta__panel--anim">
          <h1 class="alta__titulo">
            ¡Da de alta tu servicio en Doogking y empieza a recibir clientes cuanto antes!
          </h1>
          <p class="alta__sub">
            Para empezar, elige el tipo de servicio que quieres dar de alta en Doogking.
            Podrás añadir los demás cuando termines este.
          </p>

          <div class="cats" role="group" aria-label="Tipos de servicio">
            @for (v of opciones(); track v.key; let i = $index) {
              <button type="button" class="cat" [class.cat--sel]="elegido() === v.key"
                      [style.animation-delay.ms]="i * 60"
                      [attr.aria-pressed]="elegido() === v.key"
                      (click)="elegir(v.key)">
                <span class="cat__ico"><rs-icon [name]="v.icon" [size]="26" [stroke]="1.5" /></span>
                <span class="cat__cuerpo">
                  <span class="cat__label">{{ v.label }}</span>
                  <span class="cat__claim">{{ v.claim }}</span>
                </span>
                <span class="cat__marca" aria-hidden="true">
                  <rs-icon name="check" [size]="13" [stroke]="3" />
                </span>
              </button>
            }
          </div>

          @if (!opciones().length) {
            <div class="rs-alert rs-alert--warning">
              No hay categorías asociadas a tu negocio. Elige las tuyas en
              <a routerLink="/comercio/config">la configuración</a> y vuelve aquí.
            </div>
          }

          <div class="alta__pie" [class.alta__pie--dos]="serviciosCreados() > 0">
            <!-- Quien ya tiene un servicio creado llegó aquí desde el resumen:
                 sin esta salida, cambiar de idea obligaba a elegir una categoría
                 y crear una ficha para poder retroceder. -->
            @if (serviciosCreados() > 0) {
              <button type="button" class="rs-btn rs-btn--outline rs-btn--lg alta__volver"
                      (click)="irA('creado')">
                <rs-icon name="arrow-left" [size]="16" [stroke]="2.5" />
                Volver
              </button>
            }
            <button type="button" class="rs-btn rs-btn--primary rs-btn--lg rs-btn--block"
                    [disabled]="!elegido()" (click)="irAlServicio()">
              Continuar
              <rs-icon name="arrow-right" [size]="16" [stroke]="2.5" />
            </button>
          </div>
        </section>
      }

      <!-- ══ PASO 2 · La ficha del servicio ═════════════════════════════ -->
      @if (paso() === 'servicio') {
        <section class="alta__panel alta__panel--anim">
          @if (esSeguros()) {
            <!--
              Una aseguradora no publica una ficha: entrega una solicitud que
              revisamos a mano. Mismo recorrido, distinto formulario.
            -->
            <h1 class="alta__titulo">Solicita el alta de tu aseguradora</h1>
            <p class="alta__sub">
              No hace falta que montes una ficha: cuéntanos quién eres, sube las condiciones de
              tus pólizas y las revisamos nosotros.
            </p>

            <app-comercio-solicitud-seguros
              [mostrarVolver]="true"
              (volverAtras)="irA('elegir')" (creado)="servicioCreado()" />
          } @else {
            <h1 class="alta__titulo">Cuéntanos cómo es tu {{ etiquetaElegido().toLowerCase() }}</h1>
            <p class="alta__sub">
              Esto es lo que verán tus clientes. Puedes volver atrás en cualquier momento;
              nada se publica hasta que termines.
            </p>

            <app-comercio-listado-form
              [modoAlta]="true" [verticalInicial]="elegido()"
              (volverAtras)="irA('elegir')" (creado)="servicioCreado()" />
          }
        </section>
      }

      <!-- ══ SERVICIO CREADO · ¿otro más, o seguimos? ══════════════════ -->
      @if (paso() === 'creado') {
        <section class="alta__panel alta__panel--anim creado">
          <div class="creado__sello">
            <rs-icon name="check" [size]="30" [stroke]="2.5" />
          </div>

          @if (esSeguros()) {
            <h1 class="alta__titulo">Tu solicitud está en revisión</h1>
            <p class="alta__sub">
              Nuestro equipo revisará tu documentación y te escribirá. Mientras tanto puedes
              terminar con los datos de tu negocio: los necesitamos igualmente para poder
              trabajar contigo.
            </p>
          } @else {
            <h1 class="alta__titulo">
              {{ serviciosCreados() === 1 ? '¡Tu primer servicio está listo!' : '¡Servicio añadido!' }}
            </h1>
            <p class="alta__sub">
              Llevas {{ serviciosCreados() }}
              {{ serviciosCreados() === 1 ? 'servicio creado' : 'servicios creados' }}.
              Puedes añadir otro ahora —se tarda menos que el primero, ya sabes cómo va— o
              terminar con los datos de tu negocio.
            </p>
          }

          <div class="creado__opciones">
            <button type="button" class="opcion" (click)="anadirOtroServicio()">
              <span class="opcion__ico"><rs-icon name="plus" [size]="22" [stroke]="2" /></span>
              <span class="opcion__cuerpo">
                <span class="opcion__titulo">Añadir otro servicio</span>
                <span class="opcion__texto">
                  Otra categoría, u otro local de la misma. Cada uno lleva su dirección y su horario.
                </span>
              </span>
              <rs-icon name="arrow-right" [size]="16" [stroke]="2.5" class="opcion__flecha" />
            </button>

            <button type="button" class="opcion opcion--principal" (click)="irA('negocio')">
              <span class="opcion__ico"><rs-icon name="building" [size]="22" [stroke]="2" /></span>
              <span class="opcion__cuerpo">
                <span class="opcion__titulo">Continuar con mi negocio</span>
                <span class="opcion__texto">
                  El último paso: datos fiscales, contacto y condiciones. Podrás añadir más
                  servicios cuando quieras desde tu panel.
                </span>
              </span>
              <rs-icon name="arrow-right" [size]="16" [stroke]="2.5" class="opcion__flecha" />
            </button>
          </div>
        </section>
      }

      <!-- ══ PASO 3 · Los datos del negocio ═════════════════════════════ -->
      @if (paso() === 'negocio') {
        <section class="alta__panel alta__panel--anim">
          <h1 class="alta__titulo">Ya casi está: los datos de tu negocio</h1>
          <p class="alta__sub">
            Con esto emitimos tus facturas y tus clientes saben con quién hablan.
            Es el último paso.
          </p>

          <form class="alta__form" [formGroup]="negocioForm" (ngSubmit)="finalizar()" novalidate>

            <fieldset class="bloque">
              <legend class="bloque__tit">
                <rs-icon name="building" [size]="14" [stroke]="2" /> Datos fiscales
              </legend>

              <div class="rs-field">
                <label class="rs-lbl" for="nombreComercial">Nombre del negocio *</label>
                <input id="nombreComercial" class="rs-inp" formControlName="nombreComercial"
                       [placeholder]="placeholderNombre()" autocomplete="organization"
                       [class.rs-inp--error]="invalido('nombreComercial')" />
                @if (invalido('nombreComercial')) {
                  <span class="rs-field-err">Escribe el nombre con el que te conocen tus clientes.</span>
                } @else {
                  <span class="rs-field-hint">Así aparecerá en tu ficha pública.</span>
                }
              </div>

              <div class="fila">
                <div class="rs-field">
                  <label class="rs-lbl" for="razonSocial">Razón social</label>
                  <input id="razonSocial" class="rs-inp" formControlName="razonSocial"
                         placeholder="Ej: Villa Perruna S.L." autocomplete="organization" />
                  <span class="rs-field-hint">El nombre legal, el que va en las facturas.</span>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl" for="vatNumber">CIF / NIF</label>
                  <input id="vatNumber" class="rs-inp" formControlName="vatNumber"
                         placeholder="Ej: B12345678" />
                </div>
              </div>

              <div class="rs-field">
                <label class="rs-lbl" for="descripcion">Descripción del negocio</label>
                <textarea id="descripcion" class="rs-inp" formControlName="descripcion" rows="3"
                          placeholder="Cuenta qué te diferencia, con quién trabajas y qué incluye tu servicio…"
                          style="resize:vertical"></textarea>
              </div>
            </fieldset>

            <fieldset class="bloque">
              <legend class="bloque__tit">
                <rs-icon name="phone" [size]="14" [stroke]="2" /> Contacto
              </legend>

              <div class="fila">
                <div class="rs-field">
                  <label class="rs-lbl" for="nombreContacto">Persona de contacto</label>
                  <input id="nombreContacto" class="rs-inp" formControlName="nombreContacto"
                         placeholder="Nombre y apellidos" autocomplete="name" />
                </div>
                <div class="rs-field">
                  <label class="rs-lbl" for="email">Email de contacto</label>
                  <input id="email" class="rs-inp" type="email" formControlName="email"
                         placeholder="reservas@tunegocio.com" autocomplete="email"
                         [class.rs-inp--error]="invalido('email')" />
                  @if (invalido('email')) {
                    <span class="rs-field-err">Escribe un correo válido.</span>
                  }
                </div>
              </div>

              <div class="fila">
                <div class="rs-field">
                  <label class="rs-lbl" for="telefono">Teléfono</label>
                  <rs-phone-input inputId="telefono" formControlName="telefono" etiqueta="Teléfono" />
                </div>
                <div class="rs-field">
                  <label class="rs-lbl" for="whatsapp">WhatsApp <span class="opt">opcional</span></label>
                  <rs-phone-input inputId="whatsapp" formControlName="whatsapp" etiqueta="WhatsApp" />
                </div>
              </div>
            </fieldset>

            <fieldset class="bloque">
              <legend class="bloque__tit">
                <rs-icon name="badge-check" [size]="14" [stroke]="2" /> Declaraciones
              </legend>

              <label class="acuerdo" [class.acuerdo--on]="negocioForm.controls.operaLegalmente.value">
                <input type="checkbox" formControlName="operaLegalmente" />
                <span>
                  Declaro que mi empresa o actividad profesional opera legalmente y cumple con los
                  permisos, licencias y requisitos necesarios para prestar los servicios ofrecidos.
                  DOOGKING podrá solicitar documentación acreditativa y verificar los datos
                  proporcionados en cualquier momento.
                </span>
              </label>

              <label class="acuerdo" [class.acuerdo--on]="negocioForm.controls.condicionesGenerales.value">
                <input type="checkbox" formControlName="condicionesGenerales" />
                <span>
                  He leído, acepto y estoy de acuerdo con las
                  <a routerLink="/condiciones" target="_blank" rel="noopener">
                    Condiciones generales del servicio</a>.
                </span>
              </label>

              @if (faltanAcuerdos()) {
                <p class="rs-field-err">
                  Marca las dos casillas para terminar el alta. Si prefieres leerlas con calma,
                  puedes continuar más tarde.
                </p>
              }
            </fieldset>

            @if (error()) {
              <div class="rs-alert rs-alert--error" role="alert">{{ error() }}</div>
            }

            <div class="alta__pie alta__pie--fila">
              <div class="alta__acciones">
                <!-- Volver al resumen de servicios: hasta aquí sólo se salía
                     terminando o aplazando el alta, y quien quería añadir otro
                     servicio o revisar el anterior no tenía por dónde. Lo
                     escrito en el formulario se conserva. -->
                <button type="button" class="rs-btn rs-btn--outline rs-btn--lg alta__volver"
                        [disabled]="guardando()" (click)="volverDesdeNegocio()">
                  <rs-icon name="arrow-left" [size]="16" [stroke]="2.5" />
                  Volver
                </button>
                <button type="submit" class="rs-btn rs-btn--primary rs-btn--lg rs-btn--block"
                        [disabled]="guardando()">
                  @if (guardando()) { <span class="rs-spin"></span> }
                  {{ guardando() ? 'Guardando…' : 'Terminar el alta' }}
                </button>
              </div>

              <!--
                La salida honesta. Sin ella el comercio que no tiene el CIF a
                mano abandona la pantalla y no vuelve; así deja el alta guardada
                donde está y el panel le ofrece retomarla.
              -->
              <button type="button" class="rs-btn rs-btn--ghost" [disabled]="guardando()"
                      (click)="continuarMasTarde()">
                Todavía no tengo estos datos
              </button>
            </div>

            <p class="alta__nota">
              Tu servicio ya está guardado como borrador. Si lo dejas aquí, lo encontrarás en tu
              panel y podrás terminar cuando quieras: <strong>hasta entonces no se publica</strong>.
            </p>
          </form>
        </section>
      }

      <!-- ══ FIN ════════════════════════════════════════════════════════ -->
      @if (paso() === 'fin') {
        <section class="alta__panel alta__panel--anim fin">
          <div class="fin__sello">
            <rs-icon name="check" [size]="34" [stroke]="2.5" />
          </div>
          <h1 class="alta__titulo">{{ tituloFin() }}</h1>
          <p class="alta__sub">{{ textoFin() }}</p>

          <div class="alta__pie">
            <a routerLink="/comercio" class="rs-btn rs-btn--primary rs-btn--lg rs-btn--block">
              Ir a mi panel
              <rs-icon name="arrow-right" [size]="16" [stroke]="2.5" />
            </a>
            <a routerLink="/comercio/listados" class="rs-btn rs-btn--outline rs-btn--block">
              Ver mis servicios
            </a>
          </div>
        </section>
      }

      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .alta {
      max-width: 860px; margin: 0 auto; width: 100%;
      padding: var(--sp-8) var(--sp-5) var(--sp-16);
      display: flex; flex-direction: column; gap: var(--sp-6);
    }
    .alta__cargando { display: flex; justify-content: center; padding: var(--sp-16); }

    .alta__salir {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-400); text-decoration: none;
      transition: color var(--d-2);
      &:hover { color: var(--dk-blue); }
    }

    .alta__eyebrow {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .08em; text-transform: uppercase; color: var(--t-400);
      margin: var(--sp-5) 0 var(--sp-2);
    }
    .alta__barra { height: 4px; border-radius: var(--r-full); background: var(--b-1); overflow: hidden; }
    .alta__barra-fill {
      display: block; height: 100%; border-radius: var(--r-full);
      background: var(--g-accent); transition: width var(--d-3) ease;
    }

    .alta__panel { display: flex; flex-direction: column; gap: var(--sp-4); }

    /* Cada paso entra desde abajo: el recorrido se lee como un avance. */
    .alta__panel--anim { animation: entrar var(--d-3) ease both; }
    @keyframes entrar {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: none; }
    }

    .alta__titulo {
      font-family: var(--font-display); font-size: var(--f-2xl); font-weight: var(--w-8);
      color: var(--t-100); line-height: 1.2;
    }
    .alta__sub { font-size: var(--f-base); color: var(--t-400); max-width: 62ch; line-height: 1.6; }

    .alta__pie { display: flex; flex-direction: column; gap: var(--sp-3); margin-top: var(--sp-2); }
    .alta__pie--fila { align-items: stretch; }

    /*
     * Dos acciones en la misma línea: «Volver» ocupa lo justo a la izquierda y
     * «Continuar» el resto, que es la que se espera pulsar. En móvil se apilan
     * con la principal arriba —de ahí el column-reverse—, para no obligar a
     * bajar hasta el final de la pantalla a por ella.
     */
    .alta__pie--dos, .alta__acciones {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: var(--sp-3);

      .alta__volver { flex: 0 0 auto; }
      .rs-btn--block { flex: 1; }

      @media (max-width: 560px) {
        flex-direction: column-reverse;
        .alta__volver { width: 100%; }
      }
    }
    .alta__nota { font-size: var(--f-sm); color: var(--t-400); text-align: center; line-height: 1.6; }

    /* ── Rejilla de categorías ───────────────────────────────────────── */
    .cats {
      display: grid; gap: var(--sp-3);
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      margin-top: var(--sp-2);
    }

    .cat {
      display: flex; align-items: center; gap: var(--sp-4); text-align: left;
      padding: var(--sp-4) var(--sp-5);
      border: 1.5px solid var(--b-1); border-radius: var(--r-xl);
      background: var(--c-card); cursor: pointer;
      transition: border-color var(--d-2), box-shadow var(--d-2), transform var(--d-2);
      animation: entrar var(--d-3) ease both;

      &:hover { border-color: var(--dk-blue); transform: translateY(-2px); box-shadow: var(--sh-2); }
      &:focus-visible { outline: 2px solid var(--dk-blue); outline-offset: 2px; }
    }
    .cat--sel {
      border-color: var(--dk-blue); background: var(--c-accent-lo);
      box-shadow: var(--sh-2);
    }

    .cat__ico {
      display: grid; place-items: center; flex-shrink: 0;
      width: 52px; height: 52px; border-radius: var(--r-lg);
      background: var(--c-raised); color: var(--dk-blue);
      transition: background var(--d-2), color var(--d-2);
    }
    .cat--sel .cat__ico { background: var(--dk-blue); color: #fff; }

    .cat__cuerpo { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .cat__label { font-size: var(--f-base); font-weight: var(--w-7); color: var(--t-100); }
    .cat__claim { font-size: var(--f-sm); color: var(--t-400); line-height: 1.45; }

    .cat__marca {
      display: grid; place-items: center; flex-shrink: 0;
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--dk-blue); color: #fff;
      opacity: 0; transform: scale(.6);
      transition: opacity var(--d-2), transform var(--d-2);
    }
    .cat--sel .cat__marca { opacity: 1; transform: none; }

    /* ── Formulario del negocio ──────────────────────────────────────── */
    .alta__form { display: flex; flex-direction: column; gap: var(--sp-5); }

    .bloque {
      display: flex; flex-direction: column; gap: var(--sp-4);
      padding: var(--sp-5); border: 1px solid var(--b-1);
      border-radius: var(--r-xl); background: var(--c-card);
    }
    .bloque__tit {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .06em; text-transform: uppercase; color: var(--t-400);
      padding: 0 var(--sp-2);
    }

    .fila { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }
    @media (max-width: 640px) { .fila { grid-template-columns: 1fr; } }

    .opt { font-weight: var(--w-4); color: var(--t-400); font-size: var(--f-xs); }

    .acuerdo {
      display: flex; align-items: flex-start; gap: var(--sp-3);
      padding: var(--sp-4); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      font-size: var(--f-sm); color: var(--t-300); line-height: 1.6; cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);

      input { margin-top: 3px; flex-shrink: 0; }
      a { color: var(--dk-blue); font-weight: var(--w-6); }
    }
    .acuerdo--on { border-color: var(--dk-blue); background: var(--c-accent-lo); }

    /* ── Servicio creado: la bifurcación ─────────────────────────────── */
    .creado { align-items: center; text-align: center; }
    .creado__sello {
      display: grid; place-items: center;
      width: 64px; height: 64px; border-radius: 50%;
      background: var(--dk-gold); color: var(--dk-blue-deep);
      animation: sello var(--d-3) cubic-bezier(.34, 1.56, .64, 1) both;
    }
    .creado__opciones {
      display: flex; flex-direction: column; gap: var(--sp-3);
      width: 100%; margin-top: var(--sp-3);
    }

    .opcion {
      display: flex; align-items: center; gap: var(--sp-4); text-align: left;
      padding: var(--sp-4) var(--sp-5);
      border: 1.5px solid var(--b-1); border-radius: var(--r-xl);
      background: var(--c-card); cursor: pointer;
      transition: border-color var(--d-2), box-shadow var(--d-2), transform var(--d-2);

      &:hover { border-color: var(--dk-blue); transform: translateY(-2px); box-shadow: var(--sh-2); }
      &:focus-visible { outline: 2px solid var(--dk-blue); outline-offset: 2px; }
    }
    /* La salida por defecto va marcada: la mayoría publica un servicio y sigue. */
    .opcion--principal { border-color: var(--dk-blue); background: var(--c-accent-lo); }

    .opcion__ico {
      display: grid; place-items: center; flex-shrink: 0;
      width: 46px; height: 46px; border-radius: var(--r-lg);
      background: var(--c-raised); color: var(--dk-blue);
    }
    .opcion--principal .opcion__ico { background: var(--dk-blue); color: #fff; }

    .opcion__cuerpo { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .opcion__titulo { font-size: var(--f-base); font-weight: var(--w-7); color: var(--t-100); }
    .opcion__texto { font-size: var(--f-sm); color: var(--t-400); line-height: 1.45; }
    .opcion__flecha { flex-shrink: 0; color: var(--t-400); }

    /* ── Cierre ──────────────────────────────────────────────────────── */
    .fin { align-items: center; text-align: center; }
    .fin__sello {
      display: grid; place-items: center;
      width: 84px; height: 84px; border-radius: 50%;
      background: var(--dk-gold); color: var(--dk-blue-deep);
      animation: sello var(--d-3) cubic-bezier(.34, 1.56, .64, 1) both;
    }
    @keyframes sello {
      from { opacity: 0; transform: scale(.5); }
      to   { opacity: 1; transform: none; }
    }
    .fin .alta__pie { width: 100%; max-width: 340px; }

    @media (prefers-reduced-motion: reduce) {
      .alta__panel--anim, .cat, .fin__sello, .creado__sello { animation: none; }
      .cat:hover, .opcion:hover { transform: none; }
    }
  `],
})
export class ComercioAltaComponent implements OnInit {
  private readonly api = inject(ComercioApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly pasos = PASOS;
  readonly paso = signal<PasoAlta>('elegir');

  /**
   * Servicios dados de alta en este recorrido, contando los que ya tuviera.
   *
   * Un negocio con varias categorías —o con dos locales de la misma— tiene que
   * poder publicarlas de una sentada: obligarle a terminar el alta y volver a
   * entrar por el panel para el segundo es perder justo el impulso con el que
   * ha llegado.
   */
  readonly serviciosCreados = signal(0);

  /**
   * Remonta el formulario del servicio desde cero.
   *
   * Es un `@if` sobre el mismo componente: cambiar sólo la categoría dejaría
   * dentro las fotos, el horario y la dirección del anterior, y el comercio
   * acabaría publicando dos fichas casi idénticas sin darse cuenta.
   */
  anadirOtroServicio(): void {
    const opciones = this.opciones();
    if (opciones.length > 1) {
      this.elegido.set(null);
      this.irA('elegir');
      return;
    }
    // Con una sola categoría no hay nada que volver a preguntar.
    this.elegido.set(opciones[0]?.key ?? null);
    this.irA('servicio');
  }

  /** El formulario avisa de que el servicio ya está guardado. */
  servicioCreado(): void {
    this.serviciosCreados.update((n) => n + 1);
    this.irA('creado');
  }

  /**
   * Dónde iba el alta, guardado en el dispositivo.
   *
   * El formulario del servicio ya conserva sus campos al recargar, pero sin
   * esto el asistente volvía al primer paso y el trabajo restaurado quedaba
   * detrás de una pantalla que ya se había pasado.
   */
  private claveRecorrido(): string {
    return 'dk_alta_recorrido';
  }

  /** Cambia de paso dejando constancia, para poder retomarlo tras recargar. */
  irA(paso: PasoAlta): void {
    this.paso.set(paso);
    try {
      localStorage.setItem(this.claveRecorrido(), JSON.stringify({ paso, elegido: this.elegido() }));
    } catch { /* el recorrido es una comodidad; sin storage se sigue igual */ }
  }

  private olvidarRecorrido(): void {
    try {
      localStorage.removeItem(this.claveRecorrido());
    } catch { /* nada que olvidar sin storage */ }
  }

  /** @returns `true` si se retomó el recorrido guardado. */
  private retomarRecorrido(): boolean {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem(this.claveRecorrido());
    } catch { return false; }
    if (!guardado) return false;

    try {
      const { paso, elegido } = JSON.parse(guardado) as { paso: PasoAlta; elegido: string | null };
      // Sólo se retoma el paso de la ficha: los demás se deducen del estado real
      // del negocio, que es más fiable que lo que quedó escrito aquí.
      if (paso !== 'servicio' || !elegido) return false;

      this.elegido.set(elegido);
      this.paso.set('servicio');
      return true;
    } catch {
      this.olvidarRecorrido();
      return false;
    }
  }
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');

  private readonly comercio = signal<MiComercio | null>(null);
  readonly elegido = signal<string | null>(null);

  /** Si el alta se aparcó, el cierre lo dice en vez de felicitar por algo a medias. */
  private readonly aparcada = signal(false);

  /**
   * Sólo las categorías que el comercio marcó al registrarse: ofrecerle aquí
   * las siete sería contradecir lo que acaba de elegir dos pantallas antes.
   */
  readonly opciones = computed(() =>
    (this.comercio()?.verticales ?? []).map((key) => verticalUi(key)));

  readonly indicePaso = computed(() => {
    // «Creado» es el remate del paso del servicio, no un paso más: sin esto la
    // barra retrocedía a «Paso 1 de 3» justo después de publicar algo.
    const clave = this.paso() === 'creado' ? 'servicio' : this.paso();
    return Math.max(0, PASOS.findIndex((p) => p.clave === clave));
  });

  readonly progreso = computed(() => ((this.indicePaso() + 1) / PASOS.length) * 100);

  /**
   * El alta rápida deja un nombre provisional («Negocio de Ana») porque el
   * documento no puede quedarse sin él. Se presenta como campo vacío para que
   * el comercio escriba el suyo, no para que dé por bueno el de relleno.
   */
  private esProvisional(c: MiComercio): boolean {
    return c.nombreComercial.startsWith('Negocio de ');
  }

  /** Ejemplo acorde a la categoría que acaba de dar de alta. */
  placeholderNombre(): string {
    const key = this.elegido();
    return key ? `Ej. ${verticalUi(key).labelCorto} Vila-Can` : 'Ej. Royal Dog Resort';
  }

  etiquetaElegido(): string {
    const key = this.elegido();
    return key ? verticalUi(key).labelCorto : 'servicio';
  }

  tituloFin(): string {
    return this.aparcada() ? 'Guardado. Te esperamos cuando puedas' : '¡Tu negocio ya está en Doogking!';
  }

  textoFin(): string {
    return this.aparcada()
      ? 'Tu servicio está guardado como borrador. Cuando tengas los datos de tu negocio, retoma el alta desde tu panel y se publica solo.'
      : this.serviciosCreados() === 1
        ? 'Tu servicio ya está publicado. Aparecerá en el buscador en cuanto revisemos tu negocio, y mientras tanto puedes añadir más desde tu panel.'
        : 'Tus servicios ya están publicados. Aparecerán en el buscador en cuanto revisemos tu negocio, y mientras tanto puedes añadir más desde tu panel.';
  }

  readonly negocioForm = this.fb.group({
    nombreComercial: ['', [Validators.required, Validators.minLength(2)]],
    razonSocial: [''],
    vatNumber: [''],
    descripcion: [''],
    nombreContacto: [''],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    whatsapp: [''],
    operaLegalmente: [false],
    condicionesGenerales: [false],
  });

  /** Se enseña sólo tras intentar terminar: avisar antes de tiempo regaña de balde. */
  private readonly intentado = signal(false);

  readonly faltanAcuerdos = computed(() => {
    if (!this.intentado()) return false;
    const { operaLegalmente, condicionesGenerales } = this.negocioForm.getRawValue();
    return !operaLegalmente || !condicionesGenerales;
  });

  invalido(control: string): boolean {
    const c = this.negocioForm.get(control);
    return !!c && c.invalid && c.touched;
  }

  elegir(key: VerticalKey): void {
    this.elegido.set(key);
  }

  /** Seguros no rellena la ficha de listado: entrega una solicitud de alta. */
  readonly esSeguros = computed(() => this.elegido() === VerticalKey.SEGUROS);

  /** Pasa a la ficha del servicio con la categoría ya elegida. */
  irAlServicio(): void {
    this.irA('servicio');
  }

  async ngOnInit(): Promise<void> {
    try {
      const [comercio, servicios] = await Promise.all([
        firstValueFrom(this.api.getMiComercio()),
        firstValueFrom(this.api.getMisServicios()),
      ]);
      this.comercio.set(comercio);
      this.precargar(comercio);

      this.serviciosCreados.set(servicios.length);

      // Una recarga a media ficha vuelve a la ficha, no al principio: el
      // formulario ya ha restaurado sus campos y el asistente le sigue.
      if (this.retomarRecorrido()) return;

      // Quien vuelve a retomar el alta ya tiene su servicio creado: repetir la
      // ficha le crearía un duplicado. Se le lleva a lo que le falta, con la
      // puerta abierta a añadir otro desde ahí.
      if (servicios.length) { this.paso.set('creado'); return; }

      // El recorrido siempre empieza por la bienvenida («Da de alta tu
      // servicio…»): es la primera pantalla tras activar la cuenta y la que
      // explica qué se va a hacer. Con una sola categoría no hay nada que
      // elegir, así que se deja marcada y sólo queda pulsar «Continuar».
      const verticales = comercio.verticales ?? [];
      if (verticales.length === 1) this.elegido.set(verticales[0]);
    } catch {
      this.error.set('No pudimos cargar tu negocio. Vuelve a intentarlo.');
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Vuelve al resumen de servicios, que es de donde se llega a este paso. Si
   * todavía no hay ninguno creado, al principio del recorrido.
   */
  volverDesdeNegocio(): void {
    this.irA(this.serviciosCreados() > 0 ? 'creado' : 'elegir');
  }

  async finalizar(): Promise<void> {
    this.intentado.set(true);
    const v = this.negocioForm.getRawValue();

    if (this.negocioForm.invalid) { this.negocioForm.markAllAsTouched(); return; }
    if (!v.operaLegalmente || !v.condicionesGenerales) return;

    await this.guardar({ altaCompletada: true });
  }

  /**
   * Aparca el alta guardando lo que ya esté puesto. No exige nada —el sentido
   * del botón es justo no tener que rellenar todavía— pero tampoco tira lo
   * escrito, que sería castigar al que empezó de buena fe.
   */
  async continuarMasTarde(): Promise<void> {
    this.aparcada.set(true);
    await this.guardar({ altaCompletada: false });
  }

  private async guardar(cierre: { altaCompletada: boolean }): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    const v = this.negocioForm.getRawValue();

    try {
      await firstValueFrom(this.api.actualizarComercio({
        // Vacíos como `undefined`: mandar '' borraría un dato ya guardado y el
        // CIF además chocaría con el índice único.
        nombreComercial: v.nombreComercial.trim() || undefined,
        razonSocial: v.razonSocial.trim() || undefined,
        vatNumber: v.vatNumber.trim().toUpperCase() || undefined,
        descripcion: v.descripcion.trim() || undefined,
        contacto: {
          nombreContacto: v.nombreContacto || undefined,
          email: v.email || undefined,
          telefono: v.telefono || undefined,
          whatsapp: v.whatsapp || undefined,
        },
        consentimientos: {
          operaLegalmente: v.operaLegalmente,
          condicionesGenerales: v.condicionesGenerales,
        },
        ...cierre,
      }));
      this.olvidarRecorrido();
      this.paso.set('fin');
    } catch {
      this.error.set('No pudimos guardar tus datos. Inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }

  /** Lo que ya se sabe del negocio no se vuelve a pedir. */
  private precargar(c: MiComercio): void {
    this.negocioForm.patchValue({
      nombreComercial: this.esProvisional(c) ? '' : c.nombreComercial,
      razonSocial: c.razonSocial ?? '',
      vatNumber: c.vatNumber ?? '',
      descripcion: c.descripcion ?? '',
      nombreContacto: c.contacto?.nombreContacto ?? '',
      email: c.contacto?.email ?? '',
      telefono: c.contacto?.telefono ?? '',
      whatsapp: c.contacto?.whatsapp ?? '',
      operaLegalmente: c.consentimientos?.operaLegalmente?.aceptado ?? false,
      condicionesGenerales: c.consentimientos?.condicionesGenerales?.aceptado ?? false,
    });
  }
}
