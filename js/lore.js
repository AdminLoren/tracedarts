window.COTA = window.COTA || {};

COTA.lore = (function () {
  let allCharacters = [];
  let comingSoonCharacters = [];
  let selectedCode = null;
  let openCharacterId = null;
  let initialized = false;
  let equippedAlt = {};
  let outfitIndex = 0;
  let introTimer = null;

  const BG_BY_GEN = {
    2: "assets/images/nijigasaki_bg.png",
    1: "assets/images/irregular_hunter_base_bg.png",
  };

  function cardTemplate(c) {
    const defaultBoxart = `boxart_${c.code}.png`;
    const boxart = c.altArt && equippedAlt[c.id] ? c.altArt.boxart : defaultBoxart;
    return `
      <button class="select-card" data-id="${c.id}" style="--char-color:${c.color}">
        <span class="select-card-clip">
          <img src="assets/images/${boxart}" alt="${c.name}" class="select-card-img" onerror="this.onerror=null;this.src='assets/images/${defaultBoxart}'" />
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

    [gen2Wrap, gen1Wrap].forEach((wrap) => {
      wrap.querySelectorAll(".select-card").forEach((cardEl) => {
        cardEl.addEventListener("click", () => onCardClick(cardEl.dataset.id));
        cardEl.addEventListener("pointerenter", (event) => {
          if (event.pointerType === "mouse") onCardHover(cardEl.dataset.id);
        });
      });
    });
    highlightSelectedCard();
  }

  function highlightSelectedCard() {
    document.querySelectorAll(".select-card:not(.coming-soon-card)").forEach((el) => {
      el.classList.toggle("is-highlighted", el.dataset.id === selectedCode);
    });
  }

  function onCardHover(id) {
    if (id === selectedCode) return;
    selectedCode = id;
    highlightSelectedCard();
    COTA.audio.playSfx("char_switch.mp3");
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

  function playSelectIntro() {
    const selectScreen = document.getElementById("lore-select-screen");
    selectScreen.querySelectorAll(".select-grid").forEach((grid) => {
      Array.from(grid.children).forEach((card, i) => {
        card.style.setProperty("--wave", i % 3);
      });
    });
    selectScreen.classList.remove("select-anim");
    void selectScreen.offsetWidth;
    selectScreen.classList.add("select-anim");
    window.clearTimeout(introTimer);
    introTimer = window.setTimeout(() => selectScreen.classList.remove("select-anim"), 3000);
  }

  function showSelectScreen() {
    window.scrollTo(0, 0);
    document.getElementById("lore-index-screen").classList.remove("active");
    const selectScreen = document.getElementById("lore-select-screen");
    selectScreen.classList.add("active", "slide-in-bottom");
    selectedCode = openCharacterId || selectedCode;
    renderGrids();
    playSelectIntro();
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

  function setImageWithFallback(img, src, fallback) {
    img.onerror = () => {
      img.onerror = null;
      img.src = fallback;
    };
    img.src = src;
  }

  function getOutfits(character) {
    const list = [
      {
        name: character.altArt ? "Default" : character.name,
        boxart: `boxart_${character.code}.png`,
        render: `render_${character.code}.png`,
      },
    ];
    if (character.altArt) {
      list.push({
        name: character.altArt.name,
        boxart: character.altArt.boxart,
        render: character.altArt.render,
      });
    }
    return list;
  }

  function currentCharacter() {
    return allCharacters.find((c) => c.id === openCharacterId);
  }

  function closeOutfitModal() {
    document.getElementById("outfit-modal").hidden = true;
    document.getElementById("lore-index-outfit-btn").classList.remove("is-open");
  }

  function renderOutfitModal() {
    const character = currentCharacter();
    if (!character) return;
    const outfits = getOutfits(character);
    const defaults = outfits[0];
    const strip = document.getElementById("outfit-strip");
    strip.innerHTML = "";
    outfits.forEach((outfit, i) => {
      const panel = document.createElement("button");
      panel.type = "button";
      panel.className = "outfit-panel" + (i === outfitIndex ? " is-active" : "");
      const img = document.createElement("img");
      img.alt = outfit.name;
      setImageWithFallback(img, `assets/images/${outfit.boxart}`, `assets/images/${defaults.boxart}`);
      const label = document.createElement("span");
      label.className = "outfit-panel-name";
      label.textContent = outfit.name;
      panel.appendChild(img);
      panel.appendChild(label);
      panel.addEventListener("click", () => {
        if (i === outfitIndex) return;
        outfitIndex = i;
        COTA.audio.playSfx("alt_switch.mp3");
        renderOutfitModal();
      });
      strip.appendChild(panel);
    });
    document.getElementById("outfit-tag-name").textContent = outfits[outfitIndex].name;
    document.getElementById("outfit-owner-name").textContent = character.name;
    const equippedIndex = equippedAlt[character.id] ? 1 : 0;
    const equipBtn = document.getElementById("outfit-equip-btn");
    equipBtn.disabled = outfitIndex === equippedIndex;
    document.getElementById("outfit-equip-label").textContent =
      outfitIndex === equippedIndex ? "Equipped" : "Equip";
  }

  function openOutfitModal() {
    const character = currentCharacter();
    if (!character || !character.altArt) return;
    outfitIndex = equippedAlt[character.id] ? 1 : 0;
    document.getElementById("lore-index-outfit-btn").classList.add("is-open");
    document.getElementById("outfit-modal").hidden = false;
    renderOutfitModal();
  }

  function stepOutfit(delta) {
    const character = currentCharacter();
    if (!character) return;
    const total = getOutfits(character).length;
    outfitIndex = (outfitIndex + delta + total) % total;
    COTA.audio.playSfx("char_switch.mp3");
    renderOutfitModal();
  }

  function equipOutfit() {
    const character = currentCharacter();
    if (!character) return;
    equippedAlt[character.id] = outfitIndex === 1;
    COTA.audio.playSfx("char_confirm.mp3");
    closeOutfitModal();
    renderIndexContent(character);
  }

  function renderIndexContent(character) {
    closeOutfitModal();
    const outfits = getOutfits(character);
    const activeOutfit = equippedAlt[character.id] ? outfits[1] : outfits[0];
    const renderImg = document.getElementById("lore-index-render");
    setImageWithFallback(renderImg, `assets/images/${activeOutfit.render}`, `assets/images/${outfits[0].render}`);
    renderImg.alt = activeOutfit.name;
    document.getElementById("lore-index-outfit-btn").hidden = !character.altArt;
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
    graffitiImg.dataset.code = character.code;
    document.getElementById("lore-index-fullname").textContent =
      character.nickname && character.nickname !== "NOT REGISTERED YET"
        ? character.nickname
        : character.name;
    const voiceRow = document.getElementById("lore-index-voice");
    const quoteEl = document.getElementById("lore-index-quote");
    COTA.audio.stopVoice();
    document.getElementById("lore-index-mic-btn").classList.remove("is-playing");
    quoteEl.hidden = true;
    quoteEl.textContent = "";
    voiceRow.hidden = !character.quote;
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

    await COTA.outfitSets.load();
    COTA.outfitSets.createSelect("select", document.getElementById("lore-select-set"), applySelectSet);

    document.getElementById("lore-index-mic-btn").addEventListener("click", () => {
      const character = allCharacters.find((c) => c.id === openCharacterId);
      if (!character || !character.quote) return;
      const quoteEl = document.getElementById("lore-index-quote");
      const micBtn = document.getElementById("lore-index-mic-btn");
      quoteEl.textContent = `\u201C${character.quote}\u201D`;
      quoteEl.hidden = false;
      quoteEl.classList.remove("quote-in");
      void quoteEl.offsetWidth;
      quoteEl.classList.add("quote-in");
      micBtn.classList.add("is-playing");
      COTA.audio.playVoice(`voice_${character.code}.mp3`, () => micBtn.classList.remove("is-playing"));
    });
    document.getElementById("lore-index-outfit-btn").addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      openOutfitModal();
    });
    document.getElementById("outfit-prev-btn").addEventListener("click", () => stepOutfit(-1));
    document.getElementById("outfit-next-btn").addEventListener("click", () => stepOutfit(1));
    document.getElementById("outfit-equip-btn").addEventListener("click", equipOutfit);
    document.getElementById("outfit-close-btn").addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      closeOutfitModal();
    });
    document.getElementById("outfit-modal").addEventListener("click", (e) => {
      if (e.target.id === "outfit-modal") closeOutfitModal();
    });
    document.getElementById("lore-prev-btn").addEventListener("click", () => step(-1));
    document.getElementById("lore-next-btn").addEventListener("click", () => step(1));
    document.getElementById("lore-back-to-select-btn").addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      COTA.audio.stopVoice();
      closeOutfitModal();
      showSelectScreen();
    });
  }

  function playSelectMusic() {
    const music = COTA.outfitSets.musicFor("select");
    COTA.audio.playMusic(music.file, music.title);
  }

  function applySelectSet(setId) {
    const set = COTA.outfitSets.findSet(setId);
    const members = COTA.outfitSets.memberCodes();
    allCharacters.forEach((c) => {
      if (!c.altArt || !members.includes(c.code)) return;
      equippedAlt[c.id] = !!(set && set.characters && set.characters.includes(c.code));
    });
    renderGrids();
    playSelectMusic();
  }

  async function enter() {
    await init();
    showSelectScreen();
    playSelectMusic();
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
