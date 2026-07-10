# /ui-kit — Auditar y mantener el design system de Doogking

Eres un experto en el design system de **Doogking** (marketplace de servicios caninos — "Todo para su rey, en un solo lugar"). Tu trabajo es auditar el código Angular para asegurarte de que respeta el UI Kit, o implementar cambios de diseño cuando el usuario lo pida.

## Design System — fuentes de verdad

1. `apps/web/src/styles.scss` — implementación (tokens + clases `rs-*`). v3 "Royal Canine".
2. `docs/kitui.md` — brand guidelines (colores, tipografía, iconografía, mascota).
3. `docs/stitch_pawbooking_design_system/` — 4 pantallas de referencia (HTML + PNG) y `royal_canine_elite/DESIGN.md` (paleta M3, elevación, formas).

### Identidad

- **Tema claro**: fondo `#F8F9FA` (`--c-base`), cards blancas (`--c-card`), sombras con tinte azul real (nunca negras duras).
- **Royal King Blue** `#08258B` (`--dk-blue` / `--c-accent`): primario — navegación, headings, botones primary.
- **Crown Gold** `#FBAE17` (`--dk-gold` / `--c-amber`): CTA de máxima atención (Reservar, Buscar), estrellas de rating, acentos premium. Texto sobre dorado = azul navy, nunca blanco.
- **Deep Blue** `#00135D` (`--dk-blue-deep`): footer navy, hovers del primario. Texto fuerte: `#051A66` (`--t-100`).
- **Tipografías**: Plus Jakarta Sans (`--font-display`, headings), Inter (`--font`, cuerpo), Montserrat 700 (`--font-accent`, slogans/labels caps). Cargadas en `index.html`.
- **Formas**: 8px (`--r-sm`) inputs/botones, 16px (`--r-lg`) cards grandes, círculos perfectos para badges de categoría, pills para estados.
- **Cards premium/destacadas**: barra superior dorada de 4px.
- **Ritmo cromático**: los badges de las 5 categorías alternan azul→dorado→azul.

### Tokens CSS (resumen — ver /design-tokens para la tabla completa)

```
Marca:       --dk-blue --dk-blue-deep --dk-blue-text --dk-gold --dk-gold-light --dk-divider
Fondos:      --c-base --c-raised --c-card --c-surface --c-overlay --c-light --c-light-2
Accent:      --c-accent --c-accent-h --c-accent-lo --c-amber (+legacy --c-purple --c-teal --c-pink)
Gradientes:  --g-accent --g-warm (dorado) --g-hero --g-card
Texto:       --t-100 a --t-500
Bordes:      --b-1 --b-2 --b-a
Tipografía:  --font --font-display --font-accent · --f-xs a --f-6xl --f-hero · --w-3 a --w-9
Espaciado:   --sp-1 a --sp-32 (base 4px)
Radios:      --r-xs a --r-3xl --r-full
Sombras:     --sh-sm --sh-md --sh-lg --sh-xl --sh-glow --sh-card
Transiciones:--d-1 a --d-4
```

### Clases globales (prefijo `rs-`)

```
Layout:   .rs-wrap [--lg|--2xl|--3xl]  .rs-section [--sm|--lg]
Cards:    .rs-card  .rs-hotel-card (listados)
Buttons:  .rs-btn --{primary|gold|secondary|outline|ghost|teal|danger} --{xs|sm|lg|xl|block}
          primary = azul real · gold = CTA Crown Gold (texto navy)
Forms:    .rs-field > .rs-lbl + .rs-inp + .rs-field-err (legacy: .rs-form-group/.rs-label/.rs-input)
Badge:    .rs-badge --{accent|success|warning|error|neutral|purple|teal}
Alert:    .rs-alert --{error|success|warning}
Navbar:   .rs-navbar (__brand __nav __link __actions __hamburger)
Rating:   .rs-rating (estrellas doradas) · Precio: .rs-price
Tabs:     .rs-vtabs .rs-vtab · Search: .rs-search · Auth: .rs-auth · Footer: .rs-footer (navy)
Utils:    .rs-spinner .rs-skeleton .rs-hr .rs-flex .rs-gap-* .rs-anim (scroll animations)
```

### Componentes Angular del shared/

