# Plan técnico: [NOMBRE DE LA FEATURE]

**Spec de referencia:** `spec-NNN`
**Estimación:** [S | M | L | XL]
**Asignado a:** [nombre / Claude Code]
**Fecha:** YYYY-MM-DD

---

## Arquitectura de la solución

> Descripción de alto nivel de cómo se implementa.

## Archivos a crear / modificar

### Backend (`apps/api/`)

| Archivo | Acción | Descripción |
|---|---|---|
| `src/core/[módulo]/[módulo].service.ts` | crear/editar | ... |
| `src/core/[módulo]/[módulo].controller.ts` | crear/editar | ... |
| `src/core/[módulo]/dto/[nombre].dto.ts` | crear | ... |
| `src/verticals/[vertical]/[nombre].schema.ts` | crear | Discriminador Mongoose |

### Frontend (`apps/web/`)

| Archivo | Acción | Descripción |
|---|---|---|
| `src/app/features/[feature]/[nombre].component.ts` | crear/editar | ... |
| `src/app/features/[feature]/[nombre].service.ts` | crear | ... |

### Shared (`libs/shared/`)

| Archivo | Acción | Descripción |
|---|---|---|
| `src/dtos/[nombre].dto.ts` | crear | DTO compartido FE/BE |

## Diseño de la API

```typescript
// DTO de entrada
export class CreateXxxDto {
  @IsString()
  @IsNotEmpty()
  campo: string;
}

// Respuesta
export interface XxxResponseDto {
  id: string;
  campo: string;
  createdAt: Date;
}
```

## Flujo de implementación

1. [ ] Crear/actualizar schema Mongoose (si aplica discriminador, registrarlo)
2. [ ] Crear DTOs en `libs/shared`
3. [ ] Implementar Repository
4. [ ] Implementar Service con lógica de negocio
5. [ ] Implementar Controller con guards
6. [ ] Escribir tests unitarios (service + controller)
7. [ ] Implementar componente Angular
8. [ ] Conectar con el servicio HTTP tipado
9. [ ] Aplicar clases del UI Kit (`rs-*`)
10. [ ] Verificar criterios de aceptación del spec

## Riesgos técnicos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| ... | Alta/Media/Baja | ... |

## Tests a escribir

- [ ] `[módulo].service.spec.ts`: casos happy path + errores
- [ ] `[módulo].controller.spec.ts`: guards + respuestas HTTP
- [ ] `[nombre].component.spec.ts`: renderizado + interacción

## Checklist de salida (Definition of Done)

- [ ] Tests pasan al 80%+ coverage
- [ ] No hay `any` explícito
- [ ] Guards correctos en el endpoint
- [ ] UI usa tokens del design system (`--xxx`, `rs-*`)
- [ ] Sin secrets hardcodeados
- [ ] PR title sigue convención: `feat/fix/chore: descripción`
