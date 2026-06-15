/**
 * SVG 猫狗角色与绝招动画
 */
const CHAR_W = 70;
const CHAR_H = 80;
const GROUND_Y = 420;
const GRAVITY = 0.55;
const JUMP_FORCE = -11;

function createCatSVG() {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.innerHTML = `
    <!-- 尾巴 -->
    <path class="cat-tail" d="M 10 55 Q -15 30 -5 15 Q 0 5 8 20" fill="none" stroke="#FF8C42" stroke-width="6" stroke-linecap="round"/>
    <!-- 身体 -->
    <ellipse cx="35" cy="50" rx="28" ry="22" fill="#FF8C42"/>
    <!-- 肚子 -->
    <ellipse cx="35" cy="55" rx="16" ry="12" fill="#FFD4A8"/>
    <!-- 头 -->
    <circle cx="35" cy="22" r="22" fill="#FF8C42"/>
    <!-- 耳朵 -->
    <polygon points="15,8 20,0 28,10" fill="#FF8C42"/>
    <polygon points="55,8 50,0 42,10" fill="#FF8C42"/>
    <polygon points="17,7 20,2 25,9" fill="#FFB088"/>
    <polygon points="53,7 50,2 45,9" fill="#FFB088"/>
    <!-- 眼睛 -->
    <ellipse class="cat-eye-l" cx="26" cy="20" rx="5" ry="6" fill="#fff"/>
    <ellipse class="cat-eye-r" cx="44" cy="20" rx="5" ry="6" fill="#fff"/>
    <ellipse class="cat-pupil-l" cx="27" cy="21" rx="2.5" ry="3.5" fill="#333"/>
    <ellipse class="cat-pupil-r" cx="45" cy="21" rx="2.5" ry="3.5" fill="#333"/>
    <!-- 鼻子 -->
    <polygon points="35,26 32,30 38,30" fill="#FF6B8A"/>
    <!-- 嘴巴 -->
    <path d="M 35 30 Q 30 34 27 32" fill="none" stroke="#333" stroke-width="1.5"/>
    <path d="M 35 30 Q 40 34 43 32" fill="none" stroke="#333" stroke-width="1.5"/>
    <!-- 胡须 -->
    <line x1="10" y1="24" x2="22" y2="25" stroke="#333" stroke-width="1"/>
    <line x1="10" y1="28" x2="22" y2="28" stroke="#333" stroke-width="1"/>
    <line x1="48" y1="25" x2="60" y2="24" stroke="#333" stroke-width="1"/>
    <line x1="48" y1="28" x2="60" y2="28" stroke="#333" stroke-width="1"/>
    <!-- 爪子 -->
    <ellipse cx="18" cy="68" rx="8" ry="5" fill="#FF8C42"/>
    <ellipse cx="52" cy="68" rx="8" ry="5" fill="#FF8C42"/>
    <!-- 护盾（隐藏） -->
    <circle class="shield-ring" cx="35" cy="40" r="45" fill="none" stroke="#88CCFF" stroke-width="3" opacity="0" stroke-dasharray="8,4"/>
  `;
  return g;
}

function createDogSVG() {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.innerHTML = `
    <!-- 尾巴 -->
    <path class="dog-tail" d="M 60 50 Q 80 30 75 15 Q 72 5 65 18" fill="none" stroke="#C68642" stroke-width="6" stroke-linecap="round"/>
    <!-- 身体 -->
    <ellipse cx="35" cy="50" rx="30" ry="24" fill="#C68642"/>
    <!-- 肚子 -->
    <ellipse cx="35" cy="56" rx="18" ry="13" fill="#E8C99B"/>
    <!-- 头 -->
    <ellipse cx="35" cy="24" rx="24" ry="22" fill="#C68642"/>
    <!-- 耳朵（耷拉） -->
    <ellipse cx="14" cy="22" rx="10" ry="16" fill="#A06830" transform="rotate(-20 14 22)"/>
    <ellipse cx="56" cy="22" rx="10" ry="16" fill="#A06830" transform="rotate(20 56 22)"/>
    <!-- 眼睛 -->
    <circle class="dog-eye-l" cx="25" cy="20" r="5" fill="#fff"/>
    <circle class="dog-eye-r" cx="45" cy="20" r="5" fill="#fff"/>
    <circle class="dog-pupil-l" cx="26" cy="21" r="3" fill="#333"/>
    <circle class="dog-pupil-r" cx="46" cy="21" r="3" fill="#333"/>
    <!-- 鼻子 -->
    <ellipse cx="35" cy="30" rx="6" ry="4" fill="#333"/>
    <!-- 嘴巴 -->
    <path d="M 35 33 Q 28 40 22 36" fill="none" stroke="#333" stroke-width="2"/>
    <path d="M 35 33 Q 42 40 48 36" fill="none" stroke="#333" stroke-width="2"/>
    <ellipse cx="35" cy="36" rx="4" ry="3" fill="#FF8A8A"/>
    <!-- 爪子 -->
    <ellipse cx="16" cy="70" rx="9" ry="5" fill="#A06830"/>
    <ellipse cx="54" cy="70" rx="9" ry="5" fill="#A06830"/>
    <!-- 护盾 -->
    <circle class="shield-ring" cx="35" cy="40" r="45" fill="none" stroke="#88CCFF" stroke-width="3" opacity="0" stroke-dasharray="8,4"/>
  `;
  return g;
}