```
RsButtonComponent      → rs-button      RsIconComponent        → rs-icon
RsInputComponent       → rs-input (CVA) RsImageUploadComponent → rs-image-upload
RsCardComponent        → rs-card        AnimateOnScrollDirective / ImgFallbackDirective
RsBadgeComponent       → rs-badge       shared/media/images.ts (BRAND, CATEGORIA_BADGES,
RsNavbarComponent      → rs-navbar        HOTEL_IMAGES/ALOJAMIENTO_IMAGES, pexels())
```

Iconos rs-icon caninos: `paw`, `bone`, `scissors`, `stethoscope`, `graduation-cap`, `crown` (+ hotel, truck, star, search…).

### Assets de marca (`apps/web/public/`)

`favicon.svg` · `images/logo-doogking.jpg` · `images/hero-home.jpg` · `images/categoria-*.jpg` (5 badges circulares) · `images/mascota-doogking.jpg` · `images/alojamiento-*.jpg`.

## Reglas de diseño

1. **NUNCA** hardcodear colores (`#fff`, `#333`, `rgba(...)`) — usar siempre tokens `var(--xxx)`. Si necesitas un color nuevo, añade primero el token a `:root` en `styles.scss`.
2. **NUNCA** hardcodear tamaños de fuente o espaciado — usar `var(--f-*)` y `var(--sp-*)`.
3. **SIEMPRE** clases `rs-*` para elementos comunes (botones, inputs, cards, alertas).
4. Botón de acción principal de una pantalla de conversión (Reservar/Buscar/Pagar) = `rs-btn--gold`. Acciones normales = `rs-btn--primary` (azul).
5. Formularios: `.rs-field` > `.rs-lbl` + `.rs-inp` + `.rs-field-err`.
6. El tema es **claro**. Secciones oscuras solo footer/hero navy con `--dk-blue-deep`/`--c-light`.
7. Texto sobre dorado siempre azul navy; texto sobre azul siempre blanco.
8. Sombras siempre con los tokens `--sh-*` (tinte azul), nunca `rgba(0,0,0,…)`.
9. Badges de categoría: círculo perfecto, alternancia azul/dorado (usar imágenes de `CATEGORIA_BADGES`).
10. Cards destacadas/premium: barra superior dorada 4px + badge "★ Premium".

## Modo AUDITORÍA

Si el usuario pide `/ui-kit audit` o `/ui-kit check`:

1. Lee los `.component.ts` de `apps/web/src/app/features/` y `apps/web/src/app/shared/`.
2. Busca violaciones:
   - Colores/espaciados hardcodeados en `style="..."` o en `styles: [...]`
   - Restos del tema viejo (navy oscuro de fondo, azul Expedia `#1668E3`, morados `#5472F8`)
   - Clases CSS propias que dupliquen clases `rs-*`
   - `<button>` sin clase `rs-btn` · `<input>` sin clase `rs-inp`/`rs-input`
   - Restos de la marca vieja "Reservalo" (la marca es Doogking)
3. Reporta violaciones con ruta:línea y corrección sugerida.
4. Si el usuario confirma, aplica las correcciones.

## Modo NUEVO COMPONENTE

Si el usuario pide `/ui-kit nuevo [nombre]`:

1. Crea `apps/web/src/app/shared/components/[nombre]/rs-[nombre].component.ts` (standalone, OnPush, signals).
2. Solo tokens del design system — sin CSS hardcodeado.
3. Añádelo al barrel `apps/web/src/app/shared/index.ts`.
4. Documenta el componente en este archivo y crea su `.spec.ts`.

## Modo ACTUALIZAR TOKENS

1. Modifica solo `apps/web/src/styles.scss` en la sección "1. TOKENS".
2. NO tocar componentes — los tokens se propagan vía CSS custom properties.
3. Actualiza `/design-tokens` (`.claude/commands/design-tokens.md`).
4. Nunca eliminar tokens existentes sin revisar usos (`grep -r "var(--token)"`).

## $ARGUMENTS

Si se pasan argumentos (`/ui-kit audit`, `/ui-kit nuevo [nombre]`, `/ui-kit token [token] [valor]`), detecta el modo y ejecuta la acción correspondiente.
