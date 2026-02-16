class PlayerProfile {
    constructor() {
        this.name = localStorage.getItem('chroma_player_name') || 'Guest';
        this.highScores = JSON.parse(localStorage.getItem('chroma_high_scores')) || [];
        this.achievements = JSON.parse(localStorage.getItem('chroma_achievements')) || {};
        this.stats = JSON.parse(localStorage.getItem('chroma_stats')) || {
            kills: 0,
            gamesPlayed: 0,
            minigameWins: 0
        };
    }

    setName(name) {
        this.name = name;
        localStorage.setItem('chroma_player_name', name);
    }

    addScore(score, level) {
        this.highScores.push({ name: this.name, score, level, date: new Date().toLocaleDateString() });
        this.highScores.sort((a, b) => b.score - a.score);
        this.highScores = this.highScores.slice(0, 5); // Keep top 5
        localStorage.setItem('chroma_high_scores', JSON.stringify(this.highScores));
    }

    unlockAchievement(id) {
        if (!this.achievements[id]) {
            this.achievements[id] = true;
            localStorage.setItem('chroma_achievements', JSON.stringify(this.achievements));
            return true; // Newly unlocked
        }
        return false;
    }

    updateStats(kills, minigameWins) {
        this.stats.kills += kills;
        this.stats.minigameWins += minigameWins;
        this.stats.gamesPlayed++;
        localStorage.setItem('chroma_stats', JSON.stringify(this.stats));
    }
}
