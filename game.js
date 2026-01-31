const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const resultLabel = document.getElementById("result");
const promptLabel = document.getElementById("prompt");
const statsBox = document.getElementById("stats");
const startButton = document.getElementById("start-button");
const themeGameButton = document.getElementById("theme-game");
const themeCyberButton = document.getElementById("theme-cyber");
const modeSelect = document.getElementById("mode-select");
const modeSingleButton = document.getElementById("mode-single");
const modeTwoButton = document.getElementById("mode-two");
const characterSelect = document.getElementById("character-select");
const chooseLittleButton = document.getElementById("choose-little");
const chooseBigButton = document.getElementById("choose-big");
const music = document.getElementById("music");
const readySfx = document.getElementById("ready-sfx");
const hitSfx = document.getElementById("hit-sfx");
const winnerPresound = document.getElementById("winner-presound");
const littleWinsSfx = document.getElementById("little-wins");
const bigWinsSfx = document.getElementById("big-wins");
const mobileControls = document.getElementById("mobile-controls");

/* Lazy load audio on first interaction */
let audioInitialized = false;
let audioContext = null;
let musicGainNode = null;
let presoundGainNode = null;

function initAudio() {
  if (audioInitialized) return;
  audioInitialized = true;
  
  // Create Web Audio API context for iOS volume control
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    if (music) {
      music.src = "music.mp3";
      const musicSource = audioContext.createMediaElementSource(music);
      musicGainNode = audioContext.createGain();
      musicGainNode.gain.value = 0.06; // Music volume (0-1)
      musicSource.connect(musicGainNode);
      musicGainNode.connect(audioContext.destination);
    }
    
    if (winnerPresound) {
      winnerPresound.src = "winner-presound.mp3";
      const presoundSource = audioContext.createMediaElementSource(winnerPresound);
      presoundGainNode = audioContext.createGain();
      presoundGainNode.gain.value = 0.15; // Presound volume (0-1)
      presoundSource.connect(presoundGainNode);
      presoundGainNode.connect(audioContext.destination);
    }
  } catch (e) {
    // Fallback if Web Audio API fails
    if (music) {
      music.src = "music.mp3";
      music.volume = 0.06;
    }
    if (winnerPresound) {
      winnerPresound.src = "winner-presound.mp3";
      winnerPresound.volume = 0.15;
    }
  }
  
  if (readySfx) readySfx.src = "are-you-ready.m4a";
  if (hitSfx) hitSfx.src = "hit.m4a";
  if (littleWinsSfx) littleWinsSfx.src = "little-wins.m4a";
  if (bigWinsSfx) bigWinsSfx.src = "big-wins.m4a";
}

const assets = {
  little: new Image(),
  big: new Image(),
};

assets.little.src = "little-fighter.png";
assets.big.src = "big-fighter.png";

const world = {
  width: canvas.width,
  height: canvas.height,
  floor: canvas.height - 120,
};

const colors = ["#ff4f8b", "#6bffde", "#ffd53d", "#7b6bff", "#3cf5ff"];

const state = {
  running: false,
  winner: null,
  screenShake: 0,
  time: 0,
  particles: [],
  stars: [],
  confetti: [],
  awaitingConfirm: false,
  lockUntil: 0,
  confirmPromptShown: false,
  readyScreen: false,
  readyTimeoutId: null,
  readyMessageUntil: 0,
  mode: "single",
  playerSide: "little",
};

const keys = new Set();

const fighters = {
  little: createFighter({
    name: "Little",
    x: 220,
    y: world.floor,
    width: 120,
    height: 160,
    speed: 6,
    jumpPower: 18,
    dashPower: 11,
    color: "#ff7ad9",
    image: assets.little,
    flip: -1,
  }),
  big: createFighter({
    name: "Big",
    x: world.width - 260,
    y: world.floor,
    width: 160,
    height: 220,
    speed: 5,
    jumpPower: 17,
    dashPower: 10,
    color: "#6bffde",
    image: assets.big,
    flip: 1,
  }),
};

function createFighter(config) {
  return {
    ...config,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    health: 100,
    attackCooldown: 0,
    dashCooldown: 0,
    glow: 0,
    knockback: 0,
    hitFlash: 0,
    hits: 0,
    desiredHeight: config.height,
    drawWidth: config.width,
    drawHeight: config.height,
    flip: config.flip ?? 1,
  };
}

