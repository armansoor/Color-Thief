
/**
 * Chroma Quest: The Void Painter
 * Core Game Logic
 */

// --- Constants ---
const CONFIG = {
    PLAYER_SPEED: 300,
    PLAYER_SIZE: 15,
    BULLET_SPEED: 600,
    BULLET_SIZE: 4,
    BULLET_LIFETIME: 2, // seconds
    FRICTION: 0.9,
    ENEMY_SPAWN_RATE: 2, // seconds
    COLORS: {
        PLAYER: '#00ffcc', // Cyan
        ENEMY_BASE: '#ff0055', // Pink/Red
        BG: '#050505'
    },
    // Color Wheel for mechanics (0-360 hue)
    // Player starts at Cyan (180), Enemies at Red (0)
};

// --- Utilities ---
const Utils = {
    rand: (min, max) => Math.random() * (max - min) + min,
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    lerp: (a, b, t) => a + (b - a) * t,
    // Check collision between two circles
    circleCollide: (c1, c2) => Utils.dist(c1.x, c1.y, c2.x, c2.y) < (c1.r + c2.r)
};

// --- Classes ---

class Projectile {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.r = CONFIG.BULLET_SIZE;
        this.life = CONFIG.BULLET_LIFETIME;
        this.active = true;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
}

class Enemy {
    constructor(x, y, level, type = 'chaser') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.level = level;
        this.active = true;

        // Base Stats
        this.r = 15;
        this.speed = 100;
        this.health = 3;
        this.color = CONFIG.COLORS.ENEMY_BASE;
        this.shootTimer = 0;

        // Type Variations
        if (type === 'chaser') {
            this.color = '#ff0055'; // Red
            this.speed = 100 + (level * 5);
            this.health = 3 + Math.floor(level * 0.5);
        } else if (type === 'shooter') {
            this.color = '#aa00ff'; // Purple
            this.speed = 80 + (level * 2);
            this.health = 2 + Math.floor(level * 0.3);
            this.r = 18;
        } else if (type === 'dasher') {
            this.color = '#ffcc00'; // Yellow
            this.speed = 200 + (level * 8);
            this.health = 1 + Math.floor(level * 0.2);
            this.r = 12;
        } else if (type === 'tank') {
            this.color = '#0055ff'; // Blue
            this.speed = 60 + (level * 2);
            this.health = 10 + Math.floor(level * 2);
            this.r = 25;
        }
    }

    update(dt, player, projectilesList) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        // AI Logic
        if (this.type === 'shooter') {
            // Keep distance
            if (dist < 200) {
                // Retreat
                this.x -= (dx / dist) * this.speed * dt * 0.5;
                this.y -= (dy / dist) * this.speed * dt * 0.5;
            } else {
                // Approach slowly
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            }

            // Shoot at player
            this.shootTimer -= dt;
            if (this.shootTimer <= 0 && dist < 400) {
                this.shootTimer = 2.0; // Fire rate
                // Add enemy projectile
                projectilesList.push(new Projectile(
                    this.x, this.y,
                    (dx/dist) * 300, (dy/dist) * 300,
                    this.color
                ));
                // Tag it as enemy bullet?
                // Currently Projectile class doesn't distinguish owner.
                // We'll need to handle friendly fire or add owner property.
                // For now, let's assume all projectiles hurt enemies only?
                // Wait, need to update Projectile class to support enemy bullets hurting player.
                projectilesList[projectilesList.length-1].isEnemy = true;
            }

        } else {
            // Default Chase
            if (dist > 0) {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            }
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.active = false;
        }
    }
}

class Particle {
    constructor(x, y, color, vx, vy, life, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
        this.active = true;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.vx *= 0.95;
        this.vy *= 0.95;
        if (this.life <= 0) this.active = false;
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.active = true;
        this.vy = -50;
    }

    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
}

