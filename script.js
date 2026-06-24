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

  // A resposta. É piada: quase sempre "NÃO".
  // (1 em ~1000 ele "joga", só pra render compartilhamento)
  var joga = Math.random() < 0.001;
  answerText.textContent = joga ? "SIM" : "NÃO";
  answerEl.classList.toggle("is-yes", joga);

  // Detecta se faz sentido pedir pra chacoalhar (mobile / suporta movimento)
  var isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (window.matchMedia && window.matchMedia("(max-width: 720px)").matches);
  var hasMotion = typeof window.DeviceMotionEvent !== "undefined";

  var revealed = false;

  function reveal(viaShake) {
    if (revealed) return;
    revealed = true;
    if (hintEl) hintEl.hidden = true;
    answerEl.setAttribute("data-state", "shown");
    if (viaShake) {
      answerEl.classList.add("shook");
      vibrate([30, 40, 30]);
    }
    track("resultado_revelado", {
      resposta: joga ? "sim" : "nao",
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
    var text = "O Neymar joga hoje? " + (joga ? "SIM!" : "NÃO.");
    track("compartilhar", { resposta: joga ? "sim" : "nao" });
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

  // (Ative quando colocar seu código do AdSense)
  // (adsbygoogle = window.adsbygoogle || []).push({});
})();
