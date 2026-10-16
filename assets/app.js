/* Relatório de tradução — tudo é calculado a partir de data/planilha.csv
   (sincronizada do Google Sheets pela GitHub Action) + data/config.json. */
(function () {
  "use strict";

  const COR_POLOS = { 1: "#F4C08F", 2: "#EBA261", 3: "#E28531", 4: "#1D1D1B", 5: "#7A3F0E" };
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fmt = (n, d = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmt1 = (n) => fmt(Math.round(n * 10) / 10, 1);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const lista = (arr) => arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " e " + arr[arr.length - 1];

  /* ---------- leitura da planilha ---------- */
  function parseCSV(txt) {
    const linhas = []; let linha = [], campo = "", aspas = false;
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (aspas) {
        if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === ",") { linha.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && txt[i + 1] === "\n") i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = "";
      } else campo += c;
    }
    if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.filter((l) => l.some((v) => v.trim() !== ""));
  }

  const num = (v) => {
    const s = String(v || "").trim().replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s); return isNaN(n) ? null : n;
  };
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

  // "jan./2019", "mar./22", "maio/2022", "março/2022" -> {a, m} (m 0-11)
  function mesAno(v) {
    const m = norm(v || "").match(/^([a-z]+)\.?\s*\/\s*(\d{2,4})$/);
    if (!m) return null;
    const idx = MESES.indexOf(m[1].slice(0, 3));
    if (idx < 0) return null;
    let a = parseInt(m[2], 10); if (a < 100) a += 2000;
    return { a, m: idx };
  }
  // "25/09/2020" -> Date
  function data(v) {
    const m = String(v || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  }
  const idxMes = (x) => x.a * 12 + x.m;

  function colunas(cab) {
    const h = cab.map(norm);
    const acha = (...nomes) => {
      for (const n of nomes) { const i = h.indexOf(n); if (i >= 0) return i; }
      for (const n of nomes) { const i = h.findIndex((x) => x.startsWith(n)); if (i >= 0) return i; }
      return -1;
    };
    return {
      livro: acha("livro"), cap: acha("cap.", "cap"), vers: acha("vers.", "versiculos"),
      ini: acha("inicio"), fim: acha("fim"), dur: acha("duracao em meses", "duracao"),
      media: acha("media vers./mes"), polos: acha("quant. polo"),
      porPolo: acha("media vers. por polo/mes", "media vers. por polo"),
      porTrad: acha("media vers. tradutor/mes", "media vers. tradutor"),
      lanc: acha("lancamento"), ordem: acha("ordem do lancamento", "ordem"),
    };
  }

  function livros(csv) {
    const [cab, ...linhas] = parseCSV(csv);
    const c = colunas(cab);
    const pega = (l, i) => (i >= 0 ? (l[i] || "").trim() : "");
    return linhas.map((l) => {
      const polosTxt = pega(l, c.polos);
      const dentro = (polosTxt.match(/\(([^)]*)\)/) || [, ""])[1].replace(/^\s*\d+\s+em\s+/i, "");
      return {
        livro: pega(l, c.livro),
        cap: num(pega(l, c.cap)) || 0,
        vers: num(pega(l, c.vers)) || 0,
        iniTxt: pega(l, c.ini), fimTxt: pega(l, c.fim),
        ini: mesAno(pega(l, c.ini)), fim: mesAno(pega(l, c.fim)),
        dur: num(pega(l, c.dur)) || 0,
        media: num(pega(l, c.media)) || 0,
        polos: parseInt(polosTxt, 10) || 1,
        polosTxt,
        polosLista: dentro.split("/").map((s) => s.trim()).filter(Boolean),
        porPolo: num(pega(l, c.porPolo)) || 0,
        porTrad: num(pega(l, c.porTrad)) || 0,
        lancTxt: pega(l, c.lanc), lanc: data(pega(l, c.lanc)),
        ordem: pega(l, c.ordem),
      };
    }).filter((b) => b.livro);
  }

  /* ---------- cálculos ---------- */
  function mesesEntre(d1, d2) {
    const m = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + (d2.getDate() - d1.getDate()) / 30;
    return Math.ceil(m - 1e-9); // "valores arredondados sempre para mais"
  }
  const anosMeses = (m) => {
    const a = Math.floor(m / 12), r = m % 12;
    const pa = a ? `${a} ${a === 1 ? "ano" : "anos"}` : "";
    const pm = r ? `${r} ${r === 1 ? "mês" : "meses"}` : "";
    return [pa, pm].filter(Boolean).join(" e ");
  };
  const dataBR = (d) => d ? d.toLocaleDateString("pt-BR") : "—";
  const isoData = (s) => { if (!s) return null; const [a, m, d] = s.split("-").map(Number); return new Date(a, m - 1, d); };
  const soma = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
  const extremos = (arr, f) => {
    const vals = arr.map(f); const min = Math.min(...vals), max = Math.max(...vals);
    return { min, max, minN: arr.filter((x) => f(x) === min).map((x) => x.livro), maxN: arr.filter((x) => f(x) === max).map((x) => x.livro) };
  };

  function calcula(L, cfg) {
    const tpp = cfg.tradutoresPorPolo || 2;
    const k = {};
    k.livros = L.length;
    k.capitulos = soma(L, (b) => b.cap);
    k.versiculos = soma(L, (b) => b.vers);
    k.livroMeses = soma(L, (b) => b.dur);
    k.poloMes = soma(L, (b) => b.dur * b.polos);
    k.mediaMesesLivro = k.livroMeses / L.length;
    k.ponderadaPolo = k.versiculos / k.poloMes;
    k.ponderadaTrad = k.ponderadaPolo / tpp;
    k.simplesPolo = soma(L, (b) => b.porPolo) / L.length;
    k.simplesTrad = soma(L, (b) => b.porTrad) / L.length;
    k.tpp = tpp;

    // Polos (na ordem em que aparecem na planilha)
    const polos = [];
    L.forEach((b) => b.polosLista.forEach((p) => { if (!polos.includes(p)) polos.push(p); }));
    k.polosLista = polos;
    k.nPolos = polos.length || Math.max(...L.map((b) => b.polos));
    k.porQtdPolos = {};
    L.forEach((b) => (k.porQtdPolos[b.polos] = k.porQtdPolos[b.polos] || []).push(b.livro));
    k.livrosPorPolo = {};
    polos.forEach((p) => (k.livrosPorPolo[p] = L.filter((b) => b.polosLista.includes(p))));
    const um = L.filter((b) => b.polos === 1), varios = L.filter((b) => b.polos > 1);
    k.mediaUm = um.length ? soma(um, (b) => b.porPolo) / um.length : 0;
    k.mediaVarios = varios.length ? soma(varios, (b) => b.porPolo) / varios.length : 0;
    k.minPolosVarios = varios.length ? Math.min(...varios.map((b) => b.polos)) : 0;
    k.maxPolos = Math.max(...L.map((b) => b.polos));

    // Datas
    k.inicio = isoData(cfg.inicioFormal);
    k.encerramento = isoData(cfg.encerramentoNT);
    const lancs = L.map((b) => b.lanc).filter(Boolean);
    k.lancGeral = isoData(cfg.lancamentoGeral) || (lancs.length ? new Date(Math.max(...lancs)) : null);
    if (!k.inicio) { const p = L.map((b) => b.ini).filter(Boolean).sort((a, b) => idxMes(a) - idxMes(b))[0]; if (p) k.inicio = new Date(p.a, p.m, 1); }
    if (!k.encerramento) { const u = L.map((b) => b.fim).filter(Boolean).sort((a, b) => idxMes(b) - idxMes(a))[0]; if (u) k.encerramento = new Date(u.a, u.m + 1, 0); }
    k.meses = mesesEntre(k.inicio, k.encerramento);
    k.mesesLanc = k.lancGeral ? mesesEntre(k.inicio, k.lancGeral) : null;
    k.ritmo = k.versiculos / k.meses;
    k.pendentes = L.filter((b) => !b.lanc).map((b) => b.livro);

    k.dur = extremos(L, (b) => b.dur);
    k.pp = extremos(L, (b) => b.porPolo);
    k.pt = extremos(L, (b) => b.porTrad);
    k.vol = extremos(L, (b) => b.media);
    k.lentoVarios = varios.length ? extremos(varios, (b) => b.media) : null;
    k.maiorVol = L.find((b) => b.media === k.vol.max);
    k.menor = L.reduce((a, b) => (b.vers < a.vers ? b : a));
    k.maior = L.reduce((a, b) => (b.vers > a.vers ? b : a));

    k.equipe = cfg.equipe || [];
    k.pessoas = soma(k.equipe, (e) => e.pessoas);
    return k;
  }

  /* ---------- renderização ---------- */
  const set = (key, html) => $$(`[data-k="${key}"]`).forEach((el) => (el.innerHTML = html));

  function render(L, cfg, meta) {
    const k = calcula(L, cfg);
    ["titulo", "subtitulo"].forEach((c) => cfg[c] && $$(`[data-bind="${c}"]`).forEach((el) => (el.textContent = cfg[c])));

    set("livros", fmt(k.livros));
    set("capitulos", fmt(k.capitulos));
    set("versiculos", fmt(k.versiculos));
    set("meses", fmt(k.meses));
    set("polos", fmt(k.nPolos));
    set("pessoas", fmt(k.pessoas));
    set("ritmoFrase", `Ritmo médio do projeto: <strong>cerca de ${fmt(Math.round(k.ritmo))} versículos por mês</strong> ao longo dos ${k.meses} meses de tradução (${fmt(k.versiculos)} ÷ ${k.meses}).`);

    // Linha do tempo
    $("[data-marcos]").innerHTML = [
      ["Início formal", k.inicio, "Início da tradução"],
      ["Encerramento do NT", k.encerramento, `Sem consultoria · ${k.meses} meses (${anosMeses(k.meses)})`],
      ["Lançamento geral", k.lancGeral, k.mesesLanc ? `${k.mesesLanc} meses do início (${anosMeses(k.mesesLanc)})` : ""],
    ].map(([n, d, det]) => `<li><span class="marco__nome">${n}</span><span class="marco__data">${dataBR(d)}</span><span class="marco__det">${esc(det)}</span></li>`).join("");
    set("prazoFrase", `O início formal foi em ${dataBR(k.inicio)}, e o encerramento do Novo Testamento (sem consultoria) em ${dataBR(k.encerramento)} — ${k.meses} meses, ou ${anosMeses(k.meses)}.` +
      (k.lancGeral ? ` Até o lançamento geral, em ${dataBR(k.lancGeral)}, decorreram ${k.mesesLanc} meses (${anosMeses(k.mesesLanc)}).` : "") +
      (k.pendentes.length ? ` Sem data de lançamento na planilha: ${lista(k.pendentes)}.` : ""));

    const qtds = Object.keys(k.porQtdPolos).map(Number).sort((a, b) => a - b);
    const leg = qtds.map((q) => `<span><i style="background:${COR_POLOS[q] || "#999"}"></i>${q} ${q === 1 ? "polo" : "polos"}</span>`).join("");
    $$("[data-legenda-polos]").forEach((el) => (el.innerHTML = leg));
    gantt(L);

    // Equipe
    $("[data-equipe]").innerHTML = k.equipe.map((e) => `<div><span class="equipe__frente">${esc(e.frente)}</span><span class="equipe__n">${e.pessoas}<small>pessoas</small></span><p class="equipe__c">${esc(e.composicao)}</p></div>`).join("") +
      `<div class="total"><span class="equipe__frente">Total</span><span class="equipe__n">${k.pessoas}<small>pessoas</small></span><p class="equipe__c">${lista(k.equipe.map((e) => e.frente.toLowerCase()))}</p></div>`;
    const trad = k.equipe.find((e) => norm(e.frente) === "traducao");
    const outras = k.equipe.filter((e) => e !== trad);
    set("equipeFrase", `O projeto contou com ${k.nPolos} polos de tradução (${lista(k.polosLista)})` +
      (trad ? `, reunindo ${trad.pessoas} pessoas — ${esc(trad.composicao)}` : "") +
      (outras.length ? `. Somando-se as equipes de ${lista(outras.map((e) => `${e.frente.toLowerCase()} (${e.pessoas} pessoas)`))}, a equipe total foi de ${k.pessoas} pessoas.` : "."));

    $("[data-polos]").innerHTML = k.polosLista.map((p) => {
      const ls = k.livrosPorPolo[p];
      return `<div class="polo"><b>${esc(p)}</b><span>participou de ${ls.length} livros</span><div class="polo__mini">${ls.map((b) => `<i title="${esc(b.livro)}"></i>`).join("")}</div></div>`;
    }).join("");
    set("polosFrase", "Por livro, " + lista(qtds.map((q) => {
      const ns = k.porQtdPolos[q];
      return `${ns.length} ${ns.length === 1 ? "livro foi traduzido" : "livros foram traduzidos"} por ${q} ${q === 1 ? "polo" : "polos"}` + (q > 1 ? ` (${lista(ns)})` : "");
    })) + ".");

    // Duração
    set("duracaoFrase", `O tempo de tradução por livro variou de ${k.dur.min} meses (${lista(k.dur.minN)}) a ${k.dur.max} meses (${lista(k.dur.maxN)}). A média do projeto foi de ${fmt(k.livroMeses)} livro-meses ÷ ${k.livros} livros ≈ <strong>${fmt1(k.mediaMesesLivro)} meses por livro</strong>. Conta-se o mês inicial e o mês final em todos os livros.`);
    set("volumeFrase", k.maiorVol ? `${esc(k.maiorVol.livro)} teve o maior volume mensal (${fmt(k.maiorVol.vers)} versículos em ${k.maiorVol.dur} meses, com ${k.maiorVol.polos} ${k.maiorVol.polos === 1 ? "polo" : "polos"} = ${fmt(k.maiorVol.media)} vers./mês)` +
      (k.lentoVarios ? `; entre os livros com mais de um polo, ${lista(k.lentoVarios.minN)} teve o ritmo mais lento (${fmt(k.lentoVarios.min)} vers./mês).` : ".") : "");
    barras($("[data-barras-duracao]"), [...L].sort((a, b) => b.dur - a.dur), (b) => b.dur, (b) => `${b.dur} m`, (b) => `${b.livro}: ${b.iniTxt} a ${b.fimTxt}`);

    // Produtividade
    set("poloFrase", `A produtividade por polo variou de ${fmt(k.pp.min)} (${lista(k.pp.minN)}) a ${fmt(k.pp.max)} (${lista(k.pp.maxN)}) versículos por mês. A média simples dos ${k.livros} livros é de aproximadamente <strong>${fmt1(k.simplesPolo)}</strong> vers./mês/polo; a média ponderada — ${fmt(k.versiculos)} ÷ ${fmt(k.poloMes)} polo-mês — é de aproximadamente <strong>${fmt1(k.ponderadaPolo)}</strong>.`);
    set("homogeneoFrase", `Livros de 1 polo tiveram média de ~${fmt(Math.round(k.mediaUm))} vers./mês/polo; livros de ${k.minPolosVarios}–${k.maxPolos} polos, ~${fmt(Math.round(k.mediaVarios))}.`);
    barras($("[data-barras-polo]"), [...L].sort((a, b) => b.porPolo - a.porPolo), (b) => b.porPolo, (b) => fmt(b.porPolo), (b) => `${b.livro}: ${fmt(b.vers)} vers. em ${b.dur} meses com ${b.polos} polo(s)`, (b) => COR_POLOS[b.polos],
      [{ v: k.ponderadaPolo, rot: `ponderada ${fmt1(k.ponderadaPolo)}`, cls: "ponderada" }, { v: k.simplesPolo, rot: `simples ${fmt1(k.simplesPolo)}`, cls: "simples" }]);

    $("[data-explica]").innerHTML = `
      <p>A <strong>média simples</strong> dos ${k.livros} valores da coluna dá ~${fmt1(k.simplesPolo)} — mas trata todos os livros como iguais: ${esc(k.menor.livro)} (${fmt(k.menor.vers)} versículos) pesa o mesmo que ${esc(k.maior.livro)} (${fmt(k.maior.vers)}). Livros pequenos têm médias altas e inflam o resultado.</p>
      <p>A <strong>média ponderada</strong> usa o volume real de trabalho como peso: ${fmt(k.poloMes)} = soma de (meses × polos) dos ${k.livros} livros = esforço total em polo-mês.</p>
      <p class="formula">${fmt(k.versiculos)} ÷ ${fmt(k.poloMes)} ≈ ${fmt1(k.ponderadaPolo)} versículos por polo por mês</p>
      <p>É a métrica correta para planejamento e prestação de contas: responde à pergunta “se eu abrir um novo polo, quantos versículos posso esperar dele por mês?” (orçamento, prazo, proposta a financiadores). A média simples (${fmt1(k.simplesPolo)}) é útil para comparar livros entre si; a ponderada é a correta para planejar capacidade e prever prazos.</p>`;

    set("tradutorFrase", `Considerando ${k.tpp} surdos tradutores por polo, a variação foi de ${fmt(k.pt.min)} (${lista(k.pt.minN)}) a ${fmt(k.pt.max)} (${lista(k.pt.maxN)}) versículos por mês. A média simples é de aproximadamente <strong>${fmt1(k.simplesTrad)}</strong> vers./mês/tradutor; a ponderada, de aproximadamente <strong>${fmt1(k.ponderadaTrad)}</strong>.`);
    const diasUteis = 21 / k.ponderadaTrad; // ~21 dias úteis/mês
    set("praticaFrase", `Na prática: cada surdo tradutor produziu cerca de 1 versículo a cada ${fmt1(diasUteis)} dias úteis.`);

    tabela(L, k);
    $("[data-obs]").innerHTML = (cfg.observacoes || []).map((o) => `<li>${esc(o)}</li>`).join("");
    $("[data-planilha]").href = cfg.planilhaUrl || "#";
    if (meta && meta.sincronizadoEm) {
      const d = new Date(meta.sincronizadoEm);
      $("[data-sync]").textContent = `atualizado em ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }
  }

  function gantt(L) {
    const comDatas = L.filter((b) => b.ini && b.fim);
    const i0 = Math.min(...comDatas.map((b) => idxMes(b.ini)));
    const lancs = comDatas.map((b) => b.lanc).filter(Boolean).map((d) => d.getFullYear() * 12 + d.getMonth());
    const i1 = Math.max(...comDatas.map((b) => idxMes(b.fim)), ...lancs) + 1;
    const total = i1 - i0;
    const pct = (i) => ((i - i0) / total) * 100;
    const a0 = Math.floor(i0 / 12), a1 = Math.floor((i1 - 1) / 12);
    let anos = "", grade = "";
    for (let a = a0; a <= a1; a++) {
      const p = Math.max(0, pct(a * 12));
      anos += `<span class="gantt__ano" style="left:${p}%">${a}</span>`;
      grade += `<span class="gantt__grade" style="left:${p}%"></span>`;
    }
    const linhas = [...comDatas].sort((a, b) => idxMes(a.ini) - idxMes(b.ini) || idxMes(a.fim) - idxMes(b.fim)).map((b) => {
      const l = pct(idxMes(b.ini)), w = pct(idxMes(b.fim) + 1) - l;
      const lp = b.lanc ? pct(b.lanc.getFullYear() * 12 + b.lanc.getMonth() + (b.lanc.getDate() - 1) / 30) : null;
      const tip = `${b.livro}: ${b.iniTxt} → ${b.fimTxt} · ${b.dur} meses · ${b.polosTxt}` + (b.lanc ? ` · lançado em ${b.lancTxt}` : " · lançamento pendente");
      return `<div class="gantt__linha" title="${esc(tip)}"><span class="gantt__nome">${esc(b.livro)}</span><div class="gantt__trilho">${grade}<span class="gantt__barra" style="left:${l}%;width:${w}%;background:${COR_POLOS[b.polos] || "#999"}"></span>${lp !== null ? `<span class="gantt__lanc" style="left:${lp}%"></span>` : ""}</div></div>`;
    }).join("");
    $("[data-gantt]").innerHTML = `<div class="gantt__eixo"><span></span><div class="gantt__trilho">${anos}</div></div>${linhas}`;
  }

  function barras(el, itens, val, rot, tip, cor, refs = []) {
    const max = Math.max(...itens.map(val), ...refs.map((r) => r.v)) * 1.05;
    el.innerHTML = itens.map((b) => `<div class="barra" title="${esc(tip(b))}"><span class="barra__nome">${esc(b.livro)}</span><div class="barra__trilho"><div class="barra__val" style="width:${(val(b) / max) * 100}%${cor ? `;background:${cor(b)}` : ""}"></div></div><span class="barra__num">${rot(b)}</span></div>`).join("");
    if (refs.length) {
      requestAnimationFrame(() => {
        const t = el.querySelector(".barra__trilho"); if (!t) return;
        const off = t.getBoundingClientRect().left - el.getBoundingClientRect().left;
        refs.forEach((r) => {
          const s = document.createElement("div");
          s.className = `ref ref--${r.cls}`;
          s.style.left = `calc(${off}px + ${(r.v / max) * t.getBoundingClientRect().width}px)`;
          s.innerHTML = `<span>${esc(r.rot)}</span>`;
          el.appendChild(s);
        });
      });
    }
  }

  function tabela(L, k) {
    const cols = [
      ["livro", "Livro", (b) => esc(b.livro), (b) => b.livro],
      ["cap", "Cap.", (b) => fmt(b.cap), (b) => b.cap, true],
      ["vers", "Vers.", (b) => fmt(b.vers), (b) => b.vers, true],
      ["ini", "Início", (b) => esc(b.iniTxt), (b) => (b.ini ? idxMes(b.ini) : 0)],
      ["fim", "Fim", (b) => esc(b.fimTxt), (b) => (b.fim ? idxMes(b.fim) : 0)],
      ["dur", "Meses", (b) => b.dur, (b) => b.dur, true],
      ["media", "Vers./mês", (b) => fmt(b.media), (b) => b.media, true],
      ["polos", "Polos", (b) => esc(b.polosTxt), (b) => b.polos],
      ["porPolo", "Vers./polo/mês", (b) => fmt(b.porPolo), (b) => b.porPolo, true],
      ["porTrad", "Vers./tradutor/mês", (b) => fmt(b.porTrad), (b) => b.porTrad, true],
      ["lanc", "Lançamento", (b) => (b.lanc ? esc(b.lancTxt) : '<span class="pendente">pendente</span>'), (b) => (b.lanc ? +b.lanc : Infinity)],
      ["ordem", "Ordem", (b) => esc(b.ordem || "—"), (b) => parseInt(b.ordem, 10) || 999],
    ];
    const el = $("[data-tabela]");
    let ord = { i: -1, dir: 1 };
    const desenha = () => {
      const linhas = ord.i < 0 ? L : [...L].sort((a, b) => {
        const f = cols[ord.i][3], x = f(a), y = f(b);
        return (typeof x === "string" ? x.localeCompare(y, "pt-BR") : x - y) * ord.dir;
      });
      el.innerHTML = `<thead><tr>${cols.map((c, i) => `<th class="${c[4] ? "n" : ""}" data-i="${i}" ${ord.i === i ? `aria-sort="${ord.dir > 0 ? "ascending" : "descending"}"` : ""}>${c[1]}</th>`).join("")}</tr></thead>
        <tbody>${linhas.map((b) => `<tr>${cols.map((c) => `<td class="${c[4] ? "n" : ""}">${c[2](b)}</td>`).join("")}</tr>`).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="n">${fmt(k.capitulos)}</td><td class="n">${fmt(k.versiculos)}</td><td></td><td></td><td class="n">${fmt(k.livroMeses)}</td><td></td><td>${fmt(k.poloMes)} polo-mês</td><td class="n">${fmt1(k.ponderadaPolo)}*</td><td class="n">${fmt1(k.ponderadaTrad)}*</td><td colspan="2"><span class="nota">* média ponderada</span></td></tr></tfoot>`;
      $$("th", el).forEach((th) => th.addEventListener("click", () => {
        const i = +th.dataset.i; ord = { i, dir: ord.i === i ? -ord.dir : 1 }; desenha();
      }));
    };
    desenha();
  }

  /* ---------- carga ---------- */
  const v = "?v=" + Date.now(); // evita cache antigo após uma sincronização
  Promise.all([
    fetch("data/planilha.csv" + v).then((r) => { if (!r.ok) throw new Error("planilha.csv"); return r.text(); }),
    fetch("data/config.json" + v).then((r) => r.json()),
    fetch("data/meta.json" + v).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]).then(([csv, cfg, meta]) => render(livros(csv), cfg, meta))
    .catch((e) => {
      console.error(e);
      const el = $("[data-erro]"); el.hidden = false;
      el.textContent = "Não foi possível carregar os dados do relatório (" + e.message + ").";
    });
})();
