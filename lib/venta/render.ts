/* render.ts — El entregable: 3 slides 16:9 auto-escaladas.

   Portado de research-pitch/src/deck-html.js. El HTML es autocontenido (salvo
   la fuente de Google) porque se sirve tal cual desde fs.hubb.mx/r/{slug} sin
   pasar por React.

   1 · Buscador   — qué sale al buscar la marca en TikTok. ABRE la llamada.
   2 · Paid Media — anuncios corriendo + 3 ideas de script del mes 1
   3 · Orgánico   — perfiles de IG/TikTok + creador vs. marca + cierre

   El buscador va primero a propósito: antes de hablar de pauta o de seguidores,
   el cliente ve lo que un comprador suyo ve al buscarlo, que es lo único de
   todo el deck que él no controla. */
import { C, esc, escUrl, FONT_LINK } from "../theme";
import { veredictos, type Veredictos } from "./owner";
import type { Ad, Clip, Deck, Owner, Profile, Research } from "./types";

const TITLES = {
  buscador: `Cuando te buscan en <span class="gold">TikTok</span>`,
  ads: `Presencia en <span class="gold">Ads</span>`,
  organico: `Presencia <span class="gold">orgánica</span>`,
};

const OWNER_LABEL: Record<Owner, string> = {
  marca: "Marca",
  competencia: "Competencia",
  creador: "Creador",
  otro: "Sin relación",
};

function adCard(ad: Ad): string {
  const tag = ad.isVideo ? `Video${ad.duration ? " · " + esc(ad.duration) : ""}` : "Imagen";
  const badge = `<span class="tag ${ad.isVideo ? "vid" : ""}">${tag}</span>`;
  const img = ad.image
    ? `<div class="shot" style="background-image:url('${escUrl(ad.image)}')">${badge}</div>`
    : `<div class="shot empty">${badge}Sin creativo</div>`;
  return `<article class="ad">${img}<p class="hook">${esc(ad.text)}</p>${
    ad.started ? `<span class="since">Desde ${esc(ad.started)}</span>` : ""
  }</article>`;
}

/* Tarjeta de perfil: reemplaza el screenshot del perfil de IG/TikTok con los
   datos reales, que además no se despintan ni salen borrosos al proyectar. */
function profileCard(p: Profile | undefined, network: "Instagram" | "TikTok"): string {
  if (!p) {
    return `<article class="prof empty"><div class="pnet">${network}</div><p class="pnone">Sin cuenta detectada</p></article>`;
  }
  if (p.screenshot) {
    return `<article class="prof shotonly"><div class="pnet">${network}</div>
      <div class="pshot" style="background-image:url('${escUrl(p.screenshot)}')"></div></article>`;
  }
  return `<article class="prof">
      <div class="pnet">${network}</div>
      <div class="phead">
        ${p.avatar ? `<div class="pav" style="background-image:url('${escUrl(p.avatar)}')"></div>` : `<div class="pav"></div>`}
        <div class="pid">
          <div class="pname">${esc(p.name || p.handle || "")}${p.verified ? ' <span class="ver">✓</span>' : ""}</div>
          <div class="phandle">@${esc(p.handle || "")}</div>
        </div>
      </div>
      <div class="pstats">
        <div><b>${esc(p.followers || "—")}</b><span>seguidores</span></div>
        <div><b>${esc(p.posts || "—")}</b><span>publicaciones</span></div>
      </div>
      ${p.bio ? `<p class="pbio">${esc(p.bio)}</p>` : ""}
    </article>`;
}

/* Miniaturas de video con sus views. Es lo que en el research manual eran los
   "mejores 2 videos". */
function clipStrip(list: Clip[] = [], limit = 2): string {
  const shots = list.filter((c) => c.image).slice(0, limit);
  if (!shots.length) return "";
  return `<div class="thumbs">${shots
    .map(
      (t) =>
        `<figure><div class="tb" style="background-image:url('${escUrl(t.image)}')"></div>${
          t.views ? `<figcaption>${esc(t.views)} views</figcaption>` : ""
        }</figure>`
    )
    .join("")}</div>`;
}

