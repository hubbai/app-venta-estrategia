/* render.ts — La propuesta que se comparte por link.

   A diferencia del pitch de venta (3 slides fijas), esto es un documento que
   se scrollea: la marca lo lee sola, después de la llamada. El layout replica
   el de fs.hubb.mx/r/resilient-estrategia.

   Las fuentes se piden a Google en vez de embeberse en base64 como el HTML
   original: eso bajó el entregable de ~800 KB a unos 60 KB. */
import { C, esc, escUrl, FONT_LINK } from "../theme";
import type { Creador, Escenario, Estrategia, Paso } from "./types";

function section(title: string | undefined, subtitle: string | undefined, body: string): string {
  if (!body.trim()) return "";
  return `<section class="sec">
    ${title ? `<h2>${esc(title)}${subtitle ? `<span class="sub">${esc(subtitle)}</span>` : ""}</h2>` : ""}
    ${body}
  </section>`;
}

function escenarioBlock(e: Escenario): string {
  const breakdown = (e.breakdown ?? [])
    .map(
      (b, i) => `${i > 0 ? `<div class="arrow">${esc(e.breakdownSeparators?.[i - 1] ?? "→")}</div>` : ""}
      <div class="bd"><div class="bdl">${esc(b.label)}</div><div class="bdv">${esc(b.value)}</div><div class="bdc">${esc(b.caption)}</div></div>`
    )
    .join("");

  return `<article class="esc">
    <div class="tag">${esc(e.tag)}</div>
    <h3>${esc(e.title)}</h3>
    ${(e.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join("")}
    ${(e.badges ?? []).length ? `<div class="badges">${e.badges.map((b) => `<span>${esc(b)}</span>`).join("")}</div>` : ""}
    ${
      breakdown
        ? `<div class="bdbox">
             ${e.breakdownTitle ? `<div class="bdt"><i>◆</i> ${esc(e.breakdownTitle)}</div>` : ""}
             <div class="bdrow">${breakdown}</div>
           </div>`
        : ""
    }
    ${e.note ? `<p class="note">${esc(e.note)}</p>` : ""}
  </article>`;
}

