import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { AuthService } from '../../core/auth/auth.service';
import { ReservasService, ReservaApi } from '../reservas/services/reservas.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

interface Pregunta {
  readonly icon: string;
  readonly p: string;
  readonly r: string;
  readonly categoria: string;
}

interface CategoriaUi {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
}

interface Incidencia {
  readonly icon: string;
  readonly label: string;
  readonly asunto: string;
}

type Publico = 'cliente' | 'comercio';

const CATEGORIAS: Record<Publico, readonly CategoriaUi[]> = {
  cliente: [
    { key: 'mascota', label: 'Mi mascota', icon: 'paw' },
    { key: 'reservas', label: 'Reservas', icon: 'calendar' },
    { key: 'pagos', label: 'Pagos', icon: 'credit-card' },
    { key: 'cuenta', label: 'Cuenta y seguridad', icon: 'lock' },
  ],
  comercio: [
    { key: 'empezar', label: 'Empezar en Doogking', icon: 'building' },
    { key: 'reservas', label: 'Reservas', icon: 'calendar' },
    { key: 'cobros', label: 'Cobros', icon: 'credit-card' },
    { key: 'configuracion', label: 'Configuración', icon: 'settings' },
    { key: 'valoraciones', label: 'Valoraciones', icon: 'star' },
    { key: 'cuenta', label: 'Cuenta', icon: 'lock' },
  ],
};

const FAQ: Record<Publico, readonly Pregunta[]> = {
  cliente: [
    {
      icon: 'credit-card',
      categoria: 'pagos',
      p: '¿Cuándo se me cobra la reserva?',
      r: 'Al confirmar. El importe queda retenido hasta que el servicio se presta, así que si algo sale mal el dinero sigue protegido.',
    },
    {
      icon: 'alert-circle',
      categoria: 'pagos',
      p: 'El profesional pide un suplemento. ¿Me lo pueden cobrar sin avisar?',
      r: 'No. Ningún importe adicional se cobra sin tu aprobación: recibirás un correo con el precio inicial, el nuevo precio y el motivo, y decides tú. Si lo rechazas se te reembolsa reteniendo solo un cargo mínimo de gestión.',
    },
    {
      icon: 'x-circle',
      categoria: 'reservas',
      p: '¿Puedo cancelar?',
      r: 'Sí, según la política de cancelación de cada comercio, que aparece siempre antes de pagar y en el detalle de tu reserva.',
    },
    {
      icon: 'paw',
      categoria: 'mascota',
      p: '¿Para qué sirve registrar la ficha de mi perro?',
      r: 'Para no repetir sus datos en cada reserva, ver solo servicios compatibles con él y recibir un precio ajustado a su perfil en lugar de una estimación genérica.',
    },
    {
      icon: 'lock',
      categoria: 'cuenta',
      p: '¿Quién ve el historial de mi mascota?',
      r: 'Solo tú decides qué comparte cada tipo de servicio. Por defecto, lo que registra un profesional no sale de su propia categoría.',
    },
    {
      icon: 'globe',
      categoria: 'pagos',
      p: 'Veo los precios en otra moneda. ¿En qué se me cobra?',
      r: 'Siempre en euros. La conversión que ves es orientativa, para ayudarte a hacerte una idea.',
    },
  ],
  comercio: [
    {
      icon: 'credit-card',
      categoria: 'cobros',
      p: '¿Cuánto cobra Doogking por reserva?',
      r: 'Una comisión sobre el importe de la reserva, distinta según la categoría. La ves desglosada en cada liquidación, junto con los costes de la pasarela de pago.',
    },
    {
      icon: 'credit-card',
      categoria: 'cobros',
      p: '¿Cuándo recibo el dinero?',
      r: 'Tras prestarse el servicio, en la liquidación correspondiente: importe total menos comisión de plataforma y comisión de la pasarela.',
    },
    {
      icon: 'settings',
      categoria: 'configuracion',
      p: '¿Cómo evito recibir reservas que no puedo atender?',
      r: 'Manteniendo tu disponibilidad al día y configurando el apartado "apto para" de cada servicio. Los servicios sin plazas libres dejan de aparecer en el buscador.',
    },
    {
      icon: 'calendar',
      categoria: 'reservas',
      p: 'He detectado algo en recepción que cambia el precio. ¿Qué hago?',
      r: 'Solicita un ajuste desde la reserva, con los suplementos que tengas configurados y una foto del estado del animal. El cliente lo aprueba o lo rechaza; nunca se cobra sin su visto bueno.',
    },
    {
      icon: 'building',
      categoria: 'empezar',
      p: '¿Cómo doy de alta mi empresa?',
      r: 'Desde "Registra tu empresa" en la cabecera. Tras el alta, un administrador revisa los datos antes de que tus servicios se publiquen.',
    },
  ],
};

