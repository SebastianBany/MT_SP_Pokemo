(function (global) {
    const storageKey = 'pokemoAchievements';
    const statsStorageKey = 'pokemoStatistics';
    const initialData = {
        unlocked: {},
        completedGlutoxRuns: 0
    };
    const achievements = [
        {
            id: 'glutox-master',
            icon: '🔥',
            name: 'Glutox-Meister',
            description: 'Schaffe erstmals alle 8 Reihen bei Glutox.',
            condition: 'Schaffe in einer Runde alle 8 Reihen bei Glutox. Frühes Auszahlen zählt nicht.'
        },
        {
            id: 'unstoppable',
            icon: '🏆',
            name: 'Unaufhaltsam',
            description: 'Schaffe Glutox insgesamt 10-mal vollständig.',
            condition: 'Schaffe insgesamt 10 Glutox-Runden vollständig. Frühes Auszahlen zählt nicht.'
        },
        {
            id: 'first-jump',
            icon: '👣',
            name: 'Erster Sprung',
            description: 'Überlebe erstmals einen Sprung bei Pokecross.',
            condition: 'Überlebe mindestens einen Sprung bei Pokecross.'
        },
        {
            id: 'pokecross-legend',
            icon: '🌟',
            name: 'Pokecross-Legende',
            description: 'Erreiche alle 22 Sprünge bei Pokecross.',
            condition: 'Überlebe alle 22 Sprünge und erreiche das Ziel bei Pokecross.'
        },
        {
            id: 'regular-player',
            icon: '🎮',
            name: 'Stammspieler',
            description: 'Spiele insgesamt 50 Runden.',
            condition: 'Schließe insgesamt 50 Runden in Pokemo ab.'
        },
        {
            id: 'pokemo-veteran',
            icon: '🐣',
            name: 'Frisch geschlüpft',
            description: 'Öffne dein erstes Ei.',
            condition: 'Öffne dein erstes Ei in Pokemo.'
        }
    ];
    const achievementsById = new Map(achievements.map((achievement) => [achievement.id, achievement]));
    const grid = document.getElementById('achievementGrid');
    const countElement = document.getElementById('achievementsCount');
    const dialog = document.getElementById('achievementDialog');
    const detailIcon = document.getElementById('achievementDetailsIcon');
    const detailTitle = document.getElementById('achievementDetailsTitle');
    const detailCondition = document.getElementById('achievementDetailsCondition');
    const detailDate = document.getElementById('achievementDetailsDate');
    const detailClose = document.getElementById('achievementDetailsClose');
    const toast = document.getElementById('achievementToast');
    const toastIcon = document.getElementById('achievementToastIcon');
    const toastName = document.getElementById('achievementToastName');
    const toastQueue = [];
    let toastTimer = null;

    function readData() {
        const savedData = global.localStorage.getItem(storageKey);
        if (savedData === null) {
            global.localStorage.setItem(storageKey, JSON.stringify(initialData));
            return { unlocked: {}, completedGlutoxRuns: 0 };
        }

        const data = JSON.parse(savedData);
        if (!data
            || !data.unlocked
            || typeof data.unlocked !== 'object'
            || Array.isArray(data.unlocked)
            || !Number.isSafeInteger(data.completedGlutoxRuns)
            || data.completedGlutoxRuns < 0) {
            throw new Error('The saved Pokemo achievements are invalid.');
        }
        Object.values(data.unlocked).forEach((date) => {
            if (typeof date !== 'string' || !Number.isFinite(Date.parse(date))) {
                throw new Error('A saved Pokemo achievement date is invalid.');
            }
        });

        return data;
    }

    function saveData(data) {
        global.localStorage.setItem(storageKey, JSON.stringify(data));
    }

    function isUnlocked(data, id) {
        return Object.prototype.hasOwnProperty.call(data.unlocked, id);
    }

    function unlockInData(data, id, notifications) {
        if (isUnlocked(data, id)) {
            return false;
        }

        data.unlocked[id] = new Date().toISOString();
        notifications.push(achievementsById.get(id));
        return true;
    }

    function render() {
        if (!grid) {
            return;
        }

        const data = readData();
        const unlockedCount = achievements.filter((achievement) => isUnlocked(data, achievement.id)).length;
        countElement.textContent = `${unlockedCount} von ${achievements.length} freigeschaltet`;
        grid.replaceChildren();

        achievements.forEach((achievement) => {
            const unlocked = isUnlocked(data, achievement.id);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `achievement-card ${unlocked ? 'is-unlocked' : 'is-locked'}`;
            card.dataset.achievementId = achievement.id;

            const iconWrap = document.createElement('span');
            iconWrap.className = 'achievement-icon-wrap';
            iconWrap.setAttribute('aria-hidden', 'true');
            iconWrap.textContent = achievement.icon;
            if (!unlocked) {
                const lock = document.createElement('span');
                lock.className = 'achievement-lock';
                lock.textContent = '🔒';
                iconWrap.appendChild(lock);
            }

            const name = document.createElement('span');
            name.className = 'achievement-card-title';
            name.textContent = achievement.name;
            const description = document.createElement('span');
            description.className = 'achievement-card-description';
            description.textContent = achievement.description;

            card.append(iconWrap, name, description);
            grid.appendChild(card);
        });
    }

    function announce(notifications) {
        notifications.forEach((achievement) => toastQueue.push(achievement));
        showNextToast();
    }

    function showNextToast() {
        if (!toast || toastQueue.length === 0 || !toast.hidden) {
            return;
        }

        const achievement = toastQueue.shift();
        toastIcon.textContent = achievement.icon;
        toastName.textContent = achievement.name;
        toast.hidden = false;
        toastTimer = global.setTimeout(() => {
            toast.hidden = true;
            toastTimer = null;
            showNextToast();
        }, 4000);
    }

    function saveUnlocks(data, notifications) {
        if (notifications.length === 0) {
            return;
        }
        saveData(data);
        render();
        announce(notifications);
    }

    function checkRoundAchievements() {
        const stats = global.PokemoStats.getStats();
        if (stats.playedRounds < 50) {
            return;
        }

        const data = readData();
        const notifications = [];
        unlockInData(data, 'regular-player', notifications);
        saveUnlocks(data, notifications);
    }

    function recordPokecrossProgress(position) {
        if (!Number.isSafeInteger(position) || position < 1 || position > 22) {
            throw new RangeError('Pokecross progress must be between 1 and 22 jumps.');
        }

        const data = readData();
        const notifications = [];
        unlockInData(data, 'first-jump', notifications);
        if (position === 22) {
            unlockInData(data, 'pokecross-legend', notifications);
        }
        saveUnlocks(data, notifications);
    }

    function recordGlutoxVictory() {
        const data = readData();
        if (!Number.isSafeInteger(data.completedGlutoxRuns + 1)) {
            throw new RangeError('The saved Glutox completion count is too large.');
        }

        data.completedGlutoxRuns += 1;
        const notifications = [];
        unlockInData(data, 'glutox-master', notifications);
        if (data.completedGlutoxRuns >= 10) {
            unlockInData(data, 'unstoppable', notifications);
        }
        saveData(data);
        render();
        announce(notifications);
    }

    if (grid) {
        grid.addEventListener('click', (event) => {
            const card = event.target.closest('[data-achievement-id]');
            if (!card || !dialog) {
                return;
            }

            const achievement = achievementsById.get(card.dataset.achievementId);
            const data = readData();
            const unlocked = isUnlocked(data, achievement.id);
            detailIcon.textContent = achievement.icon;
            detailTitle.textContent = achievement.name;
            detailCondition.textContent = achievement.condition;
            detailDate.hidden = !unlocked;
            if (unlocked) {
                detailDate.textContent = `Freigeschaltet am ${new Date(data.unlocked[achievement.id]).toLocaleDateString('de-DE')}`;
            }
            dialog.showModal();
        });
    }

    if (detailClose && dialog) {
        detailClose.addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) {
                dialog.close();
            }
        });
    }

    global.PokemoAchievements = Object.freeze({
        recordPokecrossProgress,
        recordGlutoxVictory
    });
    global.addEventListener('pokemo-stats-change', checkRoundAchievements);
    global.addEventListener('storage', (event) => {
        if (event.key === storageKey) {
            render();
        } else if (event.key === statsStorageKey) {
            checkRoundAchievements();
        }
    });

    render();
    checkRoundAchievements();
})(window);