class Boss extends Enemy {
    constructor(x, y, level) {
        super(x, y, level, 'boss');
        this.r = 60;
        this.maxHealth = 100 + (level * 20);
        this.health = this.maxHealth;
        this.color = '#ff0000';
        this.speed = 50 + (level);
        this.phase = 0; // 0: Idle/Chase, 1: Attack Pattern 1, 2: Attack Pattern 2
        this.phaseTimer = 0;
        this.attackTimer = 0;
    }

    update(dt, player, projectilesList) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        // State Machine
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
            // Switch Phase
            this.phase = (this.phase + 1) % 3;
            this.phaseTimer = 5.0; // 5 seconds per phase
        }

        // Always move slowly towards player unless charging
        if (this.phase !== 2) {
             if (dist > 0) {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            }
        }

        // Phase Logic
        if (this.phase === 1) {
            // Phase 1: Spiral Shoot
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.attackTimer = 0.2;
                // Shoot 4 bullets in cardinal directions + rotation
                const angle = Date.now() / 500;
                for(let i=0; i<4; i++) {
                    const a = angle + (i * Math.PI / 2);
                    projectilesList.push(new Projectile(
                        this.x, this.y,
                        Math.cos(a) * 400, Math.sin(a) * 400,
                        '#ff00ff'
                    ));
                    projectilesList[projectilesList.length-1].isEnemy = true;
                }
            }
        } else if (this.phase === 2) {
            // Phase 2: Aggressive Charge
            // Move fast towards player constantly
            if (dist > 0) {
                this.x += (dx / dist) * (this.speed * 3) * dt;
                this.y += (dy / dist) * (this.speed * 3) * dt;
            }
        }
    }
}

// --- Input Handler ---
class InputHandler {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touch = {
            left: { active: false, x: 0, y: 0, originX: 0, originY: 0 }, // Move
            right: { active: false, x: 0, y: 0, originX: 0, originY: 0 } // Shoot
        };
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        this._initListeners();
    }

    _initListeners() {
        // Keyboard
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        // Mouse
        window.addEventListener('mousemove', e => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('mousedown', () => this.mouse.down = true);
        window.addEventListener('mouseup', () => this.mouse.down = false);

        // Touch
        if (this.isMobile) {
            document.getElementById('mobile-controls').classList.remove('hidden');
            const leftZone = document.getElementById('joystick-left');
            const rightZone = document.getElementById('joystick-right');

            // Left Stick (Move)
            leftZone.addEventListener('touchstart', e => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                this.touch.left.active = true;
                this.touch.left.originX = touch.clientX;
                this.touch.left.originY = touch.clientY;
                this.touch.left.x = 0;
                this.touch.left.y = 0;
            });
            leftZone.addEventListener('touchmove', e => {
                e.preventDefault();
                if(!this.touch.left.active) return;
                const touch = e.changedTouches[0];
                const dx = touch.clientX - this.touch.left.originX;
                const dy = touch.clientY - this.touch.left.originY;
                const maxDist = 50;
                this.touch.left.x = Utils.clamp(dx / maxDist, -1, 1);
                this.touch.left.y = Utils.clamp(dy / maxDist, -1, 1);
            });
            leftZone.addEventListener('touchend', e => {
                e.preventDefault();
                this.touch.left.active = false;
                this.touch.left.x = 0;
                this.touch.left.y = 0;
            });

            // Right Stick (Aim/Shoot)
            rightZone.addEventListener('touchstart', e => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                this.touch.right.active = true;
                this.touch.right.originX = touch.clientX;
                this.touch.right.originY = touch.clientY;
                this.touch.right.x = 0;
                this.touch.right.y = 0;
            });
            rightZone.addEventListener('touchmove', e => {
                 e.preventDefault();
                if(!this.touch.right.active) return;
                const touch = e.changedTouches[0];
                const dx = touch.clientX - this.touch.right.originX;
                const dy = touch.clientY - this.touch.right.originY;
                const maxDist = 50;
                this.touch.right.x = Utils.clamp(dx / maxDist, -1, 1);
                this.touch.right.y = Utils.clamp(dy / maxDist, -1, 1);
            });
             rightZone.addEventListener('touchend', e => {
                e.preventDefault();
                this.touch.right.active = false;
                this.touch.right.x = 0;
                this.touch.right.y = 0;
            });
        }
    }

    getMoveVector() {
        let x = 0, y = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

        if (this.isMobile && this.touch.left.active) {
            x = this.touch.left.x;
            y = this.touch.left.y;
        }

        const len = Math.hypot(x, y);
        if (len > 1) { x /= len; y /= len; }
        return { x, y };
    }

    getAimVector(playerX, playerY) {
        if (this.isMobile && this.touch.right.active) {
            // If stick is moved, aim is that direction. If just tapped, we need a direction?
            // For now, assume stick movement defines direction.
            // If center tap, maybe shoot straight?
            // Let's rely on stick displacement.
            const len = Math.hypot(this.touch.right.x, this.touch.right.y);
            return {
                x: this.touch.right.x,
                y: this.touch.right.y,
                active: len > 0.1
            };
        }

        const dx = this.mouse.x - playerX;
        const dy = this.mouse.y - playerY;
        const len = Math.hypot(dx, dy);
        return {
            x: dx / len,
            y: dy / len,
            active: this.mouse.down || this.keys['Space']
        };
    }
}

