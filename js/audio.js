window.COTA = window.COTA || {};

COTA.audio = (function () {
  const DEFAULT_VOLUME = 0.5;
  const SFX_RATIO = 1 / 3;

  let currentMusic = null;
  let currentMusicTitle = "";
  let currentMusicFile = "";
  let muted = false;
  let volume = DEFAULT_VOLUME;
  let musicGain = 1;
  let fadeTimer = null;
  let dipTimer = null;
  let outgoingAudio = null;
  let outgoingTimer = null;
  let voiceAudio = null;
  let voiceDone = null;

  const nowPlayingText = () => document.getElementById("now-playing-text");
  const soundToggleBtn = () => document.getElementById("sound-toggle");
  const volumeSlider = () => document.getElementById("volume-slider");
  const volumeValue = () => document.getElementById("volume-value");

  let marqueeTimer = null;

  function startMarquee(label) {
    const track = label.firstChild;
    if (!track || label.scrollWidth <= label.clientWidth + 1) return;
    const gap = 48;
    const shift = track.offsetWidth + gap;
    const clone = document.createElement("span");
    clone.textContent = label.dataset.text;
    clone.style.paddingLeft = gap + "px";
    clone.setAttribute("aria-hidden", "true");
    track.appendChild(clone);
    label.style.setProperty("--np-shift", -shift + "px");
    label.style.setProperty("--np-duration", shift / 35 + "s");
    label.classList.add("np-scrolling");
  }

  function setLabelText(label, text) {
    if (label.dataset.text === text) return;
    clearTimeout(marqueeTimer);
    label.dataset.text = text;
    label.title = text;
    label.classList.remove("np-overflow", "np-scrolling");
    label.textContent = "";
    const track = document.createElement("span");
    track.className = "np-track";
    track.textContent = text;
    label.appendChild(track);
    requestAnimationFrame(() => {
      if (label.dataset.text === text && label.scrollWidth > label.clientWidth + 1) {
        label.classList.add("np-overflow");
      }
    });
    marqueeTimer = setTimeout(() => {
      if (label.dataset.text === text) startMarquee(label);
    }, 4000);
  }

  function updateHeaderText() {
    const label = nowPlayingText();
    if (!label) return;
    if (muted || volume === 0) {
      setLabelText(label, "Sound Off");
    } else if (currentMusic && currentMusicTitle) {
      setLabelText(label, currentMusicTitle);
    } else {
      setLabelText(label, "Sound On");
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

  function killOutgoing() {
    if (outgoingTimer) clearInterval(outgoingTimer);
    outgoingTimer = null;
    if (outgoingAudio) outgoingAudio.pause();
    outgoingAudio = null;
  }

  function fadeOutgoing(audio, startGain, seconds) {
    outgoingAudio = audio;
    const startTime = performance.now();
    outgoingTimer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - startTime) / (seconds * 1000));
      audio.volume = Math.min(1, Math.max(0, musicLevel() * startGain * (1 - progress)));
      if (progress >= 1) killOutgoing();
    }, 40);
  }

  function playMusic(fileName, title, opts = {}) {
    currentMusicTitle = title || fileName;
    const previousGain = musicGain;
    clearFades();
    killOutgoing();
    musicGain = 1;
    currentMusicFile = "";
    const crossfade = opts.crossfade || 0;
    if (currentMusic) {
      if (crossfade > 0 && !muted) {
        fadeOutgoing(currentMusic, previousGain, crossfade);
      } else {
        currentMusic.pause();
      }
      currentMusic = null;
    }
    if (muted) {
      updateHeaderText();
      return;
    }
    try {
      const audio = new Audio(`assets/audio/${fileName}`);
      const loops = opts.loop !== false;
      audio.loop = loops;
      if (!loops) {
        audio.addEventListener("ended", () => {
          if (currentMusic === audio) stopMusic();
        });
      }
      currentMusic = audio;
      currentMusicFile = fileName;
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
    killOutgoing();
    if (currentMusic) {
      currentMusic.pause();
      currentMusic = null;
    }
    musicGain = 1;
    currentMusicFile = "";
    currentMusicTitle = "";
    updateHeaderText();
  }

  function isPlaying(fileName) {
    return !!currentMusic && currentMusicFile === fileName;
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

  function stopVoice() {
    if (!voiceAudio) return;
    const audio = voiceAudio;
    const done = voiceDone;
    voiceAudio = null;
    voiceDone = null;
    audio.pause();
    rampGain(1, 0.4);
    if (done) done();
  }

  function playVoice(fileName, onDone) {
    stopVoice();
    if (muted || volume === 0) {
      if (onDone) onDone();
      return false;
    }
    try {
      const audio = new Audio(`assets/audio/${fileName}`);
      audio.volume = Math.min(1, volume);
      voiceAudio = audio;
      voiceDone = onDone || null;
      const finish = () => {
        if (voiceAudio !== audio) return;
        const done = voiceDone;
        voiceAudio = null;
        voiceDone = null;
        rampGain(1, 0.4);
        if (done) done();
      };
      audio.addEventListener("ended", finish);
      audio.addEventListener("error", finish);
      rampGain(0.25, 0.2);
      audio.play().catch(finish);
      return true;
    } catch (err) {
      voiceAudio = null;
      voiceDone = null;
      if (onDone) onDone();
      return false;
    }
  }

  function toggleMute() {
    muted = !muted;
    const btn = soundToggleBtn();
    if (btn) btn.setAttribute("aria-pressed", String(muted));
    if (muted) stopVoice();
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

  return { init, playMusic, stopMusic, isPlaying, dipMusic, fadeOutMusic, playSfx, playVoice, stopVoice, toggleMute, setVolume, getVolume };
})();
