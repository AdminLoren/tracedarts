window.COTA = window.COTA || {};

COTA.outfitSets = (function () {
  let config = null;
  let loading = null;
  const active = { select: "default", relationship: "default" };

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

  function createSelect(screen, selectEl, onChange) {
    selectEl.innerHTML = "";
    config.sets.forEach((set) => {
      const opt = document.createElement("option");
      opt.value = set.id;
      opt.textContent = set.name;
      selectEl.appendChild(opt);
    });
    selectEl.value = active[screen];
    selectEl.addEventListener("change", () => {
      active[screen] = selectEl.value;
      COTA.audio.playSfx("set_confirm.mp3");
      selectEl.blur();
      onChange(selectEl.value);
    });
  }

  return { load, findSet, memberCodes, activeSetId, usesAlt, boxartFile, renderFile, musicFor, createSelect };
})();
