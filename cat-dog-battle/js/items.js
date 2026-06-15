/**
 * 围观群众投掷道具系统
 */
const ITEM_TYPES = {
  fish:    { emoji: '🐟', good: true,  effect: 'heal',     value: 20, label: 'Tasty fish! +20 HP' },
  bone:    { emoji: '🦴', good: true,  effect: 'power',    value: 5,  label: 'Power bone! ATK UP!' },
  star:    { emoji: '⭐', good: true,  effect: 'score',    value: 50, label: 'Lucky star! +50 pts' },
  bomb:    { emoji: '💣', good: false, effect: 'damage',   value: 15, label: 'Uh-oh, bomb! -15 HP' },
  tomato:  { emoji: '🍅', good: false, effect: 'slow',     value: 120, label: 'Tomato splat! Slowed!' },
  skunk:   { emoji: '🦨', good: false, effect: 'poison',   value: 150, label: 'Skunk attack! Poisoned!' },
};

const ITEM_KEYS = Object.keys(ITEM_TYPES);
const PICKUP_RADIUS = 35;

class ThrownItem {
  constructor(type, startX, startY, targetX, targetY) {
    this.type = type;
    this.config = ITEM_TYPES[type];
    this._sx = startX;
    this.x = startX;
    this.y = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.progress = 0;
    this.speed = 0.015 + Math.random() * 0.01;
    this.collected = false;
    this.groundTime = 0;
    this.landed = false;
    this.maxGroundTime = 300;

    this.el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.el.setAttribute('class', `thrown-item ${this.config.good ? 'good-item' : 'bad-item'}`);

    // 抛物线阴影
    this.shadow = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    this.shadow.setAttribute('rx', '12');
    this.shadow.setAttribute('ry', '4');
    this.shadow.setAttribute('fill', 'rgba(0,0,0,0.2)');
    this.el.appendChild(this.shadow);

    this.icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.icon.setAttribute('font-size', '28');
    this.icon.setAttribute('text-anchor', 'middle');
    this.icon.setAttribute('dominant-baseline', 'central');
    this.icon.textContent = this.config.emoji;
    this.el.appendChild(this.icon);

    // 好坏标识光圈
    if (this.config.good) {
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glow.setAttribute('r', '18');
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', '#4CAF50');
      glow.setAttribute('stroke-width', '2');
      glow.setAttribute('opacity', '0.5');
      const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      pulse.setAttribute('attributeName', 'r');
      pulse.setAttribute('values', '16;20;16');
      pulse.setAttribute('dur', '1s');
      pulse.setAttribute('repeatCount', 'indefinite');
      glow.appendChild(pulse);
      this.el.insertBefore(glow, this.icon);
    } else {
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glow.setAttribute('r', '18');
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', '#F44336');
      glow.setAttribute('stroke-width', '2');
      glow.setAttribute('opacity', '0.5');
      const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      pulse.setAttribute('attributeName', 'r');
      pulse.setAttribute('values', '16;22;16');
      pulse.setAttribute('dur', '0.5s');
      pulse.setAttribute('repeatCount', 'indefinite');
      glow.appendChild(pulse);
      this.el.insertBefore(glow, this.icon);
    }
  }

  update() {
    if (this.collected) return false;

    if (this.progress < 1) {
      this.progress += this.speed;
      const t = Math.min(1, this.progress);
      this.x = this.startX + (this.targetX - this.startX) * t;
      const arcHeight = 80;
      const baseY = this.startY + (this.targetY - this.startY) * t;
      const arc = -arcHeight * 4 * t * (1 - t);
      this.y = baseY + arc;
      this.landed = false;
    } else {
      this.x = this.targetX;
      this.y = this.targetY;
      this.landed = true;
      this.groundTime++;
      if (this.groundTime > this.maxGroundTime) return false;
    }

    this.shadow.setAttribute('cx', this.x);
    this.shadow.setAttribute('cy', this.targetY + 5);
    this.shadow.setAttribute('opacity', this.landed ? 0.3 : 0.1);

    this.icon.setAttribute('x', this.x);
    this.icon.setAttribute('y', this.y);

    if (this.landed && this.groundTime % 40 < 20) {
      this.icon.setAttribute('font-size', '30');
    } else if (this.landed) {
      this.icon.setAttribute('font-size', '26');
    }

    return true;
  }

  tryPickup(fighter) {
    if (this.collected || !this.landed) return false;
    const dist = Math.hypot(this.x - fighter.x, this.y - fighter.y);
    if (dist > PICKUP_RADIUS) return false;

    this.collected = true;
    this.applyEffect(fighter);
    this.el.remove();
    return true;
  }

