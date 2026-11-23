(function () {
    const rowCount = 8;
    const columnCount = 3;
    const jumpAnimationDuration = 380;
    const spriteLoadTimeout = 5000;
    const board = document.getElementById('glutoxBoard');
    const tiles = Array.from(document.querySelectorAll('.glutox-tile'));
    const pokemon = document.getElementById('glutoxPokemon');
    const startButton = document.getElementById('glutoxStart');
    const allInButton = document.getElementById('glutoxAllIn');
    const exitButton = document.getElementById('glutoxExit');
    const stakeInput = document.getElementById('glutoxStake');
    const betPanel = document.getElementById('glutoxBet');
    const availablePoints = document.getElementById('glutoxAvailablePoints');
    const status = document.getElementById('glutoxStatus');
    const stateLabel = document.getElementById('glutoxStateLabel');
    const multiplierLabel = document.getElementById('glutoxMultiplier');
    const payout = document.getElementById('glutoxPayout');
    const payoutAmount = document.getElementById('glutoxPayoutAmount');

    if (!board || tiles.length !== rowCount * columnCount || !pokemon || !startButton
        || !allInButton || !exitButton || !stakeInput || !betPanel || !availablePoints || !status
        || !stateLabel || !multiplierLabel || !payout || !payoutAmount) {
        throw new Error('Glutox is missing required game elements.');
    }

    if (!window.PokemoPoints || !window.PokemoProfile || !window.PokeAPI) {
        throw new Error('Glutox requires the shared profile, points, and PokéAPI services.');
    }

    if (!window.PokemoAnimations) {
        throw new Error('Glutox requires the shared game animation service.');
    }

    let gameState = 'loading';
    let pokemonImageLoaded = false;
    let currentLevel = 0;
    let currentStake = 0;
    let allInSelected = false;
    let failedRowsByColumn = [];
    let previousFailedRows = null;
    let positionedTile = null;
    let transitionTimer = null;

    // Used by the interface and payout to calculate the multiplier per row.
    function multiplierFor(level) {
        if (level <= 0) {
            return 1;
        }

        return 1.04 * Math.pow(20 / 1.04, (level - 1) / (rowCount - 1));
    }

    // Keeps multiplier labels short on buttons and the board.
    function formatMultiplier(level) {
        return Number(multiplierFor(level).toFixed(2)).toString();
    }

    // Reads and validates the stake from the bet dialog.
    function stakeForRound(balance) {
        const stake = stakeInput.valueAsNumber;
        return Number.isSafeInteger(stake) && stake > 0
            && (stake % 10 === 0 || (allInSelected && stake === balance)) ? stake : null;
    }

    // Updates buttons, available points, multipliers, and round state.
    function updateInterface() {
        const isPlaying = gameState === 'playing';
        const isRoundActive = isPlaying || gameState === 'jumping' || gameState === 'losing'
            || gameState === 'cashing-out';
        const balance = window.PokemoPoints.getBalance();
        const stake = stakeForRound(balance);
        const labels = {
            loading: 'POKÉMON LÄDT',
            ready: 'BEREIT',
            playing: 'RUN LÄUFT',
            jumping: 'SPRUNG',
            losing: 'ABSTURZ',
            'cashing-out': 'GEWINN',
            lost: 'RUN BEENDET',
            'cashed-out': 'AUSGESTIEGEN',
            won: 'ZIEL ERREICHT',
            'load-error': 'OFFLINE'
        };

        betPanel.hidden = isRoundActive;
        exitButton.hidden = !isPlaying;
        exitButton.disabled = !isPlaying;
        exitButton.textContent = `Auszahlen (x${formatMultiplier(currentLevel)})`;
        availablePoints.textContent = String(balance);
        stakeInput.max = String(balance);
        allInButton.disabled = balance < 1;
        startButton.disabled = gameState === 'loading'
            || (gameState !== 'load-error' && (!pokemonImageLoaded || stake === null || stake > balance));
        startButton.textContent = gameState === 'loading'
            ? 'Pokémon wird geladen ...'
            : gameState === 'load-error'
                ? 'Pokémon erneut laden'
                : gameState === 'ready' ? 'Runde starten' : 'Neue Runde';
        multiplierLabel.textContent = `x${formatMultiplier(currentLevel)}`;
        stateLabel.textContent = labels[gameState];
        stateLabel.dataset.state = gameState;

        tiles.forEach((tile) => {
            const row = Number(tile.dataset.row);
            tile.disabled = !isPlaying || row !== currentLevel;
        });
    }

    // Gets available sprite URLs from the PokéAPI response.
    function spriteUrlsFor(pokemon) {
        const sprites = pokemon && pokemon.sprites;
        const artwork = sprites && sprites.other && sprites.other['official-artwork'];
        return [
            artwork && artwork.front_default,
            sprites && sprites.front_default
        ].filter(Boolean);
    }

    // Tries the sprite URLs in order and rejects if none can be loaded.
    function loadSprite(urls, index) {
        if (index >= urls.length) {
            return Promise.reject(new Error('No usable Pokémon sprite was returned by PokéAPI.'));
        }

        return new Promise((resolve, reject) => {
            const image = new Image();
            let timeout;
            const tryNextSprite = () => {
                window.clearTimeout(timeout);
                image.onload = null;
                image.onerror = null;
                loadSprite(urls, index + 1).then(resolve, reject);
            };

            image.onload = () => {
                window.clearTimeout(timeout);
                resolve(image);
            };
            image.onerror = tryNextSprite;
            timeout = window.setTimeout(tryNextSprite, spriteLoadTimeout);
            image.src = urls[index];
        });
    }

    // Allows play to continue without a sprite when loading fails.
    function handlePokemonSpriteError(error) {
        console.warn('Glutox could not load the Pokémon sprite; the game will continue without it.', error);
        pokemonImageLoaded = true;
        pokemon.hidden = true;
        gameState = 'ready';
        status.textContent = 'Pokémon konnte nicht von der PokéAPI geladen werden. Du kannst trotzdem spielen.';
        updateInterface();
    }

    // Loads the selected starter when the game opens or the profile changes.
    function loadPokemon() {
        gameState = 'loading';
        pokemonImageLoaded = false;
        status.textContent = 'Ein Pokémon wird aus der PokéAPI geladen ...';
        updateInterface();

        const pokemonId = window.PokemoProfile.getStarterPokemonId();
        window.PokeAPI.getPokemon(pokemonId)
            .then((pokemon) => loadSprite(spriteUrlsFor(pokemon), 0))
            .then((image) => {
                pokemon.src = image.src;
                pokemon.alt = `Pokémon Nummer ${pokemonId}`;
                pokemonImageLoaded = true;
                gameState = 'ready';
                status.textContent = 'Dein Pokémon ist bereit. Wähle ein Feld in der untersten Reihe.';
                updateInterface();
            })
            .catch(handlePokemonSpriteError);
    }

    // Places the Pokémon over a tile or on the start line.
    function positionPokemon(tile) {
        const boardRect = board.getBoundingClientRect();
        const target = tile || board.querySelector('.glutox-start-line');
        const targetRect = target.getBoundingClientRect();
        pokemon.style.left = `${targetRect.left - boardRect.left + targetRect.width / 2}px`;
        pokemon.style.top = `${targetRect.top - boardRect.top + targetRect.height / 2}px`;
        positionedTile = tile;
    }

    // Chooses one unsafe field per column for the next round.
    function generateFailedRows() {
        const failedRows = Array.from({ length: columnCount }, () => Math.floor(Math.random() * rowCount));
        if (failedRows[0] === failedRows[1] && failedRows[1] === failedRows[2]) {
            failedRows[2] = (failedRows[2] + 1) % rowCount;
        }
        if (previousFailedRows && failedRows.every((row, column) => row === previousFailedRows[column])) {
            failedRows[2] = (failedRows[2] + 1) % rowCount;
            if (failedRows[0] === failedRows[1] && failedRows[1] === failedRows[2]) {
                failedRows[2] = (failedRows[2] + 1) % rowCount;
            }
        }

        previousFailedRows = failedRows;
        return failedRows;
    }

    // Clears old highlights and prepares a fresh randomized board.
    function resetBoard() {
        tiles.forEach((tile) => {
            tile.classList.remove('is-safe', 'is-danger', 'is-unselected', 'is-path');
        });
        failedRowsByColumn = generateFailedRows();
        currentLevel = 0;
        pokemon.classList.remove('is-jumping');
        pokemon.style.opacity = '';
        pokemon.style.transform = '';
        pokemon.hidden = !pokemonImageLoaded;
        positionPokemon(null);
    }

    // Reveals the first safe tile in each row as one valid route.
    function revealSafePath() {
        const safePath = [];
        for (let row = 0; row < rowCount; row += 1) {
            const safeTile = tiles.find((tile) => {
                const column = Number(tile.dataset.column);
                return Number(tile.dataset.row) === row && failedRowsByColumn[column] !== row;
            });
            if (!safeTile) {
                throw new Error(`Glutox could not find a safe tile in row ${row + 1}.`);
            }
            safePath.push(safeTile);
        }

        tiles.forEach((tile) => {
            tile.classList.add(safePath.includes(tile) ? 'is-path' : 'is-unselected');
        });
    }

    // Adds the winnings to the balance and animates the payout overlay.
    function runPayout(state, message) {
        const amount = Math.round(currentStake * multiplierFor(currentLevel) * 10) / 10;
        const multiplier = formatMultiplier(currentLevel);
        gameState = 'cashing-out';
        payoutAmount.textContent = '+0';
        status.textContent = message;
        status.setAttribute('aria-live', 'off');
        window.PokemoPoints.setBalance(window.PokemoPoints.getBalance() + amount);
        updateInterface();
        payout.hidden = false;

        window.PokemoAnimations.animatePayout(payoutAmount, amount, () => {
            payout.hidden = true;
            gameState = state;
            status.setAttribute('aria-live', 'polite');
            status.textContent = `${message} Du erhältst ${String(amount)} Pokémo-Punkte (x${multiplier}).`;
            updateInterface();
        });
    }

    // Checks a selected field, then advances the player or starts a fall.
    function chooseTile(tile) {
        if (gameState !== 'playing') {
            return;
        }

        const row = Number(tile.dataset.row);
        const column = Number(tile.dataset.column);
        if (row !== currentLevel) {
            return;
        }

        const isSafe = failedRowsByColumn[column] !== row;
        tiles.forEach((rowTile) => {
            if (Number(rowTile.dataset.row) === row && rowTile !== tile) {
                rowTile.classList.add('is-unselected');
            }
        });
        tile.classList.add(isSafe ? 'is-safe' : 'is-danger');
        gameState = isSafe ? 'jumping' : 'losing';
        positionPokemon(tile);
        pokemon.classList.add('is-jumping');
        status.textContent = isSafe
            ? `Sicher! Reihe ${row + 1} geschafft, der Multiplikator steigt auf x${formatMultiplier(currentLevel + 1)}.`
            : `Oh nein! Dein Pokémon springt auf das falsche Feld in Reihe ${row + 1} ...`;
        updateInterface();

        transitionTimer = window.setTimeout(() => {
            pokemon.classList.remove('is-jumping');
            if (!isSafe) {
                revealSafePath();
                window.PokemoAnimations.animateFall((progress) => {
                    pokemon.style.opacity = String(1 - progress);
                    pokemon.style.transform = `translate(-50%, ${-78 + 173 * progress}%) rotate(${75 * progress}deg)`;
                }, () => {
                    pokemon.style.opacity = '';
                    pokemon.style.transform = '';
                    pokemon.hidden = true;
                    gameState = 'lost';
                    status.textContent = `Bei deinem Sprung in Reihe ${row + 1} bist du abgestürzt. Dein Einsatz von ${currentStake} Pokémo-Punkten ist verloren.`;
                    updateInterface();
                });
                return;
            }

            currentLevel += 1;
            if (currentLevel === rowCount) {
                runPayout('won', 'Alle acht Reihen geschafft!');
                return;
            }

            gameState = 'playing';
            status.textContent = `Sicher gelandet! Wähle ein Feld in Reihe ${currentLevel + 1}.`;
            updateInterface();
        }, jumpAnimationDuration);
    }

    // Validates and deducts the stake, then starts a new round.
    function startGame() {
        if (!pokemonImageLoaded) {
            return;
        }

        const balance = window.PokemoPoints.getBalance();
        const stake = stakeForRound(balance);
        if (stake === null || stake > balance) {
            status.textContent = 'Der Einsatz muss ein Vielfaches von 10 oder dein gesamtes Guthaben sein.';
            updateInterface();
            stakeInput.focus();
            return;
        }

        currentStake = stake;
        allInSelected = false;
        window.PokemoPoints.setBalance(balance - currentStake);
        window.clearTimeout(transitionTimer);
        payout.hidden = true;
        resetBoard();
        gameState = 'playing';
        status.textContent = 'Die Runde läuft. Wähle ein Feld in der untersten Reihe.';
        updateInterface();
    }

    function selectAllIn() {
        const balance = window.PokemoPoints.getBalance();
        if (balance < 1) {
            return;
        }

        stakeInput.value = String(balance);
        allInSelected = true;
        updateInterface();
    }

    // Pays out the current multiplier when the player cashes out.
    function exitGame() {
        if (gameState !== 'playing') {
            return;
        }
        runPayout('cashed-out', `Du zahlst mit x${formatMultiplier(currentLevel)} aus.`);
    }

    startButton.addEventListener('click', () => {
        if (gameState === 'load-error') {
            loadPokemon();
        } else {
            startGame();
        }
    });
    tiles.forEach((tile) => tile.addEventListener('click', () => chooseTile(tile)));
    allInButton.addEventListener('click', selectAllIn);
    exitButton.addEventListener('click', exitGame);
    stakeInput.addEventListener('input', () => {
        allInSelected = false;
        updateInterface();
    });
    window.addEventListener('pokemo-points-change', updateInterface);
    window.addEventListener('pokemo-starter-change', () => {
        if (!['playing', 'jumping', 'losing', 'cashing-out'].includes(gameState)) {
            loadPokemon();
        }
    });
    window.addEventListener('resize', () => positionPokemon(positionedTile));

    updateInterface();
    loadPokemon();
})();
