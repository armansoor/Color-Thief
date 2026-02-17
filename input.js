class InputHandler {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.config = config || {};
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };

        // Touch State (Floating Joysticks)
        this.touch = {
            left: { active: false, id: null, originX: 0, originY: 0, currentX: 0, currentY: 0, vecX: 0, vecY: 0 },
            right: { active: false, id: null, originX: 0, originY: 0, currentX: 0, currentY: 0, vecX: 0, vecY: 0 }
        };

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.autoFire = this.isMobile; // Default ON for mobile

        this._initListeners();
    }

    _initListeners() {
        // Keyboard
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if(e.code === 'KeyF') this.toggleAutoFire(); // 'F' to toggle auto-fire
        });
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        // Mouse
        window.addEventListener('mousemove', e => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('mousedown', () => this.mouse.down = true);
        window.addEventListener('mouseup', () => this.mouse.down = false);

        // Touch (Full Screen Listener)
        // Prevent default touch actions (scrolling/zooming)
        document.body.addEventListener('touchstart', e => this._handleTouchStart(e), { passive: false });
        document.body.addEventListener('touchmove', e => this._handleTouchMove(e), { passive: false });
        document.body.addEventListener('touchend', e => this._handleTouchEnd(e), { passive: false });
        document.body.addEventListener('touchcancel', e => this._handleTouchEnd(e), { passive: false });
    }

    toggleAutoFire() {
        this.autoFire = !this.autoFire;
        // visual feedback handled by Game class checking this property
    }

    _shouldIgnoreTouch(e) {
        const target = e.target;
        // Ignore if touching a button or menu element
        return target.closest('button') || target.closest('.menu') || target.closest('a') || target.closest('input');
    }

    _handleTouchStart(e) {
        if (this._shouldIgnoreTouch(e)) return;

        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const halfWidth = window.innerWidth / 2;

            if (t.clientX < halfWidth) {
                // Left Stick (Movement)
                if (!this.touch.left.active) {
                    this.touch.left.active = true;
                    this.touch.left.id = t.identifier;
                    this.touch.left.originX = t.clientX;
                    this.touch.left.originY = t.clientY;
                    this.touch.left.currentX = t.clientX;
                    this.touch.left.currentY = t.clientY;
                    this.touch.left.vecX = 0;
                    this.touch.left.vecY = 0;
                }
            } else {
                // Right Stick (Aiming)
                if (!this.touch.right.active) {
                    this.touch.right.active = true;
                    this.touch.right.id = t.identifier;
                    this.touch.right.originX = t.clientX;
                    this.touch.right.originY = t.clientY;
                    this.touch.right.currentX = t.clientX;
                    this.touch.right.currentY = t.clientY;
                    this.touch.right.vecX = 0;
                    this.touch.right.vecY = 0;
                }
            }
        }
    }

    _handleTouchMove(e) {
        if (this._shouldIgnoreTouch(e)) return;

        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];

            if (this.touch.left.active && t.identifier === this.touch.left.id) {
                this._updateStick(this.touch.left, t.clientX, t.clientY);
            } else if (this.touch.right.active && t.identifier === this.touch.right.id) {
                this._updateStick(this.touch.right, t.clientX, t.clientY);
            }
        }
    }

    _handleTouchEnd(e) {
        // Important: We must allow the browser to process clicks on UI elements.
        // If we preventDefault on touchend, click never fires.
        if (this._shouldIgnoreTouch(e)) return;

        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];

            if (this.touch.left.active && t.identifier === this.touch.left.id) {
                this.touch.left.active = false;
                this.touch.left.vecX = 0;
                this.touch.left.vecY = 0;
            } else if (this.touch.right.active && t.identifier === this.touch.right.id) {
                this.touch.right.active = false;
                this.touch.right.vecX = 0;
                this.touch.right.vecY = 0;
            }
        }
    }

    _updateStick(stick, x, y) {
        stick.currentX = x;
        stick.currentY = y;

        const dx = x - stick.originX;
        const dy = y - stick.originY;
        const maxDist = 50;
        const dist = Math.hypot(dx, dy);

        if (dist > maxDist) {
            stick.vecX = (dx / dist);
            stick.vecY = (dy / dist);
        } else {
            stick.vecX = dx / maxDist;
            stick.vecY = dy / maxDist;
        }
    }

    getMoveVector() {
        if (this.touch.left.active) {
            return { x: this.touch.left.vecX, y: this.touch.left.vecY };
        }

        let x = 0, y = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

        const len = Math.hypot(x, y);
        if (len > 0) { x /= len; y /= len; }
        return { x, y };
    }

    getAimVector(playerX, playerY, nearestEnemy) {
        // 1. Manual Touch Aim
        if (this.touch.right.active) {
            const len = Math.hypot(this.touch.right.vecX, this.touch.right.vecY);
            return {
                x: this.touch.right.vecX,
                y: this.touch.right.vecY,
                active: len > 0.2
            };
        }

        // 2. Mouse Aim
        if (this.mouse.down || this.keys['Space']) {
             const dx = this.mouse.x - playerX;
             const dy = this.mouse.y - playerY;
             const len = Math.hypot(dx, dy);
             return {
                 x: len > 0 ? dx / len : 0,
                 y: len > 0 ? dy / len : 0,
                 active: true
             };
        }

        // 3. Auto-Fire
        if (this.autoFire && nearestEnemy) {
            const dx = nearestEnemy.x - playerX;
            const dy = nearestEnemy.y - playerY;
            const len = Math.hypot(dx, dy);
             return {
                 x: len > 0 ? dx / len : 0,
                 y: len > 0 ? dy / len : 0,
                 active: true
             };
        }

        // 4. Fallback
        const dx = this.mouse.x - playerX;
        const dy = this.mouse.y - playerY;
        const len = Math.hypot(dx, dy);
        return {
            x: len > 0 ? dx / len : 0,
            y: len > 0 ? dy / len : 0,
            active: false
        };
    }
}
