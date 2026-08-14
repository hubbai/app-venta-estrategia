# app-venta-estrategia

Las dos cosas que HUBB Full Service le enseña a una marca, en una sola app con
login para el equipo:

1. **Llamada de venta** — análisis de paid media y de orgánico, en 3 slides que
   se proyectan en vivo durante la llamada.
2. **Estrategia** — la propuesta completa que se manda cuando la marca ya pagó.

Los links que se comparten siguen siendo `https://fs.hubb.mx/r/{slug}`, pero los
sirve esta app: al darle **Publicar**, el link vive de inmediato. No hay que
commitear HTML ni esperar el build de `full_service` como antes.

Es independiente de hubb: su propia base de datos, su propio Blob y su propio
deploy. Lo único que le pide a hubb son los creadores para el portafolio de la
estrategia, por un endpoint de solo lectura.

## Arrancar en local

```bash
npm install
cp .env.example .env.local     # y llena los valores
npm run migrate                # crea las tablas
npm run seed:user -- hola@hubb.mx 'tuContraseña' 'Marcelo Garza' admin
npm run dev                    # http://localhost:3000
```

Con el usuario admin puedes dar de alta al resto del equipo desde `/equipo`.

```bash
npm run db:check    # corre la migración y un round-trip contra Postgres en WASM
```

`db:check` no necesita Docker ni una base instalada: levanta un Postgres real
(PGlite) en memoria, aplica las migraciones y verifica el esquema, el jsonb, la
transacción de publicar y los borrados en cascada. Repite las operaciones
sensibles al protocolo con los prepared statements apagados, que es como corre
en el pooler de Supabase. Vale la pena correrlo después de tocar `migrations/`
o `lib/projects.ts`.

## Sobre la conexión a Supabase

La app usa el driver `postgres` directo, no el SDK de Supabase: la base es solo
Postgres y así el proyecto no depende de nada de hubb más que del endpoint de
creadores.

Un detalle que muerde: el **transaction pooler** de Supabase (puerto `6543`) no
soporta prepared statements, y `postgres.js` los usa por default. El síntoma es
un `prepared statement "s1" does not exist` intermitente, que aparece bajo carga
y no en la primera prueba. [lib/pg-options.mjs](lib/pg-options.mjs) detecta el
puerto y los apaga solo; también respeta `?pgbouncer=true`.

| Connection string | Cuándo | Prepared statements |
|---|---|---|
| Transaction pooler `:6543` | **Vercel** (serverless) | apagados, automático |
| Session pooler `:5432` | scripts largos, migraciones | encendidos |
| Directa `db.<ref>.supabase.co` | solo desde tu máquina (es IPv6) | encendidos |

## Variables

| Variable | Para qué | ¿Obligatoria? |
|---|---|---|
| `DATABASE_URL` | Postgres de Supabase. Todo se guarda aquí. | **Sí** |
| `AUTH_SECRET` | Firma la cookie de sesión. `openssl rand -base64 48` | **Sí** |
| `BLOB_READ_WRITE_TOKEN` | Creativos, miniaturas, screenshots y el doc de Henry | Sí para imágenes |
| `ANTHROPIC_API_KEY` | Copy del pitch y lectura del documento de estrategia | Recomendada |
| `SCRAPECREATORS_API_KEY` | Ad Library, perfiles de IG/TikTok y buscador de TikTok | Recomendada |
| `HUBB_API_URL` / `HUBB_API_TOKEN` | Buscador de creadores en hubb | Solo estrategias |
| `PUBLIC_API_TOKEN` | Protege `/api/public/*`. Debe coincidir con `PITCH_APP_TOKEN` en `full_service` | Recomendada |
| `NEXT_PUBLIC_SITE_BASE` | Dominio de los links públicos (default `https://fs.hubb.mx`) | No |

Sin `ANTHROPIC_API_KEY` el pitch usa un generador determinista (mismo formato,
copy más plano) y la estrategia no se puede parsear. Sin
`SCRAPECREATORS_API_KEY` todo el research se captura a mano.

## Flujo: llamada de venta

1. `/venta/nueva` — pegas la página web y **Llenar solo**: de ahí salen la marca
   y qué venden. Los handles se proponen solo si se pudieron verificar contra la
   cuenta real; si no, los pones tú y el formulario te dice por qué.
