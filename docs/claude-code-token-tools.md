# Herramientas de ahorro de tokens para Claude Code

Guía para replicar en cualquier otro proyecto el setup de herramientas de reducción de consumo de tokens instalado en este repo. Probado en Windows con Git Bash / PowerShell.

> **Antes de instalar cualquier paquete nuevo (pip/npm) en un proyecto nuevo:** verificá que el paquete del registry (PyPI/npm) pertenece realmente al mismo autor/repo de GitHub que estás investigando. Buscá el proyecto en https://pypi.org/project/<nombre>/ o https://www.npmjs.com/package/<nombre> y confirmá que el campo "Homepage"/"Repository" apunta al repo real. Esto evita typosquatting/supply-chain attacks. No asumas que "nombre del paquete = nombre del repo".

---

## 1. RTK (rtk-ai/rtk) — proxy de terminal que filtra/comprime salidas de comandos

**Qué hace:** intercepta comandos de Bash (git, tests, builds, etc.) vía un hook `PreToolUse` y reescribe la salida para que llegue comprimida al modelo. Reduce 60-90% del consumo de tokens en salidas de terminal ruidosas.

**Alcance:** modifica el hook GLOBAL de Claude Code (`~/.claude/settings.json`) — afecta a TODOS los proyectos en la máquina, no solo al actual. Se instala una sola vez por máquina, no por proyecto.

### Instalación (Windows)

```bash
# 1. Verificar la última release y el asset de Windows
curl -s "https://api.github.com/repos/rtk-ai/rtk/releases/latest"
# buscar el asset "rtk-x86_64-pc-windows-msvc.zip"

# 2. Descargar y extraer
mkdir -p "$HOME/.local/rtk"
curl -sL "https://github.com/rtk-ai/rtk/releases/download/<VERSION>/rtk-x86_64-pc-windows-msvc.zip" -o "$HOME/.local/rtk/rtk.zip"
cd "$HOME/.local/rtk" && unzip -o rtk.zip

# 3. Mover el binario a un directorio que ya esté en PATH
mv "$HOME/.local/rtk/rtk.exe" "$HOME/.local/bin/rtk.exe"
rm -rf "$HOME/.local/rtk"

# 4. Verificar
rtk --version
```

En macOS/Linux es más simple: `brew install rtk` o el curl-script oficial (ver README del repo).

### Registrar el hook global

```bash
rtk init -g
```

Esto imprime el bloque de configuración a pegar en `~/.claude/settings.json`. **En modo no interactivo NO lo aplica solo** — hay que editarlo a mano. Agregar (o mergear si ya existen otros `PreToolUse`) dentro de `hooks.PreToolUse`:

```json
{
  "matcher": "Bash",
  "hooks": [
    { "type": "command", "command": "rtk hook claude" }
  ]
}
```

**Importante:** si `~/.claude/settings.json` ya tiene otros hooks `PreToolUse` (por ejemplo de otro MCP/tool), agregá este objeto al array existente — no sobrescribas el array completo.

### Verificación

```bash
rtk telemetry status   # debe decir "enabled: no" (opt-in, off por defecto)
rtk git status          # prueba directa del wrapping, sin pasar por el hook
```

Reiniciar Claude Code para que el hook tome efecto (los hooks se leen al arrancar la sesión).

---

## 2. Context Mode (mksglu/context-mode) — servidor MCP que aísla salidas masivas

**Qué hace:** en vez de volcar logs/resultados grandes al contexto del modelo, los guarda en SQLite local y manda solo un resumen. También persiste estado de sesión (para recuperación tras compactación de contexto).

**Alcance:** se instala como plugin de Claude Code, scope "user" (global, no por proyecto). 100% local — sin telemetría, sin llamadas de red salientes (excepto `ctx_fetch_and_index`, que bloquea por defecto URLs peligrosas y metadata endpoints de nube).

### Instalación

```bash
claude plugin marketplace add mksglu/context-mode
claude plugin install context-mode@context-mode
```

Verificar: `claude plugin list` debe mostrar `context-mode@context-mode` habilitado.

No requiere configuración manual — la instalación registra automáticamente los hooks (`SessionStart`, `PreToolUse`, `PostToolUse`, `PreCompact`, `UserPromptSubmit`, `Stop`) y las 11 herramientas MCP (`ctx_execute`, `ctx_search`, `ctx_stats`, `ctx_doctor`, etc.).

---

## 3. Code Review Graph (tirth8205/code-review-graph) — grafo de conocimiento del repo

**Qué hace:** parsea el código con Tree-sitter y construye un grafo (nodos = símbolos, edges = relaciones) para que el agente consulte "qué depende de qué" en vez de explorar archivos a ciegas. Reduce hasta 82x el consumo de tokens en revisiones/exploración de código grande.

**Alcance:** se instala por proyecto (corre `code-review-graph install` dentro del repo). El paquete en sí (`pipx install`) es global a la máquina, pero la config (`.mcp.json`, `.claude/settings.json`, `.claude/skills/`, git hooks) es por repo.

### Instalación (usar pipx, NUNCA pip global — ver nota de seguridad abajo)

```bash
# 1. Instalar pipx si no está (herramienta oficial de PyPA, segura)
python -m pip install --user pipx
python -m pipx ensurepath

# 2. Instalar el paquete en un venv aislado (no contamina el Python global del sistema)
python -m pipx install code-review-graph
```

