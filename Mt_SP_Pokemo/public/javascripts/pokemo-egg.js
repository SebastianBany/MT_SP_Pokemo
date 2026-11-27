(function (global) {
    const collectionKey = 'pokemoEggCollection';
    const variantClasses = [
        'variant-shiny',
        'variant-golden',
        'variant-diamond',
        'variant-rainbow',
        'variant-shadow'
    ];
    let isOpening = false;

    function openEggBox() {
        const box = document.getElementById('eggBox');
        if (box && !box.open) {
            box.showModal();
        }
    }

    function closeEggBox() {
        const box = document.getElementById('eggBox');
        if (box && box.open) {
            box.close();
        }
    }

    function formatChance(chance) {
        return `${chance.toLocaleString('de-DE', { maximumFractionDigits: 12 })} %`;
    }

    function getSavedCollection() {
        const savedCollection = localStorage.getItem(collectionKey);
        return savedCollection ? JSON.parse(savedCollection) : {};
    }

    function saveLocalCopy(hatch) {
        const collection = getSavedCollection();
        const pokemonId = String(hatch.pokemon.speciesId);
        const previous = collection[pokemonId] || {};
        const previousCount = Number.isSafeInteger(previous.count) ? previous.count : 0;

        collection[pokemonId] = {
            name: hatch.pokemon.name,
            rarity: hatch.rarity.id,
            variant: hatch.variant.id,
            count: Math.max(previousCount + 1, hatch.pokemonCount)
        };
        localStorage.setItem(collectionKey, JSON.stringify(collection));
    }

    function updateResult(hatch) {
        const resultArea = document.querySelector('.egg-result-area');
        const pokemonImage = document.getElementById('eggPokemonImage');
        const pokemonName = document.getElementById('eggPokemonName');
        const variantText = document.getElementById('eggVariant');
        const message = document.getElementById('eggMessage');

        resultArea.className = `egg-result-area egg-result-${hatch.rarity.id}`;
        pokemonImage.classList.remove(...variantClasses);
        if (hatch.variant.id !== 'normal') {
            pokemonImage.classList.add(`variant-${hatch.variant.id}`);
        }

        pokemonImage.onerror = function () {
            if (pokemonImage.src !== hatch.pokemon.normalImage) {
                pokemonImage.src = hatch.pokemon.normalImage;
                pokemonImage.classList.remove('variant-shiny');
                variantText.textContent += ' – Shiny-Bild nicht verfügbar, Standardbild angezeigt';
                return;
            }

            pokemonImage.hidden = true;
            message.textContent = 'Das Pokemo wurde gespeichert, aber sein Bild konnte nicht geladen werden.';
        };
        pokemonImage.src = hatch.pokemon.image;
        pokemonImage.alt = hatch.pokemon.name;
        pokemonImage.hidden = false;
        pokemonName.textContent = hatch.pokemon.name.replace(/-/g, ' ');
        const isGameVariant = ['golden', 'diamond', 'rainbow', 'shadow'].includes(hatch.variant.id);
        const variantSource = isGameVariant ? ' – spielinterne Variante' : '';
        variantText.textContent =
            `${hatch.variant.name} (${formatChance(hatch.probability.variantPercent)})${variantSource}`;
        variantText.className = `egg-variant variant-label-${hatch.variant.id}`;

        let resultMessage = hatch.duplicate
            ? `Duplikat! Du erhältst ${hatch.pointsBonus} Pokemo-Punkte.`
            : `${hatch.pokemon.form} wurde deiner Sammlung hinzugefügt.`;
        if (hatch.fallbackMessage) {
            resultMessage += ` ${hatch.fallbackMessage}`;
        }

        try {
            saveLocalCopy(hatch);
        } catch (error) {
            console.error('Die lokale Kopie der Sammlung konnte nicht aktualisiert werden.', error);
            resultMessage += ' Die lokale Sammlung konnte nicht aktualisiert werden.';
        }

        if (hatch.pointsBonus > 0) {
            try {
                global.PokemoPoints.setBalance(
                    global.PokemoPoints.getBalance() + hatch.pointsBonus
                );
            } catch (error) {
                console.error('Der Duplikat-Bonus konnte nicht gespeichert werden.', error);
                resultMessage += ' Der Punktebonus konnte nicht gespeichert werden.';
            }
        }

        message.textContent = resultMessage;
    }

    async function openEgg() {
        if (isOpening) {
            return;
        }

        const eggAnimation = document.getElementById('eggAnimation');
        const message = document.getElementById('eggMessage');
        const openButton = document.getElementById('eggOpenButton');
        const pokemonImage = document.getElementById('eggPokemonImage');
        const pokemonName = document.getElementById('eggPokemonName');
        const variantText = document.getElementById('eggVariant');

        isOpening = true;
        openButton.disabled = true;
        pokemonImage.hidden = true;
        pokemonName.textContent = '';
        variantText.textContent = '';
        eggAnimation.hidden = false;
        eggAnimation.classList.add('is-spinning');
        message.textContent = 'Das Ei dreht sich ...';

        try {
            await new Promise((resolve) => setTimeout(resolve, 1400));
            const response = await fetch('/api/egg/hatch', {
                method: 'POST',
                headers: { 'X-Pokemo-Request': 'egg-hatch' },
                credentials: 'same-origin'
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Das Ei konnte nicht geöffnet werden.');
            }

            eggAnimation.classList.remove('is-spinning');
            eggAnimation.hidden = true;
            updateResult(result);
        } catch (error) {
            eggAnimation.classList.remove('is-spinning');
            eggAnimation.hidden = false;
            message.textContent = error instanceof TypeError
                ? 'Der Spielserver ist nicht erreichbar. Bitte starte ihn neu und versuche es noch einmal.'
                : error.message || 'Das Ei konnte nicht geöffnet werden.';
            console.error('Das Pokemo-Ei konnte nicht ausgebrütet werden.', error);
        } finally {
            isOpening = false;
            openButton.disabled = false;
        }
    }

    global.openEggBox = openEggBox;
    global.closeEggBox = closeEggBox;
    global.openEgg = openEgg;

    document.addEventListener('DOMContentLoaded', () => {
        const box = document.getElementById('eggBox');
        if (box) {
            box.addEventListener('click', (event) => {
                if (event.target === box) {
                    closeEggBox();
                }
            });
        }
    });
})(window);
