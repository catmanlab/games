/**
 * Cat vs Dog Battle — main game logic
 */
(() => {
  const KEYS = {};
  let gameRunning = false;
  let gameLoop = null;
  let cat, dog, crowd;
  let matchTimer = 60;
  let timerInterval = null;

  const startScreen = document.getElementById('start-screen');
  const gameContainer = document.getElementById('game-container');
  const winScreen = document.getElementById('win-screen');
  const charsLayer = document.getElementById('characters-layer');
  const effectsLayer = document.getElementById('effects-layer');
  const itemsLayer = document.getElementById('items-layer');
  const crowdLayer = document.getElementById('crowd');

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', () => {
    winScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
  });

  document.addEventListener('keydown', e => {
    KEYS[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  document.addEventListener('keyup', e => { KEYS[e.code] = false; });

  function startGame() {
    AudioFX.init();
    startScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    winScreen.classList.add('hidden');

    charsLayer.innerHTML = '';
    effectsLayer.innerHTML = '';
    itemsLayer.innerHTML = '';
    crowdLayer.innerHTML = '';

    cat = new Fighter('cat', 200);
    dog = new Fighter('dog', 700);
    charsLayer.appendChild(cat.el);
    charsLayer.appendChild(dog.el);

    crowd = new CrowdManager(crowdLayer);

    matchTimer = 60;
    gameRunning = true;
    updateHUD();

    if (gameLoop) cancelAnimationFrame(gameLoop);
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      if (!gameRunning) return;
      matchTimer--;
      document.getElementById('timer').textContent = matchTimer;
      if (matchTimer <= 0) endGame('timeout');
    }, 1000);

    showAnnouncement('🥊 Fight!');
    AudioFX.crowdCheer();
    loop();
  }

  function loop() {
    if (!gameRunning) return;

    handleInput();
    cat.update();
    dog.update();
    crowd.update(itemsLayer);
    crowd.checkPickups(cat, dog);
    updateHUD();
    checkWin();

    gameLoop = requestAnimationFrame(loop);
  }

  function handleInput() {
    // 猫 — WASD
    let cx = 0, cy = 0;
    if (KEYS['KeyA']) cx -= 1;
    if (KEYS['KeyD']) cx += 1;
    if (KEYS['KeyW']) cy -= 1;
    if (KEYS['KeyS']) cy += 1;
    if (cx !== 0 && cy !== 0) { cx *= 0.707; cy *= 0.707; }
    cat.move(cx, cy);

    if (KEYS['Space']) cat.basicAttack(dog);
    if (KEYS['KeyQ']) cat.useSpecial(0, dog, effectsLayer);
    if (KEYS['KeyE']) cat.useSpecial(1, dog, effectsLayer);
    if (KEYS['KeyR']) cat.useSpecial(2, dog, effectsLayer);

    // 狗 — 方向键
    let dx = 0, dy = 0;
    if (KEYS['ArrowLeft']) dx -= 1;
    if (KEYS['ArrowRight']) dx += 1;
    if (KEYS['ArrowUp']) dy -= 1;
    if (KEYS['ArrowDown']) dy += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
    dog.move(dx, dy);

    if (KEYS['Enter']) dog.basicAttack(cat);
    if (KEYS['Digit1']) dog.useSpecial(0, cat, effectsLayer);
    if (KEYS['Digit2']) dog.useSpecial(1, cat, effectsLayer);
    if (KEYS['Digit3']) dog.useSpecial(2, cat, effectsLayer);
  }

  function updateHUD() {
    document.getElementById('cat-hp-bar').style.width = `${(cat.hp / cat.maxHp) * 100}%`;
    document.getElementById('dog-hp-bar').style.width = `${(dog.hp / dog.maxHp) * 100}%`;
    document.getElementById('cat-score').textContent = `${cat.score} pts`;
    document.getElementById('dog-score').textContent = `${dog.score} pts`;
  }

  function checkWin() {
    if (cat.hp <= 0) endGame('dog');
    else if (dog.hp <= 0) endGame('cat');
  }

  function endGame(winner) {
    if (!gameRunning) return;
    gameRunning = false;
    clearInterval(timerInterval);

    let title, subtitle;
    if (winner === 'cat') {
      title = '🐱 Captain Cat Wins! Meow~~';
      subtitle = `Cat ${cat.score} pts vs Dog ${dog.score} pts`;
    } else if (winner === 'dog') {
      title = '🐶 Captain Dog Wins! Woof!!';
      subtitle = `Dog ${dog.score} pts vs Cat ${cat.score} pts`;
    } else {
      if (cat.score > dog.score) {
        title = "⏰ Time's Up! 🐱 Cat Wins on Points!";
      } else if (dog.score > cat.score) {
        title = "⏰ Time's Up! 🐶 Dog Wins on Points!";
      } else {
        title = "⏰ Time's Up! It's a Tie!";
      }
      subtitle = `Cat ${cat.score} pts vs Dog ${dog.score} pts`;
    }

    AudioFX.win();
    setTimeout(() => {
      gameContainer.classList.add('hidden');
      winScreen.classList.remove('hidden');
      document.getElementById('winner-text').textContent = title;
      document.getElementById('final-scores').textContent = subtitle;
    }, 1000);
  }
})();
