
class Minigame {
    constructor(game) {
        this.game = game;
        this.overlay = document.getElementById('minigame-overlay');
        this.container = document.getElementById('minigame-container');
        this.timerBar = document.getElementById('minigame-timer');
        this.instruction = document.querySelector('.minigame-instruction');

        this.isActive = false;
        this.timer = 0;
        this.maxTime = 0;
        this.targetColor = null;
        this.gridSize = 2; // Starts 2x2
        this.onComplete = null;
        this.lastTime = 0;
    }

    trigger(level) {
        this.isActive = true;
        this.game.state = 'MINIGAME'; // Pause main loop
        this.overlay.classList.remove('hidden');
        this.container.innerHTML = '';

        // Difficulty Scaling
        this.gridSize = Math.min(5, 2 + Math.floor(level / 10)); // Caps at 5x5
        this.maxTime = Math.max(2, 5 - (level * 0.05)); // Faster timer
        this.timer = this.maxTime;

        // Colors
        const baseHue = Math.random() * 360;
        this.targetColor = `hsl(${baseHue}, 70%, 50%)`;

        // Show Target Phase
        this.instruction.innerText = "MEMORIZE THIS COLOR!";
        const preview = document.createElement('div');
        preview.className = 'target-preview';
        preview.style.background = this.targetColor;
        this.container.appendChild(preview);

        setTimeout(() => this.startGridPhase(baseHue), 1500); // 1.5s to memorize
    }

    startGridPhase(baseHue) {
        if(!this.isActive) return;
        this.container.innerHTML = '';
        this.instruction.innerText = "FIND THE COLOR!";

        const count = this.gridSize * this.gridSize;
        const targetIndex = Math.floor(Math.random() * count);

        for(let i=0; i<count; i++) {
            const btn = document.createElement('div');
            btn.className = 'grid-cell';

            if (i === targetIndex) {
                btn.style.background = this.targetColor;
                btn.onclick = () => this.win();
            } else {
                // Similar but wrong color
                const offset = (Math.random() > 0.5 ? 20 : -20) + (Math.random() * 40 - 20);
                btn.style.background = `hsl(${baseHue + offset}, 70%, 50%)`;
                btn.onclick = () => this.fail("Wrong Color!");
            }
            this.container.appendChild(btn);
        }

        this.lastTime = performance.now();
        this.loopId = requestAnimationFrame(t => this.update(t));
    }

    update(time) {
        if (!this.isActive) return;

        const now = time;
        if (!this.lastTime) this.lastTime = now;
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        this.timer -= dt;
        this.timerBar.style.width = `${Math.max(0, (this.timer / this.maxTime) * 100)}%`;

        if (this.timer <= 0) {
            this.fail("Time's Up!");
        } else {
            this.loopId = requestAnimationFrame(t => this.update(t));
        }
    }

    win() {
        this.end(true);
        this.game.log("System Hacked! Health Restored.");
        this.game.player.health = Math.min(this.game.player.maxHealth, this.game.player.health + 20);
        this.game.profile.updateStats(0, 1);
        this.game.profile.addScore(500, this.game.level);
        this.game.updateHUD();
        this.game.addFloatingText(this.game.player.x, this.game.player.y, "HACKED!", "#00ff00");
    }

    fail(reason) {
        this.end(false);
        this.game.log(`Hack Failed: ${reason}`);
        this.game.player.health -= 20;
        this.game.updateHUD();
        this.game.addFloatingText(this.game.player.x, this.game.player.y, "FAILURE", "#ff0000");
        if (this.game.player.health <= 0) this.game.gameOver();
    }

    end(success) {
        this.isActive = false;
        cancelAnimationFrame(this.loopId);
        this.overlay.classList.add('hidden');
        this.game.state = 'PLAYING';
        if (this.onComplete) this.onComplete(success);
    }
}
