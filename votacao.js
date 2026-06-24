/* =============================================================
 *  Votação + Comentários — "O Neymar joga hoje?"
 *
 *  CAMADA DE API (NeymarAPI)
 *  -------------------------------------------------------------
 *  Por enquanto os dados ficam no NAVEGADOR (localStorage), só
 *  para visualizar a interface funcionando. Quando o backend/
 *  banco estiver pronto, basta trocar o corpo dos 4 métodos
 *  abaixo por chamadas fetch() à API real — o resto do código
 *  não muda (todos retornam Promise).
 *
 *  Contrato esperado da API real:
 *    GET  /votos            -> { sim: number, nao: number }
 *    POST /votos {escolha}  -> { sim: number, nao: number }
 *    GET  /comentarios      -> [ { nome, texto, criado_em } ]
 *    POST /comentarios {nome, texto} -> { nome, texto, criado_em }
 * ============================================================= */
(function () {
  "use strict";

  // ---------------------------------------------------------------
  //  NeymarAPI — troque o miolo destes métodos pela API real depois
  // ---------------------------------------------------------------
  var LS_VOTES = "njh_votes";
  var LS_VOTED = "njh_voted";
  var LS_COMMENTS = "njh_comments";

  function lsGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var NeymarAPI = {
    getVotes: function () {
      // REAL: return fetch(API + "/votos").then(r => r.json());
      return Promise.resolve(lsGet(LS_VOTES, { sim: 0, nao: 0 }));
    },
    vote: function (escolha) {
      // REAL: return fetch(API + "/votos", {method:"POST", body: JSON.stringify({escolha})}).then(r => r.json());
      var v = lsGet(LS_VOTES, { sim: 0, nao: 0 });
      if (escolha === "sim" || escolha === "nao") v[escolha]++;
      lsSet(LS_VOTES, v);
      lsSet(LS_VOTED, escolha);
      return Promise.resolve(v);
    },
    getMyVote: function () {
      // Só local: registra que este navegador já votou (a API real
      // pode usar cookie/IP no servidor).
      return lsGet(LS_VOTED, null);
    },
    getComments: function () {
      // REAL: return fetch(API + "/comentarios").then(r => r.json());
      return Promise.resolve(lsGet(LS_COMMENTS, []));
    },
    addComment: function (nome, texto) {
      // REAL: return fetch(API + "/comentarios", {method:"POST", body: JSON.stringify({nome, texto})}).then(r => r.json());
      var c = { nome: nome, texto: texto, criado_em: new Date().toISOString() };
      var list = lsGet(LS_COMMENTS, []);
      list.unshift(c);
      lsSet(LS_COMMENTS, list.slice(0, 200));
      return Promise.resolve(c);
    }
  };

  // ---------------------------------------------------------------
  //  Utilidades
  // ---------------------------------------------------------------
  function track(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  }

  // Filtro simples de palavrões (mascara o miolo da palavra)
  var BAD = ["porra", "merda", "caralho", "buceta", "puta", "viado", "fdp", "pqp", "cu", "arrombado"];
  function limpar(texto) {
    var out = texto;
    BAD.forEach(function (w) {
      var re = new RegExp(w.replace(/(.)/g, "$1\\s*"), "gi");
      out = out.replace(re, function (m) {
        return m[0] + "*".repeat(Math.max(1, m.replace(/\s/g, "").length - 1));
      });
    });
    return out;
  }

  // Formata a data do comentário ("agora", "há 5 min", data)
  function quando(iso) {
    var d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "agora";
    if (diff < 3600) return "há " + Math.floor(diff / 60) + " min";
    if (diff < 86400) return "há " + Math.floor(diff / 3600) + " h";
    return d.toLocaleDateString("pt-BR");
  }

  function iniciais(nome) {
    var p = nome.trim().split(/\s+/);
    return ((p[0] ? p[0][0] : "?") + (p[1] ? p[1][0] : "")).toUpperCase();
  }

  // ---------------------------------------------------------------
  //  Enquete
  // ---------------------------------------------------------------
  var pollButtons = document.getElementById("pollButtons");
  var pollResults = document.getElementById("pollResults");
  var barYes = document.getElementById("barYes");
  var barNo = document.getElementById("barNo");
  var pctYes = document.getElementById("pctYes");
  var pctNo = document.getElementById("pctNo");
  var pollTotal = document.getElementById("pollTotal");

  function renderVotes(v) {
    var total = (v.sim || 0) + (v.nao || 0);
    var pSim = total ? Math.round((v.sim / total) * 100) : 0;
    var pNao = total ? 100 - pSim : 0;
    pctYes.textContent = pSim + "%";
    pctNo.textContent = pNao + "%";
    barYes.style.width = pSim + "%";
    barNo.style.width = pNao + "%";
    pollTotal.textContent = total === 1 ? "1 voto" : total + " votos";
    pollResults.hidden = false;
  }

  function marcarVotado(escolha) {
    var btns = pollButtons.querySelectorAll(".poll__btn");
    btns.forEach(function (b) {
      b.disabled = true;
      if (b.getAttribute("data-vote") === escolha) b.classList.add("is-mine");
    });
  }

  function setupPoll() {
    var jaVotou = NeymarAPI.getMyVote();
    if (jaVotou) {
      marcarVotado(jaVotou);
      NeymarAPI.getVotes().then(renderVotes);
    }

    pollButtons.addEventListener("click", function (e) {
      var btn = e.target.closest(".poll__btn");
      if (!btn || NeymarAPI.getMyVote()) return;
      var escolha = btn.getAttribute("data-vote");
      marcarVotado(escolha);
      track("votou", { escolha: escolha });
      NeymarAPI.vote(escolha).then(renderVotes);
    });
  }

  // ---------------------------------------------------------------
  //  Comentários
  // ---------------------------------------------------------------
  var form = document.getElementById("commentForm");
  var nameEl = document.getElementById("commentName");
  var textEl = document.getElementById("commentText");
  var listEl = document.getElementById("commentList");
  var countEl = document.getElementById("commentCount");

  function renderComment(c, prepend) {
    var li = document.createElement("li");
    li.className = "comment";

    var av = document.createElement("div");
    av.className = "comment__avatar";
    av.textContent = iniciais(c.nome);

    var body = document.createElement("div");
    body.className = "comment__body";

    var head = document.createElement("div");
    head.className = "comment__head";
    var nm = document.createElement("span");
    nm.className = "comment__name";
    nm.textContent = c.nome;                 // textContent = sem risco de XSS
    var tm = document.createElement("span");
    tm.className = "comment__time";
    tm.textContent = quando(c.criado_em);
    head.appendChild(nm);
    head.appendChild(tm);

    var tx = document.createElement("p");
    tx.className = "comment__text";
    tx.textContent = c.texto;                // textContent = sem risco de XSS

    body.appendChild(head);
    body.appendChild(tx);
    li.appendChild(av);
    li.appendChild(body);

    if (prepend && listEl.firstChild) listEl.insertBefore(li, listEl.firstChild);
    else listEl.appendChild(li);
  }

  function setupComments() {
    NeymarAPI.getComments().then(function (list) {
      list.forEach(function (c) { renderComment(c, false); });
    });

    textEl.addEventListener("input", function () {
      countEl.textContent = textEl.value.length + "/500";
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nome = nameEl.value.trim();
      var texto = limpar(textEl.value.trim());
      if (!nome || !texto) return;

      var btn = form.querySelector(".comments__submit");
      btn.disabled = true;

      NeymarAPI.addComment(nome, texto).then(function (c) {
        renderComment(c, true);
        track("comentou", {});
        textEl.value = "";
        countEl.textContent = "0/500";
        btn.disabled = false;
        textEl.focus();
      }).catch(function () { btn.disabled = false; });
    });
  }

  setupPoll();
  setupComments();
})();