const INCIDENCIAS: readonly Incidencia[] = [
  { icon: 'alert-triangle', label: 'No he recibido un pago', asunto: 'Incidencia: pago no recibido' },
  { icon: 'alert-triangle', label: 'Reserva urgente', asunto: 'Incidencia: reserva urgente' },
  { icon: 'alert-triangle', label: 'El cliente no se presenta', asunto: 'Incidencia: no-show de cliente' },
  { icon: 'alert-triangle', label: 'La mascota necesita atención veterinaria', asunto: 'Incidencia: atención veterinaria urgente' },
  { icon: 'alert-triangle', label: 'El cliente no acepta un suplemento', asunto: 'Incidencia: suplemento rechazado' },
];

const APRENDIZAJE: readonly string[] = [
  'Cómo conseguir más reservas',
  'Cómo aparecer primero en el buscador',
  'Cómo mejorar tus valoraciones',
  'Cómo aumentar el precio medio de tus reservas',
  'Cómo reducir cancelaciones',
];

/**
 * Centro de ayuda (Bloque 14). Responde por rol, porque las dudas de un dueño
 * y las de un comercio no se parecen en nada, y deja siempre una vía de
 * contacto humana. Sin backend: el buscador y las categorías filtran en
 * cliente sobre el array `FAQ`.
 */
