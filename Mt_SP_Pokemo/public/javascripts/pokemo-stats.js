(function (global) {
    const storageKey = 'pokemoStatistics';
    const initialStats = {
        playedRounds: 0,
        wonRounds: 0,
        earnedPoints: 0
    };
    const playedElement = document.getElementById('statisticsPlayed');
    const wonElement = document.getElementById('statisticsWon');
    const winRateElement = document.getElementById('statisticsWinRate');
    const winRateCaptionElement = document.getElementById('statisticsWinRateCaption');
    const pointsElement = document.getElementById('statisticsPoints');

    function readStats() {
        const savedStats = global.localStorage.getItem(storageKey);
        if (savedStats === null) {
            global.localStorage.setItem(storageKey, JSON.stringify(initialStats));
            return { ...initialStats };
        }

        const stats = JSON.parse(savedStats);
        if (!stats
            || !Number.isSafeInteger(stats.playedRounds) || stats.playedRounds < 0
            || !Number.isSafeInteger(stats.wonRounds) || stats.wonRounds < 0
            || stats.wonRounds > stats.playedRounds
            || typeof stats.earnedPoints !== 'number'
            || !Number.isFinite(stats.earnedPoints) || stats.earnedPoints < 0) {
            throw new Error('The saved Pokemo statistics are invalid.');
        }

        return stats;
    }

    function render() {
        const stats = readStats();
        if (!playedElement) {
            return;
        }

        const winRate = stats.playedRounds === 0
            ? 0
            : (stats.wonRounds / stats.playedRounds) * 100;
        playedElement.textContent = stats.playedRounds.toLocaleString('de-DE');
        wonElement.textContent = stats.wonRounds.toLocaleString('de-DE');
        winRateElement.textContent = `${winRate.toLocaleString('de-DE', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        })} %`;
        winRateCaptionElement.textContent = `${stats.wonRounds.toLocaleString('de-DE')} von ${stats.playedRounds.toLocaleString('de-DE')} Runden`;
        pointsElement.textContent = stats.earnedPoints.toLocaleString('de-DE', {
            maximumFractionDigits: 1
        });
    }

    function completeRound(won, earnedPoints) {
        if (typeof won !== 'boolean') {
            throw new TypeError('The round result must be a boolean.');
        }
        if (typeof earnedPoints !== 'number' || !Number.isFinite(earnedPoints) || earnedPoints < 0) {
            throw new TypeError('Earned Pokemo points must be a non-negative number.');
        }

        const stats = readStats();
        if (!Number.isSafeInteger(stats.playedRounds + 1)
            || (won && !Number.isSafeInteger(stats.wonRounds + 1))) {
            throw new RangeError('The saved Pokemo round statistics are too large.');
        }

        stats.playedRounds += 1;
        if (won) {
            stats.wonRounds += 1;
        }
        stats.earnedPoints = Math.round((stats.earnedPoints + earnedPoints) * 10) / 10;
        global.localStorage.setItem(storageKey, JSON.stringify(stats));
        render();
        global.dispatchEvent(new CustomEvent('pokemo-stats-change'));
    }

    function getStats() {
        return { ...readStats() };
    }

    global.PokemoStats = Object.freeze({ completeRound, getStats });
    global.addEventListener('storage', (event) => {
        if (event.key === storageKey) {
            render();
        }
    });

    render();
})(window);
