/* ═══════════════════════════════════════════════════════════
   MUSHAAK — Shadow of Ganesha
   Main game logic — Intro music fixed version
   ═══════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  //  RESET LEADERBOARD ONCE (v3 fresh)
  // ═══════════════════════════════════════════════════════════
  const LB_VERSION = 'v3-fresh';
  if (localStorage.getItem('mushakLBVersion') !== LB_VERSION) {
    localStorage.removeItem('mushakLeaderboard');
    localStorage.removeItem('mushakHighScore');
    localStorage.removeItem('mushakPlayerName');
    localStorage.setItem('mushakLBVersion', LB_VERSION);
  }

  // ═══════════════════════════════════════════════════════════
  //  DEVICE DETECTION
  // ═══════════════════════════════════════════════════════════
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
  const isTabletUA = /iPad|Android(?!.*Mobile)|Tablet|Kindle|Silk/i.test(navigator.userAgent);
  const useTouchControls = isTouchDevice && (isMobileUA || isTabletUA || window.innerWidth <= 1024);

  // ═══════════════════════════════════════════════════════════
  //  SETTINGS
  // ═══════════════════════════════════════════════════════════
  const settings = {
    sfx: JSON.parse(localStorage.getItem('mushakSetSfx') ?? 'true'),
    music: JSON.parse(localStorage.getItem('mushakSetMusic') ?? 'true'),
    vibrate: JSON.parse(localStorage.getItem('mushakSetVibrate') ?? 'true'),
    volume: parseInt(localStorage.getItem('mushakSetVolume') ?? '80', 10)
  };
  function saveSetting(key, value) {
    settings[key] = value;
    const map = { sfx:'mushakSetSfx', music:'mushakSetMusic', vibrate:'mushakSetVibrate', volume:'mushakSetVolume' };
    localStorage.setItem(map[key], typeof value === 'boolean' ? JSON.stringify(value) : String(value));
  }
  function vibrate(ms) {
    if (!settings.vibrate) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch(e) {}
  }
  function masterVolume(base) { return base * (settings.volume / 100); }

  // ═══════════════════════════════════════════════════════════
  //  ASSETS
  // ═══════════════════════════════════════════════════════════
  const IMAGES = {
    ganeshOpen:'images/ganesh-open.png', ganeshClosed:'images/ganesh-closed.png',
    modak:'images/modak.png', goldenModak:'images/golden-modak.png',
    diya:'images/diya.png', obstacle:'images/obstacle.png',
    char_classic:'images/mushak/classic.png', char_classicPray:'images/mushak/classic-pray.png', char_classicCaught:'images/mushak/classic-caught.png',
    char_chota:'images/mushak/chota.png', char_chotaPray:'images/mushak/chota-pray.png', char_chotaCaught:'images/mushak/chota-caught.png',
    char_mota:'images/mushak/mota.png', char_motaPray:'images/mushak/mota-pray.png', char_motaCaught:'images/mushak/mota-caught.png',
    char_chor:'images/mushak/chor.png', char_chorPray:'images/mushak/chor-pray.png', char_chorCaught:'images/mushak/chor-caught.png',
    theme_diwali:'images/themes/diwali.png', theme_spring:'images/themes/spring.png', theme_midnight:'images/themes/midnight.png',
    mushakLegacy:'images/mushak.png', mushakPrayLegacy:'images/mushak-pray.png',
    mushakCaughtLegacy:'images/mushak-caught.png', bgLegacy:'images/bg.png'
  };
  const SOUNDS = {
    bgmusic:      'sounds/bgmusic.mp3',
    click:        'sounds/click.mp3',
    collect:      'sounds/collect.mp3',
    golden:       'sounds/golden.mp3',
    intromusic:   'sounds/intromusic.mp3',
    levelcomplete:'sounds/levelcomplete.mp3',
    poweup:       'sounds/poweup.mp3',
    safe:         'sounds/safe.mp3',
    start:        'sounds/start.mp3',
    story1:       'sounds/story1.mp3',
    story2:       'sounds/story2.mp3',
    story3:       'sounds/story3.mp3',
    story4:       'sounds/story4.mp3',
    story5:       'sounds/story5.mp3'
  };
  const loadedImages = {}, loadedSounds = {};
  const loadImage = (k, src) => new Promise(r => {
    const i = new Image(); i.onload = () => { loadedImages[k]=i; r(); };
    i.onerror = () => { loadedImages[k]=null; r(); }; i.src = src;
  });
  const loadSound = (k, src) => new Promise(r => {
    const a = new Audio(); a.preload='auto';
    a.oncanplaythrough = () => { loadedSounds[k]=a; r(); };
    a.onerror = () => {
      console.warn('❌ Sound failed to load:', src);
      loadedSounds[k]=null; r();
    };
    a.src = src;
    setTimeout(() => { if (!loadedSounds[k]) { loadedSounds[k]=null; r(); } }, 2500);
  });
  async function loadAllAssets() {
    const p = [];
    for (const k in IMAGES) p.push(loadImage(k, IMAGES[k]));
    for (const k in SOUNDS) p.push(loadSound(k, SOUNDS[k]));
    await Promise.all(p);
    console.log('🎵 Loaded sounds:', Object.keys(loadedSounds).filter(k => loadedSounds[k]));
    console.log('❌ Missing sounds:', Object.keys(loadedSounds).filter(k => !loadedSounds[k]));
  }

  // ═══════════════════════════════════════════════════════════
  //  AUDIO SYSTEM
  // ═══════════════════════════════════════════════════════════
  let bgMusic = null, introMusic = null;
  let audioCtx = null, audioPrimed = false;
  let introMusicUnlockPending = false; // ← if autoplay was blocked, queue it

  function initAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  // Unlock ALL audio on the first user interaction
  function primeAudio() {
    if (audioPrimed) return;
    audioPrimed = true;
    initAudio();
    try {
      if (audioCtx) {
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);
      }
    } catch(e) {}

    // ▶ If intro music was queued while blocked, play it now
    if (introMusicUnlockPending) {
      introMusicUnlockPending = false;
      tryPlayIntroMusic();
    }
  }

  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
    window.addEventListener(evt, primeAudio, { once: false, passive: true });
  });

  // ═══════════════════════════════════════════════════════════
  //  SOUND PLAYERS
  // ═══════════════════════════════════════════════════════════
  function sfxClick() {
    if (!settings.sfx) return;
    const s = loadedSounds.click;
    if (!s) return;
    try {
      const c = s.cloneNode();
      c.volume = masterVolume(0.55);
      c.play().catch(()=>{});
    } catch(e) {}
  }

  function sfxCollect() {
    if (!settings.sfx) return;
    const s = loadedSounds.collect;
    if (!s) return;
    try {
      const c = s.cloneNode();
      c.volume = masterVolume(0.7);
      c.play().catch(()=>{});
    } catch(e) {}
  }

  function sfxGolden() {
    if (!settings.sfx) return;
    const s = loadedSounds.golden;
    if (!s) return;
    try {
      const c = s.cloneNode();
      c.volume = masterVolume(0.85);
      c.play().catch(()=>{});
    } catch(e) {}
  }

  function sfxSafe() {
    if (!settings.sfx) return;
    const s = loadedSounds.safe;
    if (!s) return;
    try {
      const c = s.cloneNode();
      c.volume = masterVolume(0.8);
      c.play().catch(()=>{});
    } catch(e) {}
  }

  function sfxLevelComplete() {
    if (!settings.sfx) return;
    const s = loadedSounds.levelcomplete;
    if (!s) return;
    try {
      const c = s.cloneNode();
      c.volume = masterVolume(0.85);
      c.play().catch(()=>{});
    } catch(e) {}
  }

  function sfxPowerup() {
    if (!settings.sfx) return;
    const s = loadedSounds.poweup;
    if (!s) return;
    try {
      const c = s.cloneNode();
      c.volume = masterVolume(0.85);
      c.play().catch(()=>{});
    } catch(e) {}
  }

  function sfxStart() {
    if (!settings.sfx) return;
    const s = loadedSounds.start;
    if (!s) return;
    try {
      const c = s.cloneNode();
      c.volume = masterVolume(0.8);
      c.play().catch(()=>{});
    } catch(e) {}
  }

  // ═══════════════════════════════════════════════════════════
  //  MUSIC LAYERS
  // ═══════════════════════════════════════════════════════════

  // Background gameplay music
  function startBgMusic() {
    if (!settings.music) return;
    const m = loadedSounds.bgmusic;
    if (!m) return;
    if (!bgMusic) {
      bgMusic = m.cloneNode();
      bgMusic.loop = true;
    }
    bgMusic.volume = masterVolume(0.28);
    bgMusic.play().catch(()=>{});
  }
  function pauseBgMusic() { if (bgMusic) { try { bgMusic.pause(); } catch(e){} } }
  function resumeBgMusic() {
    if (!settings.music) return;
    if (bgMusic) {
      bgMusic.volume = masterVolume(0.28);
      bgMusic.play().catch(()=>{});
    }
  }
  function stopBgMusic() {
    if (bgMusic) { try { bgMusic.pause(); bgMusic.currentTime = 0; } catch(e){} }
  }

  // ─────────────────────────────────────────────────────────
  //  INTRO MUSIC — plays during title animation
  //  Handles browser autoplay blocking gracefully
  // ─────────────────────────────────────────────────────────
  function tryPlayIntroMusic() {
    if (!settings.music) return false;
    const m = loadedSounds.intromusic;
    if (!m) {
      console.warn('❌ intromusic.mp3 not loaded — check: sounds/intromusic.mp3');
      return false;
    }
    if (!introMusic) {
      introMusic = m.cloneNode();
      introMusic.loop = true;
    }
    introMusic.volume = masterVolume(0.55);
    try {
      const promise = introMusic.play();
      if (promise && typeof promise.then === 'function') {
        promise.then(() => {
          console.log('✅ intromusic playing');
        }).catch(() => {
          console.warn('🔇 intromusic autoplay blocked — will play on next tap');
          introMusicUnlockPending = true;
        });
      }
      return true;
    } catch(e) {
      console.warn('🔇 intromusic play() failed:', e);
      introMusicUnlockPending = true;
      return false;
    }
  }

  function startIntroMusic() {
    introMusicUnlockPending = false;
    tryPlayIntroMusic();
  }

  function stopIntroMusic() {
    if (!introMusic) return;
    introMusicUnlockPending = false;
    try {
      const startVol = introMusic.volume;
      let fade = 0;
      const interval = setInterval(() => {
        fade += 0.15;
        if (fade >= 1) {
          clearInterval(interval);
          try { introMusic.pause(); introMusic.currentTime = 0; } catch(e){}
          try { introMusic.volume = startVol; } catch(e){}
          return;
        }
        try { introMusic.volume = Math.max(0, startVol * (1 - fade)); } catch(e){}
      }, 45);
    } catch(e) {}
  }

  // ═══════════════════════════════════════════════════════════
  //  FULLSCREEN
  // ═══════════════════════════════════════════════════════════
  function requestFullscreen() {
    try {
      const el = document.documentElement;
      const isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      if (isFs) return;
      if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
    } catch(e) {}
  }

  // ═══════════════════════════════════════════════════════════
  //  DOM
  // ═══════════════════════════════════════════════════════════
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const $ = id => document.getElementById(id);

  const homeOverlay=$('homeOverlay');
  const howToOverlay=$('howToOverlay');
  const profileOverlay=$('profileOverlay');
  const leaderboardOverlay=$('leaderboardOverlay');
  const settingsOverlay=$('settingsOverlay');
  const charOverlay=$('charOverlay');
  const themeOverlay=$('themeOverlay');
  const startOverlay=$('startOverlay');
  const nameOverlay=$('nameOverlay');
  const pauseOverlay=$('pauseOverlay');
  const levelCompleteOverlay=$('levelCompleteOverlay');
  const timeOverOverlay=$('timeOverOverlay');
  const gameOverOverlay=$('gameOverOverlay');
  const victoryOverlay=$('victoryOverlay');
  const introOverlay=$('introOverlay');
  const storyOverlay=$('storyOverlay');
  const appShell=$('appShell');
  const topCornerMenu=$('topCornerMenu');

  const scoreDisplay=$('scoreDisplay'), highScoreDisplay=$('highScoreDisplay');
  const suspicionFill=$('suspicionFill'), suspicionStatus=$('suspicionStatus');
  const suspicionBar=$('suspicionBar');
  const scoreBox=$('scoreBox');
  const roundDisplay=$('roundDisplay');
  const levelDots=$('levelDots');
  const teachingsCount=$('teachingsCount');
  const timerDisplay=$('timerDisplay'), timerBox=$('timerBox');
  const divineIndicator=$('divineIndicator');
  const levelName=$('levelName');

  const lpPray=$('lpPray'), lpPower=$('lpPower');
  const lpPowerIcon=$('lpPowerIcon'), lpPowerName=$('lpPowerName');
  const lpPrayStatus=$('lpPrayStatus'), lpPowerStatus=$('lpPowerStatus');

  const dpad=$('dpad'), touchActions=$('touchActions');
  const taPray=$('taPray'), taPower=$('taPower'), taPowerIcon=$('taPowerIcon');

  const finalScoreSpan=$('finalScore'), finalRoundSpan=$('finalRound');
  const finalHighScoreSpan=$('finalHighScore');
  const gameOverEmoji=$('gameOverEmoji'), gameOverTitle=$('gameOverTitle'), gameOverQuip=$('gameOverQuip');
  const timeOverScore=$('timeOverScore'), timeOverLevel=$('timeOverLevel'), timeOverQuip=$('timeOverQuip');

  const cinematicBanner=$('cinematicBanner'), cbIcon=$('cbIcon'), cbTitle=$('cbTitle'), cbSub=$('cbSub');
  const divineFlash=$('divineFlash'), powerFlash=$('powerFlash');

  const charPreviewAvatar=$('charPreviewAvatar');
  const charPreviewImg=$('charPreviewImg');
  const charPreviewName=$('charPreviewName');
  const charPreviewDesc=$('charPreviewDesc');
  const charPreviewStats=$('charPreviewStats');
  const charPreviewFlavor=$('charPreviewFlavor');

  const themePreviewIcon=$('themePreviewIcon');
  const themePreviewImg=$('themePreviewImg');
  const themePreviewName=$('themePreviewName');
  const themePreviewDesc=$('themePreviewDesc');
  const themePreviewEffect=$('themePreviewEffect');

  const leaderboardList=$('leaderboardList');
  const victoryLeaderboardList=$('victoryLeaderboardList');
  const timeOverLeaderboard=$('timeOverLeaderboard');
  const homeLeaderboardList=$('homeLeaderboardList');

  const startNameInput=$('startNameInput');
  const profileNameInput=$('profileNameInput');
  const profileHighScore=$('profileHighScore');
  const profilePlays=$('profilePlays');
  const profileTeachings=$('profileTeachings');
  const profileStars=$('profileStars');

  const toggleSfx=$('toggleSfx'), toggleMusic=$('toggleMusic'), toggleVibrate=$('toggleVibrate');
  const volumeSlider=$('volumeSlider'), volumeValue=$('volumeValue');

  // ═══════════════════════════════════════════════════════════
  //  DATA
  // ═══════════════════════════════════════════════════════════
  const CHARACTERS = [
    { id:'classic', name:'Classic Mushak', avatar:'🐭', powerName:'🕶️ Shadow Dash',
      powerDesc:'3s invisibility', powerIcon:'🕶️', speed:4.0, suspicionMult:1.0, color:'#f59e0b',
      imgKey:'char_classic', prayKey:'char_classicPray', caughtKey:'char_classicCaught',
      flavor:'Balanced all-rounder — great for beginners.',
      stats:{ speed: 3, caution: 3 } },
    { id:'chota', name:'Chota Mushak', avatar:'🐁', powerName:'⏱️ Samay Stambh',
      powerDesc:'Freeze time 3s', powerIcon:'⏱️', speed:5.4, suspicionMult:1.25, color:'#38bdf8',
      imgKey:'char_chota', prayKey:'char_chotaPray', caughtKey:'char_chotaCaught',
      flavor:'Fast but fragile — Ganesh notices him quickly.',
      stats:{ speed: 5, caution: 2 } },
    { id:'mota', name:'Mota Mushak', avatar:'🐹', powerName:'🛡️ Divya Kavach',
      powerDesc:'Divine shield 5s', powerIcon:'🛡️', speed:3.2, suspicionMult:0.7, color:'#10b981',
      imgKey:'char_mota', prayKey:'char_motaPray', caughtKey:'char_motaCaught',
      flavor:'Slow but sturdy — hardest to catch.',
      stats:{ speed: 2, caution: 5 } },
    { id:'chor', name:'Chor Mushak', avatar:'🐿️', powerName:'💰 Lakshmi Kripa',
      powerDesc:'2× points for 6s', powerIcon:'💰', speed:4.2, suspicionMult:1.1, color:'#a855f7',
      imgKey:'char_chor', prayKey:'char_chorPray', caughtKey:'char_chorCaught',
      flavor:'Risk-taker — earns double points.',
      stats:{ speed: 4, caution: 3 } }
  ];

  const THEMES = [
    { id:'diwali', name:'Diwali Night', icon:'🪔', desc:'Balanced & blessed',
      bgKey:'theme_diwali', effect:'Normal modaks · Normal Ganesh',
      sky:['#2d1b3d','#4a2540','#6b2c4a'], bgTint:'rgba(255,140,60,0.12)',
      starColor:'rgba(255,220,150,0.9)', modakMult:1.0, ganeshMult:1.0, scoreMult:1.0, night:true },
    { id:'spring', name:'Spring Festival', icon:'🌸', desc:'More modaks, faster watch',
      bgKey:'theme_spring', effect:'+40% modaks · Ganesh +15% faster',
      sky:['#ffd6e7','#ffc4dd','#f8b3c9'], bgTint:'rgba(255,180,220,0.12)',
      starColor:'rgba(255,255,255,0.8)', modakMult:1.4, ganeshMult:1.15, scoreMult:1.0, night:false },
    { id:'temple', name:'Midnight Temple', icon:'🌙', desc:'Fewer modaks, 2× points',
      bgKey:'theme_midnight', effect:'-30% modaks · 2× points · Ganesh +30% faster',
      sky:['#0a0a2e','#1a1a4a','#2a2a5a'], bgTint:'rgba(80,100,180,0.15)',
      starColor:'rgba(200,220,255,0.9)', modakMult:0.7, ganeshMult:1.3, scoreMult:2.0, night:true }
  ];

  const LEVELS = [
    { name:'Home Sweet Home', icon:'🏠', timeLimit: 60, difficulty: 1.0 },
    { name:'Temple Courtyard', icon:'🛕', timeLimit: 55, difficulty: 1.15 },
    { name:'Garden of Flowers', icon:'🌸', timeLimit: 50, difficulty: 1.3 },
    { name:'Moonlit River', icon:'🌙', timeLimit: 45, difficulty: 1.5 },
    { name:'Modak Heaven', icon:'✨', timeLimit: 40, difficulty: 1.7 }
  ];

  const DIVINE_POWERS = [
    { name:'Divya Drishti', icon:'👁️', label:'🕉️ Divya Drishti 🕉️' },
    { name:'Buddhi Shakti', icon:'💡', label:'🕉️ Buddhi Shakti 🕉️' },
    { name:'Vighna Harta', icon:'🌀', label:'🕉️ Vighna Harta 🕉️' },
    { name:'Ashirwad', icon:'🌺', label:'🕉️ Ashirwad 🕉️' },
    { name:'Sarva Vyapi', icon:'🌟', label:'🕉️ Sarva Vyapi 🕉️' }
  ];

  const LESSONS = [
    { title:'On Patience', text:'Rushing leads to mistakes. The wise wait for the right moment.', source:'— Reflecting on Mushak\'s haste' },
    { title:'On Contentment', text:'What you have is enough. Greed blinds even the cleverest.', source:'— A lesson from the modak thief' },
    { title:'On Respect', text:'Those who respect boundaries find peace.', source:'— Ancient wisdom' },
    { title:'On Effort', text:'Success comes to those who are patient and persistent.', source:'— Ganesh Ji\'s teaching' },
    { title:'On Devotion', text:'A single sincere prayer is worth more than a thousand rushed actions.', source:'— From the Vedas' },
    { title:'On Humility', text:'Even the smallest creature has a lesson to teach.', source:'— Traditional wisdom' },
    { title:'On Focus', text:'The mind wanders when it forgets its purpose.', source:'— Bhagavad Gita (paraphrased)' },
    { title:'On Balance', text:'Too much of anything — even modaks — brings trouble.', source:'— Ayurvedic wisdom' },
    { title:'On Courage', text:'It is not about never falling. It is about rising each time.', source:'— Timeless teaching' },
    { title:'On Gratitude', text:'Count your blessings, not your modaks.', source:'— Ganesh Ji\'s reminder' },
    { title:'On Integrity', text:'What is earned honestly brings lasting joy.', source:'— Dharmic principle' },
    { title:'On Forgiveness', text:'Ganesh Ji forgives sincere hearts.', source:'— Vighnaharta\'s grace' }
  ];

  const FUNNY_LEVEL_CLEAR = [
    '🐭 "All modaks safely delivered! Bappa never suspected a thing."',
    '🐭 "Another level conquered! I\'m basically a ninja now."',
    '🐭 "Dear diary: today I outsmarted a god. It was fun."',
    '🐭 "Ganesh Ji blinked and I cleaned the whole house!"',
    '🐭 "Sneaky level: 100. Modak collection: complete."'
  ];
  const FUNNY_TIME_OVER = [
    '🐭 "Time flew faster than my paws!"',
    '🐭 "The modak was RIGHT THERE when time stopped!"',
    '🐭 "Next time, I\'ll skip the dance breaks."',
    '🐭 "Who knew stealing was this time-consuming?"'
  ];
  const FUNNY_GAMEOVER = [
    '🐭 "Caught red-pawed! Can I keep just ONE modak? Please?"',
    '🐭 "Busted! But at least I got the golden ones first!"',
    '🐭 "I was THIS close. Also, my tail betrayed me."',
    '🐭 "Bappa, I was just... uh... counting them for you!"'
  ];
  const FUNNY_VICTORY = [
    '🐭 "I did it! Bappa, can I keep ONE modak? Please?"',
    '🐭 "Champion of Modak Heist!"',
    '🐭 "Ganesh Ji smiled! That\'s a compliment, right?"',
    '🐭 "Modak heist master — available for birthday parties."'
  ];

  const STORY_SCENE_DURATIONS = [7000, 7000, 8000, 8000, 8000];

  // ═══════════════════════════════════════════════════════════
  //  STATE
  // ═══════════════════════════════════════════════════════════
  let selectedChar = CHARACTERS[0];
  let selectedTheme = THEMES[0];
  let gameActive = false, paused = false;
  let score = 0, levelIndex = 0;
  let levelStartTime = 0;
  let levelTimeRemaining = 60;
  let modaksCollected = 0;
  let highScore = parseInt(localStorage.getItem('mushakHighScore') || '0', 10);
  highScoreDisplay.textContent = highScore;
  let totalPrayersUsed = 0, totalModaksCollected = 0, totalTimeSpent = 0;
  let totalStars = parseInt(localStorage.getItem('mushakStars') || '0', 10);
  let gamesPlayed = parseInt(localStorage.getItem('mushakPlays') || '0', 10);
  let lessonsShown = new Set(JSON.parse(localStorage.getItem('mushakTeachings') || '[]'));
  let leaderboard = JSON.parse(localStorage.getItem('mushakLeaderboard') || '[]');
  let playerName = localStorage.getItem('mushakPlayerName') || '';

  let activeMushakImg = null, activeMushakPrayImg = null, activeMushakCaughtImg = null;
  let activeThemeBg = null;

  const mushak = { x: 130, y: 400, speed: 4.0, baseSpeed: 4.0, hits: 0 };
  const safeZone = { x: 25, y: 25, w: 110, h: 85 };
  const ganesh = {
    x: 620, y: 90, lookTimer: 0, lookDuration: 70, lookCooldown: 110,
    isLooking: false, eyeOpen: 0, turnFlash: 0,
    divinePowerType: 0, divineFlashTimer: 0
  };

  let suspicion = 0;
  const SUSPICION_MAX = 100, SUSPICION_BASE = 2.6, DECAY_RATE = 0.28;

  let modaks = [], goldenModak = null, powerUps = [], obstacles = [];
  let divineBarriers = [], blessingFlowers = [];
  let particles = [], popups = [], ripples = [];
  let comboCount = 0, comboTimer = 0, comboMilestone = 0;
  const COMBO_TIMEOUT = 100;

  let emote = { text: '', timer: 0 };
  let screenShake = 0, prayCooldown = 0;
  let ganeshSlowTimer = 0, shieldActive = false, speedBoostTimer = 0;
  let slowMo = 0, newBatchNotice = 0, buddhiSlowTimer = 0;

  let powerCooldown = 0;
  const POWER_COOLDOWN = 1500;
  let powerActiveTimer = 0;
  let shadowActive = false, midasActive = false;

  const keys = { up:false, down:false, left:false, right:false, space:false, shift:false };
  const QUIPS = ['Modak modak! 🥟','Sneaky sneaky 🐭','For Bappa 😇','Just one more 🤤',
    'Nom nom 😋','So good 🥰','Jai Ganesh 🙏','Shhh 🤫','Respect 🙏','Gotcha! 🎯'];

  // ═══════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════
  const setEmote = (t,d=90) => { emote.text = t; emote.timer = d; };
  const rand = (a,b) => a + Math.random()*(b-a);
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const dist = (a,b,c,d) => Math.hypot(a-c,b-d);

  function addParticles(x,y,color,count=8,speed=4) {
    for (let i=0;i<count;i++) {
      particles.push({ x, y, vx:(Math.random()-.5)*speed, vy:(Math.random()-.5)*speed-1.2,
        life:45+Math.random()*25, maxLife:70, color, size:3+Math.random()*5,
        rot:Math.random()*Math.PI, vr:(Math.random()-.5)*.3,
        kind: Math.random() < .35 ? 'star' : 'dot' });
    }
  }
  function addPopup(x,y,text,color='#ffd56b',size=24) {
    popups.push({ x, y, text, color, size, life:160, maxLife:160, vy:-0.9 });
  }
  function addPopupShort(x,y,text,color='#ffd56b',size=24) {
    popups.push({ x, y, text, color, size, life:80, maxLife:80, vy:-1.2 });
  }
  function addRipple(x,y,color='#ffd56b',max=60) {
    ripples.push({ x, y, r:5, max, color, life:40 });
  }
  const shake = a => { screenShake = Math.max(screenShake, a); };

  function currentDivinePower() { return DIVINE_POWERS[Math.min(levelIndex, DIVINE_POWERS.length-1)]; }

  function pickUnshownLesson() {
    const available = LESSONS.filter((_, i) => !lessonsShown.has(i));
    if (available.length === 0) {
      const idx = Math.floor(Math.random() * LESSONS.length);
      return { idx, lesson: LESSONS[idx], allCollected: true };
    }
    const idx = LESSONS.indexOf(available[Math.floor(Math.random()*available.length)]);
    return { idx, lesson: LESSONS[idx], allCollected: false };
  }

  function isModakReachable(m) {
    const checkRadius = 35;
    const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
    for (const [dx, dy] of dirs) {
      const tx = m.x + dx * checkRadius;
      const ty = m.y + dy * checkRadius;
      if (tx < 20 || tx > W-20 || ty < 40 || ty > H-20) continue;
      let blocked = false;
      for (const o of obstacles) {
        if (tx > o.x - 16 && tx < o.x + o.w + 16 &&
            ty > o.y - 16 && ty < o.y + o.h + 16) { blocked = true; break; }
      }
      if (!blocked) return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════
  //  LEADERBOARD
  // ═══════════════════════════════════════════════════════════
  function saveLeaderboard() { localStorage.setItem('mushakLeaderboard', JSON.stringify(leaderboard)); }

  function addToLeaderboard(name, finalScore) {
    if (!name || !name.trim()) return;
    const entry = { name: name.trim().slice(0, 16), score: finalScore, date: Date.now() };
    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);
    saveLeaderboard();
  }

  function renderLeaderboard(containerId) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (leaderboard.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'lb-empty';
      empty.textContent = 'No scores yet — be the first!';
      container.appendChild(empty);
      return;
    }
    leaderboard.forEach((entry, i) => {
      const item = document.createElement('div');
      const isYou = playerName && entry.name === playerName && entry.score === score;
      item.className = 'lb-item' +
        (i === 0 ? ' rank-1' : i === 1 ? ' rank-2' : i === 2 ? ' rank-3' : '') +
        (isYou ? ' you' : '');
      const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      item.innerHTML = `<div class="lb-rank">${rank}</div><div class="lb-name">${escapeHtml(entry.name)}</div><div class="lb-score">${entry.score}</div>`;
      container.appendChild(item);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════
  //  CINEMATIC
  // ═══════════════════════════════════════════════════════════
  let cinematicTimeout = null;
  function playCinematic(icon, title, sub, duration = 1800) {
    cinematicBanner.classList.remove('play');
    void cinematicBanner.offsetWidth;
    cbIcon.textContent = icon;
    cbTitle.textContent = title;
    cbSub.textContent = sub;
    cinematicBanner.classList.add('play');
    clearTimeout(cinematicTimeout);
    cinematicTimeout = setTimeout(() => { cinematicBanner.classList.remove('play'); }, duration);
  }
  function playDivineFlash() {
    divineFlash.classList.remove('play');
    void divineFlash.offsetWidth;
    divineFlash.classList.add('play');
  }
  function playPowerFlash(color) {
    powerFlash.style.background = `radial-gradient(circle at 50% 70%, ${color} 0%, transparent 60%)`;
    powerFlash.classList.remove('play');
    void powerFlash.offsetWidth;
    powerFlash.classList.add('play');
  }

  // ═══════════════════════════════════════════════════════════
  //  ROUND GENERATION
  // ═══════════════════════════════════════════════════════════
  function generateRoundContent(lvIdx) {
    modaks = []; powerUps = []; obstacles = [];
    divineBarriers = []; blessingFlowers = [];
    modaksCollected = 0;
    comboMilestone = 0;

    const lvl = LEVELS[Math.min(lvIdx, LEVELS.length - 1)];
    const difficulty = lvl.difficulty;

    const obsCount = Math.floor((3 + Math.min(lvIdx + 1, 6)) * difficulty);
    for (let i=0; i<obsCount; i++) {
      for (let tries=0; tries<200; tries++) {
        const ox = rand(230, W-80), oy = rand(60, H-70);
        const ow = rand(45, 70), oh = rand(30, 55);
        if (ox > safeZone.x + safeZone.w + 20 && oy < H-70 &&
            dist(ox,oy,ganesh.x,ganesh.y) > 130 &&
            !obstacles.some(o => Math.abs(o.x-ox)<80 && Math.abs(o.y-oy)<80)) {
          obstacles.push({ x: ox, y: oy, w: ow, h: oh, wobble: Math.random()*Math.PI*2 });
          break;
        }
      }
    }

    const themeMod = selectedTheme.modakMult;
    const baseCount = Math.min(4 + lvIdx * 2, 16);
    const count = Math.max(4, Math.floor(baseCount * themeMod * difficulty));
    const MODAK_BUFFER = 42;

    for (let i=0; i<count; i++) {
      for (let tries=0; tries<400; tries++) {
        const mx = rand(190, W-40), my = rand(70, H-40);
        if (mx < safeZone.x + safeZone.w + 30) continue;
        if (dist(mx, my, ganesh.x, ganesh.y) < 140) continue;
        const overlapsObstacle = obstacles.some(o =>
          mx > o.x - MODAK_BUFFER && mx < o.x + o.w + MODAK_BUFFER &&
          my > o.y - MODAK_BUFFER && my < o.y + o.h + MODAK_BUFFER);
        if (overlapsObstacle) continue;
        const overlapsModak = modaks.some(m => dist(mx, my, m.x, m.y) < MODAK_BUFFER);
        if (overlapsModak) continue;
        const wedgedCount = obstacles.filter(o =>
          mx > o.x - 50 && mx < o.x + o.w + 50 &&
          my > o.y - 50 && my < o.y + o.h + 50).length;
        if (wedgedCount > 1) continue;
        modaks.push({ x: mx, y: my, r: 18, collected:false, bob: Math.random()*Math.PI*2 });
        break;
      }
    }

    goldenModak = null;
    for (let tries=0; tries<400; tries++) {
      const gx = rand(220, W-40), gy = rand(80, H-40);
      if (gx < safeZone.x + safeZone.w + 40) continue;
      if (dist(gx, gy, ganesh.x, ganesh.y) < 140) continue;
      const overlapsObstacle = obstacles.some(o =>
        gx > o.x - 50 && gx < o.x + o.w + 50 && gy > o.y - 50 && gy < o.y + o.h + 50);
      if (overlapsObstacle) continue;
      const overlapsModak = modaks.some(m => dist(gx, gy, m.x, m.y) < 50);
      if (overlapsModak) continue;
      goldenModak = { x: gx, y: gy, r: 24, collected:false, bob:0 };
      break;
    }

    const puCount = lvIdx < 2 ? 1 : (lvIdx < 4 ? 1 : 0);
    for (let i=0; i<puCount; i++) {
      for (let tries=0; tries<100; tries++) {
        const px = rand(220, W-60), py = rand(80, H-60);
        if (px > safeZone.x + safeZone.w + 40 && dist(px,py,ganesh.x,ganesh.y) > 110) {
          powerUps.push({ x: px, y: py, r: 18, type: pick(['speed','shield','freeze']),
            bob: Math.random()*Math.PI*2, collected:false });
          break;
        }
      }
    }

    ganesh.divinePowerType = Math.min(lvIdx, DIVINE_POWERS.length - 1);
    divineIndicator.textContent = currentDivinePower().label;
    divineIndicator.style.display = 'block';

    if (lvIdx >= 2) {
      const barrierCount = Math.min(1 + Math.floor((lvIdx - 1) / 2), 3);
      for (let b = 0; b < barrierCount; b++) {
        for (let tries = 0; tries < 100; tries++) {
          const bx = rand(240, W - 120), by = rand(80, H - 120);
          const bw = rand(60, 120), bh = rand(20, 40);
          const horizontal = Math.random() < 0.5;
          const finalW = horizontal ? bw : bh;
          const finalH = horizontal ? bh : bw;
          if (dist(bx, by, ganesh.x, ganesh.y) > 130 && bx > safeZone.x + safeZone.w + 30) {
            divineBarriers.push({ x: bx, y: by, w: finalW, h: finalH,
              pulse: Math.random() * Math.PI * 2, horizontal });
            break;
          }
        }
      }
    }

    if (lvIdx >= 3) {
      for (let f = 0; f < 2; f++) {
        for (let tries = 0; tries < 100; tries++) {
          const fx = rand(200, W - 60), fy = rand(70, H - 60);
          if (fx > safeZone.x + safeZone.w + 30 && dist(fx, fy, ganesh.x, ganesh.y) > 100) {
            blessingFlowers.push({ x: fx, y: fy, r: 18,
              bob: Math.random() * Math.PI * 2, collected: false });
            break;
          }
        }
      }
    }
  }

  function resetGame(startLevel = 0) {
    score = 0; levelIndex = startLevel;
    suspicion = 0; comboCount = 0; comboTimer = 0; prayCooldown = 0;
    ganeshSlowTimer = 0; shieldActive = false; speedBoostTimer = 0;
    slowMo = 0; newBatchNotice = 0; buddhiSlowTimer = 0;
    powerCooldown = 0; powerActiveTimer = 0; shadowActive = false; midasActive = false;
    mushak.speed = selectedChar.speed; mushak.baseSpeed = selectedChar.speed;
    mushak.hits = 0;
    mushak.x = 130; mushak.y = 400;
    ganesh.isLooking = false; ganesh.lookTimer = 0; ganesh.eyeOpen = 0;
    ganesh.lookDuration = 70; ganesh.lookCooldown = 110;
    ganesh.divineFlashTimer = 0;
    particles = []; popups = []; ripples = [];
    emote = { text:'', timer:0 };
    screenShake = 0;

    activeMushakImg = loadedImages[selectedChar.imgKey] || loadedImages.mushakLegacy;
    activeMushakPrayImg = loadedImages[selectedChar.prayKey] || loadedImages.mushakPrayLegacy || activeMushakImg;
    activeMushakCaughtImg = loadedImages[selectedChar.caughtKey] || loadedImages.mushakCaughtLegacy || activeMushakImg;
    activeThemeBg = loadedImages[selectedTheme.bgKey] || loadedImages.bgLegacy;

    generateRoundContent(levelIndex);
    levelStartTime = performance.now();
    levelTimeRemaining = LEVELS[levelIndex].timeLimit;
    updateUI();
    updateLevelName();
    updateLevelDots();
    updateTeachingsHUD();
    lpPowerIcon.textContent = selectedChar.powerIcon;
    lpPowerName.textContent = selectedChar.powerName.replace(/^[^\s]+\s/,'');
    taPowerIcon.textContent = selectedChar.powerIcon;
    setEmote('😈', 100);
  }

  function updateLevelName() {
    const divine = currentDivinePower();
    const lvl = LEVELS[levelIndex];
    levelName.textContent = `${lvl.icon} ${lvl.name} · ${divine.icon} ${divine.name}`;
  }

  function updateLevelDots() {
    const dots = levelDots.querySelectorAll('.level-dot');
    dots.forEach((d, i) => {
      d.classList.remove('done', 'current');
      if (i < levelIndex) d.classList.add('done');
      else if (i === levelIndex) d.classList.add('current');
    });
    roundDisplay.textContent = (levelIndex + 1);
  }

  function updateTeachingsHUD() { teachingsCount.textContent = lessonsShown.size; }

  function updateUI() {
    scoreDisplay.textContent = score;
    const pct = Math.min(suspicion, 100);
    suspicionFill.style.width = pct + '%';
    suspicionBar.classList.toggle('mindful', suspicion > 65);
    let status = 'CALM';
    let statusClass = '';
    if (suspicion > 85) { status = 'CAUGHT'; statusClass = 'caught'; }
    else if (suspicion > 65) { status = 'NOTICED'; statusClass = 'noticed'; }
    else if (suspicion > 35) { status = 'WATCHED'; statusClass = 'watched'; }
    suspicionStatus.textContent = status;
    suspicionStatus.className = 'suspicion-status-badge ' + statusClass;

    if (gameActive && !paused) {
      const elapsed = (performance.now() - levelStartTime) / 1000;
      const remaining = Math.max(0, LEVELS[levelIndex].timeLimit - elapsed);
      levelTimeRemaining = remaining;
      timerDisplay.textContent = Math.ceil(remaining);
      timerBox.classList.toggle('warning', remaining < 10);
    } else {
      timerDisplay.textContent = Math.ceil(levelTimeRemaining);
    }

    updatePowerHUD();
    updateTouchActionButtons();
  }

  function updatePowerHUD() {
    const prayReady = prayCooldown <= 0;
    lpPray.classList.remove('ready', 'cooling', 'active-power');
    if (prayReady) { lpPray.classList.add('ready'); lpPrayStatus.textContent = 'READY'; }
    else { lpPray.classList.add('cooling'); lpPrayStatus.textContent = 'WAIT ' + Math.ceil(prayCooldown/60) + 's'; }

    const powerActive = powerActiveTimer > 0;
    const powerReady = powerCooldown <= 0;
    lpPower.classList.remove('ready', 'cooling', 'active-power');
    if (powerActive) {
      lpPower.classList.add('active-power');
      lpPowerStatus.textContent = 'ACTIVE ' + Math.ceil(powerActiveTimer/60) + 's';
    } else if (powerReady) {
      lpPower.classList.add('ready');
      lpPowerStatus.textContent = 'READY';
    } else {
      lpPower.classList.add('cooling');
      lpPowerStatus.textContent = 'WAIT ' + Math.ceil(powerCooldown/60) + 's';
    }
  }

  function updateTouchActionButtons() {
    taPray.classList.toggle('ready', prayCooldown <= 0);
    taPray.classList.toggle('cooling', prayCooldown > 0);
    taPower.classList.toggle('ready', powerCooldown <= 0 && powerActiveTimer <= 0);
    taPower.classList.toggle('cooling', powerCooldown > 0 && powerActiveTimer <= 0);
  }

  // ═══════════════════════════════════════════════════════════
  //  GANESH / MUSHAAK
  // ═══════════════════════════════════════════════════════════
  let ganeshPowerCooldown = 0;
  function triggerGaneshPowerCinematic() {
    if (ganeshPowerCooldown > 0) return;
    ganeshPowerCooldown = 400;
    const divine = currentDivinePower();
    ganesh.divineFlashTimer = 60;
    playDivineFlash();
    addRipple(ganesh.x, ganesh.y, '#ffd56b', 180);
    addParticles(ganesh.x, ganesh.y, '#ffd56b', 30, 6);
    playCinematic(divine.icon, divine.name + ' ACTIVATED', 'Divine presence grows', 1400);
  }

  function updateGanesh(dt) {
    const themeMult = selectedTheme.ganeshMult;
    const lvlMult = LEVELS[levelIndex].difficulty;
    const slow = (ganeshSlowTimer > 0 ? 0.4 : 1) * themeMult * lvlMult;
    if (ganesh.isLooking) {
      ganesh.lookTimer += dt * slow;
      ganesh.eyeOpen = Math.min(1, ganesh.eyeOpen + 0.09);
      if (ganesh.lookTimer > ganesh.lookDuration) {
        ganesh.isLooking = false; ganesh.lookTimer = 0; ganesh.turnFlash = 15;
      }
    } else {
      ganesh.lookTimer += dt * slow;
      ganesh.eyeOpen = Math.max(0, ganesh.eyeOpen - 0.07);
      if (ganesh.lookTimer > ganesh.lookCooldown) {
        ganesh.isLooking = true; ganesh.lookTimer = 0;
        ganesh.lookDuration = 70 + Math.min(40, levelIndex * 8);
        ganesh.lookCooldown = Math.max(45, 110 - levelIndex * 12);
        ganesh.turnFlash = 15;
      }
    }
    if (ganesh.turnFlash > 0) ganesh.turnFlash--;
    if (ganesh.divinePowerType >= 1 && ganesh.isLooking && ganesh.eyeOpen > 0.6) {
      if (dist(mushak.x, mushak.y, ganesh.x, ganesh.y) < 200) {
        if (buddhiSlowTimer <= 0) triggerGaneshPowerCinematic();
        buddhiSlowTimer = Math.max(buddhiSlowTimer, 20);
        addRipple(ganesh.x, ganesh.y, 'rgba(255,213,107,0.5)', 120);
      }
    }
    if (ganesh.divineFlashTimer > 0) ganesh.divineFlashTimer--;
    if (ganeshSlowTimer > 0) ganeshSlowTimer--;
    if (buddhiSlowTimer > 0) buddhiSlowTimer--;
  }

  function updateMushak(dt) {
    if (ganeshPowerCooldown > 0) ganeshPowerCooldown -= dt;
    if (slowMo > 0) { slowMo -= dt; dt *= 0.35; }
    if (prayCooldown > 0) { prayCooldown--; return; }
    let dx = 0, dy = 0;
    if (keys.up) dy--; if (keys.down) dy++;
    if (keys.left) dx--; if (keys.right) dx++;
    if (dx || dy) {
      const len = Math.hypot(dx,dy); dx/=len; dy/=len;
      const buddhiMult = buddhiSlowTimer > 0 ? 0.55 : 1;
      const spd = mushak.speed * (speedBoostTimer > 0 ? 1.6 : 1) * buddhiMult;
      mushak.x += dx*spd; mushak.y += dy*spd;
      mushak.x = Math.max(22, Math.min(W-22, mushak.x));
      mushak.y = Math.max(40, Math.min(H-22, mushak.y));
      for (const o of obstacles) {
        if (mushak.x+17 > o.x && mushak.x-17 < o.x+o.w &&
            mushak.y+17 > o.y && mushak.y-17 < o.y+o.h) {
          if (mushak.x < o.x+o.w/2) mushak.x = o.x-17;
          else mushak.x = o.x+o.w+17;
          if (mushak.y < o.y+o.h/2) mushak.y = o.y-17;
          else mushak.y = o.y+o.h+17;
        }
      }
      for (const b of divineBarriers) {
        if (mushak.x+17 > b.x && mushak.x-17 < b.x+b.w &&
            mushak.y+17 > b.y && mushak.y-17 < b.y+b.h) {
          if (b.horizontal) {
            if (mushak.y < b.y + b.h/2) mushak.y = b.y - 17;
            else mushak.y = b.y + b.h + 17;
          } else {
            if (mushak.x < b.x + b.w/2) mushak.x = b.x - 17;
            else mushak.x = b.x + b.w + 17;
          }
          addPopupShort(mushak.x, mushak.y - 30, '🕉️ Vighna Harta', '#ffd56b', 16);
          setEmote('🙏', 60);
        }
      }
      const immune = shieldActive || shadowActive || (powerActiveTimer > 0 && selectedChar.id === 'mota');
      if (ganesh.isLooking && ganesh.eyeOpen > 0.4 && !immune) {
        suspicion += SUSPICION_BASE * selectedChar.suspicionMult * LEVELS[levelIndex].difficulty * dt;
        if (suspicion > 80 && slowMo <= 0) slowMo = 40;
        if (Math.random() < 0.012) setEmote(pick(['😳','😨','🫣','😅']), 45);
      }
    }
    if ((!ganesh.isLooking || ganesh.eyeOpen < 0.2) && suspicion > 0)
      suspicion = Math.max(0, suspicion - DECAY_RATE * dt);
    if (shieldActive) suspicion = Math.max(0, suspicion - 0.15 * dt);
    if (shadowActive) suspicion = Math.max(0, suspicion - 0.2 * dt);
    if (powerActiveTimer > 0 && selectedChar.id === 'mota') suspicion = Math.max(0, suspicion - 0.25 * dt);
    if (suspicion >= SUSPICION_MAX) {
      if (selectedChar.id === 'mota' && mushak.hits < 1) {
        mushak.hits++; suspicion = 30;
        addPopup(mushak.x, mushak.y-40, '🛡️ Divine Shield held!', '#10b981', 22);
        shake(8);
      } else { gameOver(); return; }
    }
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) comboCount = 0; }
    if (speedBoostTimer > 0) speedBoostTimer -= dt;
    if (newBatchNotice > 0) newBatchNotice -= dt;
    if (powerCooldown > 0) powerCooldown -= dt;
    if (powerActiveTimer > 0) {
      powerActiveTimer -= dt;
      if (powerActiveTimer <= 0) { shadowActive = false; midasActive = false; }
    }
    totalTimeSpent += dt / 60;
  }

  function collectModaks() {
    const scoreMult = selectedTheme.scoreMult * (midasActive ? 2 : 1);
    for (const m of modaks) {
      if (m.collected) continue;
      if (dist(mushak.x, mushak.y, m.x, m.y) < 38) {
        m.collected = true;
        modaksCollected++; totalModaksCollected++;
        comboCount++; comboTimer = COMBO_TIMEOUT;
        const comboMult = 1 + Math.floor(comboCount/3);
        const pts = Math.round(10 * comboMult * scoreMult);
        score += pts;
        addParticles(m.x, m.y, '#ffd56b', 10);
        addPopupShort(m.x, m.y-20, '+' + pts + (comboMult>1 ? ' x'+comboMult : ''),
                 midasActive ? '#a855f7' : '#ffd56b', 22);
        addRipple(m.x, m.y, '#fcd34d', 50);
        sfxCollect();
        setEmote(pick(['😋','😇','🤤','😊']), 40);
        scoreBox.classList.remove('pop'); void scoreBox.offsetWidth; scoreBox.classList.add('pop');
        if (comboCount >= 6 && comboCount >= comboMilestone + 6) {
          comboMilestone = comboCount;
          playCinematic('🔥', comboCount + 'x COMBO!', 'Mushak is unstoppable!', 1200);
        }
        if (modaksCollected % 3 === 0) addPopup(mushak.x, mushak.y-70, pick(QUIPS), '#a855f7', 16);
      }
    }
    if (goldenModak && !goldenModak.collected &&
        dist(mushak.x, mushak.y, goldenModak.x, goldenModak.y) < 42) {
      goldenModak.collected = true;
      const pts = Math.round(75 * scoreMult);
      score += pts; comboCount += 2; comboTimer = COMBO_TIMEOUT;
      addParticles(goldenModak.x, goldenModak.y, '#ffd56b', 24, 6);
      addPopup(goldenModak.x, goldenModak.y-30, `+${pts} GOLDEN!`, '#dc2626', 28);
      addRipple(goldenModak.x, goldenModak.y, '#ffd56b', 90);
      sfxGolden();
      setEmote('🥳', 60); shake(6);
      playCinematic('🌟', 'GOLDEN MODAK!', '+' + pts + ' points', 1300);
    }
    for (const f of blessingFlowers) {
      if (f.collected) continue;
      if (dist(mushak.x, mushak.y, f.x, f.y) < 38) {
        f.collected = true; score += 100;
        suspicion = Math.max(0, suspicion - 25);
        addParticles(f.x, f.y, '#f472b6', 20, 5);
        addPopup(f.x, f.y-30, '🌺 Ashirwad! +100', '#f472b6', 24);
        addRipple(f.x, f.y, '#f472b6', 90);
        sfxGolden();
        setEmote('🙏', 70); shake(4);
        playCinematic('🌺', 'ASHIRWAD!', 'Divine blessing received', 1400);
      }
    }
    for (const p of powerUps) {
      if (p.collected) continue;
      if (dist(mushak.x, mushak.y, p.x, p.y) < 34) {
        p.collected = true;
        sfxPowerup();
        addRipple(p.x, p.y, '#a855f7', 70);
        if (p.type === 'speed') { speedBoostTimer = 300; addPopup(p.x, p.y-25, '☕ SPEED!', '#38bdf8', 22); }
        else if (p.type === 'shield') {
          shieldActive = true;
          setTimeout(()=>{ shieldActive = false; }, 6000);
          addPopup(p.x, p.y-25, '🛡️ SHIELD!', '#a855f7', 22);
        } else { ganeshSlowTimer = 300; addPopup(p.x, p.y-25, '❄️ SLOW!', '#38bdf8', 22); }
        setEmote('😊', 50);
      }
    }
  }

  function checkSafeZone() {
    const inSafe = mushak.x > safeZone.x && mushak.x < safeZone.x + safeZone.w &&
                   mushak.y > safeZone.y && mushak.y < safeZone.y + safeZone.h;
    if (!inSafe) return;
    const allDone = modaks.every(m => m.collected) &&
                    (goldenModak ? goldenModak.collected : true) &&
                    blessingFlowers.every(f => f.collected);
    if (!allDone) {
      addPopup(mushak.x, mushak.y-40, '🙏 Collect all first!', '#ffd56b', 22);
      setEmote('😅', 45);
      if (newBatchNotice <= 0) { newBatchNotice = 90; shake(2); }
      mushak.x = safeZone.x + safeZone.w + 20;
      return;
    }
    const timeTaken = (performance.now() - levelStartTime) / 1000;
    const timeBonus = Math.max(0, Math.round(1000 - timeTaken * 5));
    score += timeBonus;
    let stars = 3;
    if (timeTaken > LEVELS[levelIndex].timeLimit * 0.75) stars = 1;
    else if (timeTaken > LEVELS[levelIndex].timeLimit * 0.5) stars = 2;
    if (suspicion < 15) score += 50;
    totalStars += stars;
    localStorage.setItem('mushakStars', String(totalStars));
    suspicion = Math.max(0, suspicion - 35);
    comboCount = 0;
    sfxSafe();
    setTimeout(() => { sfxLevelComplete(); }, 350);
    addRipple(mushak.x, mushak.y, '#10b981', 100);
    shake(4);
    scoreBox.classList.remove('pop'); void scoreBox.offsetWidth; scoreBox.classList.add('pop');
    playCinematic('🎉', 'LEVEL ' + (levelIndex + 1) + ' CLEAR!', 'Stars: ' + '⭐'.repeat(stars), 2000);
    setTimeout(() => { showLevelComplete(stars, timeBonus); }, 2000);
  }

  function showLevelComplete(stars, timeBonus) {
    gameActive = false;
    $('starRating').textContent = '⭐'.repeat(stars) + '☆'.repeat(3-stars);
    $('totalScore').textContent = score;
    $('timeBonus').textContent = '+' + timeBonus;
    $('levelCompleteQuip').textContent = pick(FUNNY_LEVEL_CLEAR);
    $('levelCompleteTitle').textContent = pick(['🎉 Level Clear!', '🌟 Well Done!', '✨ Shabash!', '🎊 Smooth!']);
    levelCompleteOverlay.classList.remove('hidden');
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('mushakHighScore', highScore);
      highScoreDisplay.textContent = highScore;
    }
  }

  function nextLevel() {
    levelCompleteOverlay.classList.add('hidden');
    levelIndex++;
    if (levelIndex >= LEVELS.length) { victory(); return; }
    score += 200;
    const divine = currentDivinePower();
    playCinematic(LEVELS[levelIndex].icon, 'LEVEL ' + (levelIndex + 1), LEVELS[levelIndex].name, 1800);
    setTimeout(() => {
      resetGame(levelIndex);
      gameActive = true; paused = false;
      setTimeout(() => {
        playCinematic(divine.icon, divine.name, 'Ganesh Ji\'s power grows', 1600);
      }, 800);
    }, 1800);
  }

  function victory() {
    gameActive = false;
    sfxLevelComplete();
    shake(10);
    playCinematic('🏆', 'VICTORY!', 'All 5 levels mastered', 2200);
    setTimeout(() => {
      $('victoryScore').textContent = score;
      $('victoryHighScore').textContent = highScore;
      $('victoryQuip').textContent = pick(FUNNY_VICTORY);
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('mushakHighScore', highScore);
        highScoreDisplay.textContent = highScore;
      }
      if (playerName && playerName.trim()) addToLeaderboard(playerName, score);
      renderLeaderboard('victoryLeaderboardList');
      victoryOverlay.classList.remove('hidden');
      topCornerMenu.classList.add('hidden');
    }, 2200);
  }

  function saveTeachings() { localStorage.setItem('mushakTeachings', JSON.stringify([...lessonsShown])); }

  function prayAction() {
    if (!gameActive || paused || prayCooldown > 0) return;
    suspicion = Math.max(0, suspicion - 20);
    prayCooldown = 22;
    totalPrayersUsed++;
    setEmote('🙏', 70);
    sfxClick();
    addParticles(mushak.x, mushak.y, '#fde68a', 14);
    addRipple(mushak.x, mushak.y, '#fef3c7', 70);
    addPopup(mushak.x, mushak.y-40, '🙏 Om Gan Ganpataye!', '#a855f7', 22);
  }

  function activatePower() {
    if (!gameActive || paused || powerCooldown > 0) return;
    powerCooldown = POWER_COOLDOWN;
    powerActiveTimer = 180;
    const c = selectedChar;
    let cinematicIcon = c.powerIcon, cinematicTitle = '', cinematicSub = '';
    if (c.id === 'classic') {
      shadowActive = true; powerActiveTimer = 180;
      addPopup(mushak.x, mushak.y-50, '🕶️ Shadow Dash!', '#ffd56b', 26);
      cinematicTitle = 'SHADOW DASH'; cinematicSub = 'Mushak fades into the shadows';
      playPowerFlash('rgba(255,213,107,0.75)');
    } else if (c.id === 'chota') {
      ganeshSlowTimer = 180; powerActiveTimer = 180;
      addPopup(mushak.x, mushak.y-50, '⏱️ Samay Stambh!', '#38bdf8', 26);
      cinematicTitle = 'SAMAY STAMBH'; cinematicSub = 'Time itself slows down';
      playPowerFlash('rgba(56,189,248,0.75)');
    } else if (c.id === 'mota') {
      powerActiveTimer = 300;
      addPopup(mushak.x, mushak.y-50, '🛡️ Divya Kavach!', '#10b981', 26);
      cinematicTitle = 'DIVYA KAVACH'; cinematicSub = 'The divine shield protects';
      playPowerFlash('rgba(16,185,129,0.75)');
    } else if (c.id === 'chor') {
      midasActive = true; powerActiveTimer = 360;
      addPopup(mushak.x, mushak.y-50, '💰 Lakshmi Kripa!', '#a855f7', 26);
      cinematicTitle = 'LAKSHMI KRIPA'; cinematicSub = 'Double points flow freely';
      playPowerFlash('rgba(168,85,247,0.75)');
    }
    sfxPowerup();
    playCinematic(cinematicIcon, cinematicTitle, cinematicSub, 1400);
    setEmote('😊', 60);
    shake(6);
    addParticles(mushak.x, mushak.y, c.color, 30, 7);
    addRipple(mushak.x, mushak.y, c.color, 130);
  }

  function timeOver() {
    if (!gameActive) return;
    gameActive = false;
    gamesPlayed++;
    localStorage.setItem('mushakPlays', String(gamesPlayed));
    timeOverScore.textContent = score;
    timeOverLevel.textContent = (levelIndex + 1);
    timeOverQuip.textContent = pick(FUNNY_TIME_OVER);
    $('timeOverTitle').textContent = pick(['⏱️ Time\'s Up!', '⌛ Too Slow!', '🕐 Ganesh Ji Woke Up!']);
    if (playerName && playerName.trim()) addToLeaderboard(playerName, score);
    renderLeaderboard('timeOverLeaderboard');
    timeOverOverlay.classList.remove('hidden');
    divineIndicator.style.display = 'none';
    topCornerMenu.classList.add('hidden');
    dpad.classList.remove('active');
    touchActions.classList.remove('active');
  }

  function gameOver() {
    if (!gameActive) return;
    gameActive = false;
    gamesPlayed++;
    localStorage.setItem('mushakPlays', String(gamesPlayed));
    shake(12);
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('mushakHighScore', highScore);
      highScoreDisplay.textContent = highScore;
    }
    finalScoreSpan.textContent = score;
    finalRoundSpan.textContent = (levelIndex+1);
    finalHighScoreSpan.textContent = highScore;
    gameOverEmoji.textContent = pick(['🙏','😅','🐘','✨','😬']);
    gameOverTitle.textContent = pick(['Ganesh Ji Noticed', 'Busted!', 'Caught!', 'Spotted!', 'Uh-oh!']);
    gameOverQuip.textContent = pick(FUNNY_GAMEOVER);
    const { idx, lesson } = pickUnshownLesson();
    lessonsShown.add(idx);
    saveTeachings();
    $('lessonTitle').textContent = `🕉️ ${lesson.title}`;
    $('lessonText').textContent = `"${lesson.text}"`;
    $('lessonSource').textContent = lesson.source;
    updateTeachingsHUD();
    if (playerName && playerName.trim()) addToLeaderboard(playerName, score);
    renderLeaderboard('leaderboardList');
    gameOverOverlay.classList.remove('hidden');
    divineIndicator.style.display = 'none';
    topCornerMenu.classList.add('hidden');
    dpad.classList.remove('active');
    touchActions.classList.remove('active');
  }

  // ═══════════════════════════════════════════════════════════
  //  DRAWING
  // ═══════════════════════════════════════════════════════════
  function drawBackground(t) {
    const theme = selectedTheme;
    const bgImg = activeThemeBg || loadedImages.bgLegacy;
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, W, H);
      ctx.fillStyle = theme.bgTint; ctx.fillRect(0, 0, W, H);
      if (theme.night) { ctx.fillStyle = 'rgba(20,20,60,0.45)'; ctx.fillRect(0, 0, W, H); }
    } else {
      const grad = ctx.createLinearGradient(0,0,W,H);
      grad.addColorStop(0, theme.sky[0]);
      grad.addColorStop(0.5, theme.sky[1]);
      grad.addColorStop(1, theme.sky[2]);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    }
    if (theme.night) {
      for (let i=0; i<50; i++) {
        const sx = (i*137)%W, sy = (i*89)%H;
        const twinkle = 0.5 + Math.sin(t*0.003 + i)*0.5;
        ctx.fillStyle = theme.starColor.replace('0.9', (0.3+twinkle*0.6).toFixed(2));
        ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI*2); ctx.fill();
      }
    }
    const diyas = [{x:80,y:455},{x:720,y:455},{x:400,y:20},{x:200,y:20},{x:600,y:470}];
    for (const d of diyas) {
      const flick = Math.sin(t*0.008 + d.x)*0.3 + 0.9;
      if (loadedImages.diya) {
        ctx.globalAlpha = flick;
        ctx.drawImage(loadedImages.diya, d.x-20, d.y-25, 40, 40);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#d97706';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, 15, 8, 0, 0, Math.PI*2); ctx.fill();
        const fg = ctx.createRadialGradient(d.x, d.y-14, 1, d.x, d.y-14, 14*flick);
        fg.addColorStop(0, 'rgba(255,220,100,1)');
        fg.addColorStop(1, 'rgba(251,146,60,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(d.x, d.y-14, 14*flick, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  function drawSafeZone(t) {
    const pulse = 0.5 + Math.sin(t*0.005)*0.15;
    ctx.save();
    ctx.shadowColor = '#fde047'; ctx.shadowBlur = 30*pulse + 15;
    const sg = ctx.createLinearGradient(safeZone.x, safeZone.y, safeZone.x, safeZone.y + safeZone.h);
    sg.addColorStop(0, 'rgba(187,247,208,'+pulse+')');
    sg.addColorStop(1, 'rgba(134,239,172,'+pulse+')');
    ctx.fillStyle = sg;
    ctx.beginPath(); roundRect(safeZone.x, safeZone.y, safeZone.w, safeZone.h, 20); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#15803d'; ctx.lineWidth = 4;
    ctx.beginPath(); roundRect(safeZone.x, safeZone.y, safeZone.w, safeZone.h, 20); ctx.stroke();
    ctx.setLineDash([6,4]); ctx.strokeStyle = '#166534'; ctx.lineWidth = 2;
    ctx.beginPath(); roundRect(safeZone.x+6, safeZone.y+6, safeZone.w-12, safeZone.h-12, 15); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 17px "Comic Sans MS", cursive';
    ctx.fillStyle = '#14532d'; ctx.textAlign = 'center';
    ctx.fillText('🏠 SAFE', safeZone.x + safeZone.w/2, safeZone.y + 35);
    ctx.font = '12px "Comic Sans MS", cursive';
    ctx.fillText('escape here!', safeZone.x + safeZone.w/2, safeZone.y + 58);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawDivineBarriers(t) {
    for (const b of divineBarriers) {
      const pulse = 0.5 + Math.sin(t*0.008 + b.pulse)*0.5;
      ctx.save();
      ctx.globalAlpha = 0.5 + pulse*0.3;
      const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
      grad.addColorStop(0, 'rgba(255,213,107,0.7)');
      grad.addColorStop(0.5, 'rgba(230,177,67,0.5)');
      grad.addColorStop(1, 'rgba(255,213,107,0.7)');
      ctx.fillStyle = grad;
      ctx.shadowColor = '#ffd56b'; ctx.shadowBlur = 20;
      ctx.beginPath(); roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill();
      ctx.strokeStyle = '#e6b143'; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🕉️', b.x + b.w/2, b.y + b.h/2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }

  function drawBlessingFlowers(t) {
    for (const f of blessingFlowers) {
      if (f.collected) continue;
      const bob = Math.sin(t*0.006 + f.bob)*4;
      const glow = 0.6 + Math.sin(t*0.01)*0.4;
      ctx.save();
      ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 25*glow;
      ctx.font = '36px sans-serif';
      ctx.fillText('🌸', f.x-18, f.y+12+bob);
      ctx.restore();
      for (let i = 0; i < 2; i++) {
        const a = t*0.004 + i*3.14 + f.bob;
        const sx = f.x + Math.cos(a)*26;
        const sy = f.y + Math.sin(a)*26 + bob;
        ctx.font = '14px sans-serif';
        ctx.fillText('✨', sx-7, sy);
      }
    }
  }

  function drawObstacles(t) {
    for (const o of obstacles) {
      const wob = Math.sin(t*0.003 + o.wobble)*2;
      ctx.save();
      ctx.translate(o.x + o.w/2, o.y + o.h/2 + wob);
      if (loadedImages.obstacle) {
        ctx.drawImage(loadedImages.obstacle, -o.w/2, -o.h/2, o.w, o.h);
      } else {
        const og = ctx.createLinearGradient(0,-o.h/2,0,o.h/2);
        og.addColorStop(0, '#ff9933'); og.addColorStop(1, '#b45309');
        ctx.fillStyle = og; ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2;
        ctx.beginPath(); roundRect(-o.w/2, -o.h/2, o.w, o.h, 10); ctx.fill(); ctx.stroke();
        ctx.font = Math.min(o.w,o.h)*0.7 + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🏺', 0, 2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();
    }
  }

  function drawModaks(t) {
    for (const m of modaks) {
      if (m.collected) continue;
      const bob = Math.sin(t*0.005 + m.bob)*3;
      const reachable = isModakReachable(m);
      if (!reachable) {
        ctx.save();
        ctx.strokeStyle = 'rgba(220,38,38,' + (0.4 + Math.sin(t*0.01)*0.3) + ')';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(m.x, m.y, 26, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (loadedImages.modak) {
        ctx.save();
        ctx.shadowColor = '#f97316'; ctx.shadowBlur = 14;
        ctx.globalAlpha = reachable ? 1 : 0.55;
        ctx.drawImage(loadedImages.modak, m.x-18, m.y-18+bob, 36, 36);
        ctx.restore();
      } else {
        ctx.save();
        ctx.shadowColor = '#f97316'; ctx.shadowBlur = 14;
        ctx.globalAlpha = reachable ? 1 : 0.55;
        ctx.font = '34px sans-serif';
        ctx.fillText('🥟', m.x-18, m.y+12+bob);
        ctx.restore();
      }
    }
    if (goldenModak && !goldenModak.collected) {
      const bob = Math.sin(t*0.006)*4;
      const glow = 0.6 + Math.sin(t*0.01)*0.4;
      if (loadedImages.goldenModak) {
        ctx.save(); ctx.shadowColor = '#ffd56b'; ctx.shadowBlur = 30*glow;
        ctx.drawImage(loadedImages.goldenModak, goldenModak.x-22, goldenModak.y-22+bob, 44, 44);
        ctx.restore();
      } else {
        ctx.save(); ctx.shadowColor = '#ffd56b'; ctx.shadowBlur = 30*glow;
        ctx.font = '46px sans-serif';
        ctx.fillText('🥟', goldenModak.x-23, goldenModak.y+15+bob);
        ctx.restore();
      }
    }
    for (const p of powerUps) {
      if (p.collected) continue;
      const bob = Math.sin(t*0.005 + p.bob)*4;
      ctx.save(); ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 20;
      ctx.font = '30px sans-serif';
      ctx.fillText(p.type === 'speed' ? '☕' : p.type === 'shield' ? '🛡️' : '❄️',
                   p.x-15, p.y+10+bob);
      ctx.restore();
    }
  }

  function drawGanesh(t) {
    const lvIdx = Math.min(levelIndex, DIVINE_POWERS.length-1);
    const divine = DIVINE_POWERS[lvIdx];
    if (ganesh.divineFlashTimer > 0) {
      const p = ganesh.divineFlashTimer / 60;
      const rg = ctx.createRadialGradient(ganesh.x, ganesh.y, 10, ganesh.x, ganesh.y, 200);
      rg.addColorStop(0, `rgba(255,213,107,${p*0.9})`);
      rg.addColorStop(1, 'rgba(255,213,107,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(ganesh.x, ganesh.y, 200, 0, Math.PI*2); ctx.fill();
    }
    const rg = ctx.createRadialGradient(ganesh.x, ganesh.y, 10, ganesh.x, ganesh.y, 130);
    rg.addColorStop(0, 'rgba(255,220,140,0.6)');
    rg.addColorStop(0.5, 'rgba(255,213,107,0.25)');
    rg.addColorStop(1, 'rgba(255,213,107,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(ganesh.x, ganesh.y, 130, 0, Math.PI*2); ctx.fill();
    const auraPulse = 0.7 + Math.sin(t*0.004)*0.3;
    ctx.save();
    ctx.strokeStyle = `rgba(255,213,107,${auraPulse*0.5})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 0.05;
    ctx.beginPath(); ctx.arc(ganesh.x, ganesh.y, 105, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (ganesh.turnFlash > 0) {
      ctx.save();
      ctx.globalAlpha = ganesh.turnFlash/20;
      ctx.fillStyle = 'rgba(255,213,107,0.6)';
      ctx.beginPath(); ctx.arc(ganesh.x, ganesh.y, 90 + (15-ganesh.turnFlash)*3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    const gazeImage = ganesh.eyeOpen > 0.5 ? loadedImages.ganeshOpen : loadedImages.ganeshClosed;
    if (gazeImage) {
      const size = 180;
      ctx.save();
      ctx.translate(ganesh.x, ganesh.y);
      if (ganesh.isLooking) ctx.rotate(Math.sin(t*0.01)*0.03);
      ctx.drawImage(gazeImage, -size/2, -size/2, size, size);
      ctx.restore();
    } else {
      ctx.font = '96px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐘', ganesh.x, ganesh.y+32);
      ctx.textAlign = 'left';
      if (ganesh.eyeOpen > 0.5) {
        ctx.font = '34px sans-serif';
        ctx.fillText('👀', ganesh.x-22, ganesh.y - 28);
      } else {
        ctx.font = '34px sans-serif';
        ctx.fillText('😌', ganesh.x-18, ganesh.y - 28);
      }
    }
    const haloSpin = t * 0.008;
    ctx.save();
    ctx.translate(ganesh.x + 60, ganesh.y - 55);
    ctx.rotate(haloSpin);
    ctx.strokeStyle = `rgba(255,213,107,${0.5 + Math.sin(t*0.01)*0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = '28px sans-serif';
    ctx.shadowColor = '#ffd56b'; ctx.shadowBlur = 12;
    ctx.fillText(divine.icon, ganesh.x + 60, ganesh.y - 55);
    ctx.restore();
    ctx.font = 'bold 15px "Comic Sans MS", cursive';
    ctx.fillStyle = selectedTheme.night ? '#ffe4b5' : '#6b4a08';
    ctx.textAlign = 'center';
    ctx.fillText('Ganesh Ji', ganesh.x, ganesh.y + 82);
    ctx.textAlign = 'left';
  }

  function drawMushak(t) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(mushak.x, mushak.y+20, 18, 6, 0, 0, Math.PI*2); ctx.fill();
    if (shieldActive) {
      const p = 0.6 + Math.sin(t*0.01)*0.3;
      ctx.save();
      ctx.strokeStyle = 'rgba(167,139,250,'+p+')';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(mushak.x, mushak.y, 28, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    if (buddhiSlowTimer > 0) {
      ctx.save(); ctx.globalAlpha = 0.5;
      ctx.font = '18px sans-serif';
      ctx.fillText('💡', mushak.x - 30, mushak.y - 30);
      ctx.restore();
    }
    if (shadowActive) {
      ctx.globalAlpha = 0.4;
      ctx.font = '40px sans-serif';
      ctx.fillText('💨', mushak.x - 15, mushak.y + 12);
      ctx.globalAlpha = 1;
    }
    if (midasActive) {
      ctx.save();
      ctx.shadowColor = '#ffd56b'; ctx.shadowBlur = 20;
      ctx.strokeStyle = '#ffd56b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mushak.x, mushak.y, 30, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    if (speedBoostTimer > 0) {
      for (let i=1; i<=3; i++) {
        ctx.globalAlpha = 0.25/i;
        const trailImg = activeMushakImg || loadedImages.mushakLegacy;
        if (trailImg) {
          ctx.drawImage(trailImg, mushak.x - 20 - i*10, mushak.y - 20, 40, 40);
        } else {
          ctx.font = '38px sans-serif';
          ctx.fillText(selectedChar.avatar, mushak.x - i*10, mushak.y + 12);
        }
      }
      ctx.globalAlpha = 1;
    }
    let mushakImg = activeMushakImg || loadedImages.mushakLegacy;
    if (prayCooldown > 0 && activeMushakPrayImg) mushakImg = activeMushakPrayImg;
    if (!gameActive && activeMushakCaughtImg) mushakImg = activeMushakCaughtImg;
    if (shadowActive) ctx.globalAlpha = 0.35;
    const bounce = Math.abs(Math.sin(t*0.015))*2;
    if (mushakImg) {
      ctx.save();
      ctx.shadowColor = '#1a0e2e'; ctx.shadowBlur = 10;
      ctx.drawImage(mushakImg, mushak.x-25, mushak.y-25-bounce, 50, 50);
      ctx.restore();
    } else {
      ctx.font = '40px sans-serif';
      ctx.fillText(selectedChar.avatar, mushak.x-20, mushak.y+12-bounce);
    }
    if (shadowActive) ctx.globalAlpha = 1;
    if (emote.timer > 0) {
      const bub = Math.min(1, (120 - emote.timer)/15) * Math.min(1, emote.timer/20);
      ctx.save();
      ctx.globalAlpha = bub;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#b45309'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mushak.x+34, mushak.y-38, 20, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(emote.text, mushak.x+34, mushak.y-31);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life/p.maxLife);
      ctx.fillStyle = p.color;
      if (p.kind === 'star') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath();
        for (let i=0;i<5;i++) {
          const a = i*Math.PI*2/5 - Math.PI/2;
          const a2 = a + Math.PI/5;
          ctx.lineTo(Math.cos(a)*p.size, Math.sin(a)*p.size);
          ctx.lineTo(Math.cos(a2)*p.size*0.4, Math.sin(a2)*p.size*0.4);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPopups() {
    for (const p of popups) {
      const age = p.maxLife - p.life;
      let a;
      if (age < 15) a = age / 15;
      else if (p.life < 30) a = p.life / 30;
      else a = 1;
      ctx.globalAlpha = Math.min(1, a);
      ctx.font = 'bold ' + p.size + 'px "Comic Sans MS", cursive';
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = p.color; ctx.lineWidth = 4;
      const w = ctx.measureText(p.text).width;
      ctx.strokeText(p.text, p.x - w/2, p.y);
      ctx.fillText(p.text, p.x - w/2, p.y);
      ctx.globalAlpha = 1;
    }
  }

  function drawRipples() {
    for (const r of ripples) {
      ctx.globalAlpha = (r.life/40)*0.7;
      ctx.strokeStyle = r.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawHUDOverlay(t) {
    const collected = modaks.filter(m=>m.collected).length;
    const total = modaks.length;
    const barW = 220, barH = 12;
    const barX = W/2 - barW/2, barY = 18;
    ctx.fillStyle = 'rgba(26,14,46,0.7)';
    ctx.beginPath(); roundRect(barX, barY, barW, barH, 6); ctx.fill();
    ctx.fillStyle = '#ffd56b';
    const pct = total > 0 ? collected/total : 0;
    ctx.beginPath(); roundRect(barX, barY, barW*pct, barH, 6); ctx.fill();
    ctx.font = 'bold 13px "Comic Sans MS", cursive';
    ctx.fillStyle = selectedTheme.night ? '#ffe4b5' : '#6b4a08';
    ctx.textAlign = 'center';
    ctx.fillText(`🥟 ${collected}/${total} modaks`, W/2, barY+27);
    ctx.textAlign = 'left';
    const allCollected = modaks.length > 0 &&
                        modaks.every(m => m.collected) &&
                        (goldenModak ? goldenModak.collected : true) &&
                        blessingFlowers.every(f => f.collected);
    if (allCollected && gameActive) {
      const glow = 0.6 + Math.sin(t*0.01)*0.4;
      ctx.save();
      ctx.shadowColor = '#10b981'; ctx.shadowBlur = 20*glow;
      ctx.font = 'bold 26px "Comic Sans MS", cursive';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 5;
      ctx.textAlign = 'center';
      ctx.strokeText('🏃 ALL COLLECTED! RUN TO SAFE ZONE!', W/2, H-30);
      ctx.fillText('🏃 ALL COLLECTED! RUN TO SAFE ZONE!', W/2, H-30);
      ctx.textAlign = 'left';
      ctx.restore();
    }
    if (slowMo > 0) {
      const a = Math.min(0.5, slowMo/40);
      ctx.strokeStyle = `rgba(255,213,107,${a*0.8})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, W-8, H-8);
    }
    if (newBatchNotice > 0) {
      ctx.globalAlpha = Math.min(1, newBatchNotice/30);
      ctx.font = 'bold 26px "Comic Sans MS", cursive';
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffd56b'; ctx.lineWidth = 5;
      ctx.textAlign = 'center';
      ctx.strokeText('🙏 Collect all first!', W/2, H/2);
      ctx.fillText('🙏 Collect all first!', W/2, H/2);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  function drawCombo(t) {
    if (comboCount > 1 && comboTimer > 0) {
      const pulse = 1 + Math.sin(t*0.02)*0.08;
      ctx.save();
      ctx.translate(W-130, H-45); ctx.scale(pulse, pulse);
      ctx.font = 'bold 26px "Comic Sans MS", cursive';
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 5;
      ctx.strokeText('🔥 COMBO x' + comboCount, -90, 0);
      ctx.fillText('🔥 COMBO x' + comboCount, -90, 0);
      ctx.restore();
    }
  }

  function drawVignette() {
    if (suspicion > 50) {
      const a = Math.min(0.35, (suspicion-50)/150);
      const vg = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.8);
      vg.addColorStop(0, 'rgba(255,213,107,0)');
      vg.addColorStop(1, 'rgba(255,213,107,'+a+')');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
  }

  function roundRect(x,y,w,h,r) {
    if (w < 2*r) r = w/2;
    if (h < 2*r) r = h/2;
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  // ═══════════════════════════════════════════════════════════
  //  MAIN LOOP
  // ═══════════════════════════════════════════════════════════
  let lastT = performance.now();
  function loop(t) {
    const dt = Math.min(3, (t - lastT)/16.67);
    lastT = t;
    if (gameActive && !paused) {
      updateGanesh(dt);
      updateMushak(dt);
      if (gameActive) { collectModaks(); checkSafeZone(); }
      updateUI();
      if (gameActive) {
        const elapsed = (performance.now() - levelStartTime) / 1000;
        if (elapsed >= LEVELS[levelIndex].timeLimit) { timeOver(); return; }
      }
      if (emote.timer > 0) emote.timer -= dt;
      for (let i=particles.length-1; i>=0; i--) {
        const p = particles[i];
        p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 0.12*dt;
        p.rot += p.vr*dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i,1);
      }
      for (let i=popups.length-1; i>=0; i--) {
        const p = popups[i];
        p.y += p.vy*dt; p.vy *= 0.99; p.life -= dt;
        if (p.life <= 0) popups.splice(i,1);
      }
      for (let i=ripples.length-1; i>=0; i--) {
        const r = ripples[i];
        r.r += (r.max - r.r)*0.12*dt; r.life -= dt;
        if (r.life <= 0) ripples.splice(i,1);
      }
    }
    if (screenShake > 0) screenShake *= 0.88;
    ctx.save();
    if (screenShake > 0.4) ctx.translate(rand(-screenShake, screenShake), rand(-screenShake, screenShake));
    drawBackground(t);
    drawSafeZone(t);
    drawDivineBarriers(t);
    drawObstacles(t);
    drawBlessingFlowers(t);
    drawModaks(t);
    drawGanesh(t);
    drawMushak(t);
    drawRipples();
    drawParticles();
    drawPopups();
    drawVignette();
    drawHUDOverlay(t);
    if (gameActive && !paused) drawCombo(t);
    ctx.restore();
    requestAnimationFrame(loop);
  }

  // ═══════════════════════════════════════════════════════════
  //  INPUT
  // ═══════════════════════════════════════════════════════════
  function keyToAction(k) {
    if (k === 'ArrowUp' || k === 'w' || k === 'W') return 'up';
    if (k === 'ArrowDown' || k === 's' || k === 'S') return 'down';
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') return 'left';
    if (k === 'ArrowRight' || k === 'd' || k === 'D') return 'right';
    if (k === ' ' || k === 'Space' || k === 'Spacebar') return 'space';
    if (k === 'Shift') return 'shift';
    return null;
  }
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const a = keyToAction(e.key);
    if (a) {
      e.preventDefault();
      if (a === 'space') { if (!keys.space) prayAction(); keys.space = true; }
      else if (a === 'shift') { if (!keys.shift) activatePower(); keys.shift = true; }
      else keys[a] = true;
    }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && gameActive) togglePause();
  }, { passive: false });
  window.addEventListener('keyup', (e) => {
    const a = keyToAction(e.key);
    if (a) { e.preventDefault(); if (a === 'space') keys.space = false; else if (a === 'shift') keys.shift = false; else keys[a] = false; }
  }, { passive: false });

  function togglePause() {
    if (!gameActive) return;
    paused = !paused;
    if (paused) {
      pauseOverlay.classList.remove('hidden');
      pauseBgMusic();
      dpad.classList.remove('active');
      touchActions.classList.remove('active');
    } else {
      pauseOverlay.classList.add('hidden');
      resumeBgMusic();
      if (useTouchControls) { dpad.classList.add('active'); touchActions.classList.add('active'); }
    }
    updateUI();
  }

  function setupDpad() {
    const btns = dpad.querySelectorAll('.dpad-btn');
    btns.forEach(btn => {
      const dir = btn.dataset.dir;
      const press = (e) => {
        e.preventDefault(); e.stopPropagation();
        initAudio();
        keys[dir] = true;
        btn.classList.add('pressed');
        vibrate(10);
      };
      const release = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        keys[dir] = false;
        btn.classList.remove('pressed');
      };
      btn.addEventListener('pointerdown', press, { passive: false });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release);
      btn.addEventListener('touchcancel', release);
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
    window.addEventListener('pointerup', () => {
      btns.forEach(b => {
        const dir = b.dataset.dir;
        if (keys[dir]) { keys[dir] = false; b.classList.remove('pressed'); }
      });
    });
  }
  setupDpad();

  function bindTouchAction(btn, action) {
    const handler = (e) => {
      e.preventDefault(); e.stopPropagation();
      initAudio();
      action();
      vibrate(20);
    };
    btn.addEventListener('click', handler);
    btn.addEventListener('touchend', handler);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  }
  bindTouchAction(taPray, () => prayAction());
  bindTouchAction(taPower, () => activatePower());

  // ═══════════════════════════════════════════════════════════
  //  SCREEN FLOW
  // ═══════════════════════════════════════════════════════════
  function hideAllOverlays() {
    [homeOverlay, howToOverlay, profileOverlay, leaderboardOverlay, settingsOverlay,
     charOverlay, themeOverlay, startOverlay, nameOverlay, pauseOverlay,
     levelCompleteOverlay, timeOverOverlay, gameOverOverlay, victoryOverlay,
     introOverlay, storyOverlay].forEach(o => { if (o) o.classList.add('hidden'); });
  }
  function showHomeScreen() {
    hideAllOverlays();
    homeOverlay.classList.remove('hidden');
    appShell.classList.add('hidden');
    topCornerMenu.classList.add('hidden');
    divineIndicator.style.display = 'none';
    dpad.classList.remove('active');
    touchActions.classList.remove('active');
    gameActive = false; paused = false;
  }
  function showCharScreen() {
    hideAllOverlays();
    charOverlay.classList.remove('hidden');
    appShell.classList.add('hidden');
    topCornerMenu.classList.add('hidden');
    dpad.classList.remove('active');
    touchActions.classList.remove('active');
    gameActive = false; paused = false;
  }
  function showThemeScreen() {
    hideAllOverlays();
    themeOverlay.classList.remove('hidden');
  }
  function showTutorialScreen() {
    hideAllOverlays();
    startOverlay.classList.remove('hidden');
  }
  function showNameScreen() {
    hideAllOverlays();
    nameOverlay.classList.remove('hidden');
    startNameInput.value = playerName || '';
    setTimeout(() => { try { startNameInput.focus(); } catch(e){} }, 200);
  }

  // ═══════════════════════════════════════════════════════════
  //  PREVIEW UPDATES
  // ═══════════════════════════════════════════════════════════
  function updateCharPreview() {
    const c = selectedChar;
    const img = loadedImages[c.imgKey] || loadedImages.mushakLegacy;
    if (img) {
      charPreviewImg.src = img.src;
      charPreviewImg.style.display = 'block';
      charPreviewAvatar.style.display = 'none';
    } else {
      charPreviewImg.style.display = 'none';
      charPreviewAvatar.style.display = 'flex';
      charPreviewAvatar.textContent = c.avatar;
    }
    charPreviewName.textContent = c.name;
    charPreviewDesc.textContent = `${c.powerIcon} ${c.powerName} — ${c.powerDesc}`;
    const speedStars = '★'.repeat(c.stats.speed) + '☆'.repeat(5 - c.stats.speed);
    const cautionStars = '★'.repeat(c.stats.caution) + '☆'.repeat(5 - c.stats.caution);
    charPreviewStats.innerHTML = `⚡ Speed: ${speedStars}<br>👁️ Caution: ${cautionStars}`;
    charPreviewFlavor.textContent = c.flavor;
  }

  function updateThemePreview() {
    const th = selectedTheme;
    const img = loadedImages[th.bgKey] || loadedImages.bgLegacy;
    if (img) {
      themePreviewImg.src = img.src;
      themePreviewImg.style.display = 'block';
      themePreviewIcon.style.display = 'none';
    } else {
      themePreviewImg.style.display = 'none';
      themePreviewIcon.style.display = 'flex';
      themePreviewIcon.textContent = th.icon;
    }
    themePreviewName.textContent = th.name;
    themePreviewDesc.textContent = th.desc;
    themePreviewEffect.innerHTML = th.effect.replace(/ · /g, '<br>');
  }

  function updateProfileStats() {
    profileHighScore.textContent = highScore;
    profilePlays.textContent = gamesPlayed;
    profileTeachings.textContent = lessonsShown.size + '/12';
    profileStars.textContent = totalStars;
    profileNameInput.value = playerName || '';
  }

  // ═══════════════════════════════════════════════════════════
  //  BUILD UI
  // ═══════════════════════════════════════════════════════════
  const charGrid = $('charGrid');
  CHARACTERS.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'char-card' + (i === 0 ? ' selected' : '');
    el.dataset.charId = c.id;
    el.innerHTML = `
      <span class="char-avatar">${c.avatar}</span>
      <div class="char-name">${c.name.replace(' Mushak', '')}</div>
      <div class="char-power">${c.powerName}</div>
    `;
    el.addEventListener('click', () => {
      selectedChar = c;
      document.querySelectorAll('.char-card').forEach(card => card.classList.toggle('selected', card.dataset.charId === c.id));
      updateCharPreview();
      sfxClick();
    });
    charGrid.appendChild(el);
  });
  updateCharPreview();

  const themeGrid = $('themeGrid');
  THEMES.forEach((th, i) => {
    const el = document.createElement('div');
    el.className = 'theme-card' + (i === 0 ? ' selected' : '');
    el.dataset.themeId = th.id;
    el.innerHTML = `
      <span class="theme-icon">${th.icon}</span>
      <div class="theme-name">${th.name}</div>
      <div class="theme-desc">${th.desc}</div>
    `;
    el.addEventListener('click', () => {
      selectedTheme = th;
      document.querySelectorAll('.theme-card').forEach(card => card.classList.toggle('selected', card.dataset.themeId === th.id));
      updateThemePreview();
      sfxClick();
    });
    themeGrid.appendChild(el);
  });
  updateThemePreview();

  let currentSlide = 0;
  const slides = document.querySelectorAll('.tutorial-slide');
  const dots = document.querySelectorAll('.slide-dot');
  const tutSlidePrevBtn = $('tutSlidePrevBtn');
  const tutSlideNextBtn = $('tutSlideNextBtn');
  const startBtn = $('startBtn');

  function showSlide(n) {
    slides.forEach((s, i) => s.classList.toggle('active', i === n));
    dots.forEach((d, i) => d.classList.toggle('active', i === n));
    currentSlide = n;
    tutSlidePrevBtn.style.display = n === 0 ? 'none' : 'inline-block';
    if (n === slides.length - 1) {
      tutSlideNextBtn.style.display = 'none';
      startBtn.style.display = 'inline-block';
    } else {
      tutSlideNextBtn.style.display = 'inline-block';
      startBtn.style.display = 'none';
    }
  }
  dots.forEach(d => d.addEventListener('click', () => { sfxClick(); showSlide(+d.dataset.dot); }));
  tutSlideNextBtn.addEventListener('click', () => { sfxClick(); showSlide(Math.min(currentSlide + 1, slides.length - 1)); });
  tutSlidePrevBtn.addEventListener('click', () => { sfxClick(); showSlide(Math.max(currentSlide - 1, 0)); });

  // ═══════════════════════════════════════════════════════════
  //  HOME BUTTONS
  // ═══════════════════════════════════════════════════════════
  $('homePlayBtn').addEventListener('click', () => {
    try { initAudio(); } catch(e){}
    try { requestFullscreen(); } catch(e){}
    sfxClick();
    showCharScreen();
  });
  $('homeHowToBtn').addEventListener('click', () => {
    sfxClick();
    hideAllOverlays();
    howToOverlay.classList.remove('hidden');
  });
  $('homeProfileBtn').addEventListener('click', () => {
    sfxClick();
    hideAllOverlays();
    updateProfileStats();
    profileOverlay.classList.remove('hidden');
  });
  $('homeLeaderboardBtn').addEventListener('click', () => {
    sfxClick();
    hideAllOverlays();
    renderLeaderboard('homeLeaderboardList');
    leaderboardOverlay.classList.remove('hidden');
  });
  $('homeSettingsBtn').addEventListener('click', () => {
    sfxClick();
    hideAllOverlays();
    settingsOverlay.classList.remove('hidden');
    toggleSfx.classList.toggle('on', settings.sfx);
    toggleMusic.classList.toggle('on', settings.music);
    toggleVibrate.classList.toggle('on', settings.vibrate);
    volumeSlider.value = settings.volume;
    volumeValue.textContent = settings.volume + '%';
  });
  $('homeExitBtn').addEventListener('click', () => {
    sfxClick();
    if (!confirm('Exit Mushak? The game will close.')) return;
    try {
      window.close();
      setTimeout(() => {
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:1.5rem;color:#ffd56b;background:#1a0e2e;text-align:center;padding:20px;">🕉️ Thank you for playing Mushak!<br>You can close this tab now.</div>';
      }, 200);
    } catch(e) {}
  });

  $('closeHowToBtn').addEventListener('click', () => {
    sfxClick();
    hideAllOverlays();
    if (gameActive && paused) pauseOverlay.classList.remove('hidden');
    else showHomeScreen();
  });

  $('saveProfileBtn').addEventListener('click', () => {
    const name = profileNameInput.value.trim();
    if (!name) {
      profileNameInput.focus();
      profileNameInput.style.borderColor = '#dc2626';
      setTimeout(() => { profileNameInput.style.borderColor = ''; }, 800);
      return;
    }
    playerName = name.slice(0, 16);
    localStorage.setItem('mushakPlayerName', playerName);
    sfxGolden();
    vibrate(40);
    const btn = $('saveProfileBtn');
    btn.textContent = '✓ Saved!';
    setTimeout(() => { btn.textContent = '💾 Save'; }, 1500);
  });
  $('closeProfileBtn').addEventListener('click', () => { sfxClick(); showHomeScreen(); });
  $('closeLeaderboardBtn').addEventListener('click', () => { sfxClick(); showHomeScreen(); });

  $('closeSettingsBtn').addEventListener('click', () => {
    sfxClick();
    hideAllOverlays();
    if (gameActive && paused) pauseOverlay.classList.remove('hidden');
    else showHomeScreen();
  });
  toggleSfx.addEventListener('click', () => {
    const v = !settings.sfx;
    saveSetting('sfx', v);
    toggleSfx.classList.toggle('on', v);
    sfxClick();
  });
  toggleMusic.addEventListener('click', () => {
    const v = !settings.music;
    saveSetting('music', v);
    toggleMusic.classList.toggle('on', v);
    if (v) resumeBgMusic(); else pauseBgMusic();
    sfxClick();
  });
  toggleVibrate.addEventListener('click', () => {
    const v = !settings.vibrate;
    saveSetting('vibrate', v);
    toggleVibrate.classList.toggle('on', v);
    vibrate(30);
    sfxClick();
  });
  volumeSlider.addEventListener('input', () => {
    const v = parseInt(volumeSlider.value, 10);
    saveSetting('volume', v);
    volumeValue.textContent = v + '%';
    if (bgMusic) bgMusic.volume = masterVolume(0.28);
    if (introMusic) introMusic.volume = masterVolume(0.55);
  });

  $('resetLeaderboardBtn').addEventListener('click', () => {
    if (!confirm('Reset the leaderboard? This cannot be undone.')) return;
    leaderboard = [];
    saveLeaderboard();
    renderLeaderboard('leaderboardList');
    renderLeaderboard('victoryLeaderboardList');
    renderLeaderboard('timeOverLeaderboard');
    renderLeaderboard('homeLeaderboardList');
    sfxClick();
    vibrate(40);
  });

  $('resetAllBtn').addEventListener('click', () => {
    if (!confirm('Reset ALL data? Everything will be erased.')) return;
    ['mushakLeaderboard','mushakHighScore','mushakTeachings','mushakPlayerName',
     'mushakLBVersion','mushakStars','mushakPlays'].forEach(k => localStorage.removeItem(k));
    leaderboard = [];
    lessonsShown = new Set();
    playerName = '';
    highScore = 0;
    totalStars = 0;
    gamesPlayed = 0;
    highScoreDisplay.textContent = '0';
    updateTeachingsHUD();
    sfxClick();
    vibrate(40);
    setTimeout(() => location.reload(), 500);
  });

  // ═══════════════════════════════════════════════════════════
  //  GAME FLOW BUTTONS
  // ═══════════════════════════════════════════════════════════
  $('charBackBtn').addEventListener('click', () => { sfxClick(); showHomeScreen(); });
  $('charNextBtn').addEventListener('click', () => { sfxClick(); showThemeScreen(); });
  $('themeBackBtn').addEventListener('click', () => { sfxClick(); showCharScreen(); });
  $('themeNextBtn').addEventListener('click', () => { sfxClick(); showTutorialScreen(); showSlide(0); });
  $('tutBackBtn').addEventListener('click', () => { sfxClick(); showThemeScreen(); });
  startBtn.addEventListener('click', () => { sfxClick(); showNameScreen(); });
  $('nameBackBtn').addEventListener('click', () => {
    sfxClick();
    showTutorialScreen();
    showSlide(slides.length - 1);
  });

  function beginGame() {
    const name = startNameInput.value.trim();
    if (!name) {
      try { startNameInput.focus(); } catch(e){}
      startNameInput.style.borderColor = '#dc2626';
      setTimeout(() => { startNameInput.style.borderColor = ''; }, 800);
      return;
    }
    playerName = name.slice(0, 16);
    localStorage.setItem('mushakPlayerName', playerName);

    try { initAudio(); } catch(e){}
    sfxStart();
    hideAllOverlays();
    appShell.classList.remove('hidden');
    topCornerMenu.classList.remove('hidden');
    gameActive = false; paused = false;
    totalPrayersUsed = 0; totalModaksCollected = 0; totalTimeSpent = 0;
    resetGame(0);
    startBgMusic();
    playCinematic(LEVELS[0].icon, 'LEVEL 1', LEVELS[0].name, 1800);
    setTimeout(() => {
      gameActive = true; paused = false;
      if (useTouchControls) { dpad.classList.add('active'); touchActions.classList.add('active'); }
    }, 1800);
    for (const k in keys) keys[k] = false;
  }

  $('nameStartBtn').addEventListener('click', beginGame);
  startNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') beginGame(); });

  $('pauseBtn').addEventListener('click', () => { sfxClick(); togglePause(); });
  $('quickHomeBtn').addEventListener('click', () => {
    sfxClick();
    if (!gameActive) return;
    if (!confirm('Exit to Home? Current game progress will be lost.')) return;
    paused = false;
    gameActive = false;
    pauseBgMusic();
    showHomeScreen();
  });

  $('resumeBtn').addEventListener('click', () => {
    sfxClick();
    paused = false; pauseOverlay.classList.add('hidden');
    resumeBgMusic();
    if (useTouchControls) { dpad.classList.add('active'); touchActions.classList.add('active'); }
    updateUI();
  });
  $('restartFromPauseBtn').addEventListener('click', () => {
    sfxClick();
    paused = false; pauseOverlay.classList.add('hidden');
    gameActive = true;
    totalPrayersUsed = 0; totalModaksCollected = 0; totalTimeSpent = 0;
    resetGame(0);
    if (useTouchControls) { dpad.classList.add('active'); touchActions.classList.add('active'); }
    for (const k in keys) keys[k] = false;
  });
  $('pauseHowToBtn').addEventListener('click', () => {
    sfxClick();
    pauseOverlay.classList.add('hidden');
    howToOverlay.classList.remove('hidden');
  });
  $('exitToHomeBtn').addEventListener('click', () => {
    sfxClick();
    if (!confirm('Exit to Home? Current game progress will be lost.')) return;
    paused = false;
    gameActive = false;
    pauseBgMusic();
    showHomeScreen();
  });

  $('nextLevelBtn').addEventListener('click', () => { sfxClick(); nextLevel(); });

  $('timeOverRetryBtn').addEventListener('click', () => {
    sfxClick();
    timeOverOverlay.classList.add('hidden');
    appShell.classList.remove('hidden');
    topCornerMenu.classList.remove('hidden');
    gameActive = true; paused = false;
    totalPrayersUsed = 0; totalModaksCollected = 0; totalTimeSpent = 0;
    resetGame(0);
    if (useTouchControls) { dpad.classList.add('active'); touchActions.classList.add('active'); }
    for (const k in keys) keys[k] = false;
  });
  $('timeOverMenuBtn').addEventListener('click', () => { sfxClick(); showHomeScreen(); });

  $('tryAgainBtn').addEventListener('click', () => {
    sfxClick();
    gameOverOverlay.classList.add('hidden');
    appShell.classList.remove('hidden');
    topCornerMenu.classList.remove('hidden');
    gameActive = true; paused = false;
    totalPrayersUsed = 0; totalModaksCollected = 0; totalTimeSpent = 0;
    resetGame(0);
    if (useTouchControls) { dpad.classList.add('active'); touchActions.classList.add('active'); }
    for (const k in keys) keys[k] = false;
  });
  $('gameOverMenuBtn').addEventListener('click', () => { sfxClick(); showHomeScreen(); });

  $('victoryAgainBtn').addEventListener('click', () => {
    sfxClick();
    victoryOverlay.classList.add('hidden');
    appShell.classList.remove('hidden');
    topCornerMenu.classList.remove('hidden');
    gameActive = true; paused = false;
    totalPrayersUsed = 0; totalModaksCollected = 0; totalTimeSpent = 0;
    resetGame(0);
    if (useTouchControls) { dpad.classList.add('active'); touchActions.classList.add('active'); }
    for (const k in keys) keys[k] = false;
  });
  $('victoryMenuBtn').addEventListener('click', () => { sfxClick(); showHomeScreen(); });

  lpPray.addEventListener('click', () => { initAudio(); sfxClick(); prayAction(); });
  lpPower.addEventListener('click', () => { initAudio(); sfxClick(); activatePower(); });

  // ═══════════════════════════════════════════════════════════
  //  ORIENTATION & TOUCH
  // ═══════════════════════════════════════════════════════════
  const orientationHint=$('orientationHint');
  function checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    const shouldHint = isTouchDevice && isMobileUA && isPortrait && window.innerWidth < 500 && gameActive;
    orientationHint.classList.toggle('active', shouldHint);
  }
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 200));

  document.addEventListener('touchmove', (e) => {
    if (e.target.closest('.overlay-card')) return;
    if (e.target.closest('.leaderboard-list')) return;
    if (e.target.closest('.side-panel')) return;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('dblclick', (e) => {
    if (e.target.closest('.btn, .dpad-btn, .touch-action-btn, .power-item, .char-card, .theme-card, .icon-btn, .toggle-switch, .menu-btn')) {
      e.preventDefault();
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  TITLE INTRO — with intro music handling
  // ═══════════════════════════════════════════════════════════
  let introFinished = false;
  let introTimer = null;

  function finishIntro() {
    if (introFinished) return;
    introFinished = true;
    clearTimeout(introTimer);
    stopIntroMusic();
    introOverlay.style.transition = 'opacity 0.6s ease';
    introOverlay.style.opacity = '0';
    setTimeout(() => {
      introOverlay.classList.add('hidden');
      introOverlay.style.opacity = '1';
      startStory();
    }, 620);
    window.removeEventListener('keydown', skipIntroHandler);
    window.removeEventListener('pointerdown', skipIntroHandler);
    window.removeEventListener('touchstart', skipIntroHandler);
  }

  function skipIntroHandler(e) {
    if (e && e.target && e.target.closest('button, a, .btn, .icon-btn')) return;
    primeAudio();
    finishIntro();
  }

  function startIntro() {
    hideAllOverlays();
    appShell.classList.add('hidden');
    topCornerMenu.classList.add('hidden');
    introOverlay.classList.remove('hidden');
    introOverlay.style.opacity = '1';
    introFinished = false;
    introTimer = setTimeout(finishIntro, 4800);
    window.addEventListener('keydown', skipIntroHandler);
    window.addEventListener('pointerdown', skipIntroHandler);
    window.addEventListener('touchstart', skipIntroHandler, { passive: true });
    initAudio();
    // ▶ Try to play intro music — if blocked, it queues for next user gesture
    startIntroMusic();
  }

  // ═══════════════════════════════════════════════════════════
  //  STORY
  // ═══════════════════════════════════════════════════════════
  let storySceneIndex = 0;
  let storyTimer = null;
  let storyFinished = false;
  const STORY_TOTAL_SCENES = 5;
  let currentStoryAudio = null;

  function showStoryScene(n) {
    const scenes = storyOverlay.querySelectorAll('.story-scene');
    const dots = storyOverlay.querySelectorAll('.story-dot');
    scenes.forEach((s, i) => {
      s.classList.toggle('active', i === n);
      s.classList.remove('transitioning');
    });
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === n);
      d.classList.toggle('done', i < n);
    });
    storySceneIndex = n;
    if (currentStoryAudio) {
      try { currentStoryAudio.pause(); currentStoryAudio.currentTime = 0; } catch(e) {}
    }
    const storySound = loadedSounds['story' + (n + 1)];
    if (storySound && settings.sfx) {
      try {
        const audio = storySound.cloneNode();
        audio.volume = masterVolume(0.85);
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch(() => {
            const retry = () => {
              audio.play().catch(()=>{});
              window.removeEventListener('pointerdown', retry);
              window.removeEventListener('touchstart', retry);
            };
            window.addEventListener('pointerdown', retry, { once: true });
            window.addEventListener('touchstart', retry, { once: true });
          });
        }
        currentStoryAudio = audio;
      } catch(e) {}
    }
  }

  function nextStoryScene() {
    if (storySceneIndex >= STORY_TOTAL_SCENES - 1) { finishStory(); return; }
    const scenes = storyOverlay.querySelectorAll('.story-scene');
    const current = scenes[storySceneIndex];
    if (current) current.classList.add('transitioning');
    setTimeout(() => {
      showStoryScene(storySceneIndex + 1);
      const nextDuration = STORY_SCENE_DURATIONS[storySceneIndex + 1] || 7000;
      storyTimer = setTimeout(nextStoryScene, nextDuration);
    }, 500);
  }

  function finishStory() {
    if (storyFinished) return;
    storyFinished = true;
    clearTimeout(storyTimer);
    if (currentStoryAudio) {
      try { currentStoryAudio.pause(); currentStoryAudio.currentTime = 0; } catch(e) {}
      currentStoryAudio = null;
    }
    storyOverlay.style.transition = 'opacity 0.6s ease';
    storyOverlay.style.opacity = '0';
    setTimeout(() => {
      storyOverlay.classList.add('hidden');
      storyOverlay.style.opacity = '1';
      showHomeScreen();
    }, 650);
  }

  function startStory() {
    hideAllOverlays();
    storyOverlay.classList.remove('hidden');
    storyOverlay.style.opacity = '1';
    storyFinished = false;
    showStoryScene(0);
    clearTimeout(storyTimer);
    storyTimer = setTimeout(nextStoryScene, STORY_SCENE_DURATIONS[0] || 7000);
    initAudio();
  }

  const storySkipBtn = $('storySkipBtn');
  if (storySkipBtn) {
    storySkipBtn.addEventListener('click', (e) => { e.stopPropagation(); sfxClick(); finishStory(); });
    storySkipBtn.addEventListener('touchend', (e) => { e.stopPropagation(); e.preventDefault(); finishStory(); });
  }

  // ═══════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════
  async function init() {
    showSlide(0);
    generateRoundContent(0);
    updateUI();
    updateLevelName();
    updateLevelDots();
    updateTeachingsHUD();
    checkOrientation();
    requestAnimationFrame(loop);
    startIntro();
    await loadAllAssets();
    updateCharPreview();
    updateThemePreview();
    updateProfileStats();
  }
  init();

})();