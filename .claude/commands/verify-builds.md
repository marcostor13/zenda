# /verify-builds — Verificar compilación completa del monorepo

Verifica que API (NestJS) y Web (Angular) compilen sin errores. **Ejecutar siempre al terminar una sesión de cambios.**

## Pasos en orden obligatorio

**1. Rebuild shared** (si se tocó `libs/shared/src/`)
```bash
bun run build:shared
```
> La API consume `libs/shared/dist/`, no el source. Sin rebuild, cambios en DTOs/enums no toman efecto.

**2. TypeScript check API**
```bash
bunx tsc --project apps/api/tsconfig.json --noEmit
```

**3. TypeScript check Web**
```bash
bunx tsc --project apps/web/tsconfig.json --noEmit
```

**4. Build Angular completo** (captura errores de templates que tsc no ve)
```bash
bun run build:web 2>&1 | tail -30
```
> Los warnings de CommonJS (class-validator) son preexistentes e inocuos. Solo fallar en errores reales.

**5. Build NestJS**
```bash
bun run build:api
```

## Errores frecuentes y fixes

| Error | Fix |
|---|---|
| `Type X is not comparable to Type Y` en `.lean().exec()` | Usar `as unknown as TipoDestino[]` |
| `Property X does not exist in type` en shared DTOs | Correr `bun run build:shared` primero |
| `Cannot find module 'shared'` | `bun install` en raíz, luego rebuild shared |
| `Cannot find module 'X'` en un workspace | Bun no hace hoisting como npm: declarar la dependencia en el `package.json` de ese workspace |
| Template errors de Angular (p.ej. pipe no importado) | Añadir el pipe a `imports: [...]` del componente standalone |

## Cuándo ejecutar

- Al terminar CUALQUIER sesión de cambios de código
- Antes de hacer commit
- Antes de reportar una feature como completa al usuario