function updateFighterSize(fighter) {
  if (fighter.image.naturalWidth && fighter.image.naturalHeight) {
    const ratio = fighter.image.naturalWidth / fighter.image.naturalHeight;
    fighter.drawHeight = fighter.desiredHeight;
    fighter.drawWidth = fighter.desiredHeight * ratio;
  }
}

assets.little.onload = () => updateFighterSize(fighters.little);
assets.big.onload = () => updateFighterSize(fighters.big);

function resetGame() {
  resetFightersForFight();
  state.running = false;
  state.winner = null;
  state.screenShake = 0;
  state.time = 0;
  state.particles = [];
  state.confetti = [];
  state.awaitingConfirm = false;
  state.lockUntil = 0;
  state.confirmPromptShown = false;
  state.readyScreen = false;
  state.readyMessageUntil = 0;
  if (state.readyTimeoutId) {
    clearTimeout(state.readyTimeoutId);
    state.readyTimeoutId = null;
  }
  updateHealthBars();
  setPrompt("Click <strong>Start</strong> to begin!");
  showOverlay("Start Game", true, "");
  setStartButtonVisible(true);
  setModeSelectVisible(true);
  syncModeUi();
}

function resetFightersForFight() {
  const margin = Math.max(100, world.width * 0.15);
  
  fighters.little.x = margin;
  fighters.little.y = world.floor;
  fighters.little.vx = 0;
  fighters.little.vy = 0;
  fighters.little.facing = 1;
  fighters.little.health = 100;
  fighters.little.attackCooldown = 0;
  fighters.little.dashCooldown = 0;
  fighters.little.hitFlash = 0;
  fighters.little.hits = 0;

  fighters.big.x = world.width - margin;
  fighters.big.y = world.floor;
  fighters.big.vx = 0;
  fighters.big.vy = 0;
  fighters.big.facing = -1;
  fighters.big.health = 100;
  fighters.big.attackCooldown = 0;
  fighters.big.dashCooldown = 0;
  fighters.big.hitFlash = 0;
  fighters.big.hits = 0;
}

function getScaleFactor() {
  // Don't scale below 0.6 to keep characters visible on mobile
  return Math.max(0.6, Math.min(world.width / 1100, world.height / 620, 1));
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  world.width = rect.width;
  world.height = rect.height;
  world.floor = world.height - Math.max(60, world.height * 0.15);
  
  // Update fighter sizes based on scale (minimum sizes for mobile)
  const scale = getScaleFactor();
  fighters.little.desiredHeight = Math.max(100, Math.round(160 * scale));
  fighters.little.drawHeight = fighters.little.desiredHeight;
  fighters.big.desiredHeight = Math.max(140, Math.round(220 * scale));
  fighters.big.drawHeight = fighters.big.desiredHeight;
  updateFighterSize(fighters.little);
  updateFighterSize(fighters.big);
  
  // Keep movement values constant - don't scale them
  // This ensures consistent gameplay feel across devices
  fighters.little.speed = 6;
  fighters.little.jumpPower = 18;
  fighters.little.dashPower = 11;
  fighters.big.speed = 5;
  fighters.big.jumpPower = 17;
  fighters.big.dashPower = 10;
}

function showOverlay(text, visible, statsHtml = "") {
  resultLabel.textContent = text;
  if (statsBox) {
    statsBox.innerHTML = statsHtml;
  }
  overlay.classList.toggle("show", visible);
}

function setPrompt(text) {
  if (promptLabel) {
    promptLabel.innerHTML = text;
  }
}

function setStartButtonVisible(visible) {
  if (!startButton) return;
  startButton.classList.toggle("hidden", !visible);
}

function setModeSelectVisible(visible) {
  if (!modeSelect) return;
  modeSelect.classList.toggle("hidden", !visible);
}

