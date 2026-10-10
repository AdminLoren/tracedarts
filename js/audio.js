window.COTA = window.COTA || {};

COTA.audio = (function () {
  const DEFAULT_VOLUME = 0.5; 
  const SFX_RATIO = 1 / 3;    

  let currentMusic = null;
  let currentMusicTitle = "";
  let muted = false;
  let volume = DEFAULT_VOLUME;
  let musicGain = 1;
  let fadeTimer = null;
  let dipTimer = null;

  const nowPlayingText = () => document.getElementById("now-playing-text");
  const soundToggleBtn = () => document.getElementById("sound-toggle");
  const volumeSlider = () => document.getElementById("volume-slider");
  const volumeValue = () => document.getElementById("volume-value");

  function updateHeaderText() {
    const label = nowPlayingText();
    if (!label) return;
    if (muted || volume === 0) {
      label.textContent = "Sound Off";
    } else if (currentMusic && currentMusicTitle) {
      label.textContent = currentMusicTitle;
    } else {
      label.textContent = "Sound On";
    }
  }

  function updateVolumeUI() {
    const slider = volumeSlider();
    const readout = volumeValue();
    const percent = Math.round(volume * 100);
    if (slider) {
      slider.value = String(percent);
      
      slider.style.setProperty("--volume-fill", `${percent}%`);
      slider.setAttribute("aria-valuetext", `${percent}%`);
    }
    if (readout) readout.textContent = `${percent}%`;
  }

  
  function musicLevel() {
    return muted ? 0 : volume;
  }

  function applyMusicVolume() {
    if (currentMusic) currentMusic.volume = Math.min(1, Math.max(0, musicLevel() * musicGain));
  }

  function clearFades() {
    if (fadeTimer) clearInterval(fadeTimer);
    if (dipTimer) clearTimeout(dipTimer);
    fadeTimer = null;
    dipTimer = null;
  }

  function rampGain(target, seconds, done) {
    if (fadeTimer) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
    if (!currentMusic || seconds <= 0) {
      musicGain = target;
      applyMusicVolume();
      if (done) done();
      return;
    }
    const startGain = musicGain;
    const startTime = performance.now();
    fadeTimer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - startTime) / (seconds * 1000));
      musicGain = startGain + (target - startGain) * progress;
      applyMusicVolume();
      if (progress >= 1) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        if (done) done();
      }
    }, 40);
  }

  function setVolume(value, opts = {}) {
    volume = Math.min(1, Math.max(0, value));

    
    if (muted && volume > 0 && opts.fromUser) {
      muted = false;
      const btn = soundToggleBtn();
      if (btn) btn.setAttribute("aria-pressed", "false");
      if (currentMusic) currentMusic.play().catch(() => {});
    }

    applyMusicVolume();
    updateVolumeUI();
    updateHeaderText();
  }

  function getVolume() {
    return volume;
  }

  function playMusic(fileName, title, opts = {}) {
    currentMusicTitle = title || fileName;
    clearFades();
    musicGain = 1;
    if (currentMusic) {
      currentMusic.pause();
      currentMusic = null;
    }
    if (muted) {
      updateHeaderText();
      return;
    }
    try {
      const audio = new Audio(`assets/audio/${fileName}`);
      audio.loop = true;
      currentMusic = audio;
      const fadeIn = opts.fadeIn || 0;
      if (fadeIn > 0) musicGain = 0;
      applyMusicVolume();
      audio.play().catch(() => {});
      if (fadeIn > 0) rampGain(1, fadeIn);
    } catch (err) {
      currentMusic = null;
    }
    updateHeaderText();
  }

  function stopMusic() {
    clearFades();
    if (currentMusic) {
      currentMusic.pause();
      currentMusic = null;
    }
    musicGain = 1;
    currentMusicTitle = "";
    updateHeaderText();
  }

  function dipMusic(silenceSeconds, fadeInSeconds) {
    if (!currentMusic) return;
    clearFades();
    musicGain = 0;
    applyMusicVolume();
    dipTimer = setTimeout(() => {
      dipTimer = null;
      rampGain(1, fadeInSeconds);
    }, silenceSeconds * 1000);
  }

  function fadeOutMusic(seconds) {
    if (!currentMusic) return;
    clearFades();
    rampGain(0, seconds, stopMusic);
  }

  function playSfx(fileName) {
    if (muted || volume === 0) return;
    try {
      const sfx = new Audio(`assets/audio/${fileName}`);
      sfx.volume = Math.min(1, volume * SFX_RATIO);
      sfx.play().catch(() => {});
    } catch (err) {}
  }

  function toggleMute() {
    muted = !muted;
    const btn = soundToggleBtn();
    if (btn) btn.setAttribute("aria-pressed", String(muted));
    if (muted && currentMusic) {
      currentMusic.pause();
    } else if (!muted && currentMusic) {
      applyMusicVolume();
      currentMusic.play().catch(() => {});
    }
    updateHeaderText();
  }

  function init() {
    const btn = soundToggleBtn();
    if (btn) btn.addEventListener("click", toggleMute);

    const slider = volumeSlider();
    if (slider) {
      slider.value = String(Math.round(DEFAULT_VOLUME * 100));
      slider.addEventListener("input", () => {
        setVolume(Number(slider.value) / 100, { fromUser: true });
      });
      
      slider.addEventListener("click", (e) => e.stopPropagation());
    }

    setVolume(DEFAULT_VOLUME);
    updateHeaderText();

    const resumeOnFirstInteraction = () => {
      if (currentMusic && currentMusic.paused && !muted) {
        currentMusic.play().catch(() => {});
      }
      document.removeEventListener("click", resumeOnFirstInteraction);
      document.removeEventListener("keydown", resumeOnFirstInteraction);
      document.removeEventListener("touchstart", resumeOnFirstInteraction);
    };
    document.addEventListener("click", resumeOnFirstInteraction);
    document.addEventListener("keydown", resumeOnFirstInteraction);
    document.addEventListener("touchstart", resumeOnFirstInteraction);
  }

  return { init, playMusic, stopMusic, dipMusic, fadeOutMusic, playSfx, toggleMute, setVolume, getVolume };
})();
