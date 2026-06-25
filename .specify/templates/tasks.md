# Tasks: [NOMBRE DE LA FEATURE]

**Plan de referencia:** `plan-NNN`
**Sprint:** [número]
**Fecha inicio:** YYYY-MM-DD

---

## Tareas

### Backend

- [ ] **T01** — Crear schema Mongoose `XxxSchema` con discriminador (si aplica)
  - Archivos: `src/verticals/[vertical]/xxx.schema.ts`
  - Criterio: Schema registrado en el módulo, índices declarados

- [ ] **T02** — Crear DTOs en `libs/shared`
  - Archivos: `libs/shared/src/dtos/xxx.dto.ts`
  - Criterio: Exportado en el barrel `libs/shared/src/index.ts`

- [ ] **T03** — Implementar `XxxRepository`
  - Archivos: `src/core/xxx/xxx.repository.ts`
  - Criterio: Queries con `.lean()` y proyección explícita

- [ ] **T04** — Implementar `XxxService`
  - Archivos: `src/core/xxx/xxx.service.ts`
  - Criterio: Sin acceso directo a Mongoose, sin lógica HTTP

- [ ] **T05** — Implementar `XxxController`
  - Archivos: `src/core/xxx/xxx.controller.ts`
  - Criterio: Guards `@UseGuards(JwtAuthGuard, RolesGuard)`, sin lógica de negocio

- [ ] **T06** — Tests backend (service + controller)
  - Archivos: `xxx.service.spec.ts`, `xxx.controller.spec.ts`
  - Criterio: 80%+ coverage, mocks con `jest.Mocked<T>`

### Frontend

- [ ] **T07** — Crear componente Angular `XxxComponent`
  - Archivos: `src/app/features/xxx/xxx.component.ts`
  - Criterio: Standalone, signals, OnPush, usa clases `rs-*`

- [ ] **T08** — Crear servicio HTTP `XxxService`
  - Archivos: `src/app/features/xxx/xxx.service.ts`
  - Criterio: Tipado con DTOs de `shared`, sin `any`

- [ ] **T09** — Tests frontend
  - Archivos: `xxx.component.spec.ts`, `xxx.service.spec.ts`
  - Criterio: 80%+ coverage

### Integración

- [ ] **T10** — Verificar criterios de aceptación del spec
- [ ] **T11** — PR review y merge

## Orden de ejecución recomendado

T01 → T02 → T03 → T04 → T05 → T06 (paralelo con T07 → T08 → T09) → T10 → T11
