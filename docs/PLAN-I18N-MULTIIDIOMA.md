# Plan — Multiidioma (i18n) de Doogking

> Estado: **plataforma completa traducida** a 8 idiomas (2.146 cadenas × 7 lenguas
> de destino). Fecha: 2026-09-02.

---

## 1. Análisis: idiomas de la Unión Europea

La UE tiene **24 lenguas oficiales**. Traducir a las 24 no es un objetivo de
producto: la mitad cubren menos del 1% de la población cada una. Lo que decide
el alcance es **cuánta gente de la UE puede usar la plataforma en su idioma**.

Población de la UE que habla cada lengua (nativo + segunda lengua,
Eurobarómetro "Europeans and their languages", sobre ~449 M de habitantes):

| # | Idioma | Código | Nativos UE | Total hablantes UE | Notas |
|---|---|---|---|---|---|
| 1 | Inglés | `en` | ~1% | **~44–47%** | Lingua franca; imprescindible aunque UK ya no esté |
| 2 | Alemán | `de` | **~18%** | ~32–36% | Más nativos de la UE (DE + AT + parte de BE/LU) |
| 3 | Francés | `fr` | ~12% | ~26–30% | FR + BE + LU |
| 4 | Italiano | `it` | ~12% | ~16–18% | Mercado activo de Doogking |
| 5 | Español | `es` | ~8% | ~15–17% | **Idioma fuente del producto** |
| 6 | Polaco | `pl` | ~8% | ~9% | Mayor mercado de Europa central |
| 7 | Neerlandés | `nl` | ~4% | ~5–6% | NL + Flandes; altísima renta por mascota |
| 8 | Portugués | `pt` | ~2% | ~3% | Mercado activo de Doogking (PT) |
| — | Rumano, griego, checo, húngaro, sueco… | | <3% c/u | <4% c/u | Fuera de alcance por ahora |

**Decisión: 8 idiomas** → `es`, `en`, `de`, `fr`, `it`, `pt`, `pl`, `nl`. Son las
ocho lenguas más habladas de la UE: con ellas ~90% de la población europea puede
usar Doogking en un idioma que domina, y quedan cubiertos al 100% los países de
`PAISES_SOPORTADOS` (ES, PT, FR, IT, DE) más el inglés como respaldo del resto
del EEE.

Añadir un idioma nuevo = **añadir siete ficheros de diccionario**. Ni el motor ni
ningún componente cambian. Ver §6.

---

## 2. La decisión de fondo: la clave es el texto español

Con **más de dos mil cadenas** en la plataforma, inventar y mantener un
identificador semántico para cada una (`panel.comercio.tituloListados`) costaba
más que traducirlas, y cualquier renombrado dejaba la pantalla escribiendo la
clave. Así que la clave **es el propio texto en español**:

```html
{{ 'Mis reservas' | t }}
```

Lo que esto compra:

- La plantilla se sigue leyendo en castellano; nadie tiene que buscar qué dice
  `panel.comercio.tituloListados`.
- La extracción es mecánica, así que se pudo automatizar sobre las 112 pantallas
  en lugar de bautizar 2.000 claves a mano.
- **El español no necesita diccionario**: es el idioma fuente y el respaldo. Eso
  quita un octavo del trabajo y, sobre todo, impide que el texto del diccionario
  y el de la plantilla se separen con el tiempo.
- **Lo que no esté traducido sale en español**, nunca como una clave rota.

El coste conocido: al reescribir un texto español hay que actualizar la clave en
los siete diccionarios. El spec de `traducciones/diccionarios.spec.ts` avisa,
porque exige que los siete cubran exactamente el mismo conjunto de cadenas.

### Por qué no `@angular/localize`

Había una configuración de `@angular/localize` con **9 cadenas marcadas** y un
build `:en` que nunca se desplegó. Es i18n **en tiempo de compilación**: un
bundle por idioma, 8 builds, routing por prefijo en nginx y una recarga completa
de página en cada cambio de idioma — perdiendo el estado del wizard de reserva,
del carrito y de los filtros.

Se sustituyó por i18n **en tiempo de ejecución**. `@angular/localize` sigue
instalado (lo necesitan el polyfill de arranque y `setup-jest`) y `build:en`
sigue terminando en verde, pero `src/locale/*.xlf` y la configuración `en` de
`angular.json` quedan como restos sin uso: se pueden retirar en una limpieza
aparte.

---

## 3. Arquitectura

Motor propio, ~130 líneas. **Cero dependencias nuevas** (`ngx-translate` y
`transloco` traen APIs RxJS-first y módulos que chocan con la regla del proyecto
de signals + standalone).