  applyEffect(fighter) {
    const cfg = this.config;
    showAnnouncement(`${fighter.type === 'cat' ? '🐱' : '🐶'} ${cfg.label}`);

    switch (cfg.effect) {
      case 'heal':
        fighter.heal(cfg.value);
        spawnPickupEffect(this.x, this.y, '#4CAF50', '💚');
        break;
      case 'power':
        fighter.powerBoost = cfg.value;
        fighter.powerBoostTimer = 300;
        fighter.attackPower += cfg.value;
        setTimeout(() => { fighter.attackPower -= cfg.value; }, 300 * 16);
        spawnPickupEffect(this.x, this.y, '#FF9800', '💪');
        AudioFX.itemPickup();
        break;
      case 'score':
        fighter.addScore(cfg.value);
        spawnPickupEffect(this.x, this.y, '#FFD700', '✨');
        break;
      case 'damage':
        fighter.takeDamage(cfg.value);
        showDamageText(fighter.x, fighter.y - 80, `-${cfg.value}`, '#FF0000');
        spawnPickupEffect(this.x, this.y, '#F44336', '💥');
        AudioFX.itemBad();
        break;
      case 'slow':
        fighter.slowed = true;
        fighter.slowTimer = cfg.value;
        spawnPickupEffect(this.x, this.y, '#FF5722', '🐌');
        AudioFX.itemBad();
        break;
      case 'poison':
        fighter.poisoned = true;
        fighter.poisonTimer = cfg.value;
        spawnPickupEffect(this.x, this.y, '#8BC34A', '☠️');
        AudioFX.itemBad();
        break;
    }
  }

  get startX() { return this._sx; }
}

function createThrownItem(type, startX, startY, targetX, targetY) {
  return new ThrownItem(type, startX, startY, targetX, targetY);
}

function spawnPickupEffect(x, y, color, emoji) {
  const layer = document.getElementById('effects-layer');
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x', x);
  t.setAttribute('y', y);
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('font-size', '24');
  t.setAttribute('class', 'damage-text');
  t.textContent = emoji;
  layer.appendChild(t);
  setTimeout(() => t.remove(), 1000);
}

class CrowdManager {
  constructor(crowdLayer) {
    this.crowdLayer = crowdLayer;
    this.throwTimer = 0;
    this.throwInterval = 120; // ~2秒
    this.spectators = [];
    this.items = [];
    this.buildCrowd();
  }

  buildCrowd() {
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94', '#C7CEEA', '#FFD93D', '#6BCB77'];
    const expressions = ['😄', '😆', '🤩', '😲', '🙀', '😹', '🤣', '😎'];

    for (let i = 0; i < 16; i++) {
      const x = 30 + i * 54;
      const y = 310 + (i % 3) * 5;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x}, ${y})`);

      // 身体
      const body = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      body.setAttribute('cx', '0');
      body.setAttribute('cy', '15');
      body.setAttribute('rx', '14');
      body.setAttribute('ry', '18');
      body.setAttribute('fill', colors[i % colors.length]);
      g.appendChild(body);

      // 头
      const head = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      head.setAttribute('cx', '0');
      head.setAttribute('cy', '-8');
      head.setAttribute('r', '12');
      head.setAttribute('fill', '#FFDBAC');
      g.appendChild(head);

      // 表情
      const face = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      face.setAttribute('x', '0');
      face.setAttribute('y', '-4');
      face.setAttribute('text-anchor', 'middle');
      face.setAttribute('font-size', '14');
      face.textContent = expressions[i % expressions.length];
      g.appendChild(face);

      // 举手动画
      const arm = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      arm.setAttribute('x1', '10');
      arm.setAttribute('y1', '5');
      arm.setAttribute('x2', '18');
      arm.setAttribute('y2', '-10');
      arm.setAttribute('stroke', '#FFDBAC');
      arm.setAttribute('stroke-width', '3');
      arm.setAttribute('stroke-linecap', 'round');
      arm.innerHTML = `<animateTransform attributeName="transform" type="rotate" values="-10 10 5;20 10 5;-10 10 5" dur="${1.5 + Math.random()}s" repeatCount="indefinite"/>`;
      g.appendChild(arm);

      this.crowdLayer.appendChild(g);
      this.spectators.push({ el: g, x, y, face });
    }

    // 横幅
    const banner = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    banner.setAttribute('x', '450');
    banner.setAttribute('y', '295');
    banner.setAttribute('text-anchor', 'middle');
    banner.setAttribute('font-size', '16');
    banner.setAttribute('fill', '#fff');
    banner.setAttribute('font-weight', 'bold');
    banner.textContent = '🎉 The crowd is cheering! 🎉';
    this.crowdLayer.appendChild(banner);
  }

  update(itemsLayer) {
    this.throwTimer++;
    if (this.throwTimer >= this.throwInterval) {
      this.throwTimer = 0;
      this.throwInterval = 90 + Math.floor(Math.random() * 90);
      this.throwItem(itemsLayer);
    }

    this.items = this.items.filter(item => {
      const alive = item.update();
      if (!alive && !item.collected) item.el.remove();
      return alive && !item.collected;
    });
  }

  throwItem(itemsLayer) {
    const specIdx = Math.floor(Math.random() * this.spectators.length);
    const spec = this.spectators[specIdx];
    const typeKey = ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)];
    const targetX = 120 + Math.random() * 660;
    const targetY = 390 + Math.random() * 60;

    const item = createThrownItem(typeKey, spec.x, spec.y - 20, targetX, targetY);
    this.items.push(item);
    itemsLayer.appendChild(item.el);

    // 观众扔东西动画
    spec.face.textContent = ITEM_TYPES[typeKey].good ? '🎯' : '😈';
    setTimeout(() => {
      spec.face.textContent = ['😄', '😆', '🤩', '😲'][Math.floor(Math.random() * 4)];
    }, 800);

    AudioFX.throw();
  }

  checkPickups(cat, dog) {
    for (const item of this.items) {
      item.tryPickup(cat);
      item.tryPickup(dog);
    }
  }
}