function syncModeUi() {
  if (!modeSingleButton || !modeTwoButton || !characterSelect) return;
  modeSingleButton.classList.toggle("active", state.mode === "single");
  modeTwoButton.classList.toggle("active", state.mode === "two");
  characterSelect.classList.toggle("hidden", state.mode !== "single");
  chooseLittleButton.classList.toggle("active", state.playerSide === "little");
  chooseBigButton.classList.toggle("active", state.playerSide === "big");
  
  // Show/hide mobile controls based on mode and player side
  const littleSide = document.getElementById("mobile-little");
  const bigSide = document.getElementById("mobile-big");
  const littleActions = document.getElementById("mobile-actions-little");
  const bigActions = document.getElementById("mobile-actions-big");
  
  if (littleSide && bigSide && littleActions && bigActions) {
    if (state.mode === "two") {
      // 2-player mode: show both sides (but this won't happen on phones)
      littleSide.classList.remove("hidden");
      bigSide.classList.remove("hidden");
      littleActions.classList.remove("hidden");
      bigActions.classList.remove("hidden");
    } else {
      // Single player: show only the chosen player's controls
      const isLittle = state.playerSide === "little";
      littleSide.classList.toggle("hidden", !isLittle);
      bigSide.classList.toggle("hidden", isLittle);
      littleActions.classList.toggle("hidden", !isLittle);
      bigActions.classList.toggle("hidden", isLittle);
    }
  }
}

function updateHealthBars() {
  // Health bars are now drawn on canvas, this function kept for compatibility
}