```
libs/shared/src/catalogos/idiomas.ts     IDIOMAS_SOPORTADOS, IdiomaSoportado, normalizarIdioma
apps/web/src/app/core/i18n/
├── diccionario.ts                       type Diccionario = Record<string,string>
├── i18n.service.ts                      signal idioma() + t() + persistencia + <html lang>
├── traducir.pipe.ts                     el pipe `| t`
├── index.ts                             barrel
└── traducciones/
    ├── {en,de,fr,it,pt,pl,nl}.ts        fusionan sus bloques
    └── {en,de,fr,it,pt,pl,nl}/
        ├── comun.ts        componentes compartidos, navegación y cabecera
        ├── publico.ts      portada, categorías, fichas y comunidad
        ├── cuenta.ts       alta, acceso, perfil y mascotas
        ├── reservas.ts     flujo de reserva, carrito, pago y seguimiento
        ├── comercio.ts     backoffice del comercio
        ├── admin.ts        backoffice de la plataforma
        └── legal.ts        textos legales
apps/web/src/app/core/interceptors/idioma.interceptor.ts   cabecera Accept-Language
apps/web/src/app/shared/components/region/rs-region-selector.component.ts  selector
```

Un fichero por bloque y por idioma para que cada uno se pueda revisar entero de
una sentada: 650 cadenas de backoffice y 139 de textos legales no se revisan
igual, y no tienen por qué vivir en el mismo sitio.

### 3.1 Reactividad (por qué funciona el cambio en caliente)

`I18nService.t()` **lee la signal `idioma()`**. Como el `TraducirPipe` es impuro
(`pure: false`), su `transform` se ejecuta dentro del contexto reactivo de la
plantilla: cualquier componente que traduzca queda suscrito a la signal y Angular
lo marca sucio al cambiar de idioma, **incluso con `OnPush`**. No hace falta
`ChangeDetectorRef`, ni recargar la página, ni un `BehaviorSubject`.

El pipe es impuro a propósito: uno puro cachea por identidad del argumento y
devolvería la traducción anterior, porque el texto de entrada no ha cambiado.

### 3.2 Carga de diccionarios

Los siete idiomas de destino son `import()` dinámicos: un chunk por idioma de
~160 kB en crudo (~35 kB transferidos), y sólo se descarga el que el usuario usa.
El bundle inicial **no lleva ningún diccionario** — el español es el texto que ya
está en las plantillas.

Al arrancar, `provideAppInitializer` espera a que cargue el idioma guardado para
que no haya un fogonazo de español antes del alemán. Si la descarga falla, **el
arranque continúa en español**: nunca bloquea la aplicación.

### 3.3 Interpolación

`t('Nivel {nivel}', { nivel: 'ALPHA II' })`. En plantilla:
`{{ 'Nivel {nivel}' | t: { nivel: n } }}`. El spec comprueba que ninguna
traducción pierda una marca por el camino.

### 3.4 Persistencia y detección

1. `localStorage['doogking_idioma']` si el usuario ya eligió.
2. Si no, `navigator.language` recortado a 2 letras, si está soportado.
3. Si no, `es`.

Mismo patrón que `MonedaService`, así que funciona igual en web y en Capacitor.

### 3.5 Backend

El `idiomaInterceptor` añade `Accept-Language: <idioma>` a todas las llamadas al
API. Hoy el backend lo ignora; el día que se traduzcan correos y mensajes de
error el dato ya viaja y no hay que tocar el frontend.

---

## 4. La cabecera: sólo idioma y moneda

`rs-region-selector` tenía tres controles. **Se retiró el de país**: enseñaba una
segunda bandera pegada a la del idioma y no filtraba nada — ningún componente
leía `moneda.pais()`. Con él fuera se quitaron también `pais` y `elegirPais` de
`MonedaService`, que ya no los usaba nadie. La región efectiva la fija el
buscador con la ciudad que escribe el usuario.

Quedan dos: **idioma** (🌐 ES) y **moneda** (€ EUR). El idioma va primero porque
es el único de los dos que reescribe la página.

---

## 5. Cobertura

Cadenas extraídas y traducidas, por bloque:

| Bloque | Cadenas | Traducidas | Sin traducir |
|---|---:|---:|---:|
| `comun` | 103 | 99 | 4 |
| `publico` | 318 | 314 | 4 |
| `cuenta` | 262 | 260 | 2 |
| `reservas` | 329 | 329 | 0 |
| `comercio` | 650 | 643 | 7 |
| `admin` | 378 | 366 | 12 |
| `legal` | 139 | 135 | 4 |
| **Total** | **2.179** | **2.146 (98,5%)** | **33** |

