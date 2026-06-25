# /ui-kit — Auditar y mantener el design system de Reservalo

Eres un experto en el design system de Reservalo. Tu trabajo es auditar el código Angular para asegurarte de que respeta el UI Kit, o implementar cambios de diseño cuando el usuario lo pida.

## Design System — fuente de verdad

El design system vive en `apps/web/src/styles.scss`. Contiene:

### Tokens CSS (prefijo `--`)
```
Colores:     --bg-base, --bg-card, --bg-elevated, --bg-surface
             --accent, --accent-hover, --accent-gradient, --accent-subtle
             --text-primary, --text-secondary, --text-muted
             --border, --border-hover
             --success, --warning, --error
Tipografía:  --font-sans, --font-display
             --text-xs a --text-6xl
             --fw-normal a --fw-extrabold
             --lh-tight, --lh-snug, --lh-normal, --lh-relaxed
Espaciado:   --s-1 a --s-24 (base 4px)
Radios:      --r-sm a --r-full
Sombras:     --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl, --shadow-accent
Transiciones:--t-fast (150ms), --t-base (250ms), --t-slow (350ms)
```

### Clases globales (prefijo `rs-`)
```
Layout:   .rs-container, .rs-section
Cards:    .rs-card, .rs-card--glass
Buttons:  .rs-btn .rs-btn--{primary|secondary|outline|ghost|danger}
          Tamaños: .rs-btn--{sm|lg|xl|block}
Forms:    .rs-form-group, .rs-label, .rs-input, .rs-input--error, .rs-field-error
Badge:    .rs-badge .rs-badge--{accent|success|warning|error|neutral}
Alert:    .rs-alert .rs-alert--{error|success|warning|info}
Navbar:   .rs-navbar y sus __brand, __nav, __link, __actions
Tabs:     .rs-vertical-tabs, .rs-vertical-tab (+ .activo)
Auth:     .rs-auth-layout, .rs-auth-card y sus __brand, __footer
Hero:     .rs-buscador-hero y sus sub-elementos
Search:   .rs-search-box, .rs-search-box__row
Utilities:.rs-gradient-text, .rs-spinner, .rs-divider
```

### Componentes Angular del shared/
```
RsButtonComponent  → selector: rs-button
RsInputComponent   → selector: rs-input (ControlValueAccessor)
RsCardComponent    → selector: rs-card
RsBadgeComponent   → selector: rs-badge
RsNavbarComponent  → selector: rs-navbar
```
Importar desde: `../../shared` o `../../../shared` según la profundidad.

## Reglas de diseño

1. **NUNCA** hardcodear colores (`#fff`, `#333`, `rgba(...)`) — usar siempre tokens `var(--xxx)`.
2. **NUNCA** hardcodear tamaños de fuente o espaciado — usar tokens `var(--text-*)` y `var(--s-*)`.
3. **SIEMPRE** usar clases `rs-*` para elementos comunes (botones, inputs, cards, alertas).
4. Los formularios usan: `.rs-form-group` > `.rs-label` + `.rs-input` + `.rs-field-error`.
5. Los botones usan: `.rs-btn .rs-btn--[variante]` — NUNCA `<button style="background: blue">`.
6. El tema es **dark first**. Si una página es light, usa `--bg-light` y `--text-dark`.
7. Inter es la fuente única. Se carga desde Google Fonts en `index.html`.

## Modo AUDITORÍA

Si el usuario pide `/ui-kit audit` o `/ui-kit check`:

1. Lee los archivos `.component.ts` de `apps/web/src/app/features/` y `apps/web/src/app/shared/`.
2. Busca violaciones:
   - Colores hardcodeados en `style="..."` o en arrays `styles: [...]`
   - Clases CSS propias que dupliquen lo que ya tienen las clases `rs-*`
   - `<button>` sin clase `rs-btn`
   - `<input>` sin clase `rs-input`
3. Reporta las violaciones con ruta:línea y la corrección sugerida.
4. Si el usuario confirma, aplica las correcciones.

## Modo NUEVO COMPONENTE

Si el usuario pide `/ui-kit nuevo [nombre]` o `/ui-kit add [nombre]`:

1. Crea el componente en `apps/web/src/app/shared/components/[nombre]/rs-[nombre].component.ts`
2. Usa tokens del design system — sin CSS hardcodeado.
3. Añádelo al barrel `apps/web/src/app/shared/index.ts`.
4. Documenta el nuevo componente en este archivo (sección Componentes Angular del shared/).

## Modo ACTUALIZAR TOKENS

Si el usuario pide cambiar el accent color, tipografía u otro token:

1. Modifica solo `apps/web/src/styles.scss` en la sección "2. DESIGN TOKENS".
2. NO tocar los componentes — los tokens se propagan automáticamente vía CSS custom properties.
3. Actualiza la documentación en este archivo.

## $ARGUMENTS

Si se pasan argumentos (`/ui-kit audit`, `/ui-kit nuevo [nombre]`, `/ui-kit token [token] [valor]`), detecta el modo y ejecuta la acción correspondiente.