function drawHealthBars() {
  const cyber = isCyberTheme();
  const barWidth = Math.min(200, world.width * 0.22);
  const barHeight = 16;
  const padding = 15;
  const labelOffset = 18;
  
  // Little Fighter health bar (left side)
  const littleX = padding;
  const littleY = padding + labelOffset;
  
  // Label
  ctx.font = "bold 12px Fredoka, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = cyber ? "#a8b0cc" : "#3b415c";
  ctx.fillText("Little Fighter", littleX, padding + 12);
  
  // Bar background
  ctx.fillStyle = cyber ? "rgba(255, 255, 255, 0.1)" : "rgba(230, 235, 255, 0.9)";
  ctx.beginPath();
  ctx.roundRect(littleX, littleY, barWidth, barHeight, 8);
  ctx.fill();
  
  // Bar fill
  const littleFillWidth = (fighters.little.health / 100) * barWidth;
  if (littleFillWidth > 0) {
    const littleGrad = ctx.createLinearGradient(littleX, 0, littleX + barWidth, 0);
    if (cyber) {
      littleGrad.addColorStop(0, "#00f0ff");
      littleGrad.addColorStop(1, "#ff2afc");
    } else {
      littleGrad.addColorStop(0, "#ff7ad9");
      littleGrad.addColorStop(1, "#6bffde");
    }
    ctx.fillStyle = littleGrad;
    ctx.beginPath();
    ctx.roundRect(littleX, littleY, littleFillWidth, barHeight, 8);
    ctx.fill();
    
    if (cyber) {
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  
  // Big Fighter health bar (right side)
  const bigX = world.width - barWidth - padding;
  const bigY = padding + labelOffset;
  
  // Label
  ctx.textAlign = "right";
  ctx.fillStyle = cyber ? "#a8b0cc" : "#3b415c";
  ctx.fillText("Big Fighter", world.width - padding, padding + 12);
  
  // Bar background
  ctx.fillStyle = cyber ? "rgba(255, 255, 255, 0.1)" : "rgba(230, 235, 255, 0.9)";
  ctx.beginPath();
  ctx.roundRect(bigX, bigY, barWidth, barHeight, 8);
  ctx.fill();
  
  // Bar fill
  const bigFillWidth = (fighters.big.health / 100) * barWidth;
  if (bigFillWidth > 0) {
    const bigGrad = ctx.createLinearGradient(bigX, 0, bigX + barWidth, 0);
    if (cyber) {
      bigGrad.addColorStop(0, "#00f0ff");
      bigGrad.addColorStop(1, "#ff2afc");
    } else {
      bigGrad.addColorStop(0, "#ff7ad9");
      bigGrad.addColorStop(1, "#6bffde");
    }
    ctx.fillStyle = bigGrad;
    ctx.beginPath();
    ctx.roundRect(bigX, bigY, bigFillWidth, barHeight, 8);
    ctx.fill();
    
    if (cyber) {
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

function getStatsHtml() {
  return `
    <div><strong>Little Hits:</strong> ${fighters.little.hits}</div>
    <div><strong>Big Hits:</strong> ${fighters.big.hits}</div>
    <div><strong>Little Health:</strong> ${fighters.little.health}%</div>
    <div><strong>Big Health:</strong> ${fighters.big.health}%</div>
  `;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function startGame() {
  if (state.running) return;
  state.running = true;
  state.winner = null;
  state.readyScreen = false;
  startMusic();
  setStartButtonVisible(false);
  setModeSelectVisible(false);
  showOverlay("", false);
}

function announceWinner(name) {
  state.running = false;
  state.winner = name;
  state.awaitingConfirm = true;
  state.lockUntil = 0;
  state.confirmPromptShown = true;
  setPrompt("Tap or click <strong>Start</strong> to play again!");
  showOverlay(`${name} Wins!`, true, getStatsHtml());
  setStartButtonVisible(true);
  setModeSelectVisible(false);
  playWinSfx(name);
  spawnConfetti(120);
}

function startMusic() {
  if (!music) return;
  
  // Resume audio context (required for iOS after user interaction)
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  music.loop = true;
  music.play().catch(() => {});
}

function playReadySfx() {
  if (!readySfx) return;
  readySfx.currentTime = 0;
  readySfx.volume = 1.0;
  readySfx.play().catch(() => {});
}

function beginReadySequence() {
  if (state.running) return;
  resetFightersForFight();
  updateHealthBars();
  state.winner = null;
  state.awaitingConfirm = false;
  state.confirmPromptShown = false;
  state.readyScreen = true;
  setStartButtonVisible(false);
  setModeSelectVisible(false);
  setPrompt("Get ready!");
  showOverlay("", false);
  state.readyMessageUntil = Date.now() + 1400;
  playReadySfx();
  if (state.readyTimeoutId) {
    clearTimeout(state.readyTimeoutId);
  }
  state.readyTimeoutId = setTimeout(() => {
    startGame();
    state.readyTimeoutId = null;
  }, 1200);
}

function playHitSfx() {
  if (!hitSfx) return;
  if (!hitSfx.paused) return;
  hitSfx.currentTime = 0;
  hitSfx.volume = 1.0;
  hitSfx.play().catch(() => {});
}

function playWinSfx(name) {
  const winnerSound = name === "Little" ? littleWinsSfx : bigWinsSfx;
  if (!winnerSound) return;

  winnerSound.pause();
  winnerSound.currentTime = 0;
  winnerSound.volume = 1.0;

  if (!winnerPresound) {
    winnerSound.play().catch(() => {});
    return;
  }

  winnerPresound.pause();
  winnerPresound.currentTime = 0;
  // Volume controlled by Web Audio API gain node (0.15)
  winnerPresound.play().catch(() => {});
  winnerSound.play().catch(() => {});
}

function applyDamage(attacker, defender) {
  if (!state.running || state.winner) return;
  if (defender.hitFlash > 0) return;

  defender.health = clamp(defender.health - 10, 0, 100);
  attacker.hits += 1;
  defender.vx += attacker.facing * 6;
  defender.vy -= 6;
  defender.hitFlash = 12;
  state.screenShake = 10;
  spawnBurst(defender.x, defender.y - defender.height / 2, 18);
  spawnBurst(defender.x, defender.y - defender.height / 2, 12, "#ffffff");
  updateHealthBars();

  if (defender.health <= 0) {
    announceWinner(attacker.name);
  }
}

function spawnBurst(x, y, count, color = null) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 1.2) * 8,
      size: 4 + Math.random() * 6,
      life: 40 + Math.random() * 20,
      color: color || colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function spawnConfetti(count) {
  for (let i = 0; i < count; i += 1) {
    state.confetti.push({
      x: Math.random() * world.width,
      y: -50 - Math.random() * 200,
      vy: 2 + Math.random() * 3,
      vx: -1 + Math.random() * 2,
      size: 6 + Math.random() * 6,
      rotation: Math.random() * Math.PI,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function handleInput() {
  const little = fighters.little;
  const big = fighters.big;

  little.vx = 0;
  if (state.mode === "two" || state.playerSide === "little") {
    if (keys.has("KeyA")) {
      little.vx = -little.speed;
      little.facing = -1;
    }
    if (keys.has("KeyD")) {
      little.vx = little.speed;
      little.facing = 1;
    }
    if (keys.has("KeyW") && little.grounded) {
      little.vy = -little.jumpPower;
      little.grounded = false;
      spawnBurst(little.x, little.y - little.height / 2, 12, "#6bffde");
    }
    if (keys.has("KeyS") && little.dashCooldown <= 0) {
      little.vx += little.facing * little.dashPower;
      little.dashCooldown = 30;
      spawnBurst(little.x, little.y - little.height / 2, 8, "#ffd53d");
    }
  }

  big.vx = 0;
  if (state.mode === "two" || state.playerSide === "big") {
    if (keys.has("ArrowLeft")) {
      big.vx = -big.speed;
      big.facing = -1;
    }
    if (keys.has("ArrowRight")) {
      big.vx = big.speed;
      big.facing = 1;
    }
    if (keys.has("ArrowUp") && big.grounded) {
      big.vy = -big.jumpPower;
      big.grounded = false;
      spawnBurst(big.x, big.y - big.height / 2, 12, "#ff7ad9");
    }
    if (keys.has("ArrowDown") && big.dashCooldown <= 0) {
      big.vx += big.facing * big.dashPower;
      big.dashCooldown = 30;
      spawnBurst(big.x, big.y - big.height / 2, 8, "#ffd53d");
    }
  }
}

function updateBot() {
  if (state.mode !== "single" || !state.running) return;
  const bot = state.playerSide === "little" ? fighters.big : fighters.little;
  const player = state.playerSide === "little" ? fighters.little : fighters.big;

  bot.vx = 0;
  const distance = player.x - bot.x;
  if (Math.abs(distance) > 260) {
    bot.vx = Math.sign(distance) * bot.speed * 0.16;
    bot.facing = Math.sign(distance) || bot.facing;
  } else if (Math.random() < 0.008) {
    bot.vx = Math.sign(distance) * bot.speed * 0.1;
  }

  if (bot.grounded && Math.random() < 0.002) {
    bot.vy = -bot.jumpPower * 0.45;
    bot.grounded = false;
  }

  if (bot.dashCooldown <= 0 && Math.random() < 0.002) {
    bot.vx += bot.facing * bot.dashPower * 0.15;
    bot.dashCooldown = 110;
  }

  if (bot.attackCooldown === 0 && Math.abs(distance) < 260 && Math.random() < 0.06) {
    tryAttack(bot, player);
  }
}

function tryAttack(attacker, defender) {
  if (!state.running || state.winner) return;
  if (attacker.attackCooldown > 0) return;
  attacker.attackCooldown = 24;
  attacker.glow = 10;
  playHitSfx();

  const attackerWidth = attacker.drawWidth || attacker.width;
  const defenderWidth = defender.drawWidth || defender.width;
  const defenderHeight = defender.drawHeight || defender.height;
  const attackRange = attackerWidth * 0.7;
  const hitX = attacker.x + attacker.facing * attackRange;
  const horizontalDist = Math.abs(attacker.x - defender.x);
  const verticalDist = Math.abs(attacker.y - defender.y);
  const overlapHit = horizontalDist < (attackerWidth + defenderWidth) * 0.35;
  const rangedHit = Math.abs(hitX - defender.x) < defenderWidth * 0.6;

  if ((overlapHit || rangedHit) && verticalDist < defenderHeight * 0.6) {
    applyDamage(attacker, defender);
  } else {
    spawnBurst(attacker.x + attacker.facing * 60, attacker.y - attacker.height / 2, 8, "#ffffff");
  }
}

function updateFighter(fighter) {
  fighter.vy += 0.9;
  fighter.x += fighter.vx;
  fighter.y += fighter.vy;

  const halfWidth = Math.max(60, (fighter.drawWidth || fighter.width) / 2);
  fighter.x = clamp(fighter.x, halfWidth, world.width - halfWidth);

  if (fighter.y >= world.floor) {
    fighter.y = world.floor;
    fighter.vy = 0;
    fighter.grounded = true;
  }

  fighter.attackCooldown = Math.max(0, fighter.attackCooldown - 1);
  fighter.dashCooldown = Math.max(0, fighter.dashCooldown - 1);
  fighter.glow = Math.max(0, fighter.glow - 1);
  fighter.hitFlash = Math.max(0, fighter.hitFlash - 1);
}

function updateParticles() {
  state.particles = state.particles.filter((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.25;
    particle.life -= 1;
    return particle.life > 0;
  });

  state.confetti = state.confetti.filter((piece) => {
    piece.x += piece.vx;
    piece.y += piece.vy;
    piece.rotation += 0.1;
    return piece.y < world.height + 40;
  });
}

function isCyberTheme() {
  return document.body.classList.contains("theme-cyber");
}

function drawBackground() {
  const cyber = isCyberTheme();
  const gradient = ctx.createLinearGradient(0, 0, 0, world.height);
  
  if (cyber) {
    gradient.addColorStop(0, "#0a001a");
    gradient.addColorStop(0.3, "#1a0a3d");
    gradient.addColorStop(0.7, "#0d0d2a");
    gradient.addColorStop(1, "#050510");
  } else {
    gradient.addColorStop(0, "#89e0ff");
    gradient.addColorStop(0.55, "#bfffd9");
    gradient.addColorStop(1, "#fff2b4");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, world.width, world.height);

  if (cyber) {
    // Animated stars/data particles
    for (let i = 0; i < 40; i++) {
      const x = (i * 37 + state.time * 0.3) % world.width;
      const y = (i * 23 + state.time * 0.1) % (world.floor - 50);
      const size = 1 + Math.sin(state.time * 0.05 + i) * 0.5;
      const alpha = 0.3 + Math.sin(state.time * 0.08 + i * 2) * 0.3;
      ctx.fillStyle = i % 3 === 0 ? `rgba(255, 42, 252, ${alpha})` : `rgba(0, 240, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // City skyline silhouette
    ctx.fillStyle = "#0a0a18";
    const buildings = [
      { x: 0, w: 60, h: 120 },
      { x: 55, w: 40, h: 80 },
      { x: 90, w: 50, h: 140 },
      { x: 135, w: 35, h: 100 },
      { x: 165, w: 55, h: 160 },
      { x: 215, w: 45, h: 90 },
      { x: 255, w: 60, h: 130 },
      { x: 310, w: 40, h: 110 },
      { x: 345, w: 50, h: 150 },
      { x: 390, w: 35, h: 85 },
      { x: 420, w: 55, h: 170 },
      { x: 470, w: 45, h: 95 },
      { x: 510, w: 60, h: 125 },
      { x: 565, w: 40, h: 145 },
      { x: 600, w: 50, h: 100 },
      { x: 645, w: 55, h: 155 },
      { x: 695, w: 45, h: 115 },
      { x: 735, w: 60, h: 135 },
      { x: 790, w: 40, h: 90 },
      { x: 825, w: 50, h: 165 },
      { x: 870, w: 55, h: 105 },
      { x: 920, w: 45, h: 140 },
      { x: 960, w: 60, h: 120 },
      { x: 1015, w: 50, h: 150 },
      { x: 1060, w: 45, h: 95 },
    ];
    buildings.forEach((b) => {
      ctx.fillRect(b.x, world.floor - b.h + 40, b.w, b.h + 40);
    });

    // Building windows (randomly lit)
    buildings.forEach((b, bi) => {
      for (let wy = world.floor - b.h + 50; wy < world.floor + 20; wy += 18) {
        for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 12) {
          const lit = Math.sin(bi * 7 + wx * 0.1 + wy * 0.05 + state.time * 0.02) > 0.3;
          if (lit) {
            const flicker = 0.4 + Math.sin(state.time * 0.1 + wx + wy) * 0.2;
            const isNeon = (bi + Math.floor(wx / 12)) % 5 === 0;
            ctx.fillStyle = isNeon 
              ? `rgba(255, 42, 252, ${flicker})` 
              : `rgba(0, 240, 255, ${flicker * 0.6})`;
            ctx.fillRect(wx, wy, 6, 10);
          }
        }
      }
    });

    // Perspective grid floor
    ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
    ctx.lineWidth = 1;
    const horizon = world.floor - 60;
    const floorY = world.floor + 20;
    // Horizontal lines with perspective
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const y = horizon + (floorY - horizon) * Math.pow(t, 0.7);
      const alpha = 0.1 + t * 0.2;
      ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(world.width, y);
      ctx.stroke();
    }
    // Vertical lines converging
    const vanishX = world.width / 2;
    for (let i = -15; i <= 15; i++) {
      const bottomX = vanishX + i * 50;
      const topX = vanishX + i * 8;
      ctx.strokeStyle = `rgba(255, 42, 252, ${0.08 + Math.abs(i) * 0.01})`;
      ctx.beginPath();
      ctx.moveTo(topX, horizon);
      ctx.lineTo(bottomX, floorY + 60);
      ctx.stroke();
    }

    // Neon glow strip at horizon
    const glowGrad = ctx.createLinearGradient(0, horizon - 20, 0, horizon + 40);
    glowGrad.addColorStop(0, "rgba(255, 42, 252, 0)");
    glowGrad.addColorStop(0.4, "rgba(255, 42, 252, 0.3)");
    glowGrad.addColorStop(0.6, "rgba(0, 240, 255, 0.25)");
    glowGrad.addColorStop(1, "rgba(0, 240, 255, 0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, horizon - 20, world.width, 60);

    // Animated scan line
    const scanY = (state.time * 2) % world.height;
    ctx.fillStyle = "rgba(0, 240, 255, 0.08)";
    ctx.fillRect(0, scanY, world.width, 3);

    // Floor
    const floorGrad = ctx.createLinearGradient(0, world.floor, 0, world.height);
    floorGrad.addColorStop(0, "#0a0a20");
    floorGrad.addColorStop(1, "#050510");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, world.floor + 20, world.width, world.height - world.floor);
    
    // Glowing floor edge
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(0, world.floor + 18, world.width, 3);
    ctx.shadowBlur = 0;

  } else {
    // Clouds for game theme
    for (let i = 0; i < 10; i += 1) {
      const x = 60 + i * 100;
      const y = 80 + Math.sin(state.time * 0.02 + i) * 8;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.arc(x + 24, y + 8, 18, 0, Math.PI * 2);
      ctx.arc(x - 26, y + 6, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    // Grass
    ctx.fillStyle = "#7edc79";
    ctx.fillRect(0, world.floor + 20, world.width, world.height - world.floor);
    ctx.fillStyle = "#5ccf77";
    for (let i = 0; i < world.width; i += 40) {
      ctx.fillRect(i, world.floor + 10, 20, 10);
    }
  }
}

function drawArenaGlow() {
  ctx.save();
  if (isCyberTheme()) {
    ctx.globalAlpha = 0.4;
    ctx.shadowColor = "#ff2afc";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#ff2afc";
  } else {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#ffffff";
  }
  ctx.beginPath();
  ctx.ellipse(world.width / 2, world.floor + 40, 420, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFighter(fighter) {
  const bob = Math.sin(state.time * 0.1 + fighter.x * 0.01) * 3;
  if (fighter.image.naturalWidth && fighter.drawWidth === fighter.width) {
    updateFighterSize(fighter);
  }
  const drawWidth = fighter.drawWidth || fighter.width;
  const drawHeight = fighter.drawHeight || fighter.height;

  ctx.save();
  ctx.translate(fighter.x, fighter.y + bob);
  ctx.scale(fighter.facing * fighter.flip, 1);

  if (fighter.glow > 0) {
    ctx.shadowColor = fighter.color;
    ctx.shadowBlur = 30;
  }

  if (fighter.hitFlash > 0) {
    const intensity = fighter.hitFlash / 12;
    const radius = Math.max(drawWidth, drawHeight) * 0.6;
    const gradient = ctx.createRadialGradient(0, -drawHeight * 0.6, 10, 0, -drawHeight * 0.6, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${0.75 * intensity})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, -drawHeight * 0.6, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.drawImage(fighter.image, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);

  ctx.restore();
}

function drawParticles() {
  state.particles.forEach((particle) => {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life / 60);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  state.confetti.forEach((piece) => {
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation);
    ctx.fillStyle = piece.color;
    ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
    ctx.restore();
  });
}

function drawHitline(attacker) {
  if (attacker.attackCooldown < 20 && attacker.attackCooldown > 15) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(attacker.x, attacker.y - attacker.height * 0.7);
    ctx.lineTo(attacker.x + attacker.facing * 120, attacker.y - attacker.height * 0.5);
    ctx.stroke();
    ctx.restore();
  }
}

function update() {
  state.time += 1;

  if (state.awaitingConfirm && !state.confirmPromptShown) {
    state.confirmPromptShown = true;
    setPrompt("Tap or click <strong>Start</strong> to play again!");
  }

  if (state.running) {
    handleInput();
    updateBot();

    updateFighter(fighters.little);
    updateFighter(fighters.big);
  }

  updateParticles();
}

function draw() {
  const shake = state.screenShake;
  if (state.screenShake > 0) {
    state.screenShake -= 1;
  }

  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  drawBackground();
  drawArenaGlow();
  drawHealthBars();
  drawParticles();

  drawFighter(fighters.little);
  drawFighter(fighters.big);

  drawHitline(fighters.little);
  drawHitline(fighters.big);

  if (state.readyMessageUntil && Date.now() < state.readyMessageUntil) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#ff4f8b";
    ctx.font = "bold 36px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NEW FIGHT STARTS NOW!", world.width / 2, 175);
    ctx.fillStyle = "#181a33";
    ctx.font = "bold 28px Fredoka, sans-serif";
    ctx.fillText("ARE YOU READY?", world.width / 2, 212);
    ctx.restore();
  }

  ctx.restore();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);

  if ((event.code === "Space" || event.code === "Enter") && event.repeat) {
    return;
  }

  if (state.running) {
    if ((state.mode === "two" || state.playerSide === "little") && event.code === "Space") {
      tryAttack(fighters.little, fighters.big);
    }
    if ((state.mode === "two" || state.playerSide === "big") && event.code === "Enter") {
      tryAttack(fighters.big, fighters.little);
    }
  }

    if (!state.running && (event.code === "Space" || event.code === "Enter")) {
      if (state.awaitingConfirm) {
        return;
      }
      beginReadySequence();
    }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

if (mobileControls) {
  mobileControls.querySelectorAll("[data-key]").forEach((button) => {
    const key = button.dataset.key;
    const press = (event) => {
      event.preventDefault();
      keys.add(key);
      if (state.running) {
        if ((state.mode === "two" || state.playerSide === "little") && key === "Space") {
          tryAttack(fighters.little, fighters.big);
        }
        if ((state.mode === "two" || state.playerSide === "big") && key === "Enter") {
          tryAttack(fighters.big, fighters.little);
        }
      }
    };
    const release = (event) => {
      event.preventDefault();
      keys.delete(key);
    };
    button.addEventListener("touchstart", press, { passive: false });
    button.addEventListener("touchend", release, { passive: false });
    button.addEventListener("touchcancel", release, { passive: false });
    button.addEventListener("mousedown", press);
    button.addEventListener("mouseup", release);
    button.addEventListener("mouseleave", release);
  });
}

startButton.addEventListener("click", () => {
  initAudio();
  if (state.awaitingConfirm) {
    resetGame();
    beginReadySequence();
    return;
  }
  beginReadySequence();
});

function isPhone() {
  return window.innerWidth <= 768 && 'ontouchstart' in window;
}

modeSingleButton.addEventListener("click", () => {
  state.mode = "single";
  syncModeUi();
});

modeTwoButton.addEventListener("click", () => {
  if (isPhone()) {
    alert("2 Players mode is only available on tablet or computer.");
    return;
  }
  state.mode = "two";
  syncModeUi();
});

chooseLittleButton.addEventListener("click", () => {
  state.playerSide = "little";
  syncModeUi();
});

chooseBigButton.addEventListener("click", () => {
  state.playerSide = "big";
  syncModeUi();
});

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
setTheme("game");
resetGame();
loop();

function setTheme(theme) {
  document.body.classList.toggle("theme-cyber", theme === "cyber");
  if (themeGameButton && themeCyberButton) {
    themeGameButton.classList.toggle("active", theme === "game");
    themeCyberButton.classList.toggle("active", theme === "cyber");
  }
}

if (themeGameButton) {
  themeGameButton.addEventListener("click", () => setTheme("game"));
}
if (themeCyberButton) {
  themeCyberButton.addEventListener("click", () => setTheme("cyber"));
}
