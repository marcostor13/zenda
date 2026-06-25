# Spec: [NOMBRE DE LA FEATURE]

**ID:** `spec-NNN`
**Vertical / Módulo:** [hoteles | vuelos | taxis | transporte | guarderia | core/auth | core/bookings | ...]
**Prioridad:** P0 | P1 | P2
**Estado:** borrador | revisado | aprobado | implementado
**Fecha:** YYYY-MM-DD

---

## Problema / Necesidad

> ¿Qué problema del usuario o del negocio resuelve esta feature? Una o dos oraciones.

## Usuarios afectados

- [ ] Cliente / Usuario final
- [ ] Comercio / Proveedor
- [ ] Administrador de plataforma

## Historia de usuario

```
Como [rol],
quiero [acción],
para [beneficio].
```

## Criterios de aceptación

> Formato: Dado [contexto], cuando [acción], entonces [resultado esperado].

- [ ] CA-1: Dado … cuando … entonces …
- [ ] CA-2: Dado … cuando … entonces …
- [ ] CA-3: Dado … cuando … entonces …

## Flujo principal (happy path)

1. El usuario …
2. El sistema …
3. El usuario ve …

## Flujos alternativos / errores

| Caso | Resultado esperado |
|---|---|
| Token expirado | Redirigir a `/auth/login` con mensaje |
| Pago rechazado | Liberar SlotHold, notificar al usuario |
| Servicio no disponible | Mostrar error y sugerir alternativas |

## Modelo de datos afectado

> Listar colecciones y campos nuevos o modificados.

```
// Nueva colección / campos
{
  campo: tipo,
}
```

## API endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | /api/v1/... | JWT | ... |
| GET  | /api/v1/... | Público | ... |

## Dependencias

- Requiere: [spec-NNN, spec-NNN]
- Bloquea: [spec-NNN]

## Preguntas abiertas

- [ ] ¿...?
- [ ] ¿...?

## Notas de diseño UI

> Componentes del UI Kit a usar: rs-card, rs-button, rs-input, etc.
> Tokens de diseño relevantes: --accent, --bg-card, etc.
