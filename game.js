const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const resultLabel = document.getElementById("result");
const promptLabel = document.getElementById("prompt");
const statsBox = document.getElementById("stats");
const startButton = document.getElementById("start-button");
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
const restartButton = document.getElementById("restart");
const littleHealthBar = document.getElementById("little-health");
const bigHealthBar = document.getElementById("big-health");

const assets = {
  little: new Image(),
  big: new Image(),
};

assets.little.src = "little fighter.png";
assets.big.src = "big fighter.png";

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
  fighters.little.x = 220;
  fighters.little.y = world.floor;
  fighters.little.vx = 0;
  fighters.little.vy = 0;
  fighters.little.facing = 1;
  fighters.little.health = 100;
  fighters.little.attackCooldown = 0;
  fighters.little.dashCooldown = 0;
  fighters.little.hitFlash = 0;
  fighters.little.hits = 0;

  fighters.big.x = world.width - 260;
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
}

function updateHealthBars() {
  littleHealthBar.style.width = `${fighters.little.health}%`;
  bigHealthBar.style.width = `${fighters.big.health}%`;
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
  music.volume = 0.06;
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
  hitSfx.volume = 0.6;
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
  winnerPresound.volume = 0.6;
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
  if (Math.abs(distance) > 240) {
    bot.vx = Math.sign(distance) * bot.speed * 0.22;
    bot.facing = Math.sign(distance) || bot.facing;
  } else if (Math.random() < 0.01) {
    bot.vx = Math.sign(distance) * bot.speed * 0.12;
  }

  if (bot.grounded && Math.random() < 0.003) {
    bot.vy = -bot.jumpPower * 0.5;
    bot.grounded = false;
  }

  if (bot.dashCooldown <= 0 && Math.random() < 0.003) {
    bot.vx += bot.facing * bot.dashPower * 0.2;
    bot.dashCooldown = 90;
  }

  if (bot.attackCooldown === 0 && Math.abs(distance) < 240 && Math.random() < 0.09) {
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

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, world.height);
  gradient.addColorStop(0, "#89e0ff");
  gradient.addColorStop(0.55, "#bfffd9");
  gradient.addColorStop(1, "#fff2b4");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, world.width, world.height);

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

  ctx.fillStyle = "#7edc79";
  ctx.fillRect(0, world.floor + 20, world.width, world.height - world.floor);

  ctx.fillStyle = "#5ccf77";
  for (let i = 0; i < world.width; i += 40) {
    ctx.fillRect(i, world.floor + 10, 20, 10);
  }
}

function drawArenaGlow() {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#ffffff";
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

restartButton.addEventListener("click", () => {
  resetGame();
  startMusic();
});

startButton.addEventListener("click", () => {
  if (state.awaitingConfirm) {
    resetGame();
    beginReadySequence();
    return;
  }
  beginReadySequence();
});

modeSingleButton.addEventListener("click", () => {
  state.mode = "single";
  syncModeUi();
});

modeTwoButton.addEventListener("click", () => {
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

resetGame();
loop();