class Fighter {
  constructor(type, startX) {
    this.type = type; // 'cat' | 'dog'
    this.x = startX;
    this.y = GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.score = 0;
    this.facing = type === 'cat' ? 1 : -1;
    this.speed = 3.5;
    this.attackPower = 8;
    this.attackCooldown = 0;
    this.specialCooldowns = [0, 0, 0];
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.stunned = false;
    this.stunTimer = 0;
    this.slowed = false;
    this.slowTimer = 0;
    this.poisoned = false;
    this.poisonTimer = 0;
    this.powerBoost = 0;
    this.powerBoostTimer = 0;
    this.animState = 'idle';
    this.animTimer = 0;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.dashing = false;
    this.dashTimer = 0;
    this.dashDir = 0;
    this.onGround = true;

    this.el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.el.setAttribute('class', `fighter ${type}-fighter`);
    this.svg = type === 'cat' ? createCatSVG() : createDogSVG();
    this.el.appendChild(this.svg);
    this.updateTransform();
  }

  get hitbox() {
    return { x: this.x - 30, y: this.y - 70, w: 60, h: 75 };
  }

  updateTransform() {
    const scaleX = this.facing;
    this.el.setAttribute('transform', `translate(${this.x - CHAR_W / 2}, ${this.y - CHAR_H}) scale(${scaleX}, 1) translate(${CHAR_W / 2}, 0)`);
  }

  move(dx, dy) {
    if (this.stunned || this.dashing) return;
    const spd = this.slowed ? this.speed * 0.5 : this.speed;
    if (dx !== 0) {
      this.x += dx * spd;
      this.facing = dx > 0 ? 1 : -1;
    }
    if (dy < 0 && this.onGround) {
      this.vy = JUMP_FORCE;
      this.onGround = false;
    }
    this.x = Math.max(60, Math.min(840, this.x));
    this.updateTransform();
  }

  takeDamage(amount, attacker) {
    if (this.shieldActive || this.invincible) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.animState = 'hurt';
    this.animTimer = 15;
    this.el.style.animation = 'shake 0.3s ease';
    setTimeout(() => { this.el.style.animation = ''; }, 300);
    AudioFX.hurt();
    return true;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    AudioFX.heal();
  }

  addScore(pts) {
    this.score += pts;
    AudioFX.itemPickup();
  }

  canAttack() {
    return this.attackCooldown <= 0 && !this.stunned && !this.dashing;
  }

  basicAttack(opponent) {
    if (!this.canAttack()) return;
    this.attackCooldown = 25;
    this.animState = 'attack';
    this.animTimer = 12;
    const dist = Math.abs(this.x - opponent.x);
    const facingOpponent = (opponent.x - this.x) * this.facing > 0;
    if (dist < 80 && facingOpponent) {
      const dmg = this.attackPower + (this.powerBoost > 0 ? 5 : 0);
      if (opponent.takeDamage(dmg, this)) {
        this.addScore(10);
        showDamageText(opponent.x, opponent.y - 80, `-${dmg}`, '#FF4444');
      }
    }
    if (this.type === 'cat') AudioFX.meow();
    else AudioFX.bark();
    AudioFX.punch();
  }

  useSpecial(index, opponent, effectsLayer) {
    if (this.specialCooldowns[index] > 0 || this.stunned) return;
    const names = this.type === 'cat'
      ? ['Claw Tornado', 'Nine Lives Rush', 'Purr Shield']
      : ['Bark Wave', 'Bone Charge', 'Tail Spin'];
    showAnnouncement(`${this.type === 'cat' ? '🐱' : '🐶'} ${names[index]}！`);

    switch (index) {
      case 0: this.special0(opponent, effectsLayer); break;
      case 1: this.special1(opponent, effectsLayer); break;
      case 2: this.special2(opponent, effectsLayer); break;
    }
    AudioFX.special();
  }