> ⚠️ **Por qué pipx y no `pip install` global:** la primera vez que probamos esto usamos `pip install code-review-graph` a nivel global y rompió la compatibilidad de `starlette`/`fastapi` con otras herramientas Python que ya estaban instaladas en la máquina (downgrade forzado de dependencias compartidas). `pipx` crea un venv propio para cada CLI y evita ese conflicto por completo.

### Configurar para el proyecto actual

Parado en la raíz del repo que querés indexar:

```bash
code-review-graph install --platform claude-code
```

Esto genera, dentro del repo:
- `.mcp.json` — registra el servidor MCP (`uvx code-review-graph serve`)
- `.claude/settings.json` (del proyecto) — hooks `PostToolUse`/`SessionStart` que mantienen el grafo actualizado (todos con `|| true`, nunca bloquean nada)
- `.claude/skills/` — 4 skills nuevas: `debug-issue`, `explore-codebase`, `refactor-safely`, `review-changes`
- `.git/hooks/pre-commit` — actualiza el grafo antes de cada commit (no bloqueante)
- Agrega `.code-review-graph/` al `.gitignore`

Cuando pregunte `Inject graph instructions into CLAUDE.md? [Y/n]` — decidir según el proyecto (inyecta instrucciones de uso del grafo directo en el CLAUDE.md).

### Construir el índice

```bash
code-review-graph build
```

### Decisión pendiente por proyecto: ¿commitear la config?

`.mcp.json`, `.claude/settings.json` y `.claude/skills/` quedan **sin trackear en git** tras la instalación. Decidir conscientemente:
- **Commitear** → todo el equipo que clone el repo obtiene el MCP server y las skills automáticamente.
- **Gitignorar** → queda como preferencia personal, no se impone al equipo.

No asumir ninguna de las dos; preguntar o decidir explícitamente por proyecto.

### Verificación

```bash
code-review-graph --version
```

Reiniciar Claude Code para que el servidor MCP quede activo (aparece en las herramientas disponibles vía `search_graph`, `trace_path`, `get_code_snippet`, `query_graph`).

---

## 4. Herramientas evaluadas y descartadas

| Herramienta | Motivo |
|---|---|
| **Claude Cost Optimizer** (Sagargupta16/claude-cost-optimizer) | Su `.claude-plugin/marketplace.json` no cumple el schema actual de Claude Code (falta el campo `owner`). `claude plugin marketplace add` falla con error de validación. Bug del repo, no arreglable de nuestro lado sin parchear un manifest de terceros a mano. Revisar si el mantenedor lo corrige antes de reintentar. |
| **Token Savior** (Mibayy/token-savior, paquete PyPI `token-savior-recall`) | Redundante con Code Review Graph — ambas son MCP servers de "navegación estructural de código + revelación en capas" para el mismo problema. No tiene sentido correr las dos a la vez. Si se prefiere Token Savior sobre Code Review Graph: `python -m pipx install "token-savior-recall[mcp]"` seguido de `claude mcp add token-savior -- token-savior` (autoría PyPI↔GitHub verificada, es seguro instalarlo). |

---

## 5. Checklist rápido para replicar en un proyecto nuevo

```bash
# --- Una sola vez por máquina ---
# RTK
curl -s "https://api.github.com/repos/rtk-ai/rtk/releases/latest"   # ver última version/asset
mkdir -p "$HOME/.local/rtk" && curl -sL "<url-del-asset-windows>" -o "$HOME/.local/rtk/rtk.zip"
cd "$HOME/.local/rtk" && unzip -o rtk.zip && mv rtk.exe "$HOME/.local/bin/rtk.exe" && cd - && rm -rf "$HOME/.local/rtk"
rtk init -g   # y pegar el hook a mano en ~/.claude/settings.json (mergeando con hooks existentes)

# Context Mode
claude plugin marketplace add mksglu/context-mode
claude plugin install context-mode@context-mode

# pipx (si no está)
python -m pip install --user pipx && python -m pipx ensurepath

# --- Por cada proyecto nuevo ---
python -m pipx install code-review-graph   # (si no está ya instalado en la máquina, se omite)
cd /ruta/al/proyecto
code-review-graph install --platform claude-code
code-review-graph build

# Reiniciar Claude Code al terminar
```

## 6. Notas de seguridad aprendidas

1. **Nunca asumir que nombre de paquete PyPI/npm == nombre de repo de GitHub.** Verificar en la página del paquete que "Homepage"/"Repository" apunte al repo real antes de instalar.
2. **Usar `pipx` para CLIs de Python, nunca `pip install` global** — evita romper dependencias compartidas de otras herramientas (nos pasó con `starlette`/`fastapi`/`chromadb`).
3. **Revisar qué archivos crea/modifica un instalador antes de dejarlos así** (`git status` después de correr cualquier `install`), especialmente hooks de git y hooks de Claude Code — aunque en este caso todos resultaron benignos (`|| true`, nunca bloqueantes).
4. **Los star counts y READMEs de GitHub se pueden verificar con `curl` directo** (grep del `aria-label="N users starred"` en el HTML) en vez de confiar ciegamente en resúmenes de herramientas de fetch automatizadas.
