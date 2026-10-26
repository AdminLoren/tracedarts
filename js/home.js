window.COTA = window.COTA || {};

COTA.home = (function () {
  const SUBTITLE_START = 1.8;
  const SUBTITLE_STEP = 0.08;
  const REST_GAP = 0.5;
  let letterCount = 0;

  function render() {}

  function splitSubtitle() {
    if (letterCount) return letterCount;
    const subtitle = document.querySelector(".home-subtitle");
    const text = subtitle.textContent.trim();
    subtitle.setAttribute("aria-label", text);
    subtitle.textContent = "";
    Array.from(text).forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "home-letter";
      span.setAttribute("aria-hidden", "true");
      span.style.setProperty("--i", i);
      span.textContent = ch;
      subtitle.appendChild(span);
    });
    letterCount = text.length;
    return letterCount;
  }

  function play(onRest) {
    const panel = document.getElementById("tab-home");
    const letters = splitSubtitle();
    const restDelay = SUBTITLE_START + letters * SUBTITLE_STEP + REST_GAP;

    panel.style.setProperty("--home-sub-start", `${SUBTITLE_START}s`);
    panel.style.setProperty("--home-sub-step", `${SUBTITLE_STEP}s`);
    panel.style.setProperty("--home-rest-delay", `${restDelay}s`);
    panel.classList.remove("home-hold", "home-play");
    void panel.offsetWidth;
    panel.classList.add("home-play");

    if (onRest) window.setTimeout(onRest, restDelay * 1000);
  }

  return { render, play };
})();
