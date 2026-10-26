window.COTA = window.COTA || {};

COTA.app = (function () {
  let currentTab = "home";
  let ready = false;

  function goToTab(tabName, opts = {}) {
    if (!ready) return;
    const resetView = opts.resetView !== false;
    if (tabName === currentTab && !opts.force) return;
    const overlay = document.getElementById("transition-overlay");
    overlay.classList.add("active");

    window.setTimeout(() => {
      COTA.audio.stopVoice();
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `tab-${tabName}`);
      });
      document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
      });
      currentTab = tabName;
      window.scrollTo(0, 0);

      if (tabName === "home") {
        COTA.home.play();
        COTA.audio.playMusic("home_bgm.mp3", "Planet Wisp - Area (Sonic Colors)");
      }
      if (tabName === "lore") {
        resetView ? COTA.lore.enter() : COTA.lore.init();
      }
      if (tabName === "stories") {
        COTA.stories.enter();
      }
      if (tabName === "relationship") {
        resetView ? COTA.relationship.enter() : COTA.relationship.init();
        COTA.audio.playMusic("relationship_bgm.mp3", "Menu (Mario Kart: Double Dash!!)");
      }

      window.setTimeout(() => overlay.classList.remove("active"), 250);
    }, 250);
  }

  function waitFor(promise, ms) {
    return new Promise((resolve) => {
      const timer = window.setTimeout(resolve, ms);
      Promise.resolve(promise).then(
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        () => {
          window.clearTimeout(timer);
          resolve();
        }
      );
    });
  }

  function pageLoaded() {
    return new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve();
        return;
      }
      window.addEventListener("load", resolve, { once: true });
    });
  }

  function videoLoaded(video) {
    return new Promise((resolve) => {
      if (!video || video.readyState >= 2) {
        resolve();
        return;
      }
      video.addEventListener("loadeddata", resolve, { once: true });
      video.addEventListener("error", resolve, { once: true });
    });
  }

  function imageLoaded(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = src;
    });
  }

  async function loadEverything() {
    const bar = document.getElementById("loading-bar");
    const pending = [];
    let total = 0;
    let done = 0;
    let shown = 0;

    function track(promise) {
      total += 1;
      pending.push(
        promise.then(() => {
          done += 1;
          shown = Math.max(shown, Math.round((done / total) * 100));
          if (bar) bar.style.width = `${shown}%`;
        })
      );
    }

    track(waitFor(pageLoaded(), 20000));
    track(waitFor(document.fonts ? document.fonts.ready : null, 8000));
    track(waitFor(videoLoaded(document.querySelector(".home-lore-bg")), 8000));
    track(waitFor(imageLoaded("assets/images/home_bg.png"), 8000));

    const dataPromise = Promise.all([COTA.data.getCharacters(), COTA.data.getRelationships()]);
    track(waitFor(dataPromise, 15000));

    let characters = [];
    try {
      characters = await COTA.data.getCharacters();
    } catch (err) {
      characters = [];
    }

    characters.forEach((c) => {
      track(waitFor(imageLoaded(`assets/images/boxart_${c.code}.png`), 10000));
      if (!c.comingSoon) {
        track(waitFor(imageLoaded(`assets/images/render_${c.code}.png`), 10000));
        track(waitFor(imageLoaded(`assets/images/graffiti_${c.code}.png`), 10000));
      }
    });

    await waitFor(Promise.all(pending), 25000);
  }

  function finishLoading() {
    const screen = document.getElementById("loading-screen");
    const bar = document.getElementById("loading-bar");
    if (bar) bar.style.width = "100%";
    ready = true;
    document.getElementById("site-header").inert = false;
    document.getElementById("app-root").inert = false;
    if (screen) {
      screen.classList.add("is-done");
      window.setTimeout(() => screen.remove(), 700);
    }
    window.setTimeout(() => {
      COTA.home.play(() => {
        document.getElementById("site-header").classList.remove("header-hold");
      });
    }, 700);
  }

  function init() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        COTA.audio.playSfx("ui_click.mp3");
        goToTab(btn.dataset.tab);
      });
    });
    document.querySelectorAll("[data-goto-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        COTA.audio.playSfx("ui_click.mp3");
        goToTab(btn.dataset.gotoTab);
      });
    });

    COTA.audio.init();
    COTA.home.render();
    COTA.audio.playMusic("home_bgm.mp3", "Planet Wisp - Area (Sonic Colors)");

    loadEverything().then(finishLoading, finishLoading);
  }

  function prepareLoading() {
    const header = document.getElementById("site-header");
    header.inert = true;
    header.classList.add("header-hold");
    document.getElementById("app-root").inert = true;
    document.getElementById("tab-home").classList.add("home-hold");
  }

  prepareLoading();

  return { init, goToTab };
})();

document.addEventListener("DOMContentLoaded", COTA.app.init);