function pasoBlock(p: Paso, i: number): string {
  return `<article class="paso">
    <div class="pnum">${i + 1}</div>
    <div class="pbody">
      <div class="phead"><span class="pphase">${esc(p.phase)}</span><span class="ptag">${esc(p.tag)}</span></div>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.desc)}</p>
      ${(p.chips ?? []).length ? `<div class="chips">${p.chips!.map((c) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
      ${
        (p.variantes ?? []).length
          ? `<div class="vars">${p.variantes!
              .map((v) => `<div><b>${esc(v.label)}</b> ${esc(v.text)}</div>`)
              .join("")}</div>`
          : ""
      }
    </div>
  </article>`;
}

function creadorCard(c: Creador): string {
  const socials = [
    c.instagram ? `<span><b>${esc(c.instagram)}</b> IG</span>` : "",
    c.tiktok ? `<span><b>${esc(c.tiktok)}</b> TikTok</span>` : "",
  ].filter(Boolean).join("");

  return `<article class="cre">
    <div class="chead">
      ${c.avatar ? `<div class="cav" style="background-image:url('${escUrl(c.avatar)}')"></div>` : `<div class="cav"></div>`}
      <div class="cid">
        <div class="cname">${esc(c.name)}${c.verified ? ' <i class="ver">◆</i>' : ""}</div>
        ${c.location ? `<div class="cloc">${esc(c.location)}</div>` : ""}
      </div>
      ${c.price ? `<div class="cprice">${esc(c.price)}</div>` : ""}
    </div>
    ${(c.categories ?? []).length ? `<div class="ccats">${esc(c.categories!.join(", "))}</div>` : ""}
    <div class="csocial">${socials || "<span>Redes por confirmar</span>"}${
      c.videos ? `<span class="cvid"><b>${c.videos}</b> videos</span>` : ""
    }</div>
    ${c.portfolioUrl ? `<a class="clink" href="${escUrl(c.portfolioUrl)}" target="_blank" rel="noreferrer">Ver portafolio →</a>` : ""}
  </article>`;
}

export function renderEstrategia(e: Estrategia): string {
  const contexto = e.contexto
    ? `<div class="ctx">
        ${e.contexto.title ? `<div class="ctxt"><i>◆</i> ${esc(e.contexto.title)}</div>` : ""}
        ${(e.contexto.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join("")}
        ${(e.contexto.atributos ?? []).length ? `<div class="attrs">${e.contexto.atributos.map((a) => `<span>${esc(a)}</span>`).join("")}</div>` : ""}
      </div>
      ${
        (e.contexto.stats ?? []).length
          ? `<div class="stats">${e.contexto.stats
              .map((s) => `<div class="stat"><div class="sv">${esc(s.value)}</div><div class="sl">${esc(s.label)}</div></div>`)
              .join("")}</div>`
          : ""
      }`
    : "";

  const panels = (e.panels ?? [])
    .map(
      (p) => `<article class="panel">
        <div class="ptop"><div class="tag">${esc(p.tag)}</div><div class="ptitle">${esc(p.title)}</div></div>
        <div class="plbl">Entregables</div>
        <dl>${p.entregables.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join("")}</dl>
        <div class="plbl">Datos operativos</div>
        <dl>${p.operativos.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join("")}</dl>
      </article>`
    )
    .join("");

  const funciones = (e.funciones ?? [])
    .map(
      (f) => `<article class="fun">
        <div class="fcount">${esc(f.count)}</div>
        <h3>${esc(f.title)}</h3>
        <p>${esc(f.desc)}</p>
        <div class="fscope">${esc(f.scope)}</div>
      </article>`
    )
    .join("");

  const lineas = (e.lineas ?? [])
    .map(
      (l, i) => `<article class="linea">
        <div class="lnum">${String(i + 1).padStart(2, "0")}</div>
        <h3>${esc(l.title)}</h3>
        <p>${esc(l.desc)}</p>
      </article>`
    )
    .join("");

  const comparativa = e.comparativa?.rows?.length
    ? `<div class="tablewrap"><table>
        <thead><tr>${e.comparativa.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${e.comparativa.rows
          .map((row) => `<tr>${row.map((cell, i) => `<td${i === 0 ? ' class="first"' : ""}>${esc(cell)}</td>`).join("")}</tr>`)
          .join("")}</tbody>
      </table></div>`
    : "";

  const creadores = (e.creadores ?? []).length
    ? `${e.creadoresNote ? `<p class="note">${esc(e.creadoresNote)}</p>` : ""}
       <div class="cregrid">${e.creadores.map(creadorCard).join("")}</div>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
${FONT_LINK}
<title>${esc(e.title)} · HUBB Full Service</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{background:#${C.cream};color:#${C.ink};font-family:"Bricolage Grotesque",ui-sans-serif,system-ui,-apple-system,Arial,sans-serif;
       -webkit-font-smoothing:antialiased;line-height:1.5}
  .wrap{max-width:1000px;margin:0 auto;padding:0 24px 100px}

  header{padding:72px 0 48px;border-bottom:1px solid #${C.border};margin-bottom:56px}
  .eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#${C.goldDark}}
  h1{font-size:clamp(30px,5vw,48px);line-height:1.08;font-weight:800;letter-spacing:-.025em;margin-top:14px}
  h1 b{color:#${C.goldDark};font-weight:800}
  .intro{margin-top:18px;font-size:17px;line-height:1.55;color:#${C.gray};max-width:660px}

  .sec{margin-bottom:64px;scroll-margin-top:24px}
  h2{font-size:clamp(21px,3vw,28px);font-weight:800;letter-spacing:-.02em;line-height:1.15}
  h2 .sub{display:block;font-size:14px;font-weight:400;color:#${C.grayLight};letter-spacing:0;margin-top:5px}
  .sec > h2{margin-bottom:24px}
  .note{font-size:13px;line-height:1.5;color:#${C.grayLight};margin-top:14px}
  .note b,.note strong{color:#${C.gray}}

  /* Contexto */
  .ctx{background:#${C.white};border:1px solid #${C.border};border-radius:16px;padding:26px 28px;
       box-shadow:0 6px 20px rgba(26,26,26,.05)}
  .ctxt{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#${C.goldDark};margin-bottom:14px}
  .ctxt i{font-style:normal}
  .ctx p{font-size:15px;line-height:1.6;color:#${C.gray};margin-bottom:12px}
  .ctx p:last-of-type{margin-bottom:0}
  .attrs{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
  .attrs span{font-size:12.5px;font-weight:600;padding:6px 13px;border-radius:999px;background:#${C.goldLight};color:#${C.goldDark}}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:14px}
  .stat{background:#${C.white};border:1px solid #${C.border};border-radius:14px;padding:18px 20px}
  .sv{font-size:28px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
  .sl{font-size:12.5px;color:#${C.grayLight};margin-top:5px;line-height:1.4}

  /* Escenarios */
  .esc{background:#${C.white};border:1px solid #${C.border};border-radius:16px;padding:26px 28px;margin-bottom:22px;
       box-shadow:0 6px 20px rgba(26,26,26,.05)}
  .tag{display:inline-flex;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
       padding:5px 12px;border-radius:999px;background:#${C.goldLight};color:#${C.goldDark}}
  .esc h3{font-size:22px;font-weight:800;letter-spacing:-.02em;margin:14px 0 12px;line-height:1.2}
  .esc p{font-size:14.5px;line-height:1.6;color:#${C.gray};margin-bottom:11px}
  .badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
  .badges span{font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;background:#${C.neutralBg};color:#${C.gray}}
  .bdbox{margin-top:22px;border-top:1px solid #${C.border};padding-top:20px}
  .bdt{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#${C.goldDark};margin-bottom:16px}
  .bdt i{font-style:normal}
  .bdrow{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
  .bd{flex:1;min-width:150px;background:#${C.cream};border:1px solid #${C.border};border-radius:12px;padding:14px 16px}
  .bdl{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#${C.grayLight}}
  .bdv{font-size:30px;font-weight:800;line-height:1.05;margin-top:6px}
  .bdc{font-size:12.5px;color:#${C.gray};margin-top:5px;line-height:1.35}
  .arrow{font-size:20px;color:#${C.gold};font-weight:700;flex:none}

  /* Paneles de entregables */
  .panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
  .panel{background:#${C.white};border:1px solid #${C.border};border-radius:16px;padding:24px 26px;
         box-shadow:0 6px 20px rgba(26,26,26,.05)}
  .ptitle{font-size:15px;font-weight:700;margin-top:10px;line-height:1.3}
  .plbl{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#${C.grayLight};
        margin:22px 0 10px}
  .panel dl > div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #${C.border}}
  .panel dl > div:last-child{border-bottom:none}
  .panel dt{font-size:13.5px;color:#${C.gray}}
  .panel dd{font-size:14.5px;font-weight:700;white-space:nowrap}

  /* Función de cada contenido */
  .funs{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:16px}
  .fun{background:#${C.white};border:1px solid #${C.border};border-radius:14px;padding:20px 22px}
  .fcount{font-size:30px;font-weight:800;color:#${C.goldDark};line-height:1}
  .fun h3{font-size:15.5px;font-weight:700;margin-top:10px;line-height:1.25}
  .fun p{font-size:13px;line-height:1.45;color:#${C.gray};margin-top:7px}
  .fscope{font-size:11px;font-weight:600;color:#${C.grayLight};margin-top:12px;padding-top:10px;border-top:1px solid #${C.border}}

  /* Pasos */
  .pasos{display:flex;flex-direction:column;gap:14px}
  .paso{display:flex;gap:18px;background:#${C.white};border:1px solid #${C.border};border-radius:14px;padding:20px 24px}
  .pnum{width:34px;height:34px;flex:none;border-radius:50%;background:#${C.gold};color:#${C.white};
        font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center}
  .pbody{min-width:0;flex:1}
  .phead{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
  .pphase{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#${C.goldDark}}
  .ptag{font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;background:#${C.neutralBg};color:#${C.gray}}
  .paso h3{font-size:17.5px;font-weight:700;margin-top:9px;line-height:1.25}
  .paso p{font-size:14px;line-height:1.55;color:#${C.gray};margin-top:8px}
  .chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}
  .chips span{font-size:11.5px;font-weight:600;padding:5px 11px;border-radius:7px;background:#${C.neutralBg};color:#${C.gray}}
  .vars{margin-top:14px;border-top:1px solid #${C.border};padding-top:12px;display:flex;flex-direction:column;gap:8px}
  .vars div{font-size:13px;line-height:1.5;color:#${C.gray}}
  .vars b{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
          padding:3px 8px;border-radius:6px;background:#${C.goldLight};color:#${C.goldDark};margin-right:7px}

  /* Líneas creativas */
  .lineas{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
  .linea{background:#${C.white};border:1px solid #${C.border};border-radius:14px;padding:22px 24px}
  .lnum{font-size:12px;font-weight:800;letter-spacing:.1em;color:#${C.gold}}
  .linea h3{font-size:17px;font-weight:700;margin-top:10px;line-height:1.2}
  .linea p{font-size:13.5px;line-height:1.5;color:#${C.gray};margin-top:8px}

  /* Comparativa */
  .tablewrap{overflow-x:auto;border:1px solid #${C.border};border-radius:14px;background:#${C.white}}
  table{width:100%;border-collapse:collapse;min-width:620px}
  th{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#${C.grayLight};
     text-align:left;padding:14px 18px;background:#${C.cream};border-bottom:1px solid #${C.border}}
  td{font-size:13.5px;color:#${C.gray};padding:13px 18px;border-bottom:1px solid #${C.border};vertical-align:top}
  td.first{font-weight:700;color:#${C.ink}}
  tr:last-child td{border-bottom:none}

  /* Creadores */
  .cregrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-top:20px}
  .cre{background:#${C.white};border:1px solid #${C.border};border-radius:14px;padding:16px 18px;display:flex;flex-direction:column}
  .chead{display:flex;align-items:center;gap:11px}
  .cav{width:42px;height:42px;flex:none;border-radius:50%;background-size:cover;background-position:center;
       background-color:#${C.neutralBg};border:1px solid #${C.border}}
  .cid{min-width:0;flex:1}
  .cname{font-size:15px;font-weight:700;line-height:1.15}
  .ver{font-style:normal;color:#${C.gold};font-size:11px}
  .cloc{font-size:11.5px;color:#${C.grayLight};margin-top:2px}
  .cprice{font-size:13.5px;font-weight:800;color:#${C.goldDark};white-space:nowrap}
  .ccats{font-size:12px;color:#${C.gray};margin-top:12px;line-height:1.4}
  .csocial{display:flex;flex-wrap:wrap;gap:12px;margin-top:11px;font-size:11.5px;color:#${C.grayLight}}
  .csocial b{color:#${C.ink};font-weight:700}
  .cvid{margin-left:auto}
  .clink{margin-top:14px;font-size:12.5px;font-weight:700;color:#${C.goldDark};text-decoration:none}
  .clink:hover{text-decoration:underline}

  footer{border-top:1px solid #${C.border};margin-top:20px;padding-top:26px;font-size:11.5px;letter-spacing:.1em;
         text-transform:uppercase;color:#${C.grayLight}}

  @media (max-width:640px){
    .paso{flex-direction:column;gap:12px}
    .bdrow{flex-direction:column;align-items:stretch}
    .arrow{text-align:center}
  }
  @media print{ body{background:#fff} .esc,.panel,.fun,.paso,.linea,.cre{break-inside:avoid} }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="eyebrow">HUBB Full Service · ${esc(e.brand)}</div>
    <h1>${esc(e.title)}</h1>
    ${e.intro ? `<p class="intro">${esc(e.intro)}</p>` : ""}
  </header>

  ${section(undefined, undefined, contexto)}
  ${section(undefined, undefined, (e.escenarios ?? []).map(escenarioBlock).join(""))}
  ${section(e.panelsTitle || "Entregables totales de cada escenario", e.panelsSubtitle, panels ? `<div class="panels">${panels}</div>${e.panelsNote ? `<p class="note">${esc(e.panelsNote)}</p>` : ""}` : "")}
  ${section(e.funcionesTitle || "Función de cada contenido", e.funcionesSubtitle, funciones ? `<div class="funs">${funciones}</div>` : "")}
  ${section(e.pasosTitle || "Pasos del servicio", e.pasosSubtitle, (e.pasos ?? []).length ? `<div class="pasos">${e.pasos.map(pasoBlock).join("")}</div>` : "")}
  ${section(e.lineasTitle || "Líneas creativas sugeridas", e.lineasSubtitle, lineas ? `<div class="lineas">${lineas}</div>` : "")}
  ${section(e.comparativaTitle || "Comparativa general", e.comparativaSubtitle, comparativa)}
  ${section(e.creadoresTitle || "Portafolios sugeridos para colaborar", (e.creadores ?? []).length ? `${e.creadores.length} perfiles preseleccionados` : undefined, creadores)}

  <footer>HUBB · Full Service &nbsp;//&nbsp; ${esc(e.brand.toUpperCase())}</footer>
</div>
</body>
</html>`;
}