2. La app corre el research sola contra ScrapeCreators:
   - **Ad Library**: resuelve el `page_id` del anunciante y trae sus anuncios
     activos con copy, fecha de arranque, creativo y si es video o imagen.
   - **Instagram** y **TikTok**: seguidores, bio, foto y los mejores videos con
     sus views.
   - **Buscador de TikTok**: qué sale cuando alguien busca la marca. De ahí se
     separan los videos de creadores externos de los de la marca —y se descartan
     las cuentas secundarias de la propia marca, porque la slide 3 afirma que
     ese contenido lo subió gente de fuera y sería falso decirlo frente al
     cliente.

   **El término de búsqueda es la decisión más importante de todo el research.**
   Nadie busca el nombre pelón: quien oyó de la marca escribe el nombre *más*
   lo que vende. La diferencia no es sutil:

   | `acapella` | `acapella ropa` |
   |---|---|
   | @germangents · 24M · barbershop quartet | **@acapellaco** · 23.4M · la marca |
   | @ynehya · 16.6M · covers | **@acapellaco** · 11.7M |

   Por eso la primera búsqueda no usa el nombre solo: `sugerirConsulta()` arma
   el término con la marca y su categoría, y sabe cuándo NO agregar nada
   (*Telcel* y *Nuvaskin* son inconfundibles; *Apple* se vuelve "apple iphone").
   Queda editable en el editor, y si aun así la mayoría de los resultados no
   hablan de la marca, la app te lo dice al terminar en vez de dejarte publicar
   una slide llena de contenido ajeno.

   Cuando un bloque falla, el editor dice por qué; casi siempre es un handle mal
   escrito, y ScrapeCreators responde eso con un **200**, no con un 404.
3. Revisas y corriges todo en el editor. Cada bloque dice si se trajo solo, si
   falló o si lo pusiste a mano. Si algo no se pudo, subes la captura.
4. **Escribir copy** — Claude arma los textos de las 3 slides respetando los
   límites de caracteres y las notas de estilo del equipo. Los puedes editar.
5. **Publicar** — el HTML se congela y `fs.hubb.mx/r/{slug}` ya sirve.

Las 3 slides, en el orden en que se proyectan:

1. **Cuando te buscan en TikTok** — la parrilla de resultados y tres respuestas:
   ¿sale la marca y en qué lugar?, ¿cuántos resultados son de la competencia?,
   ¿cuántos son de creadores? Abre la llamada porque es lo único del deck que la
   marca no controla: es lo que ve un comprador suyo.
2. **Presencia en Ads** — lo que está corriendo hoy + 3 ideas de script del mes 1.
3. **Presencia orgánica** — perfiles, creador externo vs. marca y el cierre.

Los números de la slide 1 los calcula el render con los datos, no Claude: son
afirmaciones que se dicen en voz alta frente al cliente y no pueden depender de
que el modelo cuente bien. Claude solo escribe la línea de abajo.

### Por qué los handles no se adivinan

El alta pedía cinco campos y cuatro había que ir a buscarlos. Dos salen de la
propia página con buena confianza; los handles casi nunca. Se midió antes de
decidirlo, con marcas reales:

| Camino | Resultado |
|---|---|
| Links sociales en el HTML | aparecen en ~1 de cada 5 sitios; el resto los pinta JavaScript |
| Ad Library por nombre | devuelve homónimos ("Resilient Retail Club", "Resilient Volleyball Club") |
| Buscador de cuentas de TikTok | 30 resultados globales; una marca de 138 seguidores no aparece |

Cuando la web no alcanza —`telcel.com` contesta 403 detrás de Akamai,
`kredi.mx` carga pero no trae descripción— se va a la **Ad Library**: ahí la
marca publica su nombre, su giro, su Instagram y los anuncios que trae
corriendo, que dicen qué vende mejor que cualquier meta tag. De paso queda
identificado el anunciante, así que el research se salta el desambiguador.

Ese match es por **palabra completa, nunca por prefijo**: `kredi` contra
`KreditBee` (una app de préstamos de India) empieza igual, y así una búsqueda de
Kredi México devolvió el Instagram de otra empresa. Con palabra completa
`Kredi México` sigue coincidiendo y `KreditBee` ya no.

El patrón: las marcas que nos interesan son chicas y usan abreviaturas
—RESILIENT es `@rslnt_mx` y `@resilient_tm`— que es justo lo que ningún buscador
por nombre encuentra. Así que un handle solo se propone si se **verificó** que
la cuenta existe y que es de esa marca (Claude compara nombre, bio y giro contra
lo que sabemos). Si no hay certeza, el campo se queda vacío y el formulario
explica por qué: prellenar el handle equivocado es peor que dejarlo en blanco,
porque el research se va callado por la cuenta de alguien más y el error sale
hasta la llamada.

### De quién es cada resultado

Un resultado del buscador es de la **marca**, de la **competencia** o de un
**creador**, y la slide afirma cosas sobre eso. Se decide con reglas explícitas
(`lib/venta/owner.ts`) y se puede corregir a mano en el editor:

- **Marca** — el handle coincide con la cuenta configurada, o contiene el nombre
  de la marca normalizado. Esto último es lo que atrapa las cuentas secundarias:
  RESILIENT es `@rslnt_mx` en TikTok, pero también publica desde
  `@resilientclub1`, y sin esa regla su propio video se presentaba como prueba de
  que "gente de fuera habla de la marca".
