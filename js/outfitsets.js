window.COTA = window.COTA || {};

COTA.outfitSets = (function () {
  let config = null;
  let loading = null;
  const active = { select: "default", relationship: "default" };
  const pickers = {};

  async function load() {
    if (config) return config;
    if (!loading) {
      loading = fetch("data/outfit-sets.json")
        .then((res) => res.json())
        .then((data) => {
          config = data;
          return config;
        })
        .catch(() => {
          config = { sets: [{ id: "default", name: "Default" }], defaultMusic: {} };
          return config;
        });
    }
    return loading;
  }

  function findSet(id) {
    return config ? config.sets.find((s) => s.id === id) : null;
  }

  function activeSetId(screen) {
    return active[screen];
  }

  function memberCodes() {
    const codes = [];
    (config ? config.sets : []).forEach((set) => {
      (set.characters || []).forEach((code) => {
        if (!codes.includes(code)) codes.push(code);
      });
    });
    return codes;
  }

  function usesAlt(screen, character) {
    const set = findSet(active[screen]);
    return !!(set && set.characters && character.altArt && set.characters.includes(character.code));
  }

  function boxartFile(screen, character) {
    return usesAlt(screen, character) ? character.altArt.boxart : `boxart_${character.code}.png`;
  }

  function renderFile(screen, character) {
    return usesAlt(screen, character) ? character.altArt.render : `render_${character.code}.png`;
  }

  function musicFor(screen) {
    const fallback = (config && config.defaultMusic && config.defaultMusic[screen]) || null;
    const set = findSet(active[screen]);
    if (set && set.music && set.music[screen]) return set.music[screen];
    return fallback;
  }

  function buildModal(screen, heading) {
    const modal = document.createElement("div");
    modal.className = "outfit-modal set-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="outfit-tag">
        <span class="outfit-tag-small">ALTERNATE ART SETS</span>
        <span class="outfit-tag-name">${heading}</span>
      </div>
      <div class="set-options" role="listbox"></div>
      <p class="set-note"></p>
      <button class="outfit-equip-btn set-equip-btn" type="button">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7.5V6.2a2 2 0 1 1 2 2"/><path d="M12 7.5 2.8 14.4a1.2 1.2 0 0 0 .7 2.1h17a1.2 1.2 0 0 0 .7-2.1z"/></svg>
        <span class="set-equip-label">Equip</span>
      </button>
      <button class="outfit-close-btn" type="button" aria-label="Close">&#10005;</button>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function createPicker(screen, button, heading, onEquip) {
    const modal = buildModal(screen, heading);
    const optionsEl = modal.querySelector(".set-options");
    const noteEl = modal.querySelector(".set-note");
    const equipBtn = modal.querySelector(".set-equip-btn");
    const equipLabel = modal.querySelector(".set-equip-label");
    let choice = active[screen];

    function renderOptions() {
      optionsEl.innerHTML = "";
      config.sets.forEach((set) => {
        const opt = document.createElement("button");
        opt.type = "button";
        opt.className = "set-option" + (set.id === choice ? " is-active" : "");
        opt.setAttribute("role", "option");
        opt.textContent = set.name;
        opt.addEventListener("click", () => {
          if (choice === set.id) return;
          choice = set.id;
          COTA.audio.playSfx("char_switch.mp3");
          renderOptions();
        });
        optionsEl.appendChild(opt);
      });
      const chosen = findSet(choice);
      noteEl.textContent = (chosen && chosen.note) || "";
      equipBtn.disabled = choice === active[screen];
      equipLabel.textContent = choice === active[screen] ? "Equipped" : "Equip";
    }

    function close() {
      modal.hidden = true;
      button.classList.remove("is-open");
    }

    async function open() {
      await load();
      choice = active[screen];
      renderOptions();
      button.classList.add("is-open");
      modal.hidden = false;
    }

    button.addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      open();
    });
    equipBtn.addEventListener("click", () => {
      active[screen] = choice;
      COTA.audio.playSfx("char_confirm.mp3");
      close();
      onEquip(choice);
    });
    modal.querySelector(".outfit-close-btn").addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      close();
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    pickers[screen] = { open, close };
    return pickers[screen];
  }

  function closeAll() {
    Object.keys(pickers).forEach((key) => pickers[key].close());
  }

  return { load, findSet, memberCodes, activeSetId, usesAlt, boxartFile, renderFile, musicFor, createPicker, closeAll };
})();
