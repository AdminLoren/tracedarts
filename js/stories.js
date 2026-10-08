// =====================================================================
//  LORE TAB (the stories / novels)
//  Note: the tab you see as "Characters" is lore.js. This file is the
//  new "Lore" tab, so its internal name is "stories".
//
//  How it works:
//   1. data/stories.json lists the stories and their chapters.
//   2. Each chapter is a plain .txt file (see data/stories/README.txt).
//   3. The tab has two screens: the LIBRARY (all stories) and the READER.
// =====================================================================

window.COTA = window.COTA || {};

COTA.stories = (function () {
  let stories = [];            // every story from stories.json
  let currentStory = null;     // the story being read
  let chapterIndex = 0;        // which chapter is open (0 = first)
  const chapterCache = {};     // chapter texts we already downloaded

  // Reading text sizes (in pixels). The user picks with the A- / A+ buttons.
  const TEXT_SIZES = [16, 18, 20, 22, 25];
  let sizeIndex = 2;           // start at 20px

  // ---------- small helpers ----------

  // Quick way to build an element: el("p", "my-class", "Hello")
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // The browser can remember things (last chapter read, text size).
  // If it is blocked for some reason, we just ignore the error.
  function remember(key, value) {
    try { localStorage.setItem("cota-" + key, JSON.stringify(value)); } catch (e) {}
  }
  function recall(key, fallback) {
    try {
      const saved = localStorage.getItem("cota-" + key);
      return saved === null ? fallback : JSON.parse(saved);
    } catch (e) { return fallback; }
  }

  // ---------- loading ----------

  async function loadStories() {
    if (stories.length) return;
    try {
      const res = await fetch("data/stories.json");
      const data = await res.json();
      stories = data.stories || [];
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
      return "This chapter could not be loaded. Check that the file exists:\n\n" + chapter.file;
    }
  }

  // ---------- screens ----------

  function showScreen(name) {
    document.getElementById("stories-library").hidden = name !== "library";
    document.getElementById("stories-reader").hidden = name !== "reader";
    window.scrollTo(0, 0);
  }

  // ---------- library (list of stories) ----------

  function renderLibrary() {
    const grid = document.getElementById("stories-grid");
    grid.innerHTML = "";

    stories.forEach((story) => {
      const card = el("button", "story-card");
      card.type = "button";

      // Cover: a picture if you gave one, otherwise the title on a colored cover
      const cover = el("div", "story-cover");
      if (story.cover) {
        cover.style.backgroundImage = `url('${story.cover}')`;
      } else {
        cover.appendChild(el("span", "story-cover-title", story.title));
      }
      card.appendChild(cover);

      const info = el("div", "story-info");
      info.appendChild(el("h3", "story-title", story.title));
      if (story.tagline) info.appendChild(el("p", "story-tagline", story.tagline));
      info.appendChild(el("p", "story-summary", story.summary));

      const meta = el("p", "story-meta");
      const count = story.chapters.length;
      meta.appendChild(el("span", "story-status", story.status || "Ongoing"));
      meta.appendChild(el("span", "", count + (count === 1 ? " chapter" : " chapters")));
      info.appendChild(meta);
      card.appendChild(info);

      card.addEventListener("click", () => {
        COTA.audio.playSfx("ui_click.mp3");
        openStory(story);
      });
      grid.appendChild(card);
    });

    // A dashed card so readers know more is on the way
    const soon = el("div", "story-card story-card-soon");
    soon.appendChild(el("span", "", "More stories coming soon"));
    grid.appendChild(soon);
  }

  // ---------- reader ----------

  function openStory(story) {
    currentStory = story;

    // Reopen the chapter the reader stopped at last time
    const saved = recall("story-progress", {});
    chapterIndex = Math.min(saved[story.id] || 0, story.chapters.length - 1);

    document.getElementById("stories-reader-title").textContent = story.title;

    // Fill the chapter dropdown
    const select = document.getElementById("stories-chapter-select");
    select.innerHTML = "";
    story.chapters.forEach((chapter, i) => {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = (i + 1) + ". " + chapter.title;
      select.appendChild(option);
    });

    showScreen("reader");
    showChapter(chapterIndex);
  }

  async function showChapter(index) {
    const chapter = currentStory.chapters[index];
    chapterIndex = index;

    // Remember where the reader is up to
    const saved = recall("story-progress", {});
    saved[currentStory.id] = index;
    remember("story-progress", saved);

    document.getElementById("stories-chapter-select").value = index;
    document.getElementById("stories-chapter-kicker").textContent =
      "Chapter " + (index + 1) + " of " + currentStory.chapters.length;
    document.getElementById("stories-chapter-title").textContent = chapter.title;

    const text = await loadChapterText(chapter);
    renderText(document.getElementById("stories-text"), text);

    // Previous / Next buttons (both at the top bar and at the bottom of the page)
    const atStart = index === 0;
    const atEnd = index === currentStory.chapters.length - 1;
    document.querySelectorAll(".stories-prev").forEach((b) => (b.disabled = atStart));
    document.querySelectorAll(".stories-next").forEach((b) => (b.disabled = atEnd));
    document.getElementById("stories-end-note").hidden = !atEnd;

    window.scrollTo(0, 0);
    updateProgress();
  }

  // Turns the plain text into paragraphs.
  //   empty line  = new paragraph
  //   ***         = scene break
  function renderText(container, text) {
    container.innerHTML = "";
    const paragraphs = text.replace(/\r/g, "").trim().split(/\n\s*\n/);
    paragraphs.forEach((block) => {
      const clean = block.trim();
      if (!clean) return;
      if (/^(\*\s*){3,}$/.test(clean)) {
        container.appendChild(el("hr", "scene-break"));
      } else {
        container.appendChild(el("p", "", clean));
      }
    });
  }

  function changeChapter(step) {
    const next = chapterIndex + step;
    if (!currentStory || next < 0 || next >= currentStory.chapters.length) return;
    COTA.audio.playSfx("ui_click.mp3");
    showChapter(next);
  }

  // ---------- text size ----------

  function applyTextSize() {
    document.getElementById("stories-page").style.setProperty("--story-font-size", TEXT_SIZES[sizeIndex] + "px");
    document.getElementById("stories-smaller").disabled = sizeIndex === 0;
    document.getElementById("stories-bigger").disabled = sizeIndex === TEXT_SIZES.length - 1;
  }

  function changeTextSize(step) {
    sizeIndex = Math.max(0, Math.min(TEXT_SIZES.length - 1, sizeIndex + step));
    remember("story-text-size", sizeIndex);
    applyTextSize();
  }

  // ---------- reading progress bar ----------

  function updateProgress() {
    const bar = document.getElementById("stories-progress-fill");
    if (!bar) return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const fraction = scrollable > 0 ? window.scrollY / scrollable : 0;
    bar.style.width = Math.max(0, Math.min(1, fraction)) * 100 + "%";
  }

  // ---------- start up ----------

  let wired = false;
  function wireButtons() {
    if (wired) return;
    wired = true;

    document.getElementById("stories-back-btn").addEventListener("click", () => {
      COTA.audio.playSfx("ui_click.mp3");
      showScreen("library");
    });
    document.getElementById("stories-chapter-select").addEventListener("change", (e) => {
      showChapter(Number(e.target.value));
    });
    document.querySelectorAll(".stories-prev").forEach((b) => b.addEventListener("click", () => changeChapter(-1)));
    document.querySelectorAll(".stories-next").forEach((b) => b.addEventListener("click", () => changeChapter(1)));
    document.getElementById("stories-smaller").addEventListener("click", () => changeTextSize(-1));
    document.getElementById("stories-bigger").addEventListener("click", () => changeTextSize(1));

    window.addEventListener("scroll", updateProgress, { passive: true });

    // Keyboard: left / right arrow keys change chapter while reading
    document.addEventListener("keydown", (e) => {
      const reader = document.getElementById("stories-reader");
      if (!reader || reader.hidden || !document.getElementById("tab-stories").classList.contains("active")) return;
      if (e.target.tagName === "SELECT") return;
      if (e.key === "ArrowLeft") changeChapter(-1);
      if (e.key === "ArrowRight") changeChapter(1);
    });
  }

  // Called by app.js every time the Lore tab is opened
  async function enter() {
    wireButtons();
    sizeIndex = recall("story-text-size", 2);
    applyTextSize();
    await loadStories();
    renderLibrary();
    showScreen("library");
  }

  return { enter };
})();