// --- Renderer ---
class Renderer {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Background Paint Layer
        this.bgCanvas = document.createElement('canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Preserve paint on resize by copying old
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.bgCanvas.width || 1;
        tempCanvas.height = this.bgCanvas.height || 1;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.bgCanvas, 0, 0);

        this.bgCanvas.width = window.innerWidth;
        this.bgCanvas.height = window.innerHeight;

        // Restore
        this.bgCtx.drawImage(tempCanvas, 0, 0);
    }

    clear() {
        this.ctx.fillStyle = CONFIG.COLORS.BG;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackground() {
        this.ctx.drawImage(this.bgCanvas, 0, 0);
    }

    drawSplat(x, y, color, size) {
        this.bgCtx.save();
        this.bgCtx.globalAlpha = 0.8;
        this.bgCtx.fillStyle = color;
        this.bgCtx.beginPath();
        this.bgCtx.arc(x, y, size, 0, Math.PI * 2);
        this.bgCtx.fill();
        this.bgCtx.restore();
    }

    drawPlayer(player) {
        this.ctx.save();
        this.ctx.translate(player.x, player.y);

        // Glow
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = CONFIG.COLORS.PLAYER;

        // Body
        this.ctx.beginPath();
        this.ctx.arc(0, 0, player.r, 0, Math.PI * 2);
        this.ctx.fillStyle = CONFIG.COLORS.PLAYER;
        this.ctx.fill();

        this.ctx.restore();
    }

    drawProjectiles(projectiles) {
        this.ctx.save();
        for (const p of projectiles) {
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = p.color;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    drawEnemies(enemies) {
        this.ctx.save();
        for (const e of enemies) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = e.color;
            this.ctx.fillStyle = e.color;
            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
            this.ctx.fill();

            // Health indicator (simple opacity or inner circle?)
            // Inner circle
            this.ctx.fillStyle = 'black';
            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y, e.r * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    drawParticles(particles) {
        this.ctx.save();
        for (const p of particles) {
            this.ctx.globalAlpha = p.life / p.maxLife;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    drawFloatingTexts(texts) {
        this.ctx.save();
        this.ctx.font = "bold 20px Arial";
        this.ctx.textAlign = "center";
        for (const t of texts) {
            this.ctx.globalAlpha = Math.max(0, t.life);
            this.ctx.fillStyle = t.color;
            this.ctx.shadowBlur = 4;
            this.ctx.shadowColor = 'black';
            this.ctx.fillText(t.text, t.x, t.y);
        }
        this.ctx.restore();
    }
}

// --- Game Engine ---
class Game {
    constructor() {
        this.input = new InputHandler();
        this.renderer = new Renderer();

        this.state = 'MENU';
        this.lastTime = 0;

        // Game State Data
        this.level = 1;
        this.enemiesToKill = 0;
        this.score = 0;
        this.player = {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            vx: 0, vy: 0,
            r: CONFIG.PLAYER_SIZE,
            health: 100,
            maxHealth: 100,
            energy: 100,
            color: CONFIG.COLORS.PLAYER,
            shootTimer: 0
        };

        this.projectiles = [];
        this.enemies = [];
        this.spawnTimer = 0;
        this.levelTransitionTimer = 0;

        // UI Binding
        this.ui = {
            menu: document.getElementById('menu-overlay'),
            gameOver: document.getElementById('game-over-overlay'),
            startBtn: document.getElementById('btn-start'),
            restartBtn: document.getElementById('btn-restart'),
            score: document.getElementById('score-display'),
            level: document.getElementById('level-display'),
            healthBar: document.getElementById('health-bar-fill'),
            log: document.getElementById('action-log')
        };

        this.ui.startBtn.addEventListener('click', () => this.start());
        this.ui.restartBtn.addEventListener('click', () => this.start());

        requestAnimationFrame(t => this.loop(t));
    }

    log(msg) {
        const div = document.createElement('div');
        div.className = 'log-entry';
        div.innerText = msg;
        this.ui.log.prepend(div);
        if (this.ui.log.children.length > 5) {
            this.ui.log.lastChild.remove();
        }
    }

    start() {
        this.state = 'PLAYING';
        this.ui.menu.classList.add('hidden');
        this.ui.gameOver.classList.add('hidden');

        // Reset Logic
        this.score = 0;
        this.player.health = 100;
        this.player.x = this.renderer.canvas.width / 2;
        this.player.y = this.renderer.canvas.height / 2;
        this.projectiles = [];
        this.enemies = [];
        this.renderer.bgCtx.clearRect(0, 0, this.renderer.bgCanvas.width, this.renderer.bgCanvas.height); // Clear paint

        this.startLevel(1);
    }

    startLevel(lvl) {
        this.level = lvl;
        this.enemiesToKill = 5 + Math.floor(lvl * 1.5);
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.floatingTexts = [];
        this.spawnTimer = 0;
        this.shakeTimer = 0;

        if (lvl % 35 === 0 || lvl === 500) {
            this.spawnBoss();
        } else {
            this.log(`Level ${lvl} Started! Defeat ${this.enemiesToKill} enemies.`);
        }
        this.updateHUD();
    }

    spawnBoss() {
        this.log("WARNING: BOSS APPROACHING!");
        this.enemiesToKill = 1; // Logic handled in update
        const cx = this.renderer.canvas.width / 2;
        const cy = this.renderer.canvas.height / 2;
        // Spawn boss at top
        this.enemies.push(new Boss(cx, -100, this.level));
    }

    levelComplete() {
        this.log(`Level ${this.level} Complete!`);
        this.score += 100 * this.level;
        // Heal Player
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 20);

        // Flash effect or similar could go here

        setTimeout(() => {
            this.startLevel(this.level + 1);
        }, 2000);
    }

    updateHUD() {
        this.ui.score.innerText = this.score;
        if (this.enemies.length > 0 && this.enemies[0] instanceof Boss) {
            this.ui.level.innerText = `${this.level} (BOSS HP: ${this.enemies[0].health})`;
        } else {
            this.ui.level.innerText = `${this.level} (Goal: ${this.enemiesToKill})`;
        }
        this.ui.healthBar.style.width = `${Math.max(0, (this.player.health / this.player.maxHealth) * 100)}%`;
    }

    spawnParticles(x, y, color, count, speed = 100) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Utils.rand(50, speed);
            this.particles.push(new Particle(
                x, y, color,
                Math.cos(angle)*spd, Math.sin(angle)*spd,
                Utils.rand(0.5, 1.0), Utils.rand(2, 5)
            ));
        }
    }

    addFloatingText(x, y, text, color) {
        this.floatingTexts.push(new FloatingText(x, y, text, color));
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        // Screen Shake Timer
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            const shake = 5 * (this.shakeTimer / 0.5);
            const dx = Math.random() * shake - shake/2;
            const dy = Math.random() * shake - shake/2;
            this.renderer.ctx.save();
            this.renderer.ctx.translate(dx, dy);
            // Note: We need to restore this in draw() or end of frame.
            // Actually, usually shake affects camera transform.
            // Here, I am translating context. If I don't restore, it accumulates?
            // Wait, renderer.clear() clears pixels, but transformation matrix persists?
            // Yes. I should handle shake in draw() strictly or wrap here.
            // Let's move shake logic to draw().
            this.renderer.ctx.restore(); // Undo immediately to prevent state leak logic issues
            // I'll handle visual shake in draw() only.
        }

        // --- Particles & Texts ---
        for(let i=this.particles.length-1; i>=0; i--) {
            this.particles[i].update(dt);
            if(!this.particles[i].active) this.particles.splice(i, 1);
        }
        for(let i=this.floatingTexts.length-1; i>=0; i--) {
            this.floatingTexts[i].update(dt);
            if(!this.floatingTexts[i].active) this.floatingTexts.splice(i, 1);
        }

        // --- Player Movement ---
        const move = this.input.getMoveVector();
        this.player.vx += move.x * CONFIG.PLAYER_SPEED * 10 * dt;
        this.player.vy += move.y * CONFIG.PLAYER_SPEED * 10 * dt;
        this.player.vx *= CONFIG.FRICTION;
        this.player.vy *= CONFIG.FRICTION;
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;

        // Bounds
        const r = this.player.r;
        const w = this.renderer.canvas.width;
        const h = this.renderer.canvas.height;
        if (this.player.x < r) { this.player.x = r; this.player.vx *= -0.5; }
        if (this.player.x > w - r) { this.player.x = w - r; this.player.vx *= -0.5; }
        if (this.player.y < r) { this.player.y = r; this.player.vy *= -0.5; }
        if (this.player.y > h - r) { this.player.y = h - r; this.player.vy *= -0.5; }

        // --- Shooting ---
        this.player.shootTimer -= dt;
        const aim = this.input.getAimVector(this.player.x, this.player.y);
        if (aim.active && this.player.shootTimer <= 0) {
            this.projectiles.push(new Projectile(
                this.player.x + aim.x * 20,
                this.player.y + aim.y * 20,
                aim.x * CONFIG.BULLET_SPEED,
                aim.y * CONFIG.BULLET_SPEED,
                this.player.color
            ));
            this.player.shootTimer = 0.15; // Fire rate
        }

        // --- Projectiles Update ---
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);

            // Check collision with Player if enemy bullet
            if (p.isEnemy) {
                 if (Utils.circleCollide(p, this.player)) {
                    p.active = false;
                    this.player.health -= 5 + this.level;
                    this.updateHUD();
                    this.renderer.drawSplat(p.x, p.y, p.color, p.r * 3);
                    if (this.player.health <= 0) this.gameOver();
                 }
            }

            // Splat on despawn or hit (Hit handled later)
            if (!p.active) {
                if (!p.isEnemy) {
                   // Only player bullets paint automatically on death?
                   // Or enemy bullets paint too? Let's say all paint.
                   this.renderer.drawSplat(p.x, p.y, p.color, p.r * 3);
                }
                this.projectiles.splice(i, 1);
            } else if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
                // Hit wall -> Splat
                p.active = false;
                this.renderer.drawSplat(p.x, p.y, p.color, p.r * 4);
            }
        }

        // --- Enemy Spawning ---
        this.spawnTimer -= dt;
        // Only spawn if we haven't killed enough? No, we spawn until we kill enough.
        // But maybe limit active enemies?
        if (this.spawnTimer <= 0 && this.enemies.length < 10 + this.level) {
            // Spawn logic based on level
            const edge = Math.floor(Math.random() * 4); // 0:top, 1:right, 2:bottom, 3:left
            let ex, ey;
            switch(edge) {
                case 0: ex = Math.random() * w; ey = -50; break;
                case 1: ex = w + 50; ey = Math.random() * h; break;
                case 2: ex = Math.random() * w; ey = h + 50; break;
                case 3: ex = -50; ey = Math.random() * h; break;
            }

            // Determine Type
            let type = 'chaser';
            if (this.level >= 5 && Math.random() < 0.3) type = 'shooter';
            if (this.level >= 10 && Math.random() < 0.2) type = 'dasher';
            if (this.level >= 20 && Math.random() < 0.1) type = 'tank';

            this.enemies.push(new Enemy(ex, ey, this.level, type));
            this.spawnTimer = CONFIG.ENEMY_SPAWN_RATE / (1 + this.level * 0.1);
        }

        // --- Enemy Update & Collision ---
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, this.player, this.projectiles);

            // Player Collision
            if (Utils.circleCollide(this.player, e)) {
                this.player.health -= 10;
                this.updateHUD();
                this.shakeTimer = 0.3;
                this.spawnParticles(this.player.x, this.player.y, CONFIG.COLORS.PLAYER, 10);
                this.addFloatingText(this.player.x, this.player.y - 20, "-10 HP", "red");
                e.active = false; // Enemy explodes on impact
                this.spawnParticles(e.x, e.y, e.color, 20, 200);

                // Check Death
                if (this.player.health <= 0) {
                    this.gameOver();
                }
            }

            // Projectile Collision (Player bullets hitting Enemy)
            for (const p of this.projectiles) {
                if (p.active && !p.isEnemy && Utils.circleCollide(p, e)) {
                    p.active = false; // Bullet dies
                    e.takeDamage(1);
                    this.renderer.drawSplat(p.x, p.y, p.color, p.r * 5);
                    this.spawnParticles(p.x, p.y, p.color, 5, 100);

                    if (!e.active) {
                        this.spawnParticles(e.x, e.y, e.color, 15, 150);
                        this.addFloatingText(e.x, e.y, `+${10*this.level}`, "#ffff00");
                        this.score += 10 * this.level;

                        // Win Logic
                        const isBossLevel = (this.level % 35 === 0 || this.level === 500);

                        if (isBossLevel) {
                            if (e instanceof Boss) {
                                this.levelComplete();
                            } else {
                                // Minion kill, doesn't count towards goal but gives score
                            }
                        } else {
                            this.enemiesToKill--;
                            this.updateHUD();
                            if (this.enemiesToKill <= 0) {
                                this.levelComplete();
                            }
                        }
                    }
                    break;
                }
            }

            if (!e.active) {
                this.enemies.splice(i, 1);
            }
        }
    }

    gameOver() {
        this.state = 'GAMEOVER';
        this.ui.gameOver.classList.remove('hidden');
        document.getElementById('final-level').innerText = this.level;
    }

    draw() {
        this.renderer.clear();

        // Shake Effect
        if (this.shakeTimer > 0) {
            const shake = 5 * (this.shakeTimer / 0.5);
            const dx = Math.random() * shake - shake/2;
            const dy = Math.random() * shake - shake/2;
            this.renderer.ctx.save();
            this.renderer.ctx.translate(dx, dy);
        }

        this.renderer.drawBackground();

        if (this.state === 'PLAYING') {
            this.renderer.drawSplat(this.player.x, this.player.y, this.player.color, 2); // Player trail
            this.renderer.drawProjectiles(this.projectiles);
            this.renderer.drawEnemies(this.enemies);
            this.renderer.drawPlayer(this.player);
            this.renderer.drawParticles(this.particles);
            this.renderer.drawFloatingTexts(this.floatingTexts);
        }

        if (this.shakeTimer > 0) {
            this.renderer.ctx.restore();
        }
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (dt < 0.1) {
            this.update(dt);
            this.draw();
        }

        requestAnimationFrame(t => this.loop(t));
    }
}

// Start Game
window.onload = () => {
    window.game = new Game();
};
