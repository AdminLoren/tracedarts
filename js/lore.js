window.COTA = window.COTA || {};

COTA.lore = (function () {
  let allCharacters = [];
  let comingSoonCharacters = [];
  let selectedCode = null;
  let openCharacterId = null;
  let initialized = false;

  const BG_BY_GEN = {
    2: "assets/images/nijigasaki_bg.png",
    1: "assets/images/irregular_hunter_base_bg.png",
  };

  function cardTemplate(c) {
    return `
      <button class="select-card" data-id="${c.id}" style="--char-color:${c.color}">
        <span class="select-card-clip">
          <img src="assets/images/boxart_${c.code}.png" alt="${c.name}" class="select-card-img" />
          <span class="select-card-nameplate">${c.name}</span>
        </span>
      </button>
    `;
  }

  function comingSoonCardTemplate(c) {
    return `
      <div class="select-card coming-soon-card" style="--char-color:${c.color}">
        <span class="select-card-clip">
          <img src="assets/images/boxart_${c.code}.png" alt="${c.name}" class="select-card-img" />
          <span class="coming-soon-ribbon">Coming Soon</span>
          <span class="select-card-nameplate">${c.name}</span>
        </span>
      </div>
    `;
  }

  function renderComingSoonGrids() {
    const gen2Wrap = document.getElementById("lore-select-comingsoon-2nd");
    const gen1Wrap = document.getElementById("lore-select-comingsoon-1st");
    const seniorsWrap = document.getElementById("lore-select-comingsoon-seniors");
    if (!gen2Wrap || !seniorsWrap) return;
    gen2Wrap.innerHTML = comingSoonCharacters
      .filter((c) => c.comingSoonGroup === "2nd Gen")
      .map(comingSoonCardTemplate)
      .join("");
    if (gen1Wrap) {
      gen1Wrap.innerHTML = comingSoonCharacters
        .filter((c) => c.comingSoonGroup === "1st Gen")
        .map(comingSoonCardTemplate)
        .join("");
    }
    seniorsWrap.innerHTML = comingSoonCharacters
      .filter((c) => c.comingSoonGroup === "Seniors")
      .map(comingSoonCardTemplate)
      .join("");

    const authorGodsWrap = document.getElementById("lore-select-authorgods");
    if (authorGodsWrap) {
      authorGodsWrap.innerHTML = comingSoonCharacters
        .filter((c) => c.comingSoonGroup === "Author Gods")
        .map(comingSoonCardTemplate)
        .join("");
    }
  }

  function renderGrids() {
    const gen2Wrap = document.getElementById("lore-select-gen2");
    const gen1Wrap = document.getElementById("lore-select-gen1");
    gen2Wrap.innerHTML = allCharacters.filter((c) => c.gen === 2).map(cardTemplate).join("");
    gen1Wrap.innerHTML = allCharacters.filter((c) => c.gen === 1).map(cardTemplate).join("");

    gen2Wrap.querySelectorAll(".select-card").forEach((cardEl) => {
      cardEl.addEventListener("click", () => onCardClick(cardEl.dataset.id));
    });
    gen1Wrap.querySelectorAll(".select-card").forEach((cardEl) => {
      cardEl.addEventListener("click", () => onCardClick(cardEl.dataset.id));
    });
    highlightSelectedCard();
  }

  function highlightSelectedCard() {
    document.querySelectorAll(".select-card:not(.coming-soon-card)").forEach((el) => {
      el.classList.toggle("is-highlighted", el.dataset.id === selectedCode);
    });
  }

  function onCardClick(id) {
    const character = COTA.data.findCharacter(allCharacters, id);
    if (id === selectedCode) {
      confirmSelection(character);
      return;
    }
    selectedCode = id;
    highlightSelectedCard();
    COTA.audio.playSfx("char_switch.mp3");
  }

  function confirmSelection(character) {
    COTA.audio.playSfx("char_confirm.mp3");
    COTA.audio.playSfx(`char_announce_${character.code}.mp3`);
    openCharacterId = character.id;
    COTA.audio.playMusic(character.bgm.file, character.bgm.title);
    showIndexScreen(character);
  }

  function showSelectScreen() {
    window.scrollTo(0, 0);
    document.getElementById("lore-index-screen").classList.remove("active");
    const selectScreen = document.getElementById("lore-select-screen");
    selectScreen.classList.add("active", "slide-in-bottom");
    selectedCode = openCharacterId || selectedCode;
    renderGrids();
    window.setTimeout(() => selectScreen.classList.remove("slide-in-bottom"), 500);
  }

  function showIndexScreen(character) {
    window.scrollTo(0, 0);
    const selectScreen = document.getElementById("lore-select-screen");
    const indexScreen = document.getElementById("lore-index-screen");
    selectScreen.classList.remove("active");
    indexScreen.classList.add("active", "fade-in");
    window.setTimeout(() => indexScreen.classList.remove("fade-in"), 400);
    renderIndexContent(character);
  }

  function renderIndexContent(character) {
    document.getElementById("lore-index-render").src = `assets/images/render_${character.code}.png`;
    document.getElementById("lore-index-render").alt = character.name;
    const indexBadge = document.getElementById("lore-index-franchise-badge");
    if (character.franchiseLogo) {
      indexBadge.src = `assets/images/${character.franchiseLogo}`;
      indexBadge.style.display = "";
    } else {
      indexBadge.style.display = "none";
    }
    const graffitiImg = document.getElementById("lore-index-graffiti-name");
    graffitiImg.src = `assets/images/graffiti_${character.code}.png`;
    graffitiImg.alt = character.name;
    graffitiImg.dataset.code = character.code; // lets the CSS resize one character's name art
    document.getElementById("lore-index-fullname").textContent =
      character.nickname && character.nickname !== "NOT REGISTERED YET"
        ? character.nickname
        : character.name;
    document.getElementById("lore-index-bio").textContent = character.bio;
    document.getElementById("lore-index-birthdate-label").textContent = character.birthdateLabel || "Birthdate";
    document.getElementById("lore-index-birthdate").textContent = character.birthdate;
    document.getElementById("lore-index-occupation").textContent = character.occupation;
    document.getElementById("lore-index-cherishes").textContent = character.cherishes.join(", ");
    document.getElementById("lore-index-dislikes").textContent = character.dislikes.join(", ");

    const abilitiesList = document.getElementById("lore-index-abilities");
    abilitiesList.innerHTML = character.abilities
      .map((a) => `<li><strong>${a.name}</strong> — ${a.desc}</li>`)
      .join("");

    const bg = document.getElementById("lore-index-bg");
    bg.style.backgroundImage = `url('${BG_BY_GEN[character.gen]}')`;
    const overlay = document.getElementById("lore-index-color-overlay");
    overlay.style.setProperty("--overlay-color", character.color);
  }

  function step(delta) {
    COTA.audio.playSfx("switch.mp3");
    const idx = allCharacters.findIndex((c) => c.id === openCharacterId);
    const nextIdx = (idx + delta + allCharacters.length) % allCharacters.length;
    const nextChar = allCharacters[nextIdx];

    const content = document.getElementById("lore-index-content");
    content.classList.add("index-swap-out");
    window.setTimeout(() => {
      openCharacterId = nextChar.id;
      selectedCode = nextChar.id;
      window.scrollTo(0, 0);
      COTA.audio.playMusic(nextChar.bgm.file, nextChar.bgm.title);
      renderIndexContent(nextChar);
      content.classList.remove("index-swap-out");
    }, 180);
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    const fetched = await COTA.data.getCharacters();
    allCharacters = fetched.filter((c) => !c.comingSoon);
    comingSoonCharacters = fetched.filter((c) => c.comingSoon);
    const defaultChar = allCharacters.find((c) => c.isDefault) || allCharacters[0];
    selectedCode = defaultChar.id;
    renderGrids();
    renderComingSoonGrids();

    document.getElementById("lore-prev-btn").addEventListener("click", () => step(-1));
    document.getElementById("lore-next-btn").addEventListener("click", () => step(1));
    document.getElementById("lore-back-to-select-btn").addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      showSelectScreen();
    });
  }

  async function enter() {
    await init();
    showSelectScreen();
    COTA.audio.playMusic("char_select.mp3", "Online Menu (Sonic Generations)");
  }

  async function openCharacterById(id) {
    await init();
    const character = COTA.data.findCharacter(allCharacters, id);
    if (!character) return;
    openCharacterId = character.id;
    selectedCode = character.id;
    COTA.audio.playMusic(character.bgm.file, character.bgm.title);
    showIndexScreen(character);
  }

  return { init, enter, openCharacterById, showSelectScreen };
})();
