window.COTA = window.COTA || {};

COTA.relationship = (function () {
  let allCharacters = [];
  let allRelationships = [];
  let slots = [null, null];
  let initialized = false;

  function rosterCardTemplate(c) {
    return `
      <button class="rel-roster-card" data-id="${c.id}" style="--char-color:${c.color}">
        <span class="rel-roster-clip">
          <img src="assets/images/boxart_${c.code}.png" alt="${c.name}" class="rel-roster-img" />
          <span class="rel-roster-nameplate">${c.name}</span>
        </span>
      </button>
    `;
  }

  function renderRoster() {
    const gen2Wrap = document.getElementById("rel-roster-gen2");
    const gen1Wrap = document.getElementById("rel-roster-gen1");
    gen2Wrap.innerHTML = allCharacters.filter((c) => c.gen === 2).map(rosterCardTemplate).join("");
    gen1Wrap.innerHTML = allCharacters.filter((c) => c.gen === 1).map(rosterCardTemplate).join("");

    document.querySelectorAll(".rel-roster-card").forEach((el) => {
      el.addEventListener("click", () => onRosterPick(el.dataset.id));
    });
    refreshRosterHighlight();
  }

  // Returns true if these two characters have a pairing in relationships.json
  function hasPairing(idA, idB) {
    return COTA.data.findRelationship(allRelationships, idA, idB) !== undefined;
  }

  function refreshRosterHighlight() {
    // Is exactly one character picked so far? If yes, remember who.
    const filled = slots.filter(Boolean);
    const firstPick = filled.length === 1 ? filled[0] : null;

    document.querySelectorAll(".rel-roster-card").forEach((el) => {
      const id = el.dataset.id;

      // Grey out the cards that are already picked (same as before)
      el.classList.toggle("is-picked", slots.includes(id));

      // Grey out and lock the cards that have NO pairing with the first pick.
      // (If nobody is picked yet, firstPick is null, so nothing is locked.)
      const noPairing = firstPick !== null && id !== firstPick && !hasPairing(firstPick, id);
      el.classList.toggle("is-unavailable", noPairing);
      el.disabled = noPairing; // a disabled button cannot be clicked
    });
  }

  function slotTemplate(index) {
    const id = slots[index];
    const slotEl = document.getElementById(`rel-slot-${index}`);
    if (!id) {
      slotEl.innerHTML = `<span class="rel-slot-placeholder">${index + 1}</span>`;
      slotEl.classList.remove("is-filled");
      return;
    }
    const character = COTA.data.findCharacter(allCharacters, id);
    slotEl.classList.add("is-filled");
    slotEl.innerHTML = `
      <button class="rel-slot-remove" data-slot="${index}" aria-label="Remove ${character.name}">&times;</button>
      <img src="assets/images/boxart_${character.code}.png" alt="${character.name}" class="rel-slot-img" />
      <span class="rel-slot-name">${character.name}</span>
    `;
  }

  function renderSlots() {
    slotTemplate(0);
    slotTemplate(1);
    document.querySelectorAll(".rel-slot-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeSlot(Number(btn.dataset.slot));
      });
    });
  }

  function updateStatusText() {
    const statusEl = document.getElementById("rel-pick-status");
    const filledCount = slots.filter(Boolean).length;
    if (filledCount === 0) statusEl.textContent = "Choose your first character";
    else if (filledCount === 1) statusEl.textContent = "Choose your second character";
  }

  function removeSlot(index) {
    slots[index] = null;
    renderSlots();
    refreshRosterHighlight();
    updateStatusText();
  }

  function onRosterPick(id) {
    if (slots.includes(id)) return;
    if (document.querySelector(`.rel-roster-card[data-id="${id}"]`).disabled) return; // locked card
    const emptyIndex = slots.findIndex((s) => s === null);
    if (emptyIndex === -1) return;
    slots[emptyIndex] = id;
    renderSlots();
    refreshRosterHighlight();

    if (slots[0] && slots[1]) {
      COTA.audio.playSfx("link.mp3");
      showRelationship(slots[0], slots[1]);
    } else {
      COTA.audio.playSfx("switch.mp3");
      updateStatusText();
    }
  }

  // Shrinks a character picture to match their real height.
  // heightScale (in characters.json) is 1 for Fumio (the standard size).
  // Characters taller than Fumio are bigger than 1, shorter ones are smaller than 1.
  // The picture shrinks from its feet, so everyone still stands on the same ground.
  function setHeight(imgId, character) {
    const scale = character.heightScale || 1; // no heightScale = normal size
    document.getElementById(imgId).style.transform = `scale(${scale})`;
  }

  function showRelationship(idA, idB) {
    const charA = COTA.data.findCharacter(allCharacters, idA);
    const charB = COTA.data.findCharacter(allCharacters, idB);
    const rel = COTA.data.findRelationship(allRelationships, idA, idB);

    document.getElementById("rel-char-a-render").src = `assets/images/render_${charA.code}.png`;
    document.getElementById("rel-char-a-render").alt = charA.name;
    setHeight("rel-char-a-render", charA); // real height, relative to the others
    document.getElementById("rel-char-a-name").src = `assets/images/graffiti_${charA.code}.png`;
    document.getElementById("rel-char-a-name").alt = charA.name;
    document.getElementById("rel-char-a-name").dataset.code = charA.code; // lets the CSS resize one character's name art

    document.getElementById("rel-char-b-render").src = `assets/images/render_${charB.code}.png`;
    document.getElementById("rel-char-b-render").alt = charB.name;
    setHeight("rel-char-b-render", charB); // real height, relative to the others
    document.getElementById("rel-char-b-name").src = `assets/images/graffiti_${charB.code}.png`;
    document.getElementById("rel-char-b-name").alt = charB.name;
    document.getElementById("rel-char-b-name").dataset.code = charB.code; // lets the CSS resize one character's name art

    const type = rel ? rel.type : "N/A";
    const title = rel ? rel.title : "NOT REGISTERED YET";
    const bio = rel ? rel.bio : "This pairing hasn't been registered yet.";

    document.getElementById("rel-title").textContent = title;
    document.getElementById("rel-specific-title").textContent = type;
    document.getElementById("rel-bio").textContent = bio;

    const overlay = document.getElementById("rel-color-overlay");
    overlay.style.backgroundColor = COTA.data.RELATIONSHIP_COLORS[type] || COTA.data.RELATIONSHIP_COLORS["N/A"];

    document.getElementById("relationship-select-screen").classList.remove("active");
    const display = document.getElementById("relationship-display-screen");
    display.classList.add("active", "fade-in");
    window.scrollTo(0, 0);
    window.setTimeout(() => display.classList.remove("fade-in"), 400);
  }

  function resetToSelect() {
    slots = [null, null];
    renderSlots();
    refreshRosterHighlight();
    updateStatusText();
    window.scrollTo(0, 0);
    document.getElementById("relationship-display-screen").classList.remove("active");
    document.getElementById("relationship-select-screen").classList.add("active");
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    allCharacters = await COTA.data.getCharacters();
    allRelationships = await COTA.data.getRelationships();
    renderRoster();
    renderSlots();
    document.getElementById("rel-link-another-btn").addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      resetToSelect();
    });
  }

  async function enter() {
    await init();
    resetToSelect();
  }

  return { init, enter };
})();
