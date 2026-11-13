(function () {
    const circleCount = 22;
    const visibleCircleCount = 5;
    const firstJumpSurvivalChance = 0.95;
    const lastJumpSurvivalChance = 0.2;
    const animationDuration = 380;
    const canvas = document.getElementById('canvasPokecross');
    const canvasContainer = canvas && canvas.parentElement;
    const startButton = document.getElementById('startGame');
    const crossButton = document.getElementById('crossButton');
    const exitButton = document.getElementById('exitButton');
    const stakeInput = document.getElementById('stakeAmount');
    const betPanel = document.getElementById('gameBet');
    const availablePoints = document.getElementById('availablePoints');
    const status = document.getElementById('gameStatus');
    const gameStateLabel = document.getElementById('gameStateLabel');

    if (!canvas || !canvasContainer || !startButton || !crossButton || !exitButton
        || !stakeInput || !betPanel || !availablePoints || !status || !gameStateLabel) {
        throw new Error('Pokecross is missing required game elements.');
    }

    if (!window.PokemoPoints || !window.PokemoProfile || !window.PokeAPI) {
        throw new Error('Pokecross requires the shared Pokémo profile and points services.');
    }

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Pokecross requires a browser with Canvas support.');
    }

    let gameState = 'loading';
    let failedJump = null;
    let position = 0;
    let animation = null;
    let pokemonImage = null;
    let pokemonReady = false;
    let currentStake = 0;

    function multiplierFor(jump) {
        if (jump <= 0) {
            return 1;
        }

        return Math.pow(circleCount, (jump - 1) / (circleCount - 1));
    }

    function survivalChanceFor(jump) {
        const progress = (jump - 1) / (circleCount - 1);
        return firstJumpSurvivalChance
            * Math.pow(lastJumpSurvivalChance / firstJumpSurvivalChance, progress);
    }

    function formatMultiplier(jump) {
        return Number(multiplierFor(jump).toFixed(2)).toString();
    }

    function stakeForRound() {
        const stake = stakeInput.valueAsNumber;
        return Number.isSafeInteger(stake) && stake > 0 ? stake : null;
    }

    function getLayout() {
        const viewportWidth = canvasContainer.clientWidth;
        const height = canvasContainer.clientHeight;
        const margin = Math.max(44, Math.min(76, viewportWidth * 0.12));
        const spacing = (viewportWidth - margin * 2) / visibleCircleCount;
        const width = margin * 2 + spacing * circleCount;

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        return {
            width,
            height,
            viewportWidth,
            margin,
            spacing,
            centerY: height * 0.68,
            radius: Math.min(48, spacing * 0.35, height * 0.14)
        };
    }

    function xForPosition(jump, layout) {
        return layout.margin + jump * layout.spacing;
    }

    function drawBackground(layout) {
        context.fillStyle = '#f3edcf';
        context.fillRect(0, 0, layout.width, layout.height);
    }

    function drawTrack(layout) {
        context.save();
        context.beginPath();
        context.moveTo(xForPosition(0, layout), layout.centerY);
        context.lineTo(xForPosition(circleCount, layout), layout.centerY);
        context.lineWidth = 8;
        context.lineCap = 'round';
        context.strokeStyle = '#d9e7bc';
        context.stroke();
        context.strokeStyle = '#a8c77d';
        context.lineWidth = 3;
        context.stroke();
        context.restore();

        context.save();
        context.font = '700 10px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#73865c';
        context.fillText('START', xForPosition(0, layout), layout.centerY + layout.radius + 30);
        context.fillText('ZIEL', xForPosition(circleCount, layout), layout.centerY + layout.radius + 30);
        context.restore();
    }

    function drawCircles(layout) {
        const revealFailedCircle = gameState !== 'playing' && failedJump !== null;

        for (let jump = 1; jump <= circleCount; jump += 1) {
            const x = xForPosition(jump, layout);
            const isFailedCircle = revealFailedCircle && jump === failedJump;
            const hasPassed = jump <= position && !isFailedCircle;

            context.save();
            context.beginPath();
            context.arc(x, layout.centerY, layout.radius, 0, Math.PI * 2);
            if (isFailedCircle) {
                const danger = context.createRadialGradient(x - 5, layout.centerY - 7, 2, x, layout.centerY, layout.radius * 1.4);
                danger.addColorStop(0, '#ff817d');
                danger.addColorStop(1, '#a8233e');
                context.fillStyle = danger;
                context.shadowColor = 'rgba(255, 74, 94, 0.75)';
            } else if (hasPassed) {
                const safe = context.createRadialGradient(x - 5, layout.centerY - 7, 2, x, layout.centerY, layout.radius * 1.4);
                safe.addColorStop(0, '#d7f0a9');
                safe.addColorStop(1, '#8ebc58');
                context.fillStyle = safe;
                context.shadowColor = 'rgba(115, 160, 65, 0.28)';
            } else {
                const idle = context.createRadialGradient(x - 5, layout.centerY - 7, 2, x, layout.centerY, layout.radius * 1.4);
                idle.addColorStop(0, '#ffffff');
                idle.addColorStop(1, '#eaf2d8');
                context.fillStyle = idle;
                context.shadowColor = 'rgba(91, 119, 62, 0.16)';
            }
            context.shadowBlur = isFailedCircle || hasPassed ? 8 : 5;
            context.fill();
            context.shadowBlur = 0;
            context.lineWidth = isFailedCircle ? 3 : 2;
            context.strokeStyle = isFailedCircle
                ? '#d97662'
                : hasPassed ? '#79a547' : '#c5d3aa';
            context.stroke();

            context.fillStyle = isFailedCircle ? '#ffffff' : '#425638';
            context.font = `700 ${Math.max(12, Math.min(17, layout.radius * 0.43))}px Arial`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(`x${formatMultiplier(jump)}`, x, layout.centerY);

            context.fillStyle = '#73865c';
            context.font = '700 11px Arial';
            context.fillText(String(jump).padStart(2, '0'), x, layout.centerY + layout.radius + 16);
            context.restore();
        }
    }

    function drawPokemon(x, layout, jumpHeight) {
        const groundY = layout.centerY - layout.radius - 3;
        const spriteHeight = Math.min(132, layout.height * 0.34);

        context.save();
        context.globalAlpha = animation ? 0.62 : 0.32;
        context.fillStyle = '#9fbd75';
        context.beginPath();
        context.ellipse(x, groundY + 9, layout.radius * 0.8, 4, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();

        if (!pokemonImage) {
            context.save();
            context.beginPath();
            context.arc(x, groundY - 27 - jumpHeight, 18, 0, Math.PI * 2);
            context.fillStyle = 'rgba(132, 174, 87, 0.22)';
            context.fill();
            context.strokeStyle = 'rgba(106, 151, 66, 0.7)';
            context.lineWidth = 2;
            context.stroke();
            context.restore();
            return;
        }

        const aspectRatio = pokemonImage.width / pokemonImage.height || 1;
        const spriteWidth = spriteHeight * aspectRatio;
        context.save();
        context.shadowColor = 'rgba(99, 138, 58, 0.24)';
        context.shadowBlur = 12;
        context.drawImage(
            pokemonImage,
            x - spriteWidth / 2,
            groundY - spriteHeight - jumpHeight,
            spriteWidth,
            spriteHeight
        );
        context.restore();
    }

    function draw(now) {
        const layout = getLayout();
        const currentTime = now === undefined ? performance.now() : now;
        context.clearRect(0, 0, layout.width, layout.height);
        drawBackground(layout);
        drawTrack(layout);
        drawCircles(layout);

        let playerX = xForPosition(position, layout);
        let jumpHeight = 0;
        if (animation) {
            const progress = Math.min(1, (currentTime - animation.startedAt) / animationDuration);
            const easedProgress = progress * progress * (3 - 2 * progress);
            playerX = xForPosition(animation.from, layout)
                + (xForPosition(animation.to, layout) - xForPosition(animation.from, layout)) * easedProgress;
            jumpHeight = Math.sin(progress * Math.PI) * Math.min(78, layout.height * 0.22);
        }
        const cameraOffset = Math.max(0, playerX - layout.viewportWidth / 2);
        canvas.style.transform = `translate3d(${-cameraOffset}px, 0, 0)`;
        drawPokemon(playerX, layout, jumpHeight);
    }

    function resizeCanvas() {
        const layout = getLayout();
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.round(layout.width * pixelRatio);
        canvas.height = Math.round(layout.height * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        draw();
    }

    function updateInterface() {
        const isPlaying = gameState === 'playing';
        const balance = window.PokemoPoints.getBalance();
        const stake = stakeForRound();
        const labels = {
            loading: 'POKÉMON LÄDT',
            ready: 'BEREIT',
            playing: 'RUN LÄUFT',
            lost: 'RUN BEENDET',
            'cashed-out': 'AUSGESTIEGEN',
            'load-error': 'OFFLINE'
        };

        startButton.hidden = isPlaying;
        crossButton.hidden = !isPlaying;
        exitButton.hidden = !isPlaying;
        betPanel.hidden = isPlaying;
        availablePoints.textContent = balance.toLocaleString('de-DE');
        stakeInput.max = String(Math.floor(balance));
        startButton.disabled = gameState === 'loading'
            || (gameState !== 'load-error' && (!pokemonReady || stake === null || stake > balance));
        startButton.textContent = gameState === 'loading'
            ? 'Pokémon wird geladen ...'
            : gameState === 'load-error'
                ? 'Pokémon erneut laden'
                : gameState === 'ready' ? 'Runde starten' : 'Neue Runde';
        crossButton.disabled = Boolean(animation) || position >= circleCount;
        exitButton.disabled = Boolean(animation);
        exitButton.textContent = `Aussteigen (x${formatMultiplier(position)})`;
        gameStateLabel.textContent = labels[gameState];
        gameStateLabel.dataset.state = gameState;
    }

    function spriteUrlsFor(pokemon) {
        const sprites = pokemon.sprites || {};
        const artwork = sprites.other && sprites.other['official-artwork'];
        return [
            artwork && artwork.front_default,
            sprites.front_default,
            sprites.front_shiny
        ].filter((url, index, urls) => url && urls.indexOf(url) === index);
    }

    function loadSprite(urls, index) {
        if (index >= urls.length) {
            return Promise.reject(new Error('No usable Pokémon sprite was returned by PokéAPI.'));
        }

        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => {
                loadSprite(urls, index + 1).then(resolve, reject);
            };
            image.src = urls[index];
        });
    }

    function handlePokemonLoadError(error) {
        console.error('Pokecross could not load its Pokémon.', error);
        pokemonReady = false;
        pokemonImage = null;
        gameState = 'load-error';
        status.textContent = 'Das Pokémon konnte nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.';
        updateInterface();
        draw();
    }

    function loadPokemon() {
        gameState = 'loading';
        pokemonReady = false;
        status.textContent = 'Ein Pokémon wird aus der PokéAPI geladen ...';
        updateInterface();
        draw();

        if (!window.PokeAPI || typeof window.PokeAPI.getPokemon !== 'function') {
            handlePokemonLoadError(new Error('The shared PokeAPI client is not available.'));
            return;
        }

        const pokemonId = window.PokemoProfile.getStarterPokemonId();
        window.PokeAPI.getPokemon(pokemonId)
            .then((pokemon) => loadSprite(spriteUrlsFor(pokemon), 0).then((image) => ({ pokemon, image })))
            .then(({ pokemon, image }) => {
                pokemonImage = image;
                pokemonReady = true;
                gameState = 'ready';
                status.textContent = 'Dein Pokémon ist bereit. Wie weit traust du dich?';
                updateInterface();
                draw();
            })
            .catch(handlePokemonLoadError);
    }

    function startGame() {
        if (!pokemonReady) {
            return;
        }

        const stake = stakeForRound();
        const balance = window.PokemoPoints.getBalance();
        if (stake === null || stake > balance) {
            status.textContent = 'Der Einsatz muss eine positive ganze Zahl sein und darf dein Guthaben nicht überschreiten.';
            updateInterface();
            stakeInput.focus();
            return;
        }

        currentStake = stake;
        window.PokemoPoints.setBalance(balance - currentStake);
        failedJump = null;
        position = 0;
        animation = null;
        canvas.style.transform = 'translate3d(0, 0, 0)';
        gameState = 'playing';
        status.textContent = 'Die Runde läuft. Mit jedem sicheren Sprung steigt dein Multiplikator.';
        updateInterface();
        draw();
    }

    function finishJump(nextPosition) {
        position = nextPosition;
        animation = null;

        if (Math.random() >= survivalChanceFor(position)) {
            failedJump = position;
            gameState = 'lost';
            status.textContent = `Bei Sprung ${position} bist du abgestürzt. Deine Überlebenschance lag bei ${Math.round(survivalChanceFor(position) * 100)} %. Dein Einsatz von ${currentStake} Pokémo-Punkten ist verloren.`;
        } else if (position === circleCount) {
            status.textContent = `Ziel erreicht! Dein Multiplikator steht bei x${formatMultiplier(position)}. Du kannst jetzt aussteigen.`;
        } else {
            status.textContent = `Sicher gelandet! Überlebenschance beim nächsten Sprung: ${Math.round(survivalChanceFor(position + 1) * 100)} %.`;
        }

        updateInterface();
        draw();
        if (gameState === 'lost') {
            stakeInput.focus();
        }
    }

    function animateJump(nextPosition) {
        animation = {
            from: position,
            to: nextPosition,
            startedAt: performance.now()
        };
        updateInterface();

        function frame(now) {
            draw(now);
            if (now - animation.startedAt < animationDuration) {
                requestAnimationFrame(frame);
                return;
            }
            finishJump(nextPosition);
        }

        requestAnimationFrame(frame);
    }

    function cross() {
        if (gameState !== 'playing' || animation || position >= circleCount) {
            return;
        }
        animateJump(position + 1);
    }

    function exitGame() {
        if (gameState !== 'playing' || animation) {
            return;
        }

        gameState = 'cashed-out';
        const payout = Number((currentStake * multiplierFor(position)).toFixed(1));
        window.PokemoPoints.setBalance(window.PokemoPoints.getBalance() + payout);
        status.textContent = `Du steigst mit x${formatMultiplier(position)} aus und erhältst ${payout.toLocaleString('de-DE')} Pokémo-Punkte.`;
        updateInterface();
        draw();
        stakeInput.focus();
    }

    startButton.addEventListener('click', () => {
        if (gameState === 'load-error') {
            loadPokemon();
        } else {
            startGame();
        }
    });
    crossButton.addEventListener('click', cross);
    exitButton.addEventListener('click', exitGame);
    stakeInput.addEventListener('input', updateInterface);
    window.addEventListener('pokemo-points-change', updateInterface);
    window.addEventListener('pokemo-starter-change', () => {
        if (gameState !== 'playing') {
            loadPokemon();
        }
    });
    window.addEventListener('resize', resizeCanvas);

    updateInterface();
    resizeCanvas();
    loadPokemon();
})();