/* La parrilla del buscador de TikTok, reconstruida con resultados reales.

   Cada resultado lleva de quién es. Sin esa etiqueta la parrilla son seis
   miniaturas y ya; con ella se ve de un golpe quién está ocupando el espacio,
   que es el argumento entero de la slide. */
function searchGrid(clips: Clip[] = []): string {
  const shots = clips.slice(0, 6);
  if (!shots.length) return "";
  return `<div class="sgrid">${shots
    .map((c, i) => {
      const owner = c.owner ?? "creador";
      return `<figure class="sc ${owner}">
        <div class="stb"${c.image ? ` style="background-image:url('${escUrl(c.image)}')"` : ""}>
          <span class="pos">${i + 1}</span>
          <span class="own">${OWNER_LABEL[owner]}</span>
        </div>
        <figcaption><b>${esc(c.views || "—")}</b><span>@${esc(c.author || "?")}</span></figcaption>
      </figure>`;
    })
    .join("")}</div>`;
}

/* Las tres respuestas de la slide 1.

   El número y el sí/no salen de los datos, no de Claude: son afirmaciones que
   se dicen frente al cliente y no pueden depender de que el modelo cuente
   bien. Claude solo escribe la línea de abajo, la que dice qué significan. */
function veredictoCards(v: Veredictos, copy: Deck["buscador"]["veredictos"]): string {
  const cards: { q: string; big: string; cap: string; line: string; tone: "bad" | "good" | "flat" }[] = [
    {
      q: "¿Sales tú?",
      big: v.posicionMarca ? `#${v.posicionMarca}` : "No",
      cap: v.posicionMarca ? `de ${v.total} resultados` : "no apareces en los resultados",
      line: copy.marca,
      tone: v.posicionMarca ? "good" : "bad",
    },
    {
      q: "¿Sale tu competencia?",
      big: v.totalCompetencia > 0 ? String(v.totalCompetencia) : "No",
      cap: v.totalCompetencia > 0 ? `de ${v.total} son de otras marcas` : "ninguna otra marca aparece",
      line: copy.competencia,
      tone: v.totalCompetencia > 0 ? "bad" : "good",
    },
    {
      q: "¿Hay creadores hablando de ti?",
      big: v.totalCreadores > 0 ? String(v.totalCreadores) : "No",
      cap:
        v.totalCreadores > 0
          ? v.mejorCreador?.views
            ? `de ${v.total}, el mejor con ${esc(v.mejorCreador.views)} views`
            : `de ${v.total} resultados`
          : v.totalOtros > 0
            ? // Distinguir "nadie habla de ti" de "tu nombre trae otra cosa".
              `${v.totalOtros} de ${v.total} ni siquiera son de tu categoría`
            : "todavía ninguno",
      line: copy.creadores,
      tone: v.totalCreadores > 0 ? "good" : "flat",
    },
  ];

  return `<div class="vers">${cards
    .map(
      (c) => `<article class="ver ${c.tone}">
        <div class="vq">${esc(c.q)}</div>
        <div class="vbig">${esc(c.big)}</div>
        <div class="vcap">${c.cap}</div>
        ${c.line ? `<p class="vline">${esc(c.line)}</p>` : ""}
      </article>`
    )
    .join("")}</div>`;
}

