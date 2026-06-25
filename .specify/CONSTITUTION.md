# Constitución del Proyecto — Reservalo

> Este documento es la guía constitucional del proyecto. Toda especificación, plan e implementación debe respetarla.

## Misión del producto
Marketplace de reservas multi-vertical para el mercado peruano. Un solo producto que unifica 5 verticales de reserva bajo un mismo buscador, perfil de usuario, pasarela de pago y panel administrativo.

## Principios de arquitectura

1. **Core agnóstico al vertical.** Nunca añadir `if vertical === 'hotel'` dentro de módulos core (`bookings`, `payments`, `catalog`, `availability`). Cada vertical es un módulo aislado.
2. **Extensibilidad por diseño.** Añadir un vertical = crear `verticals/<nombre>` con schema discriminador + AvailabilityStrategy + PricingStrategy. El core no cambia.
3. **Un solo repositorio.** Frontend Angular y backend NestJS en el mismo monorepo con npm workspaces. DTOs compartidos en `libs/shared`.
4. **Pago primero.** La reserva solo se confirma tras webhook de pago aprobado (Stripe). Idempotencia obligatoria en el handler.
5. **Multi-tenant lógico.** Todo dato de comercio filtrado por `comercioId`. Los guards impiden acceso cruzado.

## Principios de código

1. **TypeScript strict.** Sin `any` explícito. `interface` para contratos. `readonly` en propiedades inmutables.
2. **NestJS:** Un módulo por dominio. Controllers orquestan, Services tienen la lógica, Repositories acceden a datos. Sin lógica de negocio en controllers.
3. **Angular:** Standalone components siempre. Signals para estado local. `OnPush` en todos los componentes. Lazy loading obligatorio por feature.
4. **Tests:** Cada archivo de producción tiene su `.spec.ts`. Cobertura mínima 80%. Describe/it en español.
5. **Sin magia:** No magic numbers. No hardcodear credenciales. Variables sensibles solo en `.env`.

## Principios de diseño UI

1. **Design system:** Usar siempre los tokens CSS de `styles.scss` (prefijo `--` y clases `rs-*`). No hardcodear colores ni tamaños.
2. **Componentes compartidos:** Usar `rs-button`, `rs-input`, `rs-card`, `rs-badge`, `rs-navbar` del `shared/` antes de crear HTML plano.
3. **Dark first:** El tema base es oscuro (navy `#080D1A`). Accent: gradiente azul-índigo `#4F72F8 → #8B5CF6`.
4. **Tipografía Inter:** Siempre via los tokens `--font-sans` / `--font-display`.
5. **Consistencia sobre creatividad:** Si una decisión de diseño no está en `styles.scss`, añadirla ahí primero y documentarla.

## Decisiones técnicas clave

| Decisión | Elección | Razón |
|---|---|---|
| Frontend | Angular 20+ standalone | Señalado en el brief |
| Backend | NestJS modular monolith | Modular, escalable |
| BD | MongoDB Atlas / Mongoose | Flexibilidad de esquema para verticales |
| Pagos | Stripe únicamente | Decisión del cliente |
| Moneda | PEN (soles) | Mercado peruano |
| Hosting FE | Netlify | CI/CD automático |
| Hosting BE | Coolify (EC2) | Self-hosted, control total |

## Fuera del alcance MVP

- Login social (Google/Facebook) — P2
- Programa de puntos/fidelización — Fase 4
- Facturación electrónica SUNAT — Fase posterior al MVP
- Pasarelas alternativas (Culqi, Izipay, Yape) — Fase posterior
- Notificaciones push móvil — Fase 5
