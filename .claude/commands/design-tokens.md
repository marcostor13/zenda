# /design-tokens — Referencia rápida del design system de Doogking

Muestra la referencia completa de tokens y clases disponibles, o busca un token específico.

> Fuente de verdad: `apps/web/src/styles.scss` (v3 "Royal Canine"). Especificación de diseño: `docs/kitui.md` + `docs/stitch_pawbooking_design_system/`.

## Uso

```
/design-tokens              → mostrar referencia completa
/design-tokens color        → solo tokens de color
/design-tokens spacing      → solo tokens de espaciado
/design-tokens [búsqueda]   → buscar token por nombre parcial
```

---

## Referencia completa

### Marca Doogking
| Token | Valor | Uso |
|---|---|---|
| `--dk-blue` | `#08258B` | Royal King Blue — primario (botones, headings, links) |
| `--dk-blue-deep` | `#00135D` | Deep — footer navy, hover del primario |
| `--dk-blue-text` | `#051A66` | Deep Shadow Blue — texto fuerte |
| `--dk-gold` | `#FBAE17` | Crown Gold — CTA destacado (Reservar/Buscar), acentos, estrellas. **No usar como color de texto sobre fondos claros/fotos** (contraste ~1.9:1, falla WCAG) |
| `--dk-gold-light` | `#FFC533` | Extremo claro del gradiente dorado |
| `--dk-gold-text` | `#A6720C` | Dorado oscurecido para **texto** sobre fondos claros/fotos (contraste ~4.2:1, pasa AA texto grande) |
| `--dk-divider` | `#8B9BBC` | Divisores verticales entre módulos de servicio |

### Colores — fondos (tema claro)
| Token | Valor | Uso |
|---|---|---|
| `--c-base` | `#F8F9FA` | Fondo principal de la app |
| `--c-raised` | `#F3F4F5` | Superficies ligeramente elevadas |
| `--c-card` | `#FFFFFF` | Cards y paneles (blanco puro) |
| `--c-surface` | `#EDEEEF` | Superficies interactivas |
| `--c-overlay` | `#E1E3E4` | Overlays claros |
| `--c-light` | `#00135D` | Secciones navy (footer) |
| `--c-light-2` | `#08258B` | Secciones azul real |

### Colores — accent
| Token | Uso |
|---|---|
| `--c-accent` | `#08258B` — igual a --dk-blue |
| `--c-accent-h` | `#00135D` — hover |
| `--c-accent-lo` | `rgba(8,37,139,.08)` — fondos suaves azules |
| `--c-amber` | `#FBAE17` — igual a --dk-gold |
| `--c-pink` | `#FFC533` — gold light (legacy alias) |
| `--c-purple` / `--c-teal` | `#4156B9` — azul secundario (legacy alias) |

### Gradientes
| Token | Valor |
|---|---|
| `--g-accent` | azul real → azul secundario (135deg) |
| `--g-warm` | `#FBAE17 → #FFC533` — gradiente dorado (CTA, corona) |
| `--g-hero` | radiales azul/dorado suaves sobre --c-base |

### Colores — texto
| Token | Uso |
|---|---|
| `--t-100` | `#051A66` — headings, texto principal |
| `--t-200` | `#1E2A4A` — texto de cuerpo |
| `--t-300` | `#454652` — secundario |
| `--t-400` | `#6E7387` — muted, labels |
| `--t-500` | `#9AA1B5` — placeholders |

### Tipografía
| Token | Valor |
|---|---|
| `--font` | Inter (cuerpo, botones) |
| `--font-display` | Plus Jakarta Sans (headings h1–h6, .rs-display) |
| `--font-accent` | Montserrat 700 (slogan, .rs-label-caps) |
| `--f-xs`…`--f-6xl` | 11 → 72px |
| `--f-hero` | clamp responsive para heros |
| `--w-3`…`--w-9` | pesos 300 → 900 |

### Espaciado (base 4px)
`--sp-1` (4) `--sp-2` (8) `--sp-3` (12) `--sp-4` (16) `--sp-5` (20) `--sp-6` (24) `--sp-8` (32) `--sp-10` (40) `--sp-12` (48) `--sp-16` (64) `--sp-20` (80) `--sp-24` (96) `--sp-32` (128)

### Border radius
`--r-xs` (4) `--r-sm` (8 — inputs/botones estándar) `--r-md` (12) `--r-lg` (16 — cards/contenedores grandes) `--r-xl` (20) `--r-2xl` (28) `--r-3xl` (40) `--r-full` (pill/círculos)

### Sombras (tinte azul real, nunca negras duras)
| Token | Uso |
|---|---|
| `--sh-sm` | elementos pequeños |
| `--sh-md` / `--sh-card` | cards en reposo `0 4px 20px rgba(8,37,139,.05)` |
| `--sh-lg` | popovers/hover `0 8px 30px rgba(8,37,139,.12)` |
| `--sh-xl` | modales |
| `--sh-glow` | glow dorado `rgba(251,174,23,.28)` |

### Transiciones
`--d-1` (100ms) `--d-2` (200ms) `--d-3` (300ms) `--d-4` (450ms)

---

## Clases globales `rs-*`

```
TIPOGRAFÍA: .rs-display .rs-h1 .rs-h2 .rs-h3 .rs-h4 .rs-gradient-text .rs-label-caps
LAYOUT:    .rs-wrap [--lg|--2xl|--3xl]  .rs-section [--sm|--lg]
NAVBAR:    .rs-navbar (__brand __nav __link __link--active __actions __hamburger)
BUTTONS:   .rs-btn .rs-btn--{primary|gold|secondary|outline|ghost|teal|danger}
           tamaños: .rs-btn--{xs|sm|lg|xl|block}
           → primary = azul real sólido · gold = CTA Crown Gold (texto navy)
FORMS:     .rs-field > .rs-lbl + .rs-inp (+ .rs-field-err / .rs-field-hint)
           legacy: .rs-form-group .rs-label .rs-input .rs-field-error
CARDS:     .rs-card  .rs-hotel-card (card de listado)
BADGES:    .rs-badge --{accent|success|warning|error|neutral|purple|teal}
ALERTS:    .rs-alert --{error|success|warning}
RATING:    .rs-rating (estrellas doradas)   PRECIO: .rs-price
TABS:      .rs-vtabs .rs-vtab (legacy .rs-vertical-tabs)
SEARCH:    .rs-search  (legacy .rs-search-box, .rs-buscador-hero)
AUTH:      .rs-auth (legacy .rs-auth-layout .rs-auth-card)
FOOTER:    .rs-footer (navy --dk-blue-deep)
UTILS:     .rs-spinner .rs-skeleton .rs-hr .rs-flex .rs-col .rs-center
           .rs-between .rs-gap-{2|3|4|6|8} .rs-text-center .rs-truncate
```

## Assets de marca (`apps/web/public/`)

`favicon.svg` (huella + corona) · `images/logo-doogking.jpg` · `images/hero-home.jpg` · `images/categoria-{alojamiento|transporte|veterinaria|peluqueria|adiestramiento}.jpg` (badges circulares) · `images/mascota-doogking.jpg` · helpers en `shared/media/images.ts` (BRAND, CATEGORIA_BADGES, HOTEL_IMAGES).

## $ARGUMENTS

Si `$ARGUMENTS` contiene `color`, mostrar solo la sección de colores.
Si contiene `spacing`, mostrar solo espaciado.
Si contiene cualquier otro texto, buscar en la tabla el token que lo contiene.
