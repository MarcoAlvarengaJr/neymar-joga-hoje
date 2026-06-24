(function () {
  "use strict";

  var answerEl = document.getElementById("answer");
  var answerText = document.getElementById("answerText");
  var hintEl = document.getElementById("shakeHint");
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

  // Detecta se faz sentido pedir pra chacoalhar (mobile / suporta movimento)
  var isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (window.matchMedia && window.matchMedia("(max-width: 720px)").matches);
  var hasMotion = typeof window.DeviceMotionEvent !== "undefined";

  var revealed = false;
  var pendingReveal = false;
  var pendingViaShake = false;

  function reveal(viaShake) {
    if (revealed) return;
    if (!answerLoaded) {            // ainda buscando a planilha: aguarda
      pendingReveal = true;
      pendingViaShake = viaShake;
      return;
    }
    revealed = true;
    if (hintEl) hintEl.hidden = true;
    answerEl.setAttribute("data-state", "shown");
    if (viaShake) {
      answerEl.classList.add("shook");
      vibrate([30, 40, 30]);
    }
    track("resultado_revelado", {
      resposta: currentAnswer,
      via: viaShake ? "chacoalhada" : "automatico"
    });
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  // ---------- Desktop: mostra direto ----------
  if (!isMobile || !hasMotion) {
    reveal(false);
  } else {
    // ---------- Mobile: esconde e pede pra chacoalhar ----------
    answerEl.setAttribute("data-state", "hidden");
    hintEl.hidden = false;
    startShakeDetection();
  }

  // Busca a resposta na planilha (A1) e revela assim que estiver pronta
  loadAnswer(function (val) {
    applyAnswer(val);
    if (pendingReveal) {
      pendingReveal = false;
      reveal(pendingViaShake);
    }
  });

  function startShakeDetection() {
    // iOS 13+ exige permissão via gesto do usuário.
    var needsPermission =
      typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function";

    function listen() {
      var last = { x: 0, y: 0, z: 0 };
      var lastTime = 0;
      var SHAKE_THRESHOLD = 14;

      window.addEventListener("devicemotion", function (e) {
        var acc = e.accelerationIncludingGravity || e.acceleration;
        if (!acc) return;
        var now = Date.now();
        if (now - lastTime < 80) return;

        var dx = Math.abs((acc.x || 0) - last.x);
        var dy = Math.abs((acc.y || 0) - last.y);
        var dz = Math.abs((acc.z || 0) - last.z);

        if ((dx + dy + dz) > SHAKE_THRESHOLD) {
          reveal(true);
        }

        last = { x: acc.x || 0, y: acc.y || 0, z: acc.z || 0 };
        lastTime = now;
      });
    }

    if (needsPermission) {
      // Precisa de toque pra pedir permissão de movimento (iOS).
      var ask = function () {
        DeviceMotionEvent.requestPermission()
          .then(function (state) {
            if (state === "granted") listen();
            else reveal(false); // negou -> mostra mesmo assim
          })
          .catch(function () { reveal(false); });
        document.removeEventListener("click", ask);
        document.removeEventListener("touchend", ask);
      };
      document.addEventListener("click", ask);
      document.addEventListener("touchend", ask);
    } else {
      listen();
    }

    // Fallback: tocar na dica revela (caso o aparelho não tenha sensor)
    hintEl.addEventListener("click", function () { reveal(true); });
  }

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