@Component({
  selector: 'app-ayuda',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, DatePipe, RsNavbarComponent, RsIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="ayuda-page">
  <rs-navbar />

  <section class="rs-section rs-section--sm">
    <div class="rs-wrap rs-wrap--lg">
      <header class="ay-head">
        <p class="ay-head__eyebrow">{{ 'Centro de ayuda' | t }}</p>
        <h1>{{ '¿En qué podemos ayudarte?' | t }}</h1>
        <p class="ay-head__sub">
          {{ 'Resolvemos la mayoría de dudas al instante. Busca tu pregunta o navega por categorías.' | t }}
        </p>
      </header>

      @if (saludo(); as s) {
        <div class="ay-personal">
          <h2>Hola {{ s.nombre }}, ¿necesitas ayuda con alguna de estas reservas?</h2>
          <div class="ay-personal__lista">
            @for (r of s.reservas; track r.codigo) {
              <div class="ay-personal__item">
                <div>
                  <strong>{{ r.servicioTitulo || r.codigo }}</strong>
                  <span>{{ r.fechaInicio | date:'d MMM yyyy' }} · {{ r.codigo }}</span>
                </div>
                <div class="ay-personal__acciones">
                  <a [routerLink]="['/reservas', r.codigo]" class="rs-btn rs-btn--outline rs-btn--sm">{{ 'Modificar o cancelar' | t }}</a>
                  <a class="rs-btn rs-btn--ghost rs-btn--sm" [href]="asuntoReserva(r)">{{ 'Hablar con soporte' | t }}</a>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <div class="ay-buscador">
        <rs-icon name="search" [size]="18" [stroke]="2"></rs-icon>
        <input type="search" class="rs-input" [placeholder]="'Buscar una pregunta…' | t"
               [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
      </div>

      <div class="ay-tabs" role="tablist" [attr.aria-label]="'Tipo de usuario' | t">
        <button type="button" role="tab" class="ay-tab" [class.is-on]="publico() === 'cliente'"
                [attr.aria-selected]="publico() === 'cliente'" (click)="cambiarPublico('cliente')">
          <rs-icon name="paw" [size]="16" [stroke]="2"></rs-icon> {{ 'Tengo una mascota' | t }}
        </button>
        <button type="button" role="tab" class="ay-tab" [class.is-on]="publico() === 'comercio'"
                [attr.aria-selected]="publico() === 'comercio'" (click)="cambiarPublico('comercio')">
          <rs-icon name="building" [size]="16" [stroke]="2"></rs-icon> {{ 'Tengo un negocio' | t }}
        </button>
      </div>

      <div class="ay-categorias">
        <button type="button" class="ay-categoria" [class.is-on]="categoria() === null" (click)="categoria.set(null)">
          {{ 'Todas' | t }}
        </button>
        @for (c of categorias(); track c.key) {
          <button type="button" class="ay-categoria" [class.is-on]="categoria() === c.key" (click)="categoria.set(c.key)">
            <rs-icon [name]="c.icon" [size]="14" [stroke]="2"></rs-icon> {{ c.label | t }}
          </button>
        }
      </div>

      @if (preguntasFiltradas().length === 0) {
        <div class="rs-card ay-vacio">
          <p>{{ 'No hay preguntas que coincidan con tu búsqueda todavía.' | t }}</p>
          <a class="rs-btn rs-btn--outline rs-btn--sm" href="mailto:soporte&#64;doogking.com">{{ 'Pregúntanos directamente' | t }}</a>
        </div>
      } @else {
        <ul class="ay-faq">
          @for (f of preguntasFiltradas(); track f.p) {
            <li class="ay-item">
              <details>
                <summary>
                  <rs-icon [name]="f.icon" [size]="16" [stroke]="2" class="ay-item__icon"></rs-icon>
                  <span>{{ f.p }}</span>
                  <rs-icon name="chevron-down" [size]="18" [stroke]="2.5" class="ay-item__caret"></rs-icon>
                </summary>
                <p>{{ f.r }}</p>
              </details>
            </li>
          }
        </ul>
      }

      @if (publico() === 'comercio') {
        <div class="ay-datos-rapidos">
          <div class="rs-card ay-dato"><span class="ay-dato__label">{{ 'Comisión' | t }}</span><strong>{{ 'Desde 10%' | t }}</strong></div>
          <div class="rs-card ay-dato"><span class="ay-dato__label">{{ 'Pago' | t }}</span><strong>{{ 'Tras completar el servicio' | t }}</strong></div>
          <div class="rs-card ay-dato"><span class="ay-dato__label">{{ 'Respuesta de soporte' | t }}</span><strong>{{ '&lt; 24 h laborables' | t }}</strong></div>
          <div class="rs-card ay-dato"><span class="ay-dato__label">{{ 'Estado de la plataforma' | t }}</span><strong><rs-icon name="check-circle" [size]="15" [stroke]="2"></rs-icon> {{ 'Operativa' | t }}</strong></div>
        </div>

        <div class="ay-section">
          <h2><rs-icon name="siren" [size]="18" [stroke]="2"></rs-icon> {{ 'Incidencias rápidas' | t }}</h2>
          <div class="ay-incidencias">
            @for (i of incidencias; track i.label) {
              <a class="rs-card ay-incidencia" [href]="'mailto:soporte&#64;doogking.com?subject=' + i.asunto">
                <rs-icon [name]="i.icon" [size]="18" [stroke]="2"></rs-icon>
                {{ i.label | t }}
              </a>
            }
          </div>
        </div>

        <div class="ay-section">
          <h2><rs-icon name="graduation-cap" [size]="18" [stroke]="2"></rs-icon> {{ 'Centro de aprendizaje Doogking' | t }}</h2>
          <ul class="ay-aprendizaje">
            @for (tema of aprendizaje; track tema) {
              <li><rs-icon name="check" [size]="14" [stroke]="3"></rs-icon> {{ tema }}</li>
            }
          </ul>
        </div>

        <div class="ay-section">
          <h2><rs-icon name="flame" [size]="18" [stroke]="2"></rs-icon> {{ 'Lo más consultado esta semana' | t }}</h2>
          <div class="ay-consultadas">
            @for (f of masConsultadas(); track f.p) {
              <button type="button" class="ay-consultada" (click)="busqueda.set(f.p)">{{ f.p }}</button>
            }
          </div>
        </div>
      }

      <div class="ay-contacto">
        <div>
          <h2>{{ '¿No encuentras tu respuesta?' | t }}</h2>
          <p>{{ 'Escríbenos y te contestamos en menos de 24 horas laborables.' | t }}</p>
          <p class="ay-contacto__confianza">
          <rs-icon name="clock" [size]="13" [stroke]="2"></rs-icon> {{ 'Respuesta media: 4 h ·' | t }}
          <rs-icon name="star" [size]="13" [stroke]="2.5"></rs-icon> {{ '4.8/5 satisfacción ·' | t }}
          <rs-icon name="globe" [size]="13" [stroke]="2"></rs-icon> {{ 'Español, inglés, catalán' | t }}
        </p>
        </div>
        <div class="ay-contacto__acciones">
          <a class="rs-btn rs-btn--primary" href="mailto:soporte&#64;doogking.com">
            <rs-icon name="mail" [size]="16" [stroke]="2"></rs-icon>
            {{ 'Escribir a soporte' | t }}
          </a>
          <a class="rs-btn rs-btn--outline" routerLink="/reservas">
            <rs-icon name="calendar" [size]="16" [stroke]="2"></rs-icon>
            {{ 'Ver mis reservas' | t }}
          </a>
        </div>
      </div>
    </div>
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }
    .ayuda-page { min-height: 100vh; min-height: 100dvh; background: var(--c-base); }

    .ay-head { margin-bottom: var(--sp-6); max-width: 60ch; }
    .ay-head__eyebrow {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .12em; text-transform: uppercase; color: var(--dk-gold);
      margin-bottom: var(--sp-2);
    }
    .ay-head h1 { font-size: var(--f-3xl); color: var(--dk-blue); letter-spacing: -.02em; }
    .ay-head__sub { color: var(--t-400); margin-top: var(--sp-2); font-size: var(--f-md); }

    .ay-personal {
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
      padding: var(--sp-6); margin-bottom: var(--sp-6);
      h2 { font-size: var(--f-lg); color: var(--t-100); margin-bottom: var(--sp-4); }
    }
    .ay-personal__lista { display: flex; flex-direction: column; gap: var(--sp-3); }
    .ay-personal__item {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4); background: var(--c-raised); border-radius: var(--r-lg);
      strong { display: block; font-size: var(--f-sm); color: var(--t-100); }
      span { font-size: var(--f-xs); color: var(--t-400); }
    }
    .ay-personal__acciones { display: flex; gap: var(--sp-2); flex-wrap: wrap; }

    .ay-buscador {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-5); margin-bottom: var(--sp-5);
      background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-full);
      color: var(--t-400);
      input { border: none; background: none; flex: 1; font-size: var(--f-md); color: var(--t-100); outline: none; }
    }

    .ay-tabs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-4); flex-wrap: wrap; }
    .ay-tab {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-5);
      border: 1px solid var(--b-2); border-radius: var(--r-full);
      background: var(--c-card); color: var(--t-300); cursor: pointer;
      font-size: var(--f-sm); font-weight: var(--w-6);
      transition: border-color var(--d-2), background var(--d-2), color var(--d-2);
      &:hover { border-color: var(--c-accent); }
      &.is-on { background: var(--dk-blue); border-color: var(--dk-blue); color: #fff; }
    }

    .ay-categorias { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-6); flex-wrap: wrap; }
    .ay-categoria {
      display: inline-flex; align-items: center; gap: var(--sp-1);
      padding: var(--sp-2) var(--sp-4);
      border: 1px solid var(--b-1); border-radius: var(--r-full);
      background: transparent; color: var(--t-400); cursor: pointer;
      font-size: var(--f-xs); font-weight: var(--w-6);
      transition: border-color var(--d-2), background var(--d-2), color var(--d-2);
      &:hover { border-color: var(--c-accent); }
      &.is-on { background: var(--dk-gold); border-color: var(--dk-gold); color: var(--dk-blue-deep, #00135D); }
    }

    .ay-vacio { padding: var(--sp-8); text-align: center; p { color: var(--t-400); margin-bottom: var(--sp-4); } }

    .ay-faq { list-style: none; display: flex; flex-direction: column; gap: var(--sp-3); }
    .ay-item {
      background: var(--c-card);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      overflow: hidden;

      summary {
        display: flex; align-items: center; gap: var(--sp-3);
        padding: var(--sp-5);
        cursor: pointer; list-style: none;
        font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100);
        &::-webkit-details-marker { display: none; }
        span { flex: 1; }
      }
      p { padding: 0 var(--sp-5) var(--sp-5) calc(var(--sp-5) + 16px + var(--sp-3)); color: var(--t-400); line-height: 1.65; max-width: 72ch; }
      details[open] .ay-item__caret { transform: rotate(180deg); }
    }
    .ay-item__icon { color: var(--dk-gold); flex-shrink: 0; }
    .ay-item__caret { color: var(--dk-blue); flex-shrink: 0; transition: transform var(--d-2); }

    .ay-datos-rapidos { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); margin-top: var(--sp-8); @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); } }
    .ay-dato { padding: var(--sp-5); }
    .ay-dato__label { display: block; font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-1); }
    .ay-dato strong { font-size: var(--f-md); color: var(--t-100); }

    .ay-section { margin-top: var(--sp-8); h2 { font-size: var(--f-lg); color: var(--dk-blue); margin-bottom: var(--sp-4); } }
    .ay-incidencias { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: var(--sp-3); }
    .ay-incidencia {
      display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-4);
      color: var(--t-100); font-size: var(--f-sm); text-decoration: none;
      &:hover { border-color: var(--c-accent); }
    }
    .ay-aprendizaje { list-style: none; display: flex; flex-direction: column; gap: var(--sp-2); li { font-size: var(--f-sm); color: var(--t-300); } }
    .ay-consultadas { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .ay-consultada {
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full); border: 1px solid var(--b-1);
      background: var(--c-card); color: var(--t-300); font-size: var(--f-xs); cursor: pointer;
      &:hover { border-color: var(--c-accent); }
    }

    .ay-contacto {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-6); flex-wrap: wrap;
      margin-top: var(--sp-10); padding: var(--sp-8);
      background: var(--c-card);
      border: 1px solid var(--b-1); border-radius: var(--r-xl);

      h2 { font-size: var(--f-xl); color: var(--dk-blue); margin-bottom: var(--sp-2); }
      p { color: var(--t-400); }
    }
    .ay-contacto__confianza { margin-top: var(--sp-2); font-size: var(--f-xs); }
    .ay-contacto__acciones { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
  `],
})
export class AyudaComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly reservasService = inject(ReservasService);

  readonly incidencias = INCIDENCIAS;
  readonly aprendizaje = APRENDIZAJE;

  readonly publico = signal<Publico>('cliente');
  readonly categoria = signal<string | null>(null);
  readonly busqueda = signal('');
  readonly misReservas = signal<ReservaApi[]>([]);

  readonly categorias = computed(() => CATEGORIAS[this.publico()]);

  readonly preguntas = computed(() => FAQ[this.publico()]);

  readonly preguntasFiltradas = computed(() => {
    const cat = this.categoria();
    const texto = this.busqueda().trim().toLowerCase();
    return this.preguntas().filter((f) => {
      const coincideCategoria = !cat || f.categoria === cat;
      const coincideTexto = !texto || f.p.toLowerCase().includes(texto) || f.r.toLowerCase().includes(texto);
      return coincideCategoria && coincideTexto;
    });
  });

  readonly masConsultadas = computed(() => FAQ[this.publico()].slice(0, 5));

  /** Ayuda personalizada (HU-14.1.5): solo si hay sesión y reservas activas. */
  readonly saludo = computed(() => {
    const usuario = this.auth.usuario();
    if (!usuario) return null;
    const reservas = this.misReservas().slice(0, 3);
    if (reservas.length === 0) return null;
    return { nombre: (usuario.nombre ?? '').split(' ')[0], reservas };
  });

  async ngOnInit(): Promise<void> {
    if (!this.auth.estaAutenticado()) return;
    try {
      this.misReservas.set(await this.reservasService.misReservas());
    } catch {
      // Ayuda genérica si no se pueden cargar las reservas.
    }
  }

  cambiarPublico(p: Publico): void {
    this.publico.set(p);
    this.categoria.set(null);
  }

  asuntoReserva(r: ReservaApi): string {
    return `mailto:soporte@doogking.com?subject=${encodeURIComponent('Ayuda con la reserva ' + r.codigo)}`;
  }
}