export function renderVenta(research: Research, deck: Deck): string {
  const brand = String(research.brand || "").trim();
  const footer = `HUBB · FULL SERVICE &nbsp;&nbsp;//&nbsp;&nbsp; ${esc(brand.toUpperCase())}`;
  const adCount = research.adCount ?? 0;
  const shots = (research.ads || []).slice(0, 4);

  const ideas = (deck.paid.cards || [])
    .map(
      (c, i) => `<article class="idea"><div class="num">${i + 1}</div>
        <div><h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p></div></article>`
    )
    .join("");

  const v = veredictos(research.search?.results);

  const searchLabel = research.search?.query
    ? `Al buscar “${esc(research.search.query)}” en TikTok`
    : "Al buscar la marca en TikTok";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
${FONT_LINK}
<title>${esc(brand)} · Análisis pre-junta · Hubb Full Service</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;background:#${C.ink};font-family:"Bricolage Grotesque",ui-sans-serif,system-ui,-apple-system,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  #stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
  /* flex:none NO es opcional. #stage es flex, así que sin esto el navegador
     encoge #deck para que quepa en pantallas angostas (un iframe de editor, un
     celular). Las slides son absolute con width:1280px, así que se salen de un
     #deck encogido y el escalado las corre de lugar: se ve una franja negra a
     la izquierda y la slide cortada a la derecha. */
  #deck{flex:none;width:1280px;height:720px;transform-origin:center center;position:relative}
  .slide{position:absolute;inset:0;width:1280px;height:720px;background:#${C.cream};color:#${C.ink};
         padding:46px 60px 62px;display:flex;flex-direction:column;opacity:0;pointer-events:none;transition:opacity .28s ease}
  .slide.on{opacity:1;pointer-events:auto}
  .head{flex:none}
  .eyebrow{font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#${C.goldDark}}
  h1{font-size:40px;line-height:1.1;font-weight:700;letter-spacing:-.02em;margin-top:12px}
  .gold{color:#${C.goldDark}}
  .sub{margin-top:12px;font-size:16px;line-height:1.45;color:#${C.gray};max-width:790px}
  .slide.wide .sub{max-width:1030px}
  .body{flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px;margin-top:16px}
  .lbl{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#${C.grayLight};margin-bottom:11px}
  .card{background:#${C.white};border:1px solid #${C.border};border-radius:14px;box-shadow:0 6px 18px rgba(26,26,26,.07)}

  /* Tarjeta-dashboard con el # de anuncios activos */
  .pill-card{position:absolute;top:46px;right:60px;width:246px;background:#${C.white};border:1px solid #${C.border};
             border-radius:14px;padding:14px 16px 12px;box-shadow:0 6px 18px rgba(26,26,26,.08)}
  .pill-card .plbl{font-size:10px;font-weight:700;letter-spacing:.14em;color:#${C.grayLight};text-transform:uppercase}
  .pill-card .big{font-size:44px;font-weight:700;line-height:1;margin-top:8px}
  .pill-card .cap{font-size:12px;color:#${C.gray};margin-top:4px}
  .pill-card .mix{font-size:11.5px;font-weight:600;color:#${C.goldDark};margin-top:7px;padding-top:7px;border-top:1px solid #${C.border}}

  /* Slide 1 · anuncios corriendo */
  .ads{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
  .ad{background:#${C.white};border:1px solid #${C.border};border-radius:14px;overflow:hidden;
      box-shadow:0 6px 18px rgba(26,26,26,.07);display:flex;flex-direction:column}
  .shot{position:relative;height:128px;background-size:cover;background-position:center;background-color:#${C.neutralBg}}
  .tag{position:absolute;left:9px;top:9px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
       padding:4px 9px;border-radius:999px;background:rgba(255,251,242,.92);color:#${C.gray}}
  .tag.vid{background:#${C.goldDark};color:#${C.white}}
  .shot.empty{display:flex;align-items:center;justify-content:center;font-size:11px;color:#${C.grayLight}}
  .ad .hook{font-size:12.5px;line-height:1.35;color:#${C.ink};padding:11px 13px 0;flex:1;
            display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .ad .since{font-size:10.5px;color:#${C.grayLight};padding:8px 13px 11px}

  /* Ideas del mes 1 */
  .ideas{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .idea{background:#${C.white};border:1px solid #${C.border};border-radius:14px;padding:16px 18px;
        box-shadow:0 6px 18px rgba(26,26,26,.07);display:flex;gap:12px}
  .idea .num{width:28px;height:28px;flex:none;border-radius:50%;background:#${C.gold};color:#${C.white};font-size:14px;
       font-weight:700;display:flex;align-items:center;justify-content:center}
  .idea h3{font-size:16px;font-weight:700;line-height:1.2}
  .idea p{font-size:13px;line-height:1.4;color:#${C.gray};margin-top:6px}

  /* Slide 2 · perfiles */
  .profs{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .prof{background:#${C.white};border:1px solid #${C.border};border-radius:14px;padding:16px 18px 18px;
        box-shadow:0 6px 18px rgba(26,26,26,.07)}
  .prof.empty{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;min-height:150px}
  .pnone{font-size:14px;color:#${C.grayLight};margin-top:8px}
  .pnet{font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#${C.grayLight}}
  .phead{display:flex;gap:13px;align-items:center;margin-top:12px}
  .pav{width:52px;height:52px;flex:none;border-radius:50%;background-size:cover;background-position:center;
       background-color:#${C.neutralBg};border:1px solid #${C.border}}
  .pname{font-size:16px;font-weight:700;line-height:1.15}
  .ver{color:#${C.goldDark};font-size:13px}
  .phandle{font-size:12.5px;color:#${C.grayLight};margin-top:2px}
  .pstats{display:flex;gap:26px;margin-top:14px}
  .pstats b{font-size:20px;font-weight:700;display:block;line-height:1}
  .pstats span{font-size:11px;color:#${C.grayLight};text-transform:uppercase;letter-spacing:.08em}
  .pbio{margin-top:12px;font-size:12.5px;line-height:1.4;color:#${C.gray};
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .pshot{margin-top:12px;height:196px;border-radius:10px;background-size:cover;background-position:top center;
         background-color:#${C.neutralBg};border:1px solid #${C.border}}
  .insight{border:1.5px solid #${C.gold};border-radius:14px;background:#${C.white};padding:14px 20px 16px;
           display:flex;gap:18px;align-items:center}
  .insight h4{font-size:17px;font-weight:700;line-height:1.2}
  .insight p{margin-top:6px;font-size:13.5px;line-height:1.45;color:#${C.gray}}

  /* Slide 1 · el buscador */
  .sgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
  .sc .stb{position:relative;height:186px;border-radius:10px;background-size:cover;background-position:center;
           background-color:#${C.neutralBg};border:1px solid #${C.border}}
  .sc .pos{position:absolute;left:7px;top:7px;width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:700;
           display:flex;align-items:center;justify-content:center;background:rgba(26,26,26,.72);color:#${C.cream}}
  .sc .own{position:absolute;left:7px;bottom:7px;font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
           padding:3px 7px;border-radius:999px;background:rgba(255,251,242,.93);color:#${C.gray}}
  /* La marca en dorado, la competencia marcada, el creador en verde: el color
     hace el argumento antes de que alguien lea las etiquetas. */
  .sc.marca .stb{border-color:#${C.gold};box-shadow:0 0 0 2px #${C.gold}}
  .sc.marca .own{background:#${C.goldDark};color:#${C.white}}
  .sc.competencia .own{background:#${C.ink};color:#${C.cream}}
  .sc.creador .own{background:#${C.greenBg};color:#${C.greenText}}
  /* El ruido se apaga: gris y la miniatura al 55%. No se esconde —que el
     buscador de tu marca esté lleno de contenido ajeno ES el hallazgo— pero
     tiene que leerse distinto de un creador hablando de ti. */
  .sc.otro .stb{opacity:.55}
  .sc.otro .own{background:#${C.neutralBg};color:#${C.grayLight}}
  .sc.otro figcaption b,.sc.otro figcaption span{color:#${C.grayLight}}
  .sc figcaption{margin-top:6px;text-align:center}
  .sc figcaption b{display:block;font-size:13px;font-weight:700;color:#${C.ink}}
  .sc figcaption span{display:block;font-size:10.5px;color:#${C.grayLight};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  /* Las tres respuestas */
  .vers{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .ver{background:#${C.white};border:1px solid #${C.border};border-radius:14px;padding:14px 18px 16px;
       box-shadow:0 6px 18px rgba(26,26,26,.07)}
  .ver.good{border-color:#${C.gold};background:#${C.goldLight}}
  .ver.bad{border-color:#${C.ink}}
  .vq{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#${C.grayLight}}
  .vbig{font-size:40px;font-weight:700;line-height:1;margin-top:8px;letter-spacing:-.02em}
  .vcap{font-size:11.5px;color:#${C.gray};margin-top:5px}
  .vline{font-size:13px;line-height:1.4;color:#${C.ink};margin-top:10px;padding-top:10px;border-top:1px solid #${C.border}}

  /* Slide 3 · comparativa */
  .comp{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .cmp{background:#${C.white};border:1px solid #${C.border};border-radius:14px;padding:14px 18px 16px;
       box-shadow:0 6px 18px rgba(26,26,26,.07);display:flex;gap:14px;align-items:flex-start}
  .thumbs{display:flex;gap:8px;flex:none}
  .thumbs figure{width:74px}
  .thumbs .tb{height:100px;border-radius:9px;background-size:cover;background-position:center;
              background-color:#${C.neutralBg};border:1px solid rgba(26,26,26,.08)}
  .thumbs figcaption{margin-top:5px;font-size:10.5px;font-weight:700;color:#${C.ink};text-align:center}
  .cmp.win{background:#${C.goldLight};border-color:#${C.gold}}
  .badge{display:inline-flex;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
         padding:5px 11px;border-radius:999px}
  .badge.good{background:#${C.greenBg};color:#${C.greenText}}
  .badge.neutral{background:#${C.neutralBg};color:#${C.gray}}
  .cmp h3{font-size:16.5px;font-weight:700;margin-top:8px;line-height:1.2}
  .cmp p{font-size:13px;line-height:1.4;color:#${C.gray};margin-top:6px}
  .closing{border:1.5px solid #${C.gold};border-radius:14px;background:#${C.white};padding:13px 20px 15px}
  .closing h4{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#${C.goldDark}}
  .closing p{margin-top:6px;font-size:15px;line-height:1.4;color:#${C.ink}}

  footer{position:absolute;left:60px;bottom:22px;font-size:11px;letter-spacing:.1em;color:#${C.grayLight}}
  nav{position:fixed;bottom:18px;right:22px;display:flex;gap:8px;align-items:center;z-index:5}
  nav button{width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,251,242,.25);background:rgba(255,251,242,.08);
             color:#${C.cream};font-size:15px;cursor:pointer;line-height:1}
  nav button:hover{background:rgba(255,251,242,.2)}
  nav .idx{color:rgba(255,251,242,.6);font-size:12px;letter-spacing:.12em;margin-right:6px}
  @media print{html,body{background:#fff}#deck{transform:none!important}.slide{opacity:1!important;position:relative;page-break-after:always}}
</style>
</head>
<body>
<div id="stage">
  <div id="deck">

    <section class="slide wide on" data-i="0">
      <div class="head">
        <div class="eyebrow">/ ${esc(brand)} · Buscador de TikTok</div>
        <h1>${TITLES.buscador}</h1>
        <p class="sub">${esc(deck.buscador.subtitle)}</p>
      </div>
      <div class="body">
        ${
          research.search?.screenshot
            ? `<div><div class="lbl">${searchLabel}</div>
                 <div class="pshot" style="height:210px;background-image:url('${escUrl(research.search.screenshot)}')"></div></div>`
            : research.search?.results?.length
              ? `<div><div class="lbl">${searchLabel}</div>${searchGrid(research.search.results)}</div>`
              : `<div class="lbl">${searchLabel}</div>`
        }
        ${veredictoCards(v, deck.buscador.veredictos)}
      </div>
      <footer>${footer}</footer>
    </section>

    <section class="slide" data-i="1">
      <div class="head">
        <div class="eyebrow">/ ${esc(brand)} · Paid Media</div>
        <h1>${TITLES.ads}</h1>
        <p class="sub">${esc(deck.paid.subtitle)}</p>
      </div>
      <div class="pill-card">
        <div class="plbl">Ad Library · México</div>
        <div class="big">${esc(String(adCount))}</div>
        <div class="cap">${adCount === 1 ? "anuncio activo" : "anuncios activos"}</div>
        ${research.adFormat ? `<div class="mix">${esc(research.adFormat)}</div>` : ""}
      </div>
      <div class="body">
        ${shots.length ? `<div><div class="lbl">Lo que está corriendo hoy</div><div class="ads">${shots.map(adCard).join("")}</div></div>` : ""}
        <div><div class="lbl">Así arrancaríamos el mes 1</div><div class="ideas">${ideas}</div></div>
      </div>
      <footer>${footer}</footer>
    </section>

    <section class="slide wide" data-i="2">
      <div class="head">
        <div class="eyebrow">/ ${esc(brand)} · Redes</div>
        <h1>${TITLES.organico}</h1>
        <p class="sub">${esc(deck.organico.subtitle)}</p>
      </div>
      <div class="body">
        <div>
          <div class="lbl">Sus cuentas hoy</div>
          <div class="profs">
            ${profileCard(research.instagram, "Instagram")}
            ${profileCard(research.tiktok, "TikTok")}
          </div>
        </div>
        <div class="comp">
          <article class="cmp win">
            ${clipStrip(research.organic?.creators)}
            <div>
              <span class="badge good">${esc(deck.organico.win.label || "Mejor resultado")}</span>
              <h3>${esc(deck.organico.win.title)}</h3>
              <p>${esc(deck.organico.win.desc)}</p>
            </div>
          </article>
          <article class="cmp">
            ${clipStrip(research.organic?.brand)}
            <div>
              <span class="badge neutral">${esc(deck.organico.own.label || "Resultado propio")}</span>
              <h3>${esc(deck.organico.own.title)}</h3>
              <p>${esc(deck.organico.own.desc)}</p>
            </div>
          </article>
        </div>
        <div class="closing">
          <h4>${esc(deck.organico.closing.title)}</h4>
          <p>${esc(deck.organico.closing.text)}</p>
        </div>
      </div>
      <footer>${footer}</footer>
    </section>

  </div>
</div>
<nav>
  <span class="idx" id="idx">01 / 03</span>
  <button id="prev" aria-label="Anterior">‹</button>
  <button id="next" aria-label="Siguiente">›</button>
</nav>
<script>
  var slides = [].slice.call(document.querySelectorAll('.slide')), i = 0;
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function go(n){ i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function(s, k){ s.classList.toggle('on', k === i); });
    document.getElementById('idx').textContent = pad(i + 1) + ' / ' + pad(slides.length); }
  document.getElementById('next').onclick = function(e){ e.stopPropagation(); go(i + 1); };
  document.getElementById('prev').onclick = function(e){ e.stopPropagation(); go(i - 1); };
  document.addEventListener('keydown', function(e){
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(i + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1); } });
  document.getElementById('stage').addEventListener('click', function(e){
    if (e.target.closest('nav')) return; go(i + 1 >= slides.length ? 0 : i + 1); });
  function fit(){ var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    document.getElementById('deck').style.transform = 'scale(' + s + ')'; }
  window.addEventListener('resize', fit); fit();
  /* Un solo go() al arrancar: pinta el contador y respeta el #2 de la URL.
     Si se llamara go(0) despues, el deep link quedaria muerto. */
  var start = parseInt((location.hash || '').replace('#', ''), 10);
  go(start >= 1 && start <= slides.length ? start - 1 : 0);
</script>
</body>
</html>`;
}
