# /nuevo-componente — Crear nuevo componente Angular siguiendo el design system

Crea un componente Angular standalone que respeta el UI Kit de Reservalo.

## Uso

```
/nuevo-componente [nombre] [tipo]
```

- `nombre`: nombre del componente en kebab-case (ej: `hotel-card`, `booking-summary`)
- `tipo`: `feature` | `shared` (default: `feature`)

## Qué hace

1. Detecta dónde va el componente:
   - `shared` → `apps/web/src/app/shared/components/[nombre]/rs-[nombre].component.ts`
   - `feature` → `apps/web/src/app/features/[vertical-inferido]/[nombre]/[nombre].component.ts`

2. Genera el componente con esta plantilla:

```typescript
import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
// Imports adicionales según necesidad

@Component({
  selector: 'app-[nombre]', // o rs-[nombre] si es shared
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-card">
      <!-- Usar SIEMPRE clases rs-* para elementos del design system -->
      <!-- NUNCA hardcodear colores o tamaños — usar var(--xxx) -->
    </div>
  `,
})
export class [Nombre]Component {
  // inputs con input()
  // outputs con output()
  // estado con signal()
  // derivados con computed()
}
```

3. Crea el archivo `.spec.ts` correspondiente:

```typescript
describe('[Nombre]Component', () => {
  // Tests en español
  it('debería renderizarse correctamente', () => { ... });
});
```

4. Si es `shared`, lo añade al barrel `apps/web/src/app/shared/index.ts`.

## Reglas de diseño a cumplir

- `ChangeDetectionStrategy.OnPush` en todos los componentes que no sean page-level
- No subscriptions manuales — usar `AsyncPipe` o `toSignal()`
- No `ngModel` — usar `ReactiveFormsModule`
- No `NgModule` — standalone siempre
- Estilos: solo clases `rs-*` y tokens `var(--xxx)`. Si necesitas estilo propio, añade la clase en `styles.scss` primero.
- Componentes shared exportan en `shared/index.ts`

## $ARGUMENTS

`$ARGUMENTS` contiene el nombre y tipo del componente. Si está vacío, preguntar al usuario.
