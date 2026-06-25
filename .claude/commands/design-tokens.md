# /design-tokens — Referencia rápida del design system de Reservalo

Muestra la referencia completa de tokens y clases disponibles, o busca un token específico.

## Uso

```
/design-tokens              → mostrar referencia completa
/design-tokens color        → solo tokens de color
/design-tokens spacing      → solo tokens de espaciado
/design-tokens [búsqueda]   → buscar token por nombre parcial
```

---

## Referencia completa

### Colores — fondos
| Token | Valor | Uso |
|---|---|---|
| `--bg-base` | `#080D1A` | Fondo principal de la app |
| `--bg-elevated` | `#0F1629` | Fondo de secciones elevadas |
| `--bg-card` | `#141E35` | Cards y paneles |
| `--bg-surface` | `#1C2B47` | Superficies interactivas |
| `--bg-subtle` | `#243357` | Hover states |
| `--bg-light` | `#F8FAFC` | Modo claro / secciones blancas |

### Colores — accent
| Token | Uso |
|---|---|
| `--accent` | `#4F72F8` — color principal del botón primary |
| `--accent-hover` | `#3B5BDB` — hover de accent |
| `--accent-light` | `#6B8AFA` — texto sobre fondo oscuro, links |
| `--accent-subtle` | `rgba(79,114,248,0.12)` — fondos suaves |
| `--accent-gradient` | `linear-gradient(135deg, #4F72F8, #8B5CF6)` — gradiente principal |

### Colores — texto
| Token | Uso |
|---|---|
| `--text-primary` | `#F0F4FF` — textos principales |
| `--text-secondary` | `#94A3B8` — textos secundarios |
| `--text-muted` | `#64748B` — placeholders, hints |
| `--text-dark` | `#0F172A` — texto en fondos claros |

### Tipografía
| Token | Valor |
|---|---|
| `--font-sans` | Inter, -apple-system, … |
| `--text-xs` | 12px |
| `--text-sm` | 14px |
| `--text-base` | 16px |
| `--text-lg` | 18px |
| `--text-xl` | 20px |
| `--text-2xl` | 24px |
| `--text-3xl` | 30px |
| `--text-4xl` | 36px |
| `--text-5xl` | 48px |
| `--text-6xl` | 60px |
| `--fw-normal` | 400 |
| `--fw-medium` | 500 |
| `--fw-semibold` | 600 |
| `--fw-bold` | 700 |
| `--fw-extrabold` | 800 |

### Espaciado (base 4px)
| Token | px | Token | px |
|---|---|---|---|
| `--s-1` | 4 | `--s-8` | 32 |
| `--s-2` | 8 | `--s-10` | 40 |
| `--s-3` | 12 | `--s-12` | 48 |
| `--s-4` | 16 | `--s-16` | 64 |
| `--s-5` | 20 | `--s-20` | 80 |
| `--s-6` | 24 | `--s-24` | 96 |

### Border radius
| Token | px |
|---|---|
| `--r-sm` | 6 |
| `--r-md` | 8 |
| `--r-lg` | 12 |
| `--r-xl` | 16 |
| `--r-2xl` | 24 |
| `--r-full` | 9999 |

### Sombras
| Token | Uso |
|---|---|
| `--shadow-sm` | Elementos pequeños |
| `--shadow-md` | Cards normales |
| `--shadow-lg` | Modales, dropdowns |
| `--shadow-xl` | Auth cards, overlays |
| `--shadow-accent` | Botón primary hover |
| `--shadow-card` | Cards con borde sutil |

### Transiciones
| Token | Valor |
|---|---|
| `--t-fast` | 150ms ease |
| `--t-base` | 250ms ease |
| `--t-slow` | 350ms ease |

---

## Clases globales `rs-*`

```
BUTTONS:   .rs-btn .rs-btn--primary|secondary|outline|ghost|danger
           .rs-btn--sm|lg|xl|block

FORMS:     .rs-form-group > .rs-label + .rs-input + .rs-field-error
           .rs-input--error (en el input cuando hay error)

CARDS:     .rs-card   .rs-card--glass

BADGES:    .rs-badge .rs-badge--accent|success|warning|error|neutral

ALERTS:    .rs-alert .rs-alert--error|success|warning|info

LAYOUT:    .rs-container  .rs-container--sm|md|lg|2xl  .rs-section

NAVBAR:    .rs-navbar  __brand __nav __link __link--active __actions

TABS:      .rs-vertical-tabs  .rs-vertical-tab  .activo

AUTH:      .rs-auth-layout  .rs-auth-card  __brand  __footer

HERO:      .rs-buscador-hero  __content  __eyebrow  __heading  __subheading

SEARCH:    .rs-search-box  .rs-search-box__row

UTILS:     .rs-gradient-text  .rs-spinner  .rs-divider  .rs-divider--text
           .rs-flex .rs-grid .rs-items-center .rs-justify-between
           .rs-gap-{2|3|4|6|8}  .rs-w-full  .rs-text-center
```

## $ARGUMENTS

Si `$ARGUMENTS` contiene `color`, mostrar solo la sección de colores.
Si contiene `spacing`, mostrar solo espaciado.
Si contiene cualquier otro texto, buscar en la tabla el token que lo contiene.