  // 猫: 喵爪旋风 / 狗: 汪汪声波
  special0(opponent, layer) {
    this.specialCooldowns[0] = 180;
    this.animState = 'special0';
    this.animTimer = 40;
    this.invincible = true;
    this.invincibleTimer = 40;

    if (this.type === 'cat') {
      // 旋风斩 — 范围伤害
      spawnClawTornado(this.x, this.y - 30, layer, this.facing);
      const dist = Math.hypot(this.x - opponent.x, this.y - opponent.y);
      if (dist < 120) {
        opponent.takeDamage(18, this);
        showDamageText(opponent.x, opponent.y - 80, '-18', '#FF6600');
        this.addScore(20);
      }
    } else {
      // 声波 — 锥形冲击
      spawnSonicWave(this.x, this.y - 30, layer, this.facing);
      const dist = Math.abs(this.x - opponent.x);
      const facingOpp = (opponent.x - this.x) * this.facing > 0;
      if (dist < 150 && facingOpp) {
        opponent.takeDamage(15, this);
        opponent.stunned = true;
        opponent.stunTimer = 40;
        showDamageText(opponent.x, opponent.y - 80, '-15 STUN!', '#FF6600');
        this.addScore(20);
        AudioFX.stun();
      }
    }
  }

  // 猫: 九命突击 / 狗: 骨头冲撞
  special1(opponent, layer) {
    this.specialCooldowns[1] = 200;
    this.dashing = true;
    this.dashTimer = 20;
    this.dashDir = this.facing;
    this.invincible = true;
    this.invincibleTimer = 20;
    this.animState = 'dash';

    if (this.type === 'cat') {
      spawnDashTrail(this.x, this.y - 30, layer, '#FF8C42');
    } else {
      spawnBoneCharge(this.x, this.y - 30, layer, this.facing);
    }

    setTimeout(() => {
      const dist = Math.abs(this.x - opponent.x);
      if (dist < 90) {
        const dmg = this.type === 'cat' ? 22 : 25;
        opponent.takeDamage(dmg, this);
        showDamageText(opponent.x, opponent.y - 80, `-${dmg}`, '#FF3300');
        this.addScore(25);
        // 击退
        opponent.x += this.facing * 40;
        opponent.x = Math.max(60, Math.min(840, opponent.x));
        opponent.updateTransform();
      }
    }, 200);
  }

  // 猫: 呼噜护盾 / 狗: 摇尾迷惑
  special2(opponent, layer) {
    this.specialCooldowns[2] = 250;

    if (this.type === 'cat') {
      this.shieldActive = true;
      this.shieldTimer = 180;
      this.svg.querySelector('.shield-ring').setAttribute('opacity', '0.7');
      spawnShieldAura(this.x, this.y - 30, layer);
      AudioFX.shield();
      showAnnouncement('🐱 Purr Shield activated!');
    } else {
      this.animState = 'special2';
      this.animTimer = 50;
      spawnConfuseStars(opponent.x, opponent.y - 50, layer);
      opponent.stunned = true;
      opponent.stunTimer = 80;
      opponent.slowed = true;
      opponent.slowTimer = 120;
      showAnnouncement('🐶 Tail Spin! Opponent dazed!');
      AudioFX.stun();
      this.addScore(15);
    }
  }

  update() {
    // 冷却
    if (this.attackCooldown > 0) this.attackCooldown--;
    this.specialCooldowns = this.specialCooldowns.map(c => Math.max(0, c - 1));

    // 状态计时
    if (this.shieldTimer > 0) {
      this.shieldTimer--;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        this.svg.querySelector('.shield-ring').setAttribute('opacity', '0');
      }
    }
    if (this.stunTimer > 0) { this.stunTimer--; if (this.stunTimer <= 0) this.stunned = false; }
    if (this.slowTimer > 0) { this.slowTimer--; if (this.slowTimer <= 0) this.slowed = false; }
    if (this.invincibleTimer > 0) { this.invincibleTimer--; if (this.invincibleTimer <= 0) this.invincible = false; }
    if (this.powerBoostTimer > 0) { this.powerBoostTimer--; if (this.powerBoostTimer <= 0) this.powerBoost = 0; }
    if (this.poisonTimer > 0) {
      this.poisonTimer--;
      if (this.poisonTimer % 30 === 0) {
        this.hp = Math.max(0, this.hp - 3);
        showDamageText(this.x, this.y - 90, '-3☠', '#88FF00');
      }
      if (this.poisonTimer <= 0) this.poisoned = false;
    }

