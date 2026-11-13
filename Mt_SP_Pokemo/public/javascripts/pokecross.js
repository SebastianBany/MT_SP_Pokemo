(function () {
    const circleCount = 22;
    const multiplierStep = 0.1;
    const maximumPokemonId = 1025;
    const animationDuration = 380;
    const canvas = document.getElementById('canvasPokecross');
    const startButton = document.getElementById('startGame');
    const crossButton = document.getElementById('crossButton');
    const exitButton = document.getElementById('exitButton');
    const status = document.getElementById('gameStatus');
    const gameStateLabel = document.getElementById('gameStateLabel');
    const currentMultiplier = document.getElementById('currentMultiplier');
    const jumpCounter = document.getElementById('jumpCounter');
    const jumpProgress = document.getElementById('jumpProgress');
    const pokemonName = document.getElementById('pokemonName');
    const pokemonType = document.getElementById('pokemonType');

    if (!canvas || !startButton || !crossButton || !exitButton || !status
        || !gameStateLabel || !currentMultiplier || !jumpCounter || !jumpProgress
        || !pokemonName || !pokemonType) {
        throw new Error('Pokecross is missing required game elements.');
    }

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Pokecross requires a browser with Canvas support.');
    }

    let gameState = 'loading';
    let losingJump = null;
    let position = 0;
    let animation = null;
    let pokemonImage = null;
    let pokemonReady = false;

    function multiplierFor(jump) {
        return (1 + jump * multiplierStep).toFixed(1);
    }

    function getLayout() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const margin = Math.max(112, Math.min(148, width * 0.11));
        const spacing = (width - margin * 2) / (circleCount - 1);

        return {
            width,
            height,
            margin,
            spacing,
            centerY: height * 0.7,
            radius: Math.min(20, spacing * 0.35, height * 0.055)
        };
    }

    function xForPosition(jump, layout) {
        if (jump === 0) {
            return layout.margin * 0.6;
        }
        return layout.margin + (jump - 1) * layout.spacing;
    }

    function drawBackground(layout) {
        const background = context.createLinearGradient(0, 0, 0, layout.height);
        background.addColorStop(0, '#111d2b');
        background.addColorStop(1, '#080d16');
        context.fillStyle = background;
        context.fillRect(0, 0, layout.width, layout.height);

        const glow = context.createRadialGradient(
            layout.width * 0.5,
            layout.centerY * 0.75,
            12,
            layout.width * 0.5,
            layout.centerY * 0.75,
            layout.width * 0.62
        );
        glow.addColorStop(0, 'rgba(53, 206, 178, 0.12)');
        glow.addColorStop(0.55, 'rgba(105, 91, 214, 0.06)');
        glow.addColorStop(1, 'rgba(8, 13, 22, 0)');
        context.fillStyle = glow;
        context.fillRect(0, 0, layout.width, layout.height);

        context.save();
        context.strokeStyle = 'rgba(173, 203, 221, 0.045)';
        context.lineWidth = 1;
        for (let x = 0; x <= layout.width; x += 48) {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, layout.height);
            context.stroke();
        }
        for (let y = 0; y <= layout.height; y += 48) {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(layout.width, y);
            context.stroke();
        }
        context.restore();
    }

    function drawTrack(layout) {
        const track = context.createLinearGradient(layout.margin, 0, layout.width - layout.margin, 0);
        track.addColorStop(0, '#41e5bd');
        track.addColorStop(0.5, '#67c8f4');
        track.addColorStop(1, '#9477ff');

        context.save();
        context.beginPath();
        context.moveTo(layout.margin, layout.centerY);
        context.lineTo(layout.width - layout.margin, layout.centerY);
        context.lineWidth = 5;
        context.lineCap = 'round';
        context.strokeStyle = 'rgba(114, 139, 165, 0.22)';
        context.stroke();
        context.shadowColor = 'rgba(75, 224, 199, 0.52)';
        context.shadowBlur = 14;
        context.strokeStyle = track;
        context.lineWidth = 2;
        context.stroke();
        context.restore();

        context.save();
        context.font = '700 10px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = 'rgba(174, 193, 212, 0.72)';
        context.fillText('START', xForPosition(0, layout), layout.centerY + layout.radius + 31);
        context.fillText('CASH OUT', layout.width - layout.margin, layout.centerY + layout.radius + 31);
        context.restore();
    }

    function drawCircles(layout) {
        const revealLosingCircle = gameState !== 'playing' && losingJump !== null;

        for (let jump = 1; jump <= circleCount; jump += 1) {
            const x = xForPosition(jump, layout);
            const isLosingCircle = revealLosingCircle && jump === losingJump;
            const hasPassed = jump <= position && !isLosingCircle;

            context.save();
            context.beginPath();
            context.arc(x, layout.centerY, layout.radius, 0, Math.PI * 2);
            if (isLosingCircle) {
                const danger = context.createRadialGradient(x - 5, layout.centerY - 7, 2, x, layout.centerY, layout.radius * 1.4);
                danger.addColorStop(0, '#ff817d');
                danger.addColorStop(1, '#a8233e');
                context.fillStyle = danger;
                context.shadowColor = 'rgba(255, 74, 94, 0.75)';
            } else if (hasPassed) {
                const safe = context.createRadialGradient(x - 5, layout.centerY - 7, 2, x, layout.centerY, layout.radius * 1.4);
                safe.addColorStop(0, '#a5ffe6');
                safe.addColorStop(1, '#32b995');
                context.fillStyle = safe;
                context.shadowColor = 'rgba(65, 229, 189, 0.6)';
            } else {
                const idle = context.createRadialGradient(x - 5, layout.centerY - 7, 2, x, layout.centerY, layout.radius * 1.4);
                idle.addColorStop(0, '#26374b');
                idle.addColorStop(1, '#152131');
                context.fillStyle = idle;
                context.shadowColor = 'rgba(91, 134, 174, 0.22)';
            }
            context.shadowBlur = isLosingCircle || hasPassed ? 15 : 8;
            context.fill();
            context.shadowBlur = 0;
            context.lineWidth = isLosingCircle ? 2 : 1;
            context.strokeStyle = isLosingCircle
                ? 'rgba(255, 177, 174, 0.9)'
                : hasPassed ? 'rgba(185, 255, 228, 0.76)' : 'rgba(163, 191, 220, 0.3)';
            context.stroke();

            context.fillStyle = isLosingCircle ? '#ffffff' : hasPassed ? '#07271e' : '#d8e4f0';
            context.font = `700 ${Math.max(8, Math.min(10, layout.radius * 0.55))}px Arial`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(`x${multiplierFor(jump)}`, x, layout.centerY);

            context.fillStyle = 'rgba(170, 190, 211, 0.62)';
            context.font = '600 9px Arial';
            context.fillText(String(jump).padStart(2, '0'), x, layout.centerY + layout.radius + 16);
            context.restore();
        }
    }

    function drawPokemon(x, layout, jumpHeight) {
        const groundY = layout.centerY - layout.radius - 3;
        const spriteHeight = Math.min(132, layout.height * 0.34);

        context.save();
        context.globalAlpha = animation ? 0.62 : 0.32;
        context.fillStyle = '#50e8c1';
        context.beginPath();
        context.ellipse(x, groundY + 9, layout.radius * 0.8, 4, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();

        if (!pokemonImage) {
            context.save();
            context.beginPath();
            context.arc(x, groundY - 27 - jumpHeight, 18, 0, Math.PI * 2);
            context.fillStyle = 'rgba(78, 221, 192, 0.2)';
            context.fill();
            context.strokeStyle = 'rgba(129, 246, 220, 0.65)';
            context.lineWidth = 2;
            context.stroke();
            context.restore();
            return;
        }

        const aspectRatio = pokemonImage.width / pokemonImage.height || 1;
        const spriteWidth = spriteHeight * aspectRatio;
        context.save();
        context.shadowColor = 'rgba(70, 235, 196, 0.68)';
        context.shadowBlur = 22;
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
        drawPokemon(playerX, layout, jumpHeight);
    }

    function resizeCanvas() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        draw();
    }

    function updateInterface() {
        const isPlaying = gameState === 'playing';
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
        startButton.disabled = gameState === 'loading';
        startButton.textContent = gameState === 'loading'
            ? 'Pokémon wird geladen ...'
            : gameState === 'load-error'
                ? 'Pokémon erneut laden'
                : gameState === 'ready' ? 'Runde starten' : 'Neue Runde';
        crossButton.disabled = Boolean(animation) || position >= circleCount;
        exitButton.disabled = Boolean(animation);
        gameStateLabel.textContent = labels[gameState];
        gameStateLabel.dataset.state = gameState;
        currentMultiplier.textContent = `x${multiplierFor(position)}`;
        jumpCounter.textContent = `${String(position).padStart(2, '0')} / ${circleCount}`;
        jumpProgress.style.width = `${position / circleCount * 100}%`;
    }

    function formatName(name) {
        return name.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
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
        pokemonName.textContent = 'Pokémon nicht verfügbar';
        pokemonType.textContent = 'PokéAPI-Verbindung prüfen';
        status.textContent = 'Das Pokémon konnte nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.';
        updateInterface();
        draw();
    }

    function loadPokemon() {
        gameState = 'loading';
        pokemonReady = false;
        status.textContent = 'Ein Pokémon wird aus der PokéAPI geladen ...';
        pokemonName.textContent = 'Wird geladen ...';
        pokemonType.textContent = 'PokéAPI';
        updateInterface();
        draw();

        if (!window.PokeAPI || typeof window.PokeAPI.getPokemon !== 'function') {
            handlePokemonLoadError(new Error('The shared PokeAPI client is not available.'));
            return;
        }

        const pokemonId = Math.floor(Math.random() * maximumPokemonId) + 1;
        window.PokeAPI.getPokemon(pokemonId)
            .then((pokemon) => loadSprite(spriteUrlsFor(pokemon), 0).then((image) => ({ pokemon, image })))
            .then(({ pokemon, image }) => {
                pokemonImage = image;
                pokemonReady = true;
                gameState = 'ready';
                pokemonName.textContent = formatName(pokemon.name);
                pokemonType.textContent = pokemon.types.map((entry) => formatName(entry.type.name)).join(' / ');
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

        losingJump = Math.floor(Math.random() * circleCount) + 1;
        position = 0;
        animation = null;
        gameState = 'playing';
        status.textContent = 'Die Runde läuft. Mit jedem sicheren Sprung steigt dein Multiplikator.';
        updateInterface();
        draw();
    }

    function finishJump(nextPosition) {
        position = nextPosition;
        animation = null;

        if (position === losingJump) {
            gameState = 'lost';
            status.textContent = `Sprung ${position} war die Falle. Dein Pokémon ist abgestürzt - Runde verloren.`;
        } else {
            status.textContent = `Sicher gelandet! Dein Multiplikator steht jetzt bei x${multiplierFor(position)}.`;
        }

        updateInterface();
        draw();
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
        status.textContent = `Du steigst mit x${multiplierFor(position)} aus. Die Falle lag bei Sprung ${losingJump}.`;
        updateInterface();
        draw();
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
    window.addEventListener('resize', resizeCanvas);

    updateInterface();
    resizeCanvas();
    loadPokemon();
})();
