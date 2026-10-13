window.COTA = window.COTA || {};

COTA.stories = (function () {
  let stories = [];
  let currentStory = null;
  let pages = [];
  let pageIndex = 0;
  let activeCues = [];
  let libraryMusic = null;
  let spoilerMode = false;
  let veilAllowed = false;
  const CUE_LINE = 0.55;
  const chapterCache = {};

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function byId(id) { return document.getElementById(id); }

  function remember(key, value) {
    try { localStorage.setItem("cota-" + key, JSON.stringify(value)); } catch (e) {}
  }
  function recall(key, fallback) {
    try {
      const saved = localStorage.getItem("cota-" + key);
      return saved === null ? fallback : JSON.parse(saved);
    } catch (e) { return fallback; }
  }

  function fillParagraphs(container, list) {
    container.innerHTML = "";
    (list || []).forEach((text) => container.appendChild(el("p", "", text)));
  }

  async function loadStories() {
    if (stories.length) return;
    try {
      const res = await fetch("data/stories.json");
      const data = await res.json();
      stories = data.stories || [];
      libraryMusic = data.libraryMusic || null;
    } catch (err) {
      stories = [];
    }
  }

  async function loadChapterText(chapter) {
    if (chapterCache[chapter.file]) return chapterCache[chapter.file];
    try {
      const res = await fetch(chapter.file);
      if (!res.ok) throw new Error("not found");
      const text = await res.text();
      chapterCache[chapter.file] = text;
      return text;
    } catch (err) {
      return "This chapter could not be loaded. Make sure this file exists in your project folder:\n\n" + chapter.file;
    }
  }

  let nameLookup = {};
  let nameRegex = null;
  let namesReady = false;
  let namesStory = "";
  let storySpeakers = {};

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async function prepareNames() {
    const storyKey = currentStory ? currentStory.id : "";
    if (namesReady && namesStory === storyKey) return;
    let characters = [];
    try { characters = await COTA.data.getCharacters(); } catch (e) {}

    nameLookup = {};
    characters.forEach((character) => {
      if (!character.nameGradient || !character.nameAliases) return;
      character.nameAliases.forEach((alias) => { nameLookup[alias] = character; });
    });

    storySpeakers = (currentStory && currentStory.speakers) || {};
    Object.keys(storySpeakers).forEach((key) => {
      (storySpeakers[key].nameAliases || []).forEach((alias) => { nameLookup[alias] = storySpeakers[key]; });
    });

    const aliases = Object.keys(nameLookup).sort((a, b) => b.length - a.length);
    if (aliases.length) {
      nameRegex = new RegExp(
        "(" + aliases.map(escapeRegex).join("|") + ")((?:-(?:kun|chan|san|sama|sensei|senpai|dono|tan))?)(?![A-Za-z])",
        "g"
      );
    }
    namesReady = true;
    namesStory = storyKey;
  }

  function speakerByTag(tag) {
    return nameLookup[tag] || storySpeakers[tag] || null;
  }

  function gradientOf(character) {
    return "linear-gradient(180deg, " + character.nameGradient.join(", ") + ")";
  }

  function findNames(text) {
    const found = [];
    if (!nameRegex) return found;
    nameRegex.lastIndex = 0;
    let match;
    while ((match = nameRegex.exec(text)) !== null) {
      const before = match.index > 0 ? text[match.index - 1] : "";
      if (/[A-Za-z~]/.test(before)) continue;

      let start = match.index;
      const lead = text.slice(Math.max(0, start - 6), start);
      if (/(Uncle|Auntie) $/.test(lead)) {
        start -= /Uncle $/.test(lead) ? 6 : 7;
      } else if (/['\u2019]$/.test(lead) && !/[A-Za-z0-9]['\u2019]$/.test(lead)) {
        start -= 1;
      }
      found.push({ start: start, end: match.index + match[0].length, character: nameLookup[match[1]] });
    }
    return found;
  }

  function firstName(text) {
    const found = findNames(text);
    return found.length ? found[0].character : null;
  }

  function actorOf(sentence) {
    const found = findNames(sentence);
    if (!found.length) return null;
    for (const name of found) {
      const lead = sentence.slice(Math.max(0, name.start - 7), name.start);
      if (/(\bas|\bwhile) $/.test(lead)) return name.character;
    }
    return found[0].character;
  }

  function readParagraph(text, state) {
    const thought = text.match(/^\[([^\]]+)\]\s*([^"]+)$/);
    if (thought && thought[1].trim().toLowerCase() !== "none") {
      const thinker = speakerByTag(thought[1].trim());
      state.pendingActor = null;
      if (thinker) {
        if (thinker !== state.last) { state.prev = state.last; state.last = thinker; }
      }
      return [{ type: "thought", text: thought[2], speaker: thinker }];
    }
    const pieces = [];
    const parts = text.split('"');
    const hasUnclosedQuote = parts.length % 2 === 0;
    let narrationBefore = "";

    for (let i = 0; i < parts.length; i++) {
      const isQuote = i % 2 === 1 && !(hasUnclosedQuote && i === parts.length - 1);
      if (!isQuote) {
        const raw = parts[i] + (hasUnclosedQuote && i === parts.length - 1 && i > 0 ? '"' : "");
        narrationBefore = raw;
        pieces.push({ type: "narration", text: raw });
        continue;
      }
      pieces.push({ type: "quote", text: parts[i], before: narrationBefore, after: parts[i + 1] || "" });
    }

    pieces.forEach((piece, i) => {
      if (piece.type !== "quote") return;
      const prev = pieces[i - 1];
      const tag = prev && prev.text.match(/\[([^\]]+)\]\s*$/);
      if (tag) {
        prev.text = prev.text.replace(/\[([^\]]+)\]\s*$/, "");
        piece.forced = tag[1].trim();
      }
    });

    let lastInParagraph = null;
    pieces.forEach((piece, i) => {
      if (piece.type !== "quote") return;
      const before = (pieces[i - 1] ? pieces[i - 1].text : "").trim();
      const after = (pieces[i + 1] ? pieces[i + 1].text : "").trim();
      let speaker = null;

      if (piece.forced) {
        speaker = piece.forced.toLowerCase() === "none" ? null : speakerByTag(piece.forced);
        piece.speaker = speaker;
      } else {
        const afterNames = findNames(after);
        if (afterNames.length && afterNames[0].start === 0) speaker = afterNames[0].character;

        if (!speaker) {
          const pronounMatch = after.match(/^(he|she)\b/i);
          if (pronounMatch) {
            const wanted = pronounMatch[1].toLowerCase();
            const beforeNames = findNames(before);
            const candidates = [
              beforeNames.length ? beforeNames[beforeNames.length - 1].character : null,
              lastInParagraph, state.pendingActor, state.last, state.prev,
            ];
            speaker = candidates.find((c) => c && c.pronoun === wanted) || null;
          }
        }

        if (!speaker && before) {
          const sentences = before.split(/(?<=[.!?\u2026])\s+/);
          speaker = firstName(sentences[sentences.length - 1]);
        }

        if (!speaker && lastInParagraph && before) speaker = lastInParagraph;

        if (!speaker && !before && state.pendingActor) speaker = state.pendingActor;

        if (!speaker && state.prev) speaker = state.prev;
        piece.speaker = speaker;
      }

      if (piece.speaker) {
        if (piece.speaker !== state.last) { state.prev = state.last; state.last = piece.speaker; }
        lastInParagraph = piece.speaker;
      }
    });

    const hasQuote = pieces.some((p) => p.type === "quote");
    if (hasQuote) {
      state.pendingActor = null;
    } else {
      const sentences = text.trim().split(/(?<=[.!?\u2026])\s+/);
      state.pendingActor = actorOf(sentences[sentences.length - 1]);
    }
    return pieces;
  }

  function buildParagraph(pieces) {
    const p = document.createElement("p");
    pieces.forEach((piece) => {
      if (piece.type === "narration") {
        addTextWithNames(p, piece.text);
      } else if (piece.type === "thought") {
        const holder = el("span", piece.speaker ? "say" : "");
        if (piece.speaker) {
          holder.style.setProperty("--grad", gradientOf(piece.speaker));
          holder.dataset.speaker = piece.speaker.name;
          if (piece.speaker.glow) holder.style.filter = "drop-shadow(0 0 2px " + piece.speaker.glow + ")";
        }
        addTextWithNames(holder, piece.text);
        p.appendChild(holder);
      } else {
        const holder = el("span", piece.speaker ? "say" : "");
        if (piece.speaker) {
          holder.style.setProperty("--grad", gradientOf(piece.speaker));
          holder.dataset.speaker = piece.speaker.name;
          if (piece.speaker.glow) holder.style.filter = "drop-shadow(0 0 2px " + piece.speaker.glow + ")";
        }
        holder.appendChild(document.createTextNode('"'));
        addTextWithNames(holder, piece.text);
        holder.appendChild(document.createTextNode('"'));
        p.appendChild(holder);
      }
    });
    return p;
  }

  function addTextWithNames(parent, text) {
    let position = 0;
    findNames(text).forEach((name) => {
      if (name.start < position) return;
      if (name.start > position) parent.appendChild(document.createTextNode(text.slice(position, name.start)));
      const span = el("span", "nm", text.slice(name.start, name.end));
      span.style.setProperty("--grad", gradientOf(name.character));
      if (name.character.glow) span.style.filter = "drop-shadow(0 0 2px " + name.character.glow + ")";
      parent.appendChild(span);
      position = name.end;
    });
    if (position < text.length) parent.appendChild(document.createTextNode(text.slice(position)));
  }

  function setScene(scene) {
    const tab = byId("tab-stories");
    const layer = byId("stories-scene");
    const video = document.querySelector("#tab-stories .stories-bg");

    if (!scene) {
      tab.classList.remove("show-scene");
      if (video && video.play) video.play().catch(() => {});
      return;
    }

    tab.classList.add("show-scene");
    if (video && video.pause) video.pause();

    const colors = scene.colors || ["#0b0b12", "#1d1d2b"];
    const gradient = `linear-gradient(160deg, ${colors[0]}, ${colors[1]})`;
    const picture = scene.image ? `url('${scene.image}'), ` : "";

    layer.classList.add("fading");
    setTimeout(() => {
      layer.style.backgroundImage = picture + gradient;
      layer.classList.remove("fading");
    }, 200);
  }

  function showScreen(name) {
    byId("stories-library").hidden = name !== "library";
    byId("stories-book").hidden = name !== "book";
    byId("stories-reader").hidden = name !== "reader";
    window.scrollTo(0, 0);
    if (name !== "reader") {
      activeCues = [];
      showCueMarker(false);
      veilAllowed = false;
      updateSpoilerVeil();
    }
    if (name === "library") {
      setScene(null);
      if (libraryMusic && libraryMusic.file) {
        if (!COTA.audio.isPlaying(libraryMusic.file)) {
          COTA.audio.playMusic(libraryMusic.file, libraryMusic.title, { fadeIn: 2 });
        }
      } else {
        COTA.audio.stopMusic();
      }
    }
  }

  function playStoryMusic(music, fadeIn) {
    if (!music || !music.file) {
      COTA.audio.stopMusic();
      return;
    }
    COTA.audio.playMusic(music.file, music.title, { fadeIn: fadeIn });
  }

  function loadSpoilerMode() {
    try {
      spoilerMode = localStorage.getItem("cota_no_spoiler") === "1";
    } catch (err) {
      spoilerMode = false;
    }
  }

  function saveSpoilerMode() {
    try {
      localStorage.setItem("cota_no_spoiler", spoilerMode ? "1" : "0");
    } catch (err) {}
  }

  function placeSpoilerVeil() {
    const veil = byId("stories-spoiler-veil");
    if (!veil) return;
    const clearSpace = window.innerWidth < 700 ? 70 : 100;
    veil.style.top = window.innerHeight * CUE_LINE + clearSpace + "px";
  }

  function updateSpoilerVeil() {
    const veil = byId("stories-spoiler-veil");
    const button = byId("stories-shield-btn");
    if (button) {
      button.textContent = "No-Spoiler: " + (spoilerMode ? "On" : "Off");
      button.setAttribute("aria-pressed", spoilerMode ? "true" : "false");
    }
    if (!veil) return;
    placeSpoilerVeil();
    veil.classList.toggle("on", spoilerMode && veilAllowed);
  }

  function placeCueMarker() {
    const marker = byId("stories-cue-marker");
    const page = byId("stories-page");
    if (!marker || !page || marker.hidden) return;
    const left = page.getBoundingClientRect().left;
    const padding = parseFloat(getComputedStyle(page).paddingLeft) || 0;
    marker.style.top = window.innerHeight * CUE_LINE + "px";
    marker.style.left = (left + Math.max(2, padding - 26)) + "px";
  }

  function showCueMarker(visible) {
    const marker = byId("stories-cue-marker");
    if (!marker) return;
    marker.hidden = !visible;
    placeCueMarker();
  }

  function setupCues(page, container) {
    activeCues = [];
    const cues = page.music && page.music.cues;
    if (!cues) return;
    const paragraphs = Array.from(container.querySelectorAll("p"));
    cues.forEach((cue) => {
      const paragraph = paragraphs.find((p) => p.textContent.includes(cue.text));
      if (paragraph) activeCues.push({ paragraph: paragraph, cue: cue, done: false });
    });
  }

  function runCue(cue) {
    if (cue.action === "dip") {
      COTA.audio.dipMusic(cue.silence || 3, cue.fadeIn || 3);
    } else if (cue.action === "stop") {
      COTA.audio.stopMusic();
    } else if (cue.action === "fadeOut") {
      COTA.audio.fadeOutMusic(cue.seconds || 6);
    } else if (cue.action === "play") {
      COTA.audio.playMusic(cue.file, cue.title, { fadeIn: cue.fadeIn || 3 });
    }
    if (cue.scene) setScene(cue.scene);
  }

  function checkCues() {
    if (!activeCues.length) return;
    if (!byId("tab-stories").classList.contains("active") || byId("stories-reader").hidden) return;
    const line = window.innerHeight * CUE_LINE;
    for (const item of activeCues) {
      if (item.done) continue;
      if (item.paragraph.getBoundingClientRect().top > line) break;
      item.done = true;
      runCue(item.cue);
    }
  }

  function renderLibrary() {
    const grid = byId("stories-grid");
    grid.innerHTML = "";

    stories.forEach((story) => {
      const card = el("button", "story-card");
      card.type = "button";

      const cover = el("div", "story-cover");
      if (story.cover) {
        cover.style.backgroundImage = `url('${story.cover}')`;
      } else {
        cover.appendChild(el("span", "story-cover-title", story.title));
      }
      card.appendChild(cover);

      const info = el("div", "story-info");
      info.appendChild(el("h3", "story-title", story.title));
      if (story.series) info.appendChild(el("p", "story-tagline", story.series));
      info.appendChild(el("p", "story-summary", story.summary));

      const meta = el("p", "story-meta");
      const count = story.chapters.length;
      meta.appendChild(el("span", "story-status", story.status || "Ongoing"));
      meta.appendChild(el("span", "", count + (count === 1 ? " chapter" : " chapters")));
      info.appendChild(meta);
      card.appendChild(info);

      card.addEventListener("click", () => {
        COTA.audio.playSfx("ui_click.mp3");
        openBook(story);
      });
      grid.appendChild(card);
    });

    const soon = el("div", "story-card story-card-soon");
    soon.appendChild(el("span", "", "More stories coming soon"));
    grid.appendChild(soon);
  }

  function openBook(story) {
    currentStory = story;
    pages = buildPages(story);

    byId("book-series").textContent = story.series || "";
    byId("book-title").textContent = story.title;
    byId("book-tagline").textContent = story.tagline || "";
    const pairing = byId("book-pairing");
    pairing.innerHTML = "";
    (story.pairing || "").split("\u00D7").forEach((name, i) => {
      if (i > 0) pairing.appendChild(document.createTextNode(" \u00D7 "));
      pairing.appendChild(el("span", "pairing-name", name.trim()));
    });

    const count = story.chapters.length;
    byId("book-meta").textContent = count + (count === 1 ? " chapter" : " chapters");

    fillParagraphs(byId("book-synopsis"), story.synopsis);
    byId("book-notes").textContent = story.contentNotes || "";
    byId("book-notes").hidden = !story.contentNotes;

    const saved = recall("story-progress", {})[story.id] || 0;
    const cont = byId("stories-continue-btn");
    cont.hidden = saved <= 0 || saved >= pages.length;
    if (!cont.hidden) {
      cont.textContent = "Continue: " + pageLabel(saved);
      cont.onclick = () => startReading(saved);
    }

    showScreen("book");
    setScene(story.introScene);
    if (story.introMusic) playStoryMusic(story.introMusic, 2);
  }

  function buildPages(story) {
    const list = story.chapters.map((chapter, i) => ({
      type: "chapter",
      number: i + 1,
      title: chapter.title,
      file: chapter.file,
      scene: chapter.scene,
      music: chapter.music,
    }));
    if (story.extras) {
      list.push({
        type: "extras",
        title: story.extras.title || "Extras",
        scene: story.extras.scene,
        music: story.extras.music,
        extras: story.extras,
      });
    }
    return list;
  }

  function pageLabel(index) {
    const page = pages[index];
    return page.type === "chapter" ? "Chapter " + page.number : page.title;
  }

  function startReading(index) {
    byId("stories-reader-title").textContent = currentStory.title;

    const select = byId("stories-chapter-select");
    select.innerHTML = "";
    pages.forEach((page, i) => {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = page.type === "chapter" ? page.number + ". " + page.title : page.title;
      select.appendChild(option);
    });

    showScreen("reader");
    showPage(index);
  }

  async function showPage(index) {
    const page = pages[index];
    pageIndex = index;

    const saved = recall("story-progress", {});
    saved[currentStory.id] = index;
    remember("story-progress", saved);

    byId("stories-chapter-select").value = index;
    setScene(page.scene);
    activeCues = [];
    showCueMarker(false);
    if (!page.extras || page.music) playStoryMusic(page.music, 2);

    const textBox = byId("stories-text");
    const extrasBox = byId("stories-extras");
    const isExtras = page.type === "extras";

    byId("stories-chapter-title").textContent = page.title;
    veilAllowed = !isExtras;
    updateSpoilerVeil();
    textBox.hidden = isExtras;
    extrasBox.hidden = !isExtras;

    if (isExtras) {
      byId("stories-chapter-kicker").textContent = "Bonus";
      await prepareNames();
      renderExtras(extrasBox, page.extras);
    } else {
      byId("stories-chapter-kicker").textContent = "Chapter " + page.number + " of " + currentStory.chapters.length;
      await prepareNames();
      const text = await loadChapterText(page);
      renderText(textBox, text);
      if (pageIndex === index) {
        setupCues(page, textBox);
        showCueMarker(activeCues.length > 0);
      }
    }

    const atStart = index === 0;
    const atEnd = index === pages.length - 1;
    const nextIsExtras = !atEnd && pages[index + 1].type === "extras";
    document.querySelectorAll(".stories-prev").forEach((b) => (b.disabled = atStart));
    document.querySelectorAll(".stories-next").forEach((b) => {
      b.disabled = atEnd;
      b.textContent = nextIsExtras ? "Extras \u2192" : "Next chapter \u2192";
    });
    byId("stories-end-note").hidden = !atEnd;

    window.scrollTo(0, 0);
    updateProgress();
    checkCues();
  }

  function renderText(container, text) {
    container.innerHTML = "";
    const state = { last: null, prev: null, pendingActor: null };
    const paragraphs = text.replace(/\r/g, "").trim().split(/\n\s*\n/);
    paragraphs.forEach((block) => {
      const clean = block.trim();
      if (!clean) return;
      if (/^(\*\s*){3,}$/.test(clean)) {
        container.appendChild(el("hr", "scene-break"));
        state.last = state.prev = state.pendingActor = null;
      } else {
        container.appendChild(buildParagraph(readParagraph(clean, state)));
      }
    });
  }

  function changePage(step) {
    const next = pageIndex + step;
    if (!currentStory || next < 0 || next >= pages.length) return;
    COTA.audio.playSfx("ui_click.mp3");
    showPage(next);
  }

  function renderExtras(container, extras) {
    container.innerHTML = "";

    container.appendChild(el("h3", "stories-extras-heading", "Cast"));
    const castRows = extras.castRows && extras.castRows.length ? extras.castRows : [extras.cast || []];
    castRows.forEach((row) => {
      const castGrid = el("div", extras.castRows ? "cast-row" : "cast-grid");
      row.forEach((member) => {
        const card = el("figure", "cast-card");
        const art = el("div", "cast-art");

        const images = Array.isArray(member.art) ? member.art : member.art ? [member.art] : [];
        if (images.length > 1) card.classList.add("cast-card-pair");
        if (images.length) {
          images.forEach((src) => {
            const img = document.createElement("img");
            img.src = src;
            img.alt = member.name;
            img.loading = "lazy";
            art.appendChild(img);
          });
        } else {
          art.classList.add("cast-art-empty");
          art.appendChild(el("span", "", "No art :("));
        }
        card.appendChild(art);
        const caption = el("figcaption", "");
        addTextWithNames(caption, member.name);
        card.appendChild(caption);
        castGrid.appendChild(card);
      });
      container.appendChild(castGrid);
    });

    if (extras.arts) {
      container.appendChild(el("h3", "stories-extras-heading", "Arts that inspired the novel"));
      const gallery = el("div", "inspire-grid");
      const arts = extras.arts || [];
      if (!arts.length) {
        const empty = el("div", "inspire-empty");
        empty.appendChild(el("span", "", "No art :("));
        gallery.appendChild(empty);
      }
      arts.forEach((art) => {
        const figure = el("figure", "inspire-card");
        const link = document.createElement("a");
        link.href = art.image;
        link.target = "_blank";
        link.rel = "noopener";
        const img = document.createElement("img");
        img.src = art.image;
        img.alt = art.caption || "Inspiration art";
        img.loading = "lazy";
        link.appendChild(img);
        figure.appendChild(link);
        if (art.caption) figure.appendChild(el("figcaption", "", art.caption));
        gallery.appendChild(figure);
      });
      container.appendChild(gallery);
    }

    if (extras.credit) container.appendChild(el("p", "stories-credit", extras.credit));
  }

  function updateProgress() {
    const bar = byId("stories-progress-fill");
    if (!bar) return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const fraction = scrollable > 0 ? window.scrollY / scrollable : 0;
    bar.style.width = Math.max(0, Math.min(1, fraction)) * 100 + "%";
  }

  let wired = false;
  function wireButtons() {
    if (wired) return;
    wired = true;

    byId("stories-book-back").addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      showScreen("library");
    });
    byId("stories-back-btn").addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      showScreen("library");
    });
    byId("stories-start-btn").addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      startReading(0);
    });
    byId("stories-chapter-select").addEventListener("change", (e) => {
      showPage(Number(e.target.value));
    });
    document.querySelectorAll(".stories-prev").forEach((b) => b.addEventListener("click", () => changePage(-1)));
    document.querySelectorAll(".stories-next").forEach((b) => b.addEventListener("click", () => changePage(1)));

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("scroll", checkCues, { passive: true });
    window.addEventListener("resize", placeCueMarker);
    window.addEventListener("resize", placeSpoilerVeil);
    loadSpoilerMode();
    updateSpoilerVeil();
    byId("stories-shield-btn").addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      spoilerMode = !spoilerMode;
      saveSpoilerMode();
      updateSpoilerVeil();
    });

    document.addEventListener("keydown", (e) => {
      const reader = byId("stories-reader");
      if (!reader || reader.hidden || !byId("tab-stories").classList.contains("active")) return;
      if (e.target.tagName === "SELECT") return;
      if (e.key === "ArrowLeft") changePage(-1);
      if (e.key === "ArrowRight") changePage(1);
    });
  }

  async function enter() {
    wireButtons();
    await loadStories();
    renderLibrary();
    showScreen("library");
  }

  return { enter };
})();
