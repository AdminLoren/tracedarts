// =====================================================================
//  LORE TAB (the stories / novels)
//  Note: the tab you see as "Characters" is lore.js. This file is the
//  "Lore" tab, so its internal name is "stories".
//
//  The tab has three screens:
//   1. LIBRARY  - all the stories (video background)
//   2. BOOK     - one story's front page: introduction, spoiler-free
//                 synopsis and the "Start Reading" button
//   3. READER   - the chapters, then the Extras page. Every page has its
//                 own still background picture (the "scene").
//
//  Everything comes from data/stories.json and the chapter .txt files.
//  See data/stories/README.txt for how to add chapters, stories and art.
// =====================================================================

window.COTA = window.COTA || {};

COTA.stories = (function () {
  let stories = [];            // every story from stories.json
  let currentStory = null;     // the story being read
  let pages = [];              // the chapters + the extras page of that story
  let pageIndex = 0;           // which page is open (0 = chapter 1)
  const chapterCache = {};     // chapter texts we already downloaded

  // ---------- small helpers ----------

  // Quick way to build an element: el("p", "my-class", "Hello")
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function byId(id) { return document.getElementById(id); }

  // The browser can remember where a reader stopped.
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

  // Puts each text in the list into its own paragraph
  function fillParagraphs(container, list) {
    container.innerHTML = "";
    (list || []).forEach((text) => container.appendChild(el("p", "", text)));
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
      return "This chapter could not be loaded. Make sure this file exists in your project folder:\n\n" + chapter.file;
    }
  }

  // ---------- backgrounds ----------

  // scene = { image: "path.jpg", colors: ["#111", "#333"] }
  // If the picture file is missing, the two colors make a gradient instead,
  // so every page still looks different.
  function setScene(scene) {
    const tab = byId("tab-stories");
    const layer = byId("stories-scene");
    const video = document.querySelector("#tab-stories .stories-bg");

    // No scene = the library, which uses the video
    if (!scene) {
      tab.classList.remove("show-scene");
      if (video && video.play) video.play().catch(() => {});
      return;
    }

    tab.classList.add("show-scene");
    if (video && video.pause) video.pause(); // save the computer some work

    const colors = scene.colors || ["#0b0b12", "#1d1d2b"];
    const gradient = `linear-gradient(160deg, ${colors[0]}, ${colors[1]})`;
    const picture = scene.image ? `url('${scene.image}'), ` : "";

    // Fade out, swap the picture, fade back in
    layer.classList.add("fading");
    setTimeout(() => {
      layer.style.backgroundImage = picture + gradient;
      layer.classList.remove("fading");
    }, 200);
  }

  // ---------- screens ----------

  function showScreen(name) {
    byId("stories-library").hidden = name !== "library";
    byId("stories-book").hidden = name !== "book";
    byId("stories-reader").hidden = name !== "reader";
    window.scrollTo(0, 0);
    if (name === "library") setScene(null);
  }

  // ---------- 1. library ----------

  function renderLibrary() {
    const grid = byId("stories-grid");
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

    // A dashed card so readers know more is on the way
    const soon = el("div", "story-card story-card-soon");
    soon.appendChild(el("span", "", "More stories coming soon"));
    grid.appendChild(soon);
  }

  // ---------- 2. book (introduction + synopsis) ----------

  function openBook(story) {
    currentStory = story;
    pages = buildPages(story);

    byId("book-series").textContent = story.series || "";
    byId("book-title").textContent = story.title;
    byId("book-tagline").textContent = story.tagline || "";
    // Each name stays in one piece, so a long line breaks between names, not inside one
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

    // If the reader already started this story, offer a "Continue" button
    const saved = recall("story-progress", {})[story.id] || 0;
    const cont = byId("stories-continue-btn");
    cont.hidden = saved <= 0 || saved >= pages.length;
    if (!cont.hidden) {
      cont.textContent = "Continue: " + pageLabel(saved);
      cont.onclick = () => startReading(saved);
    }

    showScreen("book");
    setScene(story.introScene);
  }

  // ---------- 3. reader ----------

  // The pages of a story = every chapter, then the extras page (if there is one)
  function buildPages(story) {
    const list = story.chapters.map((chapter, i) => ({
      type: "chapter",
      number: i + 1,
      title: chapter.title,
      file: chapter.file,
      scene: chapter.scene,
    }));
    if (story.extras) {
      list.push({
        type: "extras",
        title: story.extras.title || "Extras",
        scene: story.extras.scene,
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

    // Fill the chapter dropdown
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

    // Remember where the reader is up to
    const saved = recall("story-progress", {});
    saved[currentStory.id] = index;
    remember("story-progress", saved);

    byId("stories-chapter-select").value = index;
    setScene(page.scene);

    const textBox = byId("stories-text");
    const extrasBox = byId("stories-extras");
    const isExtras = page.type === "extras";

    byId("stories-chapter-title").textContent = page.title;
    textBox.hidden = isExtras;
    extrasBox.hidden = !isExtras;

    if (isExtras) {
      byId("stories-chapter-kicker").textContent = "Bonus";
      renderExtras(extrasBox, page.extras);
    } else {
      byId("stories-chapter-kicker").textContent = "Chapter " + page.number + " of " + currentStory.chapters.length;
      const text = await loadChapterText(page);
      renderText(textBox, text);
    }

    // Previous / Next buttons (they appear at the bottom of the page)
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

  function changePage(step) {
    const next = pageIndex + step;
    if (!currentStory || next < 0 || next >= pages.length) return;
    COTA.audio.playSfx("ui_click.mp3");
    showPage(next);
  }

  // ---------- the extras page ----------

  function renderExtras(container, extras) {
    container.innerHTML = "";

    // --- Cast ---
    container.appendChild(el("h3", "stories-extras-heading", "Cast"));
    const castGrid = el("div", "cast-grid");
    (extras.cast || []).forEach((member) => {
      const card = el("figure", "cast-card");
      const art = el("div", "cast-art");

      // "art" can be one picture or a list of pictures (for a pair)
      const images = Array.isArray(member.art) ? member.art : member.art ? [member.art] : [];
      if (images.length > 1) card.classList.add("cast-card-pair"); // pairs take two columns
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
      card.appendChild(el("figcaption", "", member.name));
      castGrid.appendChild(card);
    });
    container.appendChild(castGrid);

    // --- Arts that inspired the novel ---
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
      link.target = "_blank";          // click a picture to see it full size
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

    if (extras.credit) container.appendChild(el("p", "stories-credit", extras.credit));
  }

  // ---------- reading progress bar ----------

  function updateProgress() {
    const bar = byId("stories-progress-fill");
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

    // Keyboard: left / right arrow keys change page while reading
    document.addEventListener("keydown", (e) => {
      const reader = byId("stories-reader");
      if (!reader || reader.hidden || !byId("tab-stories").classList.contains("active")) return;
      if (e.target.tagName === "SELECT") return;
      if (e.key === "ArrowLeft") changePage(-1);
      if (e.key === "ArrowRight") changePage(1);
    });
  }

  // Called by app.js every time the Lore tab is opened
  async function enter() {
    wireButtons();
    await loadStories();
    renderLibrary();
    showScreen("library");
  }

  return { enter };
})();