    // 重力与落地
    if (!this.onGround) {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y >= GROUND_Y) {
        this.y = GROUND_Y;
        this.vy = 0;
        this.onGround = true;
      }
      this.updateTransform();
    }

    // 冲刺
    if (this.dashing) {
      this.x += this.dashDir * 12;
      this.x = Math.max(60, Math.min(840, this.x));
      this.dashTimer--;
      if (this.dashTimer <= 0) this.dashing = false;
      this.updateTransform();
    }

    // 动画
    if (this.animTimer > 0) {
      this.animTimer--;
      if (this.animTimer <= 0) this.animState = 'idle';
    }

    // 尾巴摇摆
    const tail = this.svg.querySelector(this.type === 'cat' ? '.cat-tail' : '.dog-tail');
    if (tail && this.animState === 'idle') {
      const wag = Math.sin(Date.now() / 200) * 5;
      tail.setAttribute('transform', `rotate(${wag})`);
    }
  }
}

/* ===== 特效生成 ===== */

function showDamageText(x, y, text, color) {
  const layer = document.getElementById('effects-layer');
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x', x);
  t.setAttribute('y', y);
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('fill', color);
  t.setAttribute('font-size', '22');
  t.setAttribute('class', 'damage-text');
  t.textContent = text;
  layer.appendChild(t);
  setTimeout(() => t.remove(), 1000);
}

function showAnnouncement(text) {
  const el = document.getElementById('announcement');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1200);
}

function spawnClawTornado(x, y, layer, facing) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${x}, ${y})`);
  for (let i = 0; i < 5; i++) {
    const claw = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    claw.setAttribute('x', '0');
    claw.setAttribute('y', '0');
    claw.setAttribute('font-size', '28');
    claw.setAttribute('text-anchor', 'middle');
    claw.textContent = '🐾';
    const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
    anim.setAttribute('attributeName', 'transform');
    anim.setAttribute('type', 'rotate');
    anim.setAttribute('from', `${i * 72} 0 0`);
    anim.setAttribute('to', `${i * 72 + 360} 0 0`);
    anim.setAttribute('dur', '0.6s');
    anim.setAttribute('repeatCount', '2');
    claw.appendChild(anim);
    const fade = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    fade.setAttribute('attributeName', 'opacity');
    fade.setAttribute('from', '1');
    fade.setAttribute('to', '0');
    fade.setAttribute('dur', '1.2s');
    fade.setAttribute('fill', 'freeze');
    claw.appendChild(fade);
    g.appendChild(claw);
  }
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('r', '5');
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', '#FF6600');
  ring.setAttribute('stroke-width', '3');
  const rAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
  rAnim.setAttribute('attributeName', 'r');
  rAnim.setAttribute('from', '5');
  rAnim.setAttribute('to', '60');
  rAnim.setAttribute('dur', '0.8s');
  rAnim.setAttribute('fill', 'freeze');
  ring.appendChild(rAnim);
  const oAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
  oAnim.setAttribute('attributeName', 'opacity');
  oAnim.setAttribute('from', '0.9');
  oAnim.setAttribute('to', '0');
  oAnim.setAttribute('dur', '0.8s');
  oAnim.setAttribute('fill', 'freeze');
  ring.appendChild(oAnim);
  g.appendChild(ring);
  layer.appendChild(g);
  setTimeout(() => g.remove(), 1300);
}

function spawnSonicWave(x, y, layer, facing) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${x}, ${y}) scale(${facing}, 1)`);
  for (let i = 0; i < 3; i++) {
    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arc.setAttribute('d', `M 10 ${-20 - i * 15} Q ${60 + i * 30} 0 10 ${20 + i * 15}`);
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', '#4FC3F7');
    arc.setAttribute('stroke-width', '4');
    arc.setAttribute('opacity', '0');
    const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    anim.setAttribute('attributeName', 'opacity');
    anim.setAttribute('from', '0.9');
    anim.setAttribute('to', '0');
    anim.setAttribute('dur', '0.6s');
    anim.setAttribute('begin', `${i * 0.1}s`);
    anim.setAttribute('fill', 'freeze');
    arc.appendChild(anim);
    g.appendChild(arc);
  }
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '50');
  text.setAttribute('y', '5');
  text.setAttribute('font-size', '24');
  text.textContent = 'WOOF!!';
  const fade = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
  fade.setAttribute('attributeName', 'opacity');
  fade.setAttribute('from', '1');
  fade.setAttribute('to', '0');
  fade.setAttribute('dur', '0.8s');
  fade.setAttribute('fill', 'freeze');
  text.appendChild(fade);
  const move = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
  move.setAttribute('attributeName', 'transform');
  move.setAttribute('type', 'translate');
  move.setAttribute('from', '0 0');
  move.setAttribute('to', `${facing * 80} 0`);
  move.setAttribute('dur', '0.8s');
  move.setAttribute('fill', 'freeze');
  text.appendChild(move);
  g.appendChild(text);
  layer.appendChild(g);
  AudioFX.bark();
  setTimeout(() => g.remove(), 1000);
}

