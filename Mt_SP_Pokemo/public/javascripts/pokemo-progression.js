(function (global) {
    const storageKey = 'pokemoProgression';
    const pointsToEvolve = 100;
    const maxLevel = 3;
    const evolutionLines = new Map([
        [1, [1, 2, 3]],
        [4, [4, 5, 6]],
        [7, [7, 8, 9]]
    ]);
    const levelElement = document.getElementById('profileLevel');
    const xpBar = document.querySelector('.xp-bar');
    const xpProgress = document.querySelector('.xp-progress');
    const xpLabel = document.querySelector('.xp-label');

    function readProgress() {
        const savedProgress = global.localStorage.getItem(storageKey);
        if (savedProgress === null) {
            return { level: 1, xp: 0 };
        }

        const progress = JSON.parse(savedProgress);
        if (!progress
            || !Number.isSafeInteger(progress.level)
            || progress.level < 1
            || progress.level > maxLevel
            || !Number.isSafeInteger(progress.xp)
            || progress.xp < 0
            || (progress.level < maxLevel && progress.xp >= pointsToEvolve)) {
            throw new Error('The saved Pokemo progression is invalid.');
        }

        return progress;
    }

    function render() {
        const progress = readProgress();
        if (levelElement) {
            levelElement.textContent = `Level ${progress.level}`;
        }
        if (xpProgress) {
            xpProgress.style.width = `${Math.min(progress.xp, pointsToEvolve)}%`;
        }
        if (xpBar) {
            xpBar.setAttribute('aria-valuenow',
                String(Math.min(progress.xp, pointsToEvolve)));
        }
        if (xpLabel) {
            xpLabel.textContent = progress.level < maxLevel
                ? `${progress.xp} / ${pointsToEvolve} XP`
                : `${progress.xp} XP`;
            xpLabel.title = progress.level < maxLevel
                ? `${pointsToEvolve - progress.xp} XP bis zur nächsten Entwicklung`
                : 'Maximale Entwicklung erreicht; XP werden weiter gesammelt.';
        }
    }

    function getProgress() {
        return { ...readProgress() };
    }

    function getActivePokemonId(starterPokemonId) {
        const line = evolutionLines.get(starterPokemonId);
        if (!line) {
            throw new RangeError('Choose one of the three starter Pokémon.');
        }

        return line[readProgress().level - 1];
    }

    function completeGame(wasLoss) {
        if (typeof wasLoss !== 'boolean') {
            throw new TypeError('The game result must indicate whether it was a loss.');
        }

        const progress = readProgress();
        const previousLevel = progress.level;
        if (wasLoss) {
            if (progress.xp < 2) {
                progress.level = Math.max(1, progress.level - 1);
                progress.xp = 0;
            } else {
                progress.xp -= 2;
            }
        } else {
            const earnedXp = progress.level === 1 ? 2 : 1;
            if (!Number.isSafeInteger(progress.xp + earnedXp)) {
                throw new RangeError('The saved Pokemo XP is too large.');
            }

            progress.xp += earnedXp;
            if (progress.level < maxLevel && progress.xp >= pointsToEvolve) {
                progress.level += 1;
                progress.xp = 0;
            }
        }

        global.localStorage.setItem(storageKey, JSON.stringify(progress));
        render();
        global.dispatchEvent(new CustomEvent('pokemo-progression-change', {
            detail: {
                ...progress,
                formChanged: progress.level !== previousLevel
            }
        }));
        return { ...progress };
    }

    global.PokemoProgression = Object.freeze({
        completeGame,
        getActivePokemonId,
        getProgress
    });
    global.addEventListener('storage', (event) => {
        if (event.key === storageKey) {
            render();
        }
    });

    render();
})(window);
