(function () {
  "use strict";

  var answerEl = document.getElementById("answer");
  var answerText = document.getElementById("answerText");
  var shareBtn = document.getElementById("shareBtn");
  var yearEl = document.getElementById("year");

  yearEl.textContent = new Date().getFullYear();

  // Helper de analytics (no-op se o gtag nao carregou)
  function track(name, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  }

  // ---------- A resposta vem da planilha (celula A1) ----------
  var SHEET_ID = "1C5JoK_pqYZIpRon-2Izn0U2i6a-HXqWqYxZX_sx5SsU";
  var DEFAULT_ANSWER = "NÃO";        // usado se a planilha nao carregar
  var currentAnswer = DEFAULT_ANSWER;
  var answerLoaded = false;

  // Aplica o texto da resposta + cor conforme o conteudo
  function applyAnswer(raw) {
    var text = (raw == null ? "" : String(raw)).trim();
    if (!text) text = DEFAULT_ANSWER;
    currentAnswer = text;
    answerText.textContent = text;   // o CSS deixa em maiusculas

    var norm = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    answerEl.classList.remove("is-yes", "is-neutral");
    if (norm === "sim") {
      answerEl.classList.add("is-yes");        // verde
    } else if (norm === "nao") {
      /* vermelho (padrao) */
    } else {
      answerEl.classList.add("is-neutral");    // qualquer outro texto: branco
    }
    answerLoaded = true;
  }

  // Le a celula A1 via JSONP (sem chave de API, sem problema de CORS)
  function loadAnswer(done) {
    var cbName = "__sheetCb_" + Date.now();
    var s = document.createElement("script");
    var finished = false;

    function cleanup() {
      try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
      if (s.parentNode) s.parentNode.removeChild(s);
    }
    function finish(val) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      done(val);
    }

    var timer = setTimeout(function () { finish(null); }, 5000);

    window[cbName] = function (resp) {
      var val = null;
      try { val = resp.table.rows[0].c[0].v; } catch (e) {}
      finish(val);
    };

    s.onerror = function () { finish(null); };
    s.src = "https://docs.google.com/spreadsheets/d/" + SHEET_ID +
      "/gviz/tq?tqx=out:json;responseHandler:" + cbName +
      "&range=A1&headers=0&t=" + Date.now();
    document.head.appendChild(s);
  }

  var revealed = false;
  var pendingReveal = false;

  function reveal() {
    if (revealed) return;
    if (!answerLoaded) {            // ainda buscando a planilha: aguarda
      pendingReveal = true;
      return;
    }
    revealed = true;
    track("resultado_revelado", { resposta: currentAnswer });
  }

  // A resposta aparece direto, no desktop e no celular.
  reveal();

  // Busca a resposta na planilha (A1) e revela assim que estiver pronta
  loadAnswer(function (val) {
    applyAnswer(val);
    if (pendingReveal) {
      pendingReveal = false;
      reveal();
    }
  });

  // ---------- Compartilhar ----------
  shareBtn.addEventListener("click", function () {
    var url = location.href;
    var text = "O Neymar joga hoje? " + currentAnswer.toUpperCase() + ".";
    track("compartilhar", { resposta: currentAnswer });
    if (navigator.share) {
      navigator.share({ title: "O Neymar joga hoje?", text: text, url: url })
        .catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + " " + url).then(function () {
        var old = shareBtn.textContent;
        shareBtn.textContent = "Link copiado!";
        setTimeout(function () { shareBtn.textContent = old; }, 1800);
      });
    } else {
      window.prompt("Copie o link:", url);
    }
  });

  // Link "sobre" do rodapé abre a setinha de conteúdo
  var aboutLink = document.getElementById("aboutLink");
  var seo = document.getElementById("sobre");
  if (aboutLink && seo) {
    aboutLink.addEventListener("click", function (e) {
      e.preventDefault();
      seo.open = true;
      seo.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // (Ative quando colocar seu código do AdSense)
  // (adsbygoogle = window.adsbygoogle || []).push({});
})();
