window.COTA = window.COTA || {};

COTA.audio = (function () {
  const DEFAULT_VOLUME = 0.5; 
  const SFX_RATIO = 1 / 3;    

  let currentMusic = null;
  let currentMusicTitle = "";
  let muted = false;
  let volume = DEFAULT_VOLUME;

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

  function setVolume(value, opts = {}) {
    volume = Math.min(1, Math.max(0, value));

    
    if (muted && volume > 0 && opts.fromUser) {
      muted = false;
      const btn = soundToggleBtn();
      if (btn) btn.setAttribute("aria-pressed", "false");
      if (currentMusic) currentMusic.play().catch(() => {});
    }

    if (currentMusic) currentMusic.volume = musicLevel();
    updateVolumeUI();
    updateHeaderText();
  }

  function getVolume() {
    return volume;
  }

  function playMusic(fileName, title) {
    currentMusicTitle = title || fileName;
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
      audio.volume = musicLevel();
      audio.play().catch(() => {});
      currentMusic = audio;
    } catch (err) {
      currentMusic = null;
    }
    updateHeaderText();
  }

  function stopMusic() {
    if (currentMusic) {
      currentMusic.pause();
      currentMusic = null;
    }
    currentMusicTitle = "";
    updateHeaderText();
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
      currentMusic.volume = musicLevel();
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

  return { init, playMusic, stopMusic, playSfx, toggleMute, setVolume, getVolume };
})();