function spawnDashTrail(x, y, layer, color) {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', x - i * 15);
      c.setAttribute('cy', y);
      c.setAttribute('r', '8');
      c.setAttribute('fill', color);
      c.setAttribute('opacity', '0.6');
      const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      anim.setAttribute('attributeName', 'opacity');
      anim.setAttribute('to', '0');
      anim.setAttribute('dur', '0.4s');
      anim.setAttribute('fill', 'freeze');
      c.appendChild(anim);
      layer.appendChild(c);
      setTimeout(() => c.remove(), 500);
    }, i * 30);
  }
}

function spawnBoneCharge(x, y, layer, facing) {
  const bone = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  bone.setAttribute('x', x);
  bone.setAttribute('y', y);
  bone.setAttribute('font-size', '36');
  bone.setAttribute('text-anchor', 'middle');
  bone.textContent = '🦴';
  const move = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
  move.setAttribute('attributeName', 'transform');
  move.setAttribute('type', 'translate');
  move.setAttribute('from', '0 0');
  move.setAttribute('to', `${facing * 100} 0`);
  move.setAttribute('dur', '0.4s');
  move.setAttribute('fill', 'freeze');
  bone.appendChild(move);
  const fade = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
  fade.setAttribute('attributeName', 'opacity');
  fade.setAttribute('from', '1');
  fade.setAttribute('to', '0');
  fade.setAttribute('dur', '0.5s');
  fade.setAttribute('begin', '0.3s');
  fade.setAttribute('fill', 'freeze');
  bone.appendChild(fade);
  layer.appendChild(bone);
  setTimeout(() => bone.remove(), 600);
}

function spawnShieldAura(x, y, layer) {
  for (let i = 0; i < 3; i++) {
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', x);
    ring.setAttribute('cy', y);
    ring.setAttribute('r', '10');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', '#88CCFF');
    ring.setAttribute('stroke-width', '2');
    const rAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    rAnim.setAttribute('attributeName', 'r');
    rAnim.setAttribute('from', '10');
    rAnim.setAttribute('to', '55');
    rAnim.setAttribute('dur', '1s');
    rAnim.setAttribute('begin', `${i * 0.3}s`);
    rAnim.setAttribute('fill', 'freeze');
    ring.appendChild(rAnim);
    const oAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    oAnim.setAttribute('attributeName', 'opacity');
    oAnim.setAttribute('from', '0.8');
    oAnim.setAttribute('to', '0');
    oAnim.setAttribute('dur', '1s');
    oAnim.setAttribute('begin', `${i * 0.3}s`);
    oAnim.setAttribute('fill', 'freeze');
    ring.appendChild(oAnim);
    layer.appendChild(ring);
    setTimeout(() => ring.remove(), 1500);
  }
}

function spawnConfuseStars(x, y, layer) {
  for (let i = 0; i < 5; i++) {
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const angle = (i / 5) * Math.PI * 2;
    const sx = x + Math.cos(angle) * 30;
    const sy = y + Math.sin(angle) * 20;
    star.setAttribute('x', sx);
    star.setAttribute('y', sy);
    star.setAttribute('font-size', '20');
    star.setAttribute('text-anchor', 'middle');
    star.textContent = '💫';
    const rot = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
    rot.setAttribute('attributeName', 'transform');
    rot.setAttribute('type', 'rotate');
    rot.setAttribute('from', `0 ${sx} ${sy}`);
    rot.setAttribute('to', `360 ${sx} ${sy}`);
    rot.setAttribute('dur', '1s');
    rot.setAttribute('repeatCount', '3');
    star.appendChild(rot);
    const fade = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    fade.setAttribute('attributeName', 'opacity');
    fade.setAttribute('from', '1');
    fade.setAttribute('to', '0');
    fade.setAttribute('dur', '3s');
    fade.setAttribute('fill', 'freeze');
    star.appendChild(fade);
    layer.appendChild(star);
    setTimeout(() => star.remove(), 3200);
  }
}
