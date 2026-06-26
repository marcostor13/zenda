# /verify-builds — Verificar compilación completa del monorepo

Verifica que API (NestJS) y Web (Angular) compilen sin errores. **Ejecutar siempre al terminar una sesión de cambios.**

## Pasos en orden obligatorio

**1. Rebuild shared** (si se tocó `libs/shared/src/`)
```bash
npm run build --workspace=shared
```
> La API y la Web consumen `libs/shared/dist/`, no el source. Sin rebuild, cambios en DTOs/enums no toman efecto.

**2. TypeScript check API**
```bash
npx tsc --project apps/api/tsconfig.json --noEmit
```

**3. TypeScript check Web**
```bash
npx tsc --project apps/web/tsconfig.json --noEmit
```

**4. Build Angular completo** (captura errores de templates que tsc no ve)
```bash
cd apps/web && npx ng build --no-progress 2>&1 | tail -30
```
> Los warnings de CommonJS (class-validator) son preexistentes e inocuos. Solo fallar en errores reales.

**5. Build NestJS**
```bash
cd apps/api && npx nest build
```

## Errores frecuentes y fixes

| Error | Fix |
|---|---|
| `Type X is not comparable to Type Y` en `.lean().exec()` | Usar `as unknown as TipoDestino[]` |
| `Property X does not exist in type` en shared DTOs | Correr `npm run build --workspace=shared` primero |
| `Cannot find module 'shared'` | `npm install` en raíz, luego rebuild shared |
| Template errors de Angular (p.ej. pipe no importado) | Añadir el pipe a `imports: [...]` del componente standalone |

## Cuándo ejecutar

- Al terminar CUALQUIER sesión de cambios de código
- Antes de hacer commit
- Antes de reportar una feature como completa al usuario
