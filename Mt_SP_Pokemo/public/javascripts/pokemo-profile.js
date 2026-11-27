(function (global) {
    const starterPokemonIds = Object.freeze([1, 4, 7]);
    const defaultStarterPokemonId = starterPokemonIds[0];
    const storageKey = 'pokemoStarterPokemonId';
    let starterPokemon = [];
    const profilePokemonById = new Map();

    if (!global.PokemoProgression) {
        throw new Error('The Pokemo profile requires the shared progression service.');
    }

    function getStarterPokemonId() {
        const savedId = localStorage.getItem(storageKey);
        if (savedId === null) {
            return defaultStarterPokemonId;
        }

        const pokemonId = Number(savedId);
        return starterPokemonIds.includes(pokemonId)
            ? pokemonId
            : defaultStarterPokemonId;
    }

    function hasStarterSelection() {
        const savedId = localStorage.getItem(storageKey);
        return savedId !== null && starterPokemonIds.includes(Number(savedId));
    }

    function setStarterPokemonId(pokemonId) {
        if (!starterPokemonIds.includes(pokemonId)) {
            throw new RangeError('Choose one of the three starter Pokémon.');
        }

        localStorage.setItem(storageKey, String(pokemonId));
        global.dispatchEvent(new CustomEvent('pokemo-starter-change', {
            detail: pokemonId
        }));
        renderProfilePokemon();
    }

    function getCurrentPokemonId() {
        return global.PokemoProgression.getActivePokemonId(getStarterPokemonId());
    }

    function getPokemonImage(pokemon) {
        return pokemon.sprites.other['official-artwork'].front_default
            || pokemon.sprites.front_default;
    }

    function renderProfilePokemon() {
        const button = document.querySelector('.pokemon-profile-button');
        const image = document.querySelector('.profile-pokemon-image');
        if (!button || !image) {
            return;
        }

        const pokemonId = getCurrentPokemonId();
        const pokemon = starterPokemon.find((item) => item.id === pokemonId)
            || profilePokemonById.get(pokemonId);
        if (pokemon) {
            applyProfilePokemon(button, image, pokemon);
            return;
        }

        PokeAPI.getPokemon(pokemonId)
            .then((loadedPokemon) => {
                profilePokemonById.set(pokemonId, loadedPokemon);
                if (getCurrentPokemonId() === pokemonId) {
                    applyProfilePokemon(button, image, loadedPokemon);
                }
            })
            .catch((error) => {
                console.error('Das Profil-Pokémon konnte nicht von der PokéAPI geladen werden.', error);
            });
    }

    function applyProfilePokemon(button, image, pokemon) {
        image.src = getPokemonImage(pokemon);
        image.alt = pokemon.name;
        image.hidden = false;
        button.classList.add('has-pokemon');
        button.setAttribute('aria-label', `Pokemo auswählen. Aktuell ausgewählt: ${pokemon.name}`);
    }

    async function loadStarterPokemon() {
        if (starterPokemon.length !== starterPokemonIds.length) {
            starterPokemon = await Promise.all(starterPokemonIds.map((pokemonId) =>
                PokeAPI.getPokemon(pokemonId)
            ));
        }
    }

    async function openPokemonPicker() {
        const picker = document.getElementById('pokemonPicker');
        if (!picker) {
            return;
        }

        if (!picker.open) {
            picker.showModal();
        }

        try {
            await loadStarterPokemon();
            renderStarterPokemon();
        } catch (error) {
            document.getElementById('pokemonCount').textContent =
                'Starter-Pokemos konnten nicht von der PokéAPI geladen werden.';
        }
    }

    function renderStarterPokemon() {
        const list = document.getElementById('starterPokemonList');
        const count = document.getElementById('pokemonCount');
        list.innerHTML = '';

        starterPokemon.forEach((pokemon) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'starter-pokemon-option';
            button.setAttribute('aria-label', `${pokemon.name} auswählen`);
            button.classList.toggle('is-selected',
                hasStarterSelection() && pokemon.id === getStarterPokemonId());

            const image = document.createElement('img');
            image.src = getPokemonImage(pokemon);
            image.alt = '';

            const name = document.createElement('span');
            name.textContent = pokemon.name;

            button.appendChild(image);
            button.appendChild(name);
            button.addEventListener('click', () => {
                setStarterPokemonId(pokemon.id);
                renderStarterPokemon();
                closePokemonPicker();
            });
            list.appendChild(button);
        });

        count.textContent = 'Wähle eines der drei Starter-Pokemos.';
    }

    function closePokemonPicker() {
        const picker = document.getElementById('pokemonPicker');
        if (picker && picker.open) {
            picker.close();
        }
    }

    global.openPokemonPicker = openPokemonPicker;
    global.closePokemonPicker = closePokemonPicker;

    function reset() {
        setStarterPokemonId(defaultStarterPokemonId);
    }

    global.PokemoProfile = Object.freeze({
        starterPokemonIds,
        getStarterPokemonId,
        getCurrentPokemonId,
        setStarterPokemonId,
        reset
    });

    document.addEventListener('DOMContentLoaded', () => {
        if (!hasStarterSelection()) {
            openPokemonPicker();
        }

        renderProfilePokemon();

        const picker = document.getElementById('pokemonPicker');
        if (picker) {
            picker.addEventListener('click', (event) => {
                if (event.target === picker) {
                    closePokemonPicker();
                }
            });
        }
    });

    global.addEventListener('pokemo-progression-change', renderProfilePokemon);
})(window);
