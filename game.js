/* ═══════════════════════════════════════════════════════════
   MUSHAAK — Shadow of Ganesha
   Main game logic — Final polished version
   ═══════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  //  DATA VERSION
  // ═══════════════════════════════════════════════════════════
  const LB_VERSION = 'v5-final';
  if (localStorage.getItem('mushakLBVersion') !== LB_VERSION) {
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
    a.onerror = () => { loadedSounds[k]=null; r(); };
    a.src = src;
    setTimeout(() => { if (!loadedSounds[k]) { loadedSounds[k]=null; r(); } }, 2500);
  });
  async function loadAllAssets() {
    const p = [];
    for (const k in IMAGES) p.push(loadImage(k, IMAGES[k]));
    for (const k in SOUNDS) p.push(loadSound(k, SOUNDS[k]));
    await Promise.all(p);
  }

  // ═══════════════════════════════════════════════════════════
  //  AUDIO
  // ═══════════════════════════════════════════════════════════
  let bgMusic = null, introMusic = null;
  let audioCtx = null, audioPrimed = false;
  let introMusicUnlockPending = false;

  function initAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

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
    if (introMusicUnlockPending) {
      introMusicUnlockPending = false;
      tryPlayIntroMusic();
    }
  }

  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
    window.addEventListener(evt, primeAudio, { once: false, passive: true });
  });

  function playSound(key, vol = 0.7) {
    if (!settings.sfx) return;
    const s = loadedSounds[key];
    if (!s) return;
    try { const c = s.cloneNode(); c.volume = masterVolume(vol); c.play().catch(()=>{}); } catch(e) {}
  }
  const sfxClick = () => playSound('click', 0.55);
  const sfxCollect = () => playSound('collect', 0.7);
  const sfxGolden = () => playSound('golden', 0.85);
  const sfxLevelComplete = () => playSound('levelcomplete', 0.85);
  const sfxPowerup = () => playSound('poweup', 0.85);
  const sfxStart = () => playSound('start', 0.8);

  function startBgMusic() {
    if (!settings.music) return;
    const m = loadedSounds.bgmusic;
    if (!m) return;
    if (!bgMusic) { bgMusic = m.cloneNode(); bgMusic.loop = true; }
    bgMusic.volume = masterVolume(0.28);
    bgMusic.play().catch(()=>{});
  }
  function pauseBgMusic() { if (bgMusic) { try { bgMusic.pause(); } catch(e){} } }
  function resumeBgMusic() {
    if (!settings.music) return;
    if (bgMusic) { bgMusic.volume = masterVolume(0.28); bgMusic.play().catch(()=>{}); }
  }
  function stopBgMusic() { if (bgMusic) { try { bgMusic.pause(); bgMusic.currentTime = 0; } catch(e){} } }

  function tryPlayIntroMusic() {
    if (!settings.music) return false;
    const m = loadedSounds.intromusic;
    if (!m) return false;
    if (!introMusic) { introMusic = m.cloneNode(); introMusic.loop = true; }
    introMusic.volume = masterVolume(0.55);
    try {
      const promise = introMusic.play();
      if (promise && typeof promise.then === 'function') {
        promise.then(() => {}).catch(() => { introMusicUnlockPending = true; });
      }
      return true;
    } catch(e) { introMusicUnlockPending = true; return false; }
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
          try { introMusic.pause(); introMusic.currentTime = 0; introMusic.volume = startVol; } catch(e){}
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

  const homeOverlay=$('homeOverlay'), howToOverlay=$('howToOverlay'), profileOverlay=$('profileOverlay');
  const leaderboardOverlay=$('leaderboardOverlay'), settingsOverlay=$('settingsOverlay');
  const charOverlay=$('charOverlay'), themeOverlay=$('themeOverlay'), startOverlay=$('startOverlay');
  const nameOverlay=$('nameOverlay'), pauseOverlay=$('pauseOverlay'), levelCompleteOverlay=$('levelCompleteOverlay');
  const timeOverOverlay=$('timeOverOverlay'), gameOverOverlay=$('gameOverOverlay'), victoryOverlay=$('victoryOverlay');
  const introOverlay=$('introOverlay'), storyOverlay=$('storyOverlay');
  const modakRainOverlay=$('modakRainOverlay');
  const appShell=$('appShell'), topCornerMenu=$('topCornerMenu');

  const scoreDisplay=$('scoreDisplay'), highScoreDisplay=$('highScoreDisplay');
  const suspicionFill=$('suspicionFill'), suspicionStatus=$('suspicionStatus'), suspicionBar=$('suspicionBar');
  const scoreBox=$('scoreBox'), roundDisplay=$('roundDisplay'), levelDots=$('levelDots');
  const teachingsCount=$('teachingsCount'), timerDisplay=$('timerDisplay'), timerBox=$('timerBox');
  const divineIndicator=$('divineIndicator'), levelName=$('levelName');

  const lpPray=$('lpPray'), lpPower=$('lpPower');
  const lpPowerIcon=$('lpPowerIcon'), lpPowerName=$('lpPowerName');
  const lpPrayStatus=$('lpPrayStatus'), lpPowerStatus=$('lpPowerStatus');

  const dpad=$('dpad'), touchActions=$('touchActions');
  const taPray=$('taPray'), taPower=$('taPower'), taPowerIcon=$('taPowerIcon');

  const finalScoreSpan=$('finalScore'), finalRoundSpan=$('finalRound'), finalHighScoreSpan=$('finalHighScore');
  const gameOverEmoji=$('gameOverEmoji'), gameOverTitle=$('gameOverTitle'), gameOverQuip=$('gameOverQuip');
  const timeOverScore=$('timeOverScore'), timeOverLevel=$('timeOverLevel'), timeOverQuip=$('timeOverQuip');

  const cinematicBanner=$('cinematicBanner'), cbIcon=$('cbIcon'), cbTitle=$('cbTitle'), cbSub=$('cbSub');
  const divineFlash=$('divineFlash'), powerFlash=$('powerFlash');

  const charPreviewAvatar=$('charPreviewAvatar'), charPreviewImg=$('charPreviewImg');
  const charPreviewName=$('charPreviewName'), charPreviewDesc=$('charPreviewDesc');
  const charPreviewStats=$('charPreviewStats'), charPreviewFlavor=$('charPreviewFlavor');

  const themePreviewIcon=$('themePreviewIcon'), themePreviewImg=$('themePreviewImg');
  const themePreviewName=$('themePreviewName'), themePreviewDesc=$('themePreviewDesc');
  const themePreviewEffect=$('themePreviewEffect');

  const leaderboardList=$('leaderboardList'), victoryLeaderboardList=$('victoryLeaderboardList');
  const timeOverLeaderboard=$('timeOverLeaderboard'), homeLeaderboardList=$('homeLeaderboardList');

  const startNameInput=$('startNameInput'), profileNameInput=$('profileNameInput');
  const profileHighScore=$('profileHighScore'), profilePlays=$('profilePlays');
  const profileTeachings=$('profileTeachings'), profileStars=$('profileStars');

  const toggleSfx=$('toggleSfx'), toggleMusic=$('toggleMusic'), toggleVibrate=$('toggleVibrate');
  const volumeSlider=$('volumeSlider'), volumeValue=$('volumeValue');

  const trainingInstructions=$('trainingInstructions'), tiHand=$('tiHand'), tiText=$('tiText');

  // ═══════════════════════════════════════════════════════════
  //  GAME DATA
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

  const ACHIEVEMENTS = [
    { id:'first_game', icon:'🎮', name:'First Steps', check: () => gamesPlayed >= 1 },
    { id:'first_win', icon:'🌟', name:'First Win', check: () => highScore >= 500 },
    { id:'combo_master', icon:'🔥', name:'Combo Master', check: () => highScore >= 2000 },
    { id:'star_collector', icon:'⭐', name:'Star Collector', check: () => totalStars >= 15 },
    { id:'teaching_seeker', icon:'🕉️', name:'Truth Seeker', check: () => lessonsShown.size >= 6 },
    { id:'teaching_master', icon:'📿', name:'Enlightened', check: () => lessonsShown.size >= 12 },
    { id:'champion', icon:'🏆', name:'Champion', check: () => highScore >= 5000 },
    { id:'veteran', icon:'👑', name:'Veteran', check: () => gamesPlayed >= 20 }
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
  const TRAINING_FUNNY_END = [
    '🐭 "Training complete! I\'m ready for the real heist now! Bappa, here I come!"',
    '🐭 "Okay okay, I got it! No more training wheels — time to steal some modaks!"',
    '🐭 "Mastered the art of sneaking! Ganesh Ji won\'t know what hit him!"',
    '🐭 "Sensei Mushak has graduated! Time to put my skills to the test!"'
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
  let profileCreated = localStorage.getItem('mushakProfileCreated') === 'true';
  let trainingCompleted = localStorage.getItem('mushakTrainingCompleted') === 'true';

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

  let isTraining = false;
  let trainingStep = 0;
  let trainingMoveDone = false;
  let trainingCollectDone = false;
  let trainingFreezeDone = false;
  let trainingPrayDone = false;
  let trainingPowerDone = false;

  const TRAINING_STEPS = [
    { text: '👆 Move with the D-pad or Arrow Keys!', hand: '👆' },
    { text: '🥟 Collect the modak when it appears!', hand: '👉' },
    { text: '👀 Ganesh Ji opened his eyes — FREEZE!', hand: '✋' },
    { text: '😌 Eyes closed — you can move again!', hand: '👆' },
    { text: '🙏 Press PRAY (Space) to cool suspicion!', hand: '👇' },
    { text: '⚡ Press POWER (Shift) for your special ability!', hand: '👇' },
    { text: '⏱️ Watch the timer! Don\'t let it run out!', hand: '👆' },
    { text: '🏠 Now reach the Safe Zone to complete training!', hand: '👉' }
  ];

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
    // Only add if score > 0
    if (finalScore <= 0) return;
    const entry = { name: name.trim().slice(0, 16), score: finalScore, date: Date.now() };
    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 50);
    saveLeaderboard();
  }

  function getPlayerBest() {
    if (!playerName) return 0;
    const mine = leaderboard.filter(e => e.name === playerName);
    return mine.length > 0 ? Math.max(...mine.map(e => e.score)) : 0;
  }

  function renderLeaderboard(containerId, recent = false) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';
    let list = [...leaderboard];
    if (recent) {
      list.sort((a, b) => b.date - a.date);
      list = list.slice(0, 10);
    } else {
      list.sort((a, b) => b.score - a.score);
      list = list.slice(0, 10);
    }
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'lb-empty';
      empty.textContent = 'No scores yet — be the first!';
      container.appendChild(empty);
      return;
    }
    list.forEach((entry, i) => {
      const item = document.createElement('div');
      const isYou = playerName && entry.name === playerName;
      item.className = 'lb-item' +
        (!recent && i === 0 ? ' rank-1' : !recent && i === 1 ? ' rank-2' : !recent && i === 2 ? ' rank-3' : '') +
        (isYou ? ' you' : '');
      const rank = recent ? '🕐' :
        i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      const dateStr = new Date(entry.date).toLocaleDateString();
      item.innerHTML = `<div class="lb-rank">${rank}</div><div class="lb-name">${escapeHtml(entry.name)}${isYou ? ' (You)' : ''}</div><div class="lb-score">${entry.score}</div><div class="lb-date">${dateStr}</div>`;
      container.appendChild(item);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateProfileAfterLevel() {
    // Update stats in profile
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('mushakHighScore', highScore);
      highScoreDisplay.textContent = highScore;
    }
    updateProfileStats();
  }

  function savePlayerScore() {
    if (!playerName) return;
    if (score <= 0) return;
    addToLeaderboard(playerName, score);
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
  //  MODAK RAIN INTER-LEVEL MINI-GAME
  // ═══════════════════════════════════════════════════════════
  const rainCanvas = $('modakRainCanvas');
  const rainCtx = rainCanvas ? rainCanvas.getContext('2d') : null;
  let rainActive = false;
  let rainDrops = [];
  let rainTimer = 0;
  let rainCaught = 0;
  let rainScore = 0;
  let rainAnimationId = null;
  let rainLastTime = 0;
  let rainOnComplete = null;

  function resizeRainCanvas() {
    if (!rainCanvas) return;
    rainCanvas.width = rainCanvas.clientWidth;
    rainCanvas.height = rainCanvas.clientHeight;
  }

  function startModakRain(onComplete) {
    if (!rainCanvas || !rainCtx) { if (onComplete) onComplete(); return; }
    rainOnComplete = onComplete;
    rainActive = true;
    rainDrops = [];
    rainCaught = 0;
    rainScore = 0;
    rainTimer = 8; // 8 seconds of modak rain
    rainLastTime = performance.now();
    modakRainOverlay.classList.remove('hidden');
    resizeRainCanvas();

    $('modakRainTitle').textContent = '✨ BONUS ROUND ✨';
    $('modakRainSub').textContent = 'Catch the falling modaks!';

    // Spawn initial drops
    for (let i = 0; i < 5; i++) spawnRainDrop();

    rainCanvas.addEventListener('pointerdown', handleRainClick);
    rainCanvas.addEventListener('touchstart', handleRainTouch, { passive: false });

    rainAnimationId = requestAnimationFrame(rainLoop);
  }

  function spawnRainDrop() {
    if (!rainCanvas) return;
    const isGolden = Math.random() < 0.12;
    rainDrops.push({
      x: rand(40, rainCanvas.width - 40),
      y: -40,
      vy: rand(1.5, 3.5) * (isGolden ? 0.7 : 1),
      vx: rand(-0.5, 0.5),
      size: isGolden ? 36 : 28,
      isGolden,
      rot: rand(0, Math.PI*2),
      vr: rand(-0.05, 0.05)
    });
  }

  function handleRainClick(e) {
    const rect = rainCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    checkRainCatch(x, y);
  }
  function handleRainTouch(e) {
    e.preventDefault();
    const rect = rainCanvas.getBoundingClientRect();
    for (const touch of e.touches) {
      checkRainCatch(touch.clientX - rect.left, touch.clientY - rect.top);
    }
  }

  function checkRainCatch(x, y) {
    if (!rainActive) return;
    for (let i = rainDrops.length - 1; i >= 0; i--) {
      const d = rainDrops[i];
      if (dist(x, y, d.x, d.y) < d.size) {
        rainCaught++;
        const pts = d.isGolden ? 50 : 15;
        rainScore += pts;
        // Visual burst
        addParticles(d.x, d.y, d.isGolden ? '#ffd56b' : '#f97316', d.isGolden ? 20 : 10, 5);
        rainDrops.splice(i, 1);
        sfxCollect();
        if (d.isGolden) sfxGolden();
        break;
      }
    }
  }

  function rainLoop(now) {
    if (!rainActive) return;
    const dt = Math.min(3, (now - rainLastTime) / 16.67);
    rainLastTime = now;
    rainTimer -= dt / 60; // convert to seconds

    if (rainTimer <= 0) {
      endModakRain();
      return;
    }

    // Update drops
    for (let i = rainDrops.length - 1; i >= 0; i--) {
      const d = rainDrops[i];
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      d.rot += d.vr * dt;
      if (d.y > rainCanvas.height + 50) {
        rainDrops.splice(i, 1);
      }
    }

    // Spawn new drops
    if (Math.random() < 0.08 * dt && rainDrops.length < 12) {
      spawnRainDrop();
    }

    // Draw
    rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
    // background subtle
    rainCtx.fillStyle = 'rgba(10,6,18,0.4)';
    rainCtx.fillRect(0, 0, rainCanvas.width, rainCanvas.height);

    for (const d of rainDrops) {
      rainCtx.save();
      rainCtx.translate(d.x, d.y);
      rainCtx.rotate(d.rot);
      rainCtx.font = d.size + 'px sans-serif';
      rainCtx.textAlign = 'center';
      rainCtx.textBaseline = 'middle';
      if (d.isGolden) {
        rainCtx.shadowColor = '#ffd56b';
        rainCtx.shadowBlur = 30;
      }
      rainCtx.fillText('🥟', 0, 0);
      rainCtx.restore();
    }

    // Timer bar
    const barW = rainCanvas.width * 0.6;
    const barX = (rainCanvas.width - barW) / 2;
    const barY = 60;
    rainCtx.fillStyle = 'rgba(0,0,0,0.5)';
    rainCtx.fillRect(barX, barY, barW, 12);
    rainCtx.fillStyle = '#ffd56b';
    rainCtx.fillRect(barX, barY, barW * (rainTimer / 8), 12);
    rainCtx.strokeStyle = 'rgba(255,213,107,0.6)';
    rainCtx.lineWidth = 2;
    rainCtx.strokeRect(barX, barY, barW, 12);

    // Score display
    rainCtx.font = 'bold 20px "Comic Sans MS", cursive';
    rainCtx.fillStyle = '#ffd56b';
    rainCtx.textAlign = 'center';
    rainCtx.fillText(`🥟 Caught: ${rainCaught}  ·  Bonus: +${rainScore}`, rainCanvas.width/2, rainCanvas.height - 60);

    rainAnimationId = requestAnimationFrame(rainLoop);
  }

  function endModakRain() {
    rainActive = false;
    if (rainAnimationId) cancelAnimationFrame(rainAnimationId);
    rainCanvas.removeEventListener('pointerdown', handleRainClick);
    rainCanvas.removeEventListener('touchstart', handleRainTouch);

    // Apply bonus to score
    score += rainScore;
    scoreDisplay.textContent = score;

    // Show result briefly
    $('modakRainTitle').textContent = '🎉 WELL DONE!';
    $('modakRainSub').textContent = `+${rainScore} bonus points from ${rainCaught} modaks!`;
    $('modakRainTap').textContent = '✨ Continuing...';
    sfxLevelComplete();

    setTimeout(() => {
      modakRainOverlay.classList.add('hidden');
      $('modakRainTap').textContent = '👆 Tap modaks to collect bonus points!';
      if (rainOnComplete) rainOnComplete();
    }, 2500);
  }

  // ═══════════════════════════════════════════════════════════
  //  ROUND GENERATION
  // ═══════════════════════════════════════════════════════════
  function generateRoundContent(lvIdx, training = false) {
    modaks = []; powerUps = []; obstacles = [];
    divineBarriers = []; blessingFlowers = [];
    modaksCollected = 0;
    comboMilestone = 0;
    goldenModak = null;

    const lvl = LEVELS[Math.min(lvIdx, LEVELS.length - 1)];
    const difficulty = training ? 0.8 : lvl.difficulty;

    const obsCount = training ? 2 : Math.floor((3 + Math.min(lvIdx + 1, 6)) * difficulty);
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

    const themeMod = training ? 1.0 : selectedTheme.modakMult;
    const baseCount = training ? 3 : Math.min(4 + lvIdx * 2, 16);
    const count = training ? 3 : Math.max(4, Math.floor(baseCount * themeMod * difficulty));
    const MODAK_BUFFER = 42;

    if (training) {
      const trainingSpots = [
        { x: 300, y: 350 },
        { x: 450, y: 250 },
        { x: 550, y: 400 }
      ];
      for (let i = 0; i < Math.min(3, trainingSpots.length); i++) {
        const spot = trainingSpots[i];
        if (!obstacles.some(o =>
          spot.x > o.x - MODAK_BUFFER && spot.x < o.x + o.w + MODAK_BUFFER &&
          spot.y > o.y - MODAK_BUFFER && spot.y < o.y + o.h + MODAK_BUFFER)) {
          modaks.push({ x: spot.x, y: spot.y, r: 18, collected:false, bob: Math.random()*Math.PI*2 });
        } else {
          for (let tries=0; tries<100; tries++) {
            const mx = rand(250, W-60), my = rand(100, H-60);
            if (mx < safeZone.x + safeZone.w + 30) continue;
            if (dist(mx, my, ganesh.x, ganesh.y) < 150) continue;
            const overlapsObstacle = obstacles.some(o =>
              mx > o.x - MODAK_BUFFER && mx < o.x + o.w + MODAK_BUFFER &&
              my > o.y - MODAK_BUFFER && my < o.y + o.h + MODAK_BUFFER);
            if (overlapsObstacle) continue;
            modaks.push({ x: mx, y: my, r: 18, collected:false, bob: Math.random()*Math.PI*2 });
            break;
          }
        }
      }
    } else {
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
    }

    if (!training) {
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
    }

    ganesh.divinePowerType = Math.min(lvIdx, DIVINE_POWERS.length - 1);
    divineIndicator.textContent = currentDivinePower().label;
    divineIndicator.style.display = training ? 'none' : 'block';

    if (!training && lvIdx >= 2) {
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

    if (!training && lvIdx >= 3) {
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

    generateRoundContent(levelIndex, isTraining);
    levelStartTime = performance.now();
    levelTimeRemaining = isTraining ? 90 : LEVELS[levelIndex].timeLimit;
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
    if (isTraining) {
      levelName.textContent = '🎓 Training Ground';
      return;
    }
    const divine = currentDivinePower();
    const lvl = LEVELS[levelIndex];
    levelName.textContent = `${lvl.icon} ${lvl.name} · ${divine.icon} ${divine.name}`;
  }

  function updateLevelDots() {
    const dots = levelDots.querySelectorAll('.level-dot');
    dots.forEach((d, i) => {
      d.classList.remove('done', 'current');
      if (isTraining) {
        if (i === 0) d.classList.add('current');
      } else {
        if (i < levelIndex) d.classList.add('done');
        else if (i === levelIndex) d.classList.add('current');
      }
    });
    roundDisplay.textContent = isTraining ? 'T' : (levelIndex + 1);
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
      const limit = isTraining ? 90 : LEVELS[levelIndex].timeLimit;
      const remaining = Math.max(0, limit - elapsed);
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
  //  TRAINING
  // ═══════════════════════════════════════════════════════════
  function updateTrainingInstructions() {
    if (!isTraining) return;
    let step = trainingStep;

    if (trainingStep === 0 && trainingMoveDone) step = 1;
    if (trainingStep === 1 && trainingCollectDone) step = 2;
    if (trainingStep === 2 && trainingFreezeDone) step = 3;
    if (trainingStep === 3 && modaksCollected >= 3) step = 4;
    if (trainingStep === 4 && trainingPrayDone) step = 5;
    if (trainingStep === 5 && trainingPowerDone) step = 6;
    if (trainingStep === 6) step = 7;

    if (step !== trainingStep) {
      trainingStep = step;
    }

    if (trainingStep < TRAINING_STEPS.length) {
      trainingInstructions.classList.add('active');
      const s = TRAINING_STEPS[trainingStep];
      tiText.textContent = s.text;
      tiHand.textContent = s.hand;
    } else {
      trainingInstructions.classList.remove('active');
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  GANESH & MUSHAAK
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
    if (isTraining) {
      const slow = 0.7;
      if (ganesh.isLooking) {
        ganesh.lookTimer += dt * slow;
        ganesh.eyeOpen = Math.min(1, ganesh.eyeOpen + 0.07);
        if (ganesh.lookTimer > 50) {
          ganesh.isLooking = false; ganesh.lookTimer = 0; ganesh.turnFlash = 15;
        }
      } else {
        ganesh.lookTimer += dt * slow;
        ganesh.eyeOpen = Math.max(0, ganesh.eyeOpen - 0.06);
        if (ganesh.lookTimer > 90) {
          ganesh.isLooking = true; ganesh.lookTimer = 0;
          ganesh.lookDuration = 50; ganesh.lookCooldown = 90;
          ganesh.turnFlash = 15;
        }
      }
      if (ganesh.turnFlash > 0) ganesh.turnFlash--;
      return;
    }
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
      if (isTraining && trainingStep === 0) trainingMoveDone = true;

      const immune = shieldActive || shadowActive || (powerActiveTimer > 0 && selectedChar.id === 'mota');
      if (!isTraining && ganesh.isLooking && ganesh.eyeOpen > 0.4 && !immune) {
        suspicion += SUSPICION_BASE * selectedChar.suspicionMult * LEVELS[levelIndex].difficulty * dt;
        if (suspicion > 80 && slowMo <= 0) slowMo = 40;
        if (Math.random() < 0.012) setEmote(pick(['😳','😨','🫣','😅']), 45);
      }
      if (isTraining && ganesh.isLooking && ganesh.eyeOpen > 0.4) {
        suspicion = Math.min(50, suspicion + 0.5 * dt);
      }
    }
    if ((!ganesh.isLooking || ganesh.eyeOpen < 0.2) && suspicion > 0)
      suspicion = Math.max(0, suspicion - DECAY_RATE * dt);

    // Training freeze detection
    if (isTraining && trainingStep === 2 && ganesh.isLooking && ganesh.eyeOpen > 0.7) {
      if (!dx && !dy) trainingFreezeDone = true;
    }

    if (shieldActive) suspicion = Math.max(0, suspicion - 0.15 * dt);
    if (shadowActive) suspicion = Math.max(0, suspicion - 0.2 * dt);
    if (powerActiveTimer > 0 && selectedChar.id === 'mota') suspicion = Math.max(0, suspicion - 0.25 * dt);

    if (!isTraining && suspicion >= SUSPICION_MAX) {
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
    updateTrainingInstructions();
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
        if (isTraining && modaksCollected >= 1) trainingCollectDone = true;
        if (comboCount >= 6 && comboCount >= comboMilestone + 6) {
          comboMilestone = comboCount;
          playCinematic('🔥', comboCount + 'x COMBO!', 'Mushak is unstoppable!', 1200);
        }
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

    if (isTraining) {
      if (trainingStep >= 7) {
        completeTraining();
      } else {
        addPopup(mushak.x, mushak.y-40, '👆 Complete the training steps first!', '#ffd56b', 22);
        mushak.x = safeZone.x + safeZone.w + 30;
      }
      return;
    }

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

    // Play level complete sound ONCE
    sfxLevelComplete();
    addRipple(mushak.x, mushak.y, '#10b981', 100);
    shake(4);
    scoreBox.classList.remove('pop'); void scoreBox.offsetWidth; scoreBox.classList.add('pop');

    // Update profile & save player score
    updateProfileAfterLevel();
    savePlayerScore();

    // Show cinematic banner
    playCinematic('🎉', 'LEVEL ' + (levelIndex + 1) + ' CLEAR!', 'Stars: ' + '⭐'.repeat(stars), 2000);

    // Check if this is the last level
    const isLastLevel = levelIndex >= LEVELS.length - 1;

    // After cinematic, launch Modak Rain mini-game (unless final level)
    setTimeout(() => {
      if (isLastLevel) {
        showLevelComplete(stars, timeBonus);
      } else {
        startModakRain(() => {
          showLevelComplete(stars, timeBonus);
        });
      }
    }, 2000);
  }

  function completeTraining() {
    isTraining = false;
    gameActive = false;
    trainingCompleted = true;
    localStorage.setItem('mushakTrainingCompleted', 'true');
    sfxLevelComplete();
    shake(8);
    playCinematic('🎓', 'TRAINING COMPLETE!', 'Mushak is ready!', 2200);
    // Update profile after training too
    updateProfileAfterLevel();
    savePlayerScore();
    setTimeout(() => {
      $('levelCompleteTitle').textContent = '🎓 Training Complete!';
      $('starRating').textContent = '⭐⭐⭐';
      $('totalScore').textContent = score;
      $('timeBonus').textContent = '+0';
      $('levelCompleteQuip').textContent = pick(TRAINING_FUNNY_END);
      $('nextLevelBtn').textContent = '➡ Start Level 1';
      $('nextLevelBtn').dataset.mode = 'fromTraining';
      levelCompleteOverlay.classList.remove('hidden');
    }, 2200);
  }

  function showLevelComplete(stars, timeBonus) {
    gameActive = false;
    $('starRating').textContent = '⭐'.repeat(stars) + '☆'.repeat(3-stars);
    $('totalScore').textContent = score;
    $('timeBonus').textContent = '+' + timeBonus;
    $('levelCompleteQuip').textContent = pick(FUNNY_LEVEL_CLEAR);
    $('levelCompleteTitle').textContent = pick(['🎉 Level Clear!', '🌟 Well Done!', '✨ Shabash!', '🎊 Smooth!']);
    $('nextLevelBtn').textContent = '➡ Next Level';
    $('nextLevelBtn').dataset.mode = 'nextLevel';
    levelCompleteOverlay.classList.remove('hidden');
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('mushakHighScore', highScore);
      highScoreDisplay.textContent = highScore;
    }
    updateProfileStats();
  }

  function nextLevel() {
    levelCompleteOverlay.classList.add('hidden');
    const mode = $('nextLevelBtn').dataset.mode;
    if (mode === 'fromTraining') {
      // Start real Level 1
      levelIndex = 0;
      score = 0;
      isTraining = false;
      trainingInstructions.classList.remove('active');
      playCinematic(LEVELS[0].icon, 'LEVEL 1', LEVELS[0].name, 1800);
      setTimeout(() => {
        resetGame(0);
        gameActive = true; paused = false;
        if (useTouchControls) { dpad.classList.add('active'); touchActions.classList.add('active'); }
      }, 1800);
      return;
    }
    levelIndex++;
    if (levelIndex >= LEVELS.length) { victory(); return; }
    score += 200;
    const divine = currentDivinePower();
    playCinematic(LEVELS[levelIndex].icon, 'LEVEL ' + (levelIndex + 1), LEVELS[levelIndex].name, 1800);
    setTimeout(() => {
      resetGame(levelIndex);
      gameActive = true; paused = false;
      if (useTouchControls) { dpad.classList.add('active'); touchActions.classList.add('active'); }
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
      savePlayerScore();
      renderLeaderboard('victoryLeaderboardList');
      victoryOverlay.classList.remove('hidden');
      topCornerMenu.classList.add('hidden');
      updateProfileStats();
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
    if (isTraining && trainingStep === 4) trainingPrayDone = true;
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
    if (isTraining && trainingStep === 5) trainingPowerDone = true;
  }

  function timeOver() {
    if (!gameActive) return;
    if (isTraining) {
      levelStartTime = performance.now();
      return;
    }
    gameActive = false;
    gamesPlayed++;
    localStorage.setItem('mushakPlays', String(gamesPlayed));
    timeOverScore.textContent = score;
    timeOverLevel.textContent = (levelIndex + 1);
    timeOverQuip.textContent = pick(FUNNY_TIME_OVER);
    $('timeOverTitle').textContent = pick(['⏱️ Time\'s Up!', '⌛ Too Slow!', '🕐 Ganesh Ji Woke Up!']);
    savePlayerScore();
    renderLeaderboard('timeOverLeaderboard');
    timeOverOverlay.classList.remove('hidden');
    divineIndicator.style.display = 'none';
    topCornerMenu.classList.add('hidden');
    dpad.classList.remove('active');
    touchActions.classList.remove('active');
    updateProfileStats();
  }

  function gameOver() {
    if (!gameActive) return;
    if (isTraining) {
      suspicion = 30;
      addPopup(mushak.x, mushak.y-40, '🙏 Bappa is watching...', '#ffd56b', 20);
      return;
    }
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
    savePlayerScore();
    renderLeaderboard('leaderboardList');
    gameOverOverlay.classList.remove('hidden');
    divineIndicator.style.display = 'none';
    topCornerMenu.classList.add('hidden');
    dpad.classList.remove('active');
    touchActions.classList.remove('active');
    updateProfileStats();
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

    if (isTraining) {
      ctx.save();
      ctx.font = 'bold 18px "Comic Sans MS", cursive';
      ctx.fillStyle = '#ffd56b';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#1a0e2e'; ctx.shadowBlur = 10;
      ctx.fillText('🎓 TRAINING GROUND', W/2, 60);
      ctx.restore();
    }

    const allCollected = modaks.length > 0 &&
                        modaks.every(m => m.collected) &&
                        (goldenModak ? goldenModak.collected : true) &&
                        blessingFlowers.every(f => f.collected);
    if (allCollected && gameActive && !isTraining) {
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
      if (gameActive && !isTraining) {
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
     introOverlay, storyOverlay, modakRainOverlay].forEach(o => { if (o) o.classList.add('hidden'); });
    trainingInstructions.classList.remove('active');
  }
  function showHomeScreen() {
    hideAllOverlays();
    homeOverlay.classList.remove('hidden');
    appShell.classList.add('hidden');
    topCornerMenu.classList.add('hidden');
    divineIndicator.style.display = 'none';
    dpad.classList.remove('active');
    touchActions.classList.remove('active');
    gameActive = false; paused = false; isTraining = false;
    // Show player name on home
    if (playerName) {
      $('homePlayerName').textContent = playerName;
      $('homePlayerTag').classList.remove('hidden');
    } else {
      $('homePlayerTag').classList.add('hidden');
    }
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
  //  PREVIEWS
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

  function getPlayerLevel() {
    const best = getPlayerBest();
    if (best >= 5000) return { lv: 5, name: 'Legend' };
    if (best >= 3000) return { lv: 4, name: 'Master' };
    if (best >= 1500) return { lv: 3, name: 'Expert' };
    if (best >= 500) return { lv: 2, name: 'Rising' };
    return { lv: 1, name: 'Novice' };
  }

  function updateProfileStats() {
    profileHighScore.textContent = highScore;
    profilePlays.textContent = gamesPlayed;
    profileTeachings.textContent = lessonsShown.size + '/12';
    profileStars.textContent = totalStars;
    profileNameInput.value = playerName || '';
    // Level badge
    const lvl = getPlayerLevel();
    $('profileLevelBadge').textContent = `Lv. ${lvl.lv} ${lvl.name}`;
    // Achievements
    const badgeGrid = $('badgeGrid');
    if (badgeGrid) {
      badgeGrid.innerHTML = '';
      ACHIEVEMENTS.forEach(a => {
        const unlocked = a.check();
        const el = document.createElement('div');
        el.className = 'achievement-badge' + (unlocked ? ' unlocked' : '');
        el.innerHTML = `<div class="ab-icon">${a.icon}</div><div class="ab-name">${a.name}</div>`;
        badgeGrid.appendChild(el);
      });
    }
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
    renderLeaderboard('homeLeaderboardList', false);
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
    profileCreated = true;
    localStorage.setItem('mushakProfileCreated', 'true');
    sfxGolden();
    vibrate(40);
    const btn = $('saveProfileBtn');
    btn.textContent = '✓ Saved!';
    setTimeout(() => { btn.textContent = '💾 Save'; }, 1500);
  });
  $('closeProfileBtn').addEventListener('click', () => { sfxClick(); showHomeScreen(); });
  $('closeLeaderboardBtn').addEventListener('click', () => { sfxClick(); showHomeScreen(); });
  $('lbTabAll').addEventListener('click', () => {
    sfxClick();
    $('lbTabAll').classList.add('active');
    $('lbTabRecent').classList.remove('active');
    renderLeaderboard('homeLeaderboardList', false);
  });
  $('lbTabRecent').addEventListener('click', () => {
    sfxClick();
    $('lbTabRecent').classList.add('active');
    $('lbTabAll').classList.remove('active');
    renderLeaderboard('homeLeaderboardList', true);
  });

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

  $('resetAllBtn').addEventListener('click', () => {
    if (!confirm('Reset ALL data? Everything will be erased.')) return;
    ['mushakLeaderboard','mushakHighScore','mushakTeachings','mushakPlayerName',
     'mushakLBVersion','mushakStars','mushakPlays','mushakProfileCreated','mushakTrainingCompleted'].forEach(k => localStorage.removeItem(k));
    leaderboard = [];
    lessonsShown = new Set();
    playerName = '';
    highScore = 0;
    totalStars = 0;
    gamesPlayed = 0;
    profileCreated = false;
    trainingCompleted = false;
    highScoreDisplay.textContent = '0';
    updateTeachingsHUD();
    sfxClick();
    vibrate(40);
    setTimeout(() => location.reload(), 500);
  });

  // ═══════════════════════════════════════════════════════════
  //  GAME FLOW
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

  function beginGame(forceTraining = false) {
    const name = startNameInput.value.trim();
    if (!name) {
      try { startNameInput.focus(); } catch(e){}
      startNameInput.style.borderColor = '#dc2626';
      setTimeout(() => { startNameInput.style.borderColor = ''; }, 800);
      return;
    }
    playerName = name.slice(0, 16);
    localStorage.setItem('mushakPlayerName', playerName);
    if (!profileCreated) {
      profileCreated = true;
      localStorage.setItem('mushakProfileCreated', 'true');
    }

    try { initAudio(); } catch(e){}
    sfxStart();
    hideAllOverlays();
    appShell.classList.remove('hidden');
    topCornerMenu.classList.remove('hidden');
    gameActive = false; paused = false;
    totalPrayersUsed = 0; totalModaksCollected = 0; totalTimeSpent = 0;

    // Only show training if never completed before (unless forced)
    const shouldTrain = forceTraining || !trainingCompleted;

    isTraining = shouldTrain;
    trainingStep = 0;
    trainingMoveDone = false;
    trainingCollectDone = false;
    trainingFreezeDone = false;
    trainingPrayDone = false;
    trainingPowerDone = false;

    if (isTraining) {
      tiText.textContent = TRAINING_STEPS[0].text;
      tiHand.textContent = TRAINING_STEPS[0].hand;
      trainingInstructions.classList.add('active');
    } else {
      trainingInstructions.classList.remove('active');
    }

    resetGame(0);
    startBgMusic();
    if (isTraining) {
      playCinematic('🎓', 'TRAINING GROUND', 'Learn the ropes!', 2200);
      setTimeout(() => {
        gameActive = true; paused = false;
        if (useTouchControls) { dpad.classList.add('active'); touchActions.classList.add('active'); }
      }, 2200);
    } else {
      playCinematic(LEVELS[0].icon, 'LEVEL 1', LEVELS[0].name, 1800);
      setTimeout(() => {
        gameActive = true; paused = false;
        if (useTouchControls) { dpad.classList.add('active'); touchActions.classList.add('active'); }
      }, 1800);
    }
    for (const k in keys) keys[k] = false;
  }

  $('nameStartBtn').addEventListener('click', () => beginGame());
  startNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') beginGame(); });

  $('pauseBtn').addEventListener('click', () => { sfxClick(); togglePause(); });
  $('quickHomeBtn').addEventListener('click', () => {
    sfxClick();
    if (!gameActive) return;
    if (!confirm('Exit to Home? Current game progress will be lost.')) return;
    paused = false;
    gameActive = false;
    isTraining = false;
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
    // Keep training status as-is (if trainingCompleted, don't retrain)
    isTraining = !trainingCompleted;
    trainingStep = 0;
    trainingMoveDone = false;
    trainingCollectDone = false;
    trainingFreezeDone = false;
    trainingPrayDone = false;
    trainingPowerDone = false;
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
    isTraining = false;
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
    isTraining = false;
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
    isTraining = false;
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
    isTraining = false;
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
    if (e.target.closest('.btn, .dpad-btn, .touch-action-btn, .power-item, .char-card, .theme-card, .icon-btn, .toggle-switch, .menu-btn, .lb-tab')) {
      e.preventDefault();
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  INTRO
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
    tryPlayIntroMusic();
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