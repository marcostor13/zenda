# /speckit — Spec-Driven Development para Doogking

Flujo estructurado de 7 pasos para implementar features en Doogking de forma rigurosa.

## Cuándo usar este skill

Antes de implementar cualquier feature nueva de mediana o gran complejidad. El spec garantiza que:
- Los requisitos estén claros antes de escribir código
- La arquitectura respete los principios del CLAUDE.md
- Los tests estén planificados desde el inicio
- El diseño use el UI Kit de Doogking

---

## Comandos

### `/speckit constitution`
Lee y recuerda la constitución del proyecto desde `.specify/CONSTITUTION.md`. Úsalo al inicio de una sesión nueva para establecer el contexto.

### `/speckit spec [nombre-feature]`
Crea un nuevo spec usando `.specify/templates/spec.md`. Hace preguntas sobre:
- ¿Qué problema resuelve?
- ¿Qué vertical o módulo afecta?
- ¿Cuáles son los criterios de aceptación?
- ¿Qué endpoints API necesita?
- ¿Qué componentes del UI Kit usará?

Guarda en: `.specify/specs/NNN-[nombre-feature]/spec.md`

### `/speckit plan [spec-id]`
Lee el spec `NNN` y genera un plan técnico usando `.specify/templates/plan.md`. Define:
- Archivos a crear/modificar (backend + frontend + shared)
- Diseño de DTOs y API
- Flujo de implementación paso a paso
- Tests a escribir

Guarda en: `.specify/specs/NNN-[nombre-feature]/plan.md`

### `/speckit tasks [spec-id]`
Convierte el plan en tareas accionables usando `.specify/templates/tasks.md`. Genera TaskCreate para cada tarea y las ordena por dependencias.

### `/speckit implement [task-id]`
Implementa una tarea específica del task list. Antes de escribir código:
1. Lee el spec y el plan de referencia
2. Lee la CONSTITUTION
3. Verifica que no se viole ningún principio
4. Implementa siguiendo el plan exacto

### `/speckit clarify [spec-id]`
Identifica ambigüedades en el spec y genera preguntas para el usuario. Útil cuando el spec tiene secciones incompletas.

### `/speckit converge [spec-id]`
Valida la implementación contra el spec:
1. Lee todos los criterios de aceptación
2. Verifica que el código los cumple
3. Corre los tests
4. Reporta qué falta

---

## Reglas de spec-kit para Doogking

Al crear specs y planes, respetar siempre:

1. **Core agnóstico al vertical** — si la feature toca el core, verificar que no agrega condicionales por vertical
2. **UI Kit** — todo componente nuevo usa clases `rs-*` y tokens `var(--xxx)` del design system
3. **Tests primero** — el plan siempre incluye qué tests escribir, el spec incluye los CAs
4. **DTOs en shared** — cualquier DTO usado por FE y BE va en `libs/shared`
5. **Stripe** — cualquier feature de pago usa solo Stripe, nunca otras pasarelas

## $ARGUMENTS

El argumento es el subcomando: `constitution | spec | plan | tasks | implement | clarify | converge`.
Si no se pasa argumento, mostrar el menú de ayuda arriba.