Las 33 sin traducir son texto que **no debe traducirse**: marcas (`Stripe`,
`Google Play`, `Doogking`), formatos de ejemplo (`ES00 0000 0000…`, `B12345678`,
`28013`), variables de entorno (`FCM_PROJECT_ID`) y nombres propios de negocios
de muestra (`Royal Dog Resort`). Se quedan tal cual a propósito.

Aviso sobre `legal`: la traducción de los textos legales es **orientativa**. La
versión vinculante es la española, y una revisión jurídica por jurisdicción es
trabajo aparte.

---

## 6. Cómo añadir un idioma nuevo

1. Añadir la entrada a `IDIOMAS_SOPORTADOS` en `libs/shared/src/catalogos/idiomas.ts`.
2. Crear `apps/web/src/app/core/i18n/traducciones/<codigo>/` con los siete
   bloques, copiando los de otro idioma y traduciendo los valores.
3. Crear `traducciones/<codigo>.ts` que los fusione (copiar el de otro idioma).
4. Añadir la línea al mapa `CARGADORES` de `i18n.service.ts`.

Ningún componente cambia.

## 7. Cómo traducir una pantalla nueva

En la plantilla se escribe el español y se pasa por el pipe:

```html
<h2>{{ 'Reservas de hoy' | t }}</h2>
<input [placeholder]="'Buscar por cliente…' | t" />
<a [attr.aria-label]="'Cerrar el panel' | t">…</a>
```

Luego se añade esa misma cadena como clave en el bloque que le corresponda de
cada idioma. Si se olvida, la pantalla sigue funcionando: sale en español.

Reglas del pipe:

- Interpolación mixta (`Hola {{ nombre }}`) no se envuelve entera: se parte, o se
  usa una marca (`'Hola {nombre}' | t: { nombre }`).
- Los atributos visibles se enlazan: `[placeholder]`, `[title]`, `[alt]`,
  `[attr.aria-label]`.
- Nombres propios, marcas y códigos no se traducen.

---

## 8. Garantías de no-impacto

| Riesgo | Cómo se neutraliza |
|---|---|
| Texto sin traducir | La clave **es** el español: cae al original, jamás a una clave rota |
| Fallo de red al cargar un idioma | `catch` → se queda en español y el usuario puede reintentar |
| Un idioma se queda atrás al añadir texto | `diccionarios.spec.ts` exige que los siete cubran el mismo conjunto |
| Marcas de interpolación perdidas | El mismo spec las compara una a una |
| Traducir datos del usuario | El pase automático de `| t` se limitó a nombres de campo de configuración (`titular`, `claim`, `labelUbicacion`…). `.nombre` quedó fuera: a un perro se le puede llamar "Fecha" |
| Peso del bundle inicial | Ningún diccionario es eager. El inicial **bajó** de 707 a 694 kB al quitar el español |
| Parpadeo al arrancar | `provideAppInitializer` espera al diccionario, con `catch` para no bloquear nunca |
| Dependencias nuevas | Ninguna |
| `@angular/localize` | Sigue instalado y `build:en` sigue en verde |
| `LOCALE_ID` / fechas | **No se toca** (ver ola pendiente). `euros.pipe` y los `toLocaleDateString('es-ES')` quedan como estaban |
| Regresiones | Suite completa: 21 fallos antes y 21 después, exactamente los mismos |

---

## 9. Lo que queda pendiente

| # | Pendiente | Por qué |
|---|---|---|
| 1 | Interpolaciones mixtas (`Total: {{ n }} €`) | El pase automático las saltó por seguridad. Son pocas y se traducen a mano con marcas `{n}` |
| 2 | Mensajes de error y toasts en TS | Viven en `.set('…')` dentro de los servicios, no en plantillas. Se traducen con `i18n.t()` |
| 3 | `LOCALE_ID` dinámico + `registerLocaleData` | Para que fechas y números sigan al idioma. Exige revisar los `toLocaleDateString('es-ES')` repartidos por el código |
| 4 | Backend: `Accept-Language` en correos y errores del API | La cabecera ya viaja; falta el lado servidor |
| 5 | Revisión jurídica de `legal.*` por jurisdicción | La traducción actual es orientativa |
| 6 | Retirar `src/locale/*.xlf` y la configuración `en` de `angular.json` | Restos del camino anterior, ya sin uso |

---

## 10. Verificación

```bash
bun run build:shared
bun run --cwd apps/web test
bun run build:web
```
