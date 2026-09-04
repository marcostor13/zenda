import { Component, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MAX_ASEGURADORAS, VerticalKey } from 'shared';
import { environment } from '../../../environments/environment';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ComercioApiService } from './comercio-api.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/** Documento ya subido, listo para viajar con la solicitud. */
interface DocumentoSubido {
  nombre: string;
  url: string;
}

/**
 * Alta de una aseguradora.
 *
 * No es el formulario de listado del resto de categorías, y es deliberado: una
 * compañía de seguros no publica una ficha con fotos, dirección y precio por
 * noche. Entrega **una solicitud** —quién la representa, qué compañía es y las
 * condiciones de sus pólizas en PDF— y Doogking la revisa a mano antes de dejar
 * que aparezca en el catálogo. Las coberturas, primas y límites se configuran
 * cuando el equipo la aprueba, con la documentación delante.
 *
 * Encaja en el mismo recorrido de `/comercio/alta` que los demás verticales:
 * emite `creado` al enviar, que es lo que el asistente espera para seguir.
 */
@Component({
  selector: 'app-comercio-solicitud-seguros',
  standalone: true,
  imports: [
    TraducirPipe, ReactiveFormsModule, RsIconComponent
  ],
  template: `
    <div class="sol">
      @if (enviada()) {
        <!-- Confirmación: lo único que el solicitante necesita saber es que ya
             está en nuestras manos y qué pasa a continuación. -->
        <div class="sol__ok">
          <div class="sol__sello"><rs-icon name="check" [size]="28" [stroke]="2.5" /></div>
          <h2 class="sol__ok-tit">{{ 'Hemos recibido tu solicitud' | t }}</h2>
          <p class="sol__ok-txt">
            Nuestro equipo va a revisar la documentación de {{ nombreCompania() }} y se pondrá en
            contacto contigo en el correo y el teléfono que nos has dejado. No tienes que hacer
            nada más por ahora.
          </p>
          <p class="sol__ok-txt sol__ok-txt--sec">
            {{ 'Mientras tanto, tu ficha queda guardada y sin publicar: nadie puede contratar tus pólizas hasta que el alta esté aprobada.' | t }}
          </p>
          @if (mostrarVolver()) {
            <!-- En el alta guiada, seguir al último paso lo decide quien lo lee:
                 saltar solo se llevaría por delante este mensaje. -->
            <button type="button" class="rs-btn rs-btn--primary rs-btn--lg" (click)="creado.emit()">
              {{ 'Continuar' | t }}
              <rs-icon name="arrow-right" [size]="16" [stroke]="2.5" />
            </button>
          } @else {
            <button type="button" class="rs-btn rs-btn--primary rs-btn--lg" (click)="irAlPanel()">
              {{ 'Ir a mi panel' | t }}
              <rs-icon name="arrow-right" [size]="16" [stroke]="2.5" />
            </button>
          }
        </div>
      } @else {
        <div class="sol__aviso">
          <rs-icon name="crown" [size]="18" [stroke]="2" />
          <div>
            <strong>Trabajamos con {{ maximo }} aseguradoras como máximo.</strong>
            {{ 'Preferimos pocas compañías y revisarlas de verdad, para poder acompañar cada póliza que se contrata aquí. Si ahora mismo las plazas están cubiertas, guardamos tu solicitud y te avisamos en cuanto quede una libre.' | t }}
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="enviar()" novalidate>
          <h2 class="sol__tit">{{ 'Tus datos de contacto' | t }}</h2>
          <p class="sol__ayuda">{{ 'Con quién hablamos para revisar el alta.' | t }}</p>

          <div class="sol__fila">
            <div class="rs-field">
              <label class="rs-lbl">{{ 'Nombre y apellidos *' | t }}</label>
              <input class="rs-inp" formControlName="contactoNombre" [placeholder]="'Nombre de la persona de contacto' | t"
                     [class.rs-inp--error]="malo('contactoNombre')">
              @if (malo('contactoNombre')) { <span class="rs-field-err">{{ 'Indica un nombre de contacto.' | t }}</span> }
            </div>
            <div class="rs-field">
              <label class="rs-lbl">{{ 'Cargo' | t }}</label>
              <input class="rs-inp" formControlName="contactoCargo" [placeholder]="'Ej. Responsable de alianzas' | t">
            </div>
          </div>

          <div class="sol__fila">
            <div class="rs-field">
              <label class="rs-lbl">{{ 'Correo electrónico *' | t }}</label>
              <input class="rs-inp" type="email" formControlName="contactoEmail" placeholder="nombre@aseguradora.com"
                     [class.rs-inp--error]="malo('contactoEmail')" inputmode="email">
              @if (malo('contactoEmail')) { <span class="rs-field-err">{{ 'Indica un correo válido.' | t }}</span> }
            </div>
            <div class="rs-field">
              <label class="rs-lbl">{{ 'Teléfono *' | t }}</label>
              <input class="rs-inp" formControlName="contactoTelefono" placeholder="+34 600 000 000"
                     [class.rs-inp--error]="malo('contactoTelefono')">
              @if (malo('contactoTelefono')) { <span class="rs-field-err">{{ 'Indica un teléfono.' | t }}</span> }
            </div>
          </div>

          <h2 class="sol__tit">{{ 'La aseguradora' | t }}</h2>
          <div class="sol__fila">
            <div class="rs-field">
              <label class="rs-lbl">{{ 'Razón social *' | t }}</label>
              <input class="rs-inp" formControlName="razonSocial" [placeholder]="'Ej. Seguros Doogking, S.A.' | t"
                     [class.rs-inp--error]="malo('razonSocial')">
              @if (malo('razonSocial')) { <span class="rs-field-err">{{ 'Indica la razón social.' | t }}</span> }
            </div>
            <div class="rs-field">
              <label class="rs-lbl">{{ 'NIF / CIF *' | t }}</label>
              <input class="rs-inp" formControlName="nifCif" [placeholder]="'A00000000' | t"
                     [class.rs-inp--error]="malo('nifCif')">
              @if (malo('nifCif')) { <span class="rs-field-err">{{ 'Indica el NIF o CIF.' | t }}</span> }
            </div>
          </div>

          <div class="sol__fila">
            <div class="rs-field">
              <label class="rs-lbl">{{ 'Clave de registro (DGSFP)' | t }}</label>
              <input class="rs-inp" formControlName="registroDgs" [placeholder]="'Ej. C0000' | t">
              <span class="rs-field-hint">{{ 'Nos permite comprobar que la compañía está autorizada.' | t }}</span>
            </div>
            <div class="rs-field">
              <label class="rs-lbl">{{ 'Web' | t }}</label>
              <input class="rs-inp" formControlName="web" placeholder="https://…">
            </div>
          </div>

          <div class="rs-field">
            <label class="rs-lbl">{{ 'Ámbito de actuación' | t }}</label>
            <input class="rs-inp" formControlName="ambito" [placeholder]="'Ej. Toda España, o comunidades concretas' | t">
          </div>

          <h2 class="sol__tit">{{ 'Documentación de tus pólizas' | t }}</h2>
          <p class="sol__ayuda">
            {{ 'Sube las condiciones generales de cada póliza que quieras ofrecer, y cualquier documento que acredite a la compañía. PDF o imagen, hasta 10 MB por archivo.' | t }}
          </p>

          <div class="docs">
            <input #ficheros type="file" multiple hidden
                   accept="application/pdf,image/jpeg,image/png,image/webp"
                   (change)="subir($event)" />

            <button type="button" class="rs-btn rs-btn--outline" [disabled]="subiendo()"
                    (click)="ficheros.click()">
              @if (subiendo()) { <span class="rs-spin"></span> }
              <rs-icon name="upload" [size]="16" [stroke]="2" />
              {{ subiendo() ? 'Subiendo…' : 'Añadir documentos' }}
            </button>

            @if (documentos().length) {
              <ul class="docs__lista">
                @for (d of documentos(); track d.url) {
                  <li class="docs__item">
                    <rs-icon name="file-text" [size]="15" [stroke]="2" />
                    <a [href]="d.url" target="_blank" rel="noopener">{{ d.nombre }}</a>
                    <button type="button" class="docs__x" (click)="quitar(d.url)"
                            [attr.aria-label]="'Quitar ' + d.nombre">
                      <rs-icon name="x" [size]="14" [stroke]="2.5" />
                    </button>
                  </li>
                }
              </ul>
            } @else {
              <p class="rs-field-hint">{{ 'Todavía no has subido ningún documento.' | t }}</p>
            }
            @if (errorDocs()) { <p class="rs-field-err">{{ errorDocs() }}</p> }
          </div>

          <div class="rs-field">
            <label class="rs-lbl">{{ '¿Algo que debamos saber?' | t }}</label>
            <textarea class="rs-inp" rows="3" formControlName="notas"
                      [placeholder]="'Coberturas que te interesa ofrecer, plazos, condiciones especiales…' | t"></textarea>
          </div>

          @if (error()) { <div class="rs-alert rs-alert--error" role="alert">{{ error() }}</div> }

          <div class="sol__pie">
            @if (mostrarVolver()) {
              <button type="button" class="rs-btn rs-btn--outline rs-btn--lg sol__volver"
                      [disabled]="enviando()" (click)="volverAtras.emit()">
                <rs-icon name="arrow-left" [size]="16" [stroke]="2.5" />
                {{ 'Volver' | t }}
              </button>
            }
            <button type="submit" class="rs-btn rs-btn--primary rs-btn--lg rs-btn--block"
                    [disabled]="enviando()">
              @if (enviando()) { <span class="rs-spin"></span> }
              {{ enviando() ? 'Enviando…' : 'Enviar solicitud' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: [`
    .sol { display: flex; flex-direction: column; gap: var(--sp-5); }

    /* El aviso del cupo es lo primero que se lee: explica por qué somos pocos,
       en vez de dar una negativa seca cuando no hay plaza. */
    .sol__aviso {
      display: flex; gap: var(--sp-3); align-items: flex-start;
      padding: var(--sp-4);
      background: var(--c-accent-lo);
      border: 1px solid rgba(8,37,139,.18);
      border-left: 3px solid var(--dk-gold);
      border-radius: var(--r-lg);
      font-size: var(--f-sm); line-height: 1.6; color: var(--t-200);

      rs-icon { color: var(--dk-gold); flex-shrink: 0; margin-top: 2px; }
      strong { display: block; color: var(--dk-blue); }
    }

    .sol__tit {
      font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100);
      padding-top: var(--sp-3); margin-top: var(--sp-4);
      border-top: 1px solid var(--b-1);
      &:first-of-type { padding-top: 0; margin-top: 0; border-top: none; }
    }
    .sol__ayuda { font-size: var(--f-sm); color: var(--t-400); margin-top: var(--sp-1); }

    form { display: flex; flex-direction: column; gap: var(--sp-4); }
    .sol__fila {
      display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4);
      @media (max-width: 640px) { grid-template-columns: 1fr; }
    }

    .docs { display: flex; flex-direction: column; gap: var(--sp-3); align-items: flex-start; }
    .docs__lista { display: flex; flex-direction: column; gap: var(--sp-2); width: 100%; list-style: none; padding: 0; }
    .docs__item {
      display: flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-md);
      font-size: var(--f-sm);

      a { color: var(--dk-blue); text-decoration: none; flex: 1; word-break: break-word; }
      a:hover { text-decoration: underline; }
    }
    .docs__x {
      border: none; background: transparent; color: var(--t-400); cursor: pointer;
      display: inline-flex; align-items: center;
      &:hover { color: #B91C1C; }
    }

    /* Misma fila de acciones que el resto del alta: volver a la izquierda. */
    .sol__pie {
      display: flex; align-items: center; gap: var(--sp-3); margin-top: var(--sp-2);
      .sol__volver { flex: 0 0 auto; }
      .rs-btn--block { flex: 1; }
      @media (max-width: 560px) {
        flex-direction: column-reverse;
        .sol__volver { width: 100%; }
      }
    }

    .sol__ok { text-align: center; padding-block: var(--sp-6); }
    .sol__sello {
      width: 64px; height: 64px; margin: 0 auto var(--sp-4);
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; background: var(--c-accent-lo); color: var(--dk-blue);
    }
    .sol__ok-tit { font-family: var(--font-display); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); }
    .sol__ok-txt {
      max-width: 52ch; margin: var(--sp-3) auto 0;
      font-size: var(--f-sm); line-height: 1.6; color: var(--t-300);
    }
    .sol__ok-txt--sec { color: var(--t-400); }
    .sol__ok .rs-btn { margin-top: var(--sp-5); }
  `],
})
export class ComercioSolicitudSegurosComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly comercioApi = inject(ComercioApiService);

  /** En el alta guiada hay un paso anterior al que volver; suelto, no. */
  readonly mostrarVolver = input(false);
  readonly volverAtras = output<void>();
  readonly creado = output<void>();

  readonly maximo = MAX_ASEGURADORAS;

  readonly documentos = signal<DocumentoSubido[]>([]);
  readonly subiendo = signal(false);
  readonly enviando = signal(false);
  readonly enviada = signal(false);
  readonly error = signal('');
  readonly errorDocs = signal('');

  readonly form = this.fb.group({
    contactoNombre: ['', Validators.required],
    contactoCargo: [''],
    contactoEmail: ['', [Validators.required, Validators.email]],
    contactoTelefono: ['', Validators.required],
    razonSocial: ['', Validators.required],
    nifCif: ['', Validators.required],
    registroDgs: [''],
    web: [''],
    ambito: [''],
    notas: [''],
  });

  nombreCompania(): string {
    return this.form.controls.razonSocial.value.trim() || 'tu compañía';
  }

  malo(campo: string): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  async subir(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const ficheros = Array.from(input.files ?? []);
    if (!ficheros.length) return;

    this.errorDocs.set('');
    this.subiendo.set(true);
    try {
      for (const fichero of ficheros) {
        const datos = new FormData();
        datos.append('file', fichero);
        const { url } = await firstValueFrom(
          this.http.post<{ url: string }>(`${environment.apiUrl}/upload/documento`, datos),
        );
        this.documentos.update((lista) => [...lista, { nombre: fichero.name, url }]);
      }
    } catch {
      this.errorDocs.set('No pudimos subir alguno de los documentos. Revisa el formato (PDF o imagen) y el tamaño.');
    } finally {
      this.subiendo.set(false);
      // Sin esto, volver a elegir el mismo archivo no dispara el evento.
      input.value = '';
    }
  }

  quitar(url: string): void {
    this.documentos.update((lista) => lista.filter((d) => d.url !== url));
  }

  async enviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.documentos().length) {
      this.errorDocs.set('Sube al menos un documento con las condiciones de tus pólizas.');
      return;
    }

    const v = this.form.getRawValue();
    this.error.set('');
    this.enviando.set(true);
    try {
      /*
       * La solicitud se guarda como una ficha del vertical en borrador: así
       * hereda el ciclo de vida que ya existe (el admin la aprueba y se
       * publica) sin inventar una colección nueva. Lo que la distingue es que
       * el comercio no ha podido poner precios ni coberturas: eso se configura
       * al aprobarla.
       */
      await firstValueFrom(this.comercioApi.crearServicio({
        vertical: VerticalKey.SEGUROS,
        titulo: v.razonSocial,
        descripcion: `Solicitud de alta de ${v.razonSocial}. Pendiente de revisión por Doogking.`,
        ciudad: v.ambito || 'España',
        precioBase: 0,
        imagenes: [],
        extra: {
          solicitud: {
            contacto: {
              nombre: v.contactoNombre,
              cargo: v.contactoCargo || undefined,
              email: v.contactoEmail,
              telefono: v.contactoTelefono,
            },
            aseguradora: {
              razonSocial: v.razonSocial,
              nifCif: v.nifCif,
              registroDgs: v.registroDgs || undefined,
              web: v.web || undefined,
              ambito: v.ambito || undefined,
            },
            documentos: this.documentos(),
            notas: v.notas || undefined,
            enviadaEn: new Date().toISOString(),
          },
          estadoSolicitud: 'pendiente',
        },
      }));

      this.enviada.set(true);
    } catch {
      this.error.set('No pudimos enviar la solicitud. Vuelve a intentarlo en un momento.');
    } finally {
      this.enviando.set(false);
    }
  }

  irAlPanel(): void {
    void this.router.navigate(['/comercio']);
  }
}