- **Competencia** — coincide con la lista que escribes en el editor. No se
  adivina: otra marca y un creador son lo mismo vistos desde fuera.
- **Creador** — todo lo demás.
- **Sin relación** — el video no habla de la marca: solo comparte la palabra.
  Buscar "Apple" devuelve manzanas animadas; "Resilient", videos de motivación.
  Esto no lo puede decidir una regla de texto, así que lo juzga Claude
  ([lib/venta/relevancia.ts](lib/venta/relevancia.ts)).

Marcas de menos de 5 letras no aplican la regla de "contiene": daría falsos
positivos por todos lados.

Claude solo puede **bajar** un resultado de "creador" a "sin relación", nunca
tocar lo que las reglas marcaron como marca o competencia. Así el peor caso de
un modelo equivocado es un creador de menos en la cuenta, y nunca una cuenta de
la marca presentada como creador externo. Ante la duda deja pasar el video.

El ruido **no se esconde: se etiqueta y se apaga**. Que el buscador de tu marca
esté lleno de contenido ajeno *es* el hallazgo —tu nombre ahí todavía no es
tuyo—, y contarlo como "creadores hablando de ti" sería mentir en la llamada.
Cuando la mayoría de los resultados son ruido, el copy cambia de ángulo solo.

## Flujo: estrategia

1. `/estrategia/nueva` — solo la marca.
2. Subes el documento de Henry en **PDF** (o pegas el texto). Si es un Word o
   un Google Doc, expórtalo a PDF: se parsea mucho mejor.
3. Claude lo convierte en las secciones de la propuesta: contexto de marca,
   escenarios, entregables lado a lado, función de cada contenido, los pasos del
   servicio, líneas creativas y comparativa. **No inventa cifras**: lo que no
   esté en el documento, se omite.
4. Editas lo que haga falta y eliges los creadores del portafolio buscándolos en
   hubb. Lo que eliges se congela: si el creador cambia allá, la propuesta que
   ya mandaste no se altera.
5. **Publicar**.

Volver a leer el documento reescribe las secciones pero conserva los creadores.

## Cómo llegan los links a fs.hubb.mx

`full_service/app/r/[slug]/route.ts` consulta primero
`{PITCH_APP_URL}/api/public/{slug}` (ver `full_service/lib/pitch-app.ts`). Si
esta app no responde o no está configurada, `/r` cae a sus fuentes de siempre
—los audits de Supabase y los decks ya commiteados—, así que el puente no puede
tumbar los links viejos.

El índice `/r` de `full_service` suma lo publicado aquí vía
`/api/public/index`.

## El endpoint de creadores en hubb

`GET https://www.hubb.mx/api/external/creators`, que hubb ya tenía para
integraciones. Auth por `Authorization: Bearer ${HUBB_API_TOKEN}`, donde el
token es una fila de `integration_tokens` con scope `creators.read` y nada más
—revocable y auditada desde hubb, sin secreto global compartido—. Solo lectura,
solo creadores aprobados y no suspendidos, y solo campos de vitrina: nada de
correo ni teléfono ni datos de pago.

Tres detalles que muerden:

- **El `www` no es opcional.** `hubb.mx` redirige (307) al `www` y, como es otro
  origen, el redirect descarta el `Authorization`. Un token válido daría 401.
  `hubbBase()` reescribe el apex solo, por si alguien lo configura sin `www`.
- **El país lo pone el token**, no la query: el endpoint filtra por el país del
  workspace dueño del token (México), así que el catálogo ya llega acotado.
- **El orden es aleatorio con semilla.** Para paginar hay que reenviar la misma
  `seed` con el `offset`, o "Cargar más" repetiría creadores. `limit` topa en 50.

De la fila que devuelve, `creator_categories[].category.name` son las categorías
buenas —la columna suelta `categories` casi siempre viene null— y los handles a
veces llegan como URL completa. [lib/hubb.ts](lib/hubb.ts) normaliza las dos cosas.

## Estructura

```
app/
  login/  equipo/            sesión y alta del equipo
  venta/                     índice, alta y editor de la llamada
  estrategia/                índice, alta y editor de la propuesta
  api/public/                lo único abierto: lo que consume fs.hubb.mx
lib/
  scrape/                    cliente de ScrapeCreators y normalización
  venta/                     tipos, copy con Claude, render de las 3 slides
  estrategia/                tipos, parse del documento, render de la propuesta
  hubb.ts                    buscador de creadores
migrations/                  SQL, se aplican con npm run migrate
```

## Notas de estilo

`/ajustes/estilo`. Son las correcciones del equipo sobre cómo debe sonar el
copy, y pesan **más** que las reglas base del prompt: se pegan al final del
system prompt y ganan si contradicen algo anterior. Es lo mismo que hacía el
`style-notes.md` de `research-pitch`, pero en DB y editable por cualquiera.

Aplican desde la siguiente generación; no reescriben lo ya publicado.
