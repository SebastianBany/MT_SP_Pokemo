(function () {
    var profileCard = document.querySelector('.profile-card');
    var username = document.getElementById('username');
    var closeButton = document.getElementById('closePokemonPicker');
    var picker = document.getElementById('pokemonPicker');
    var searchInput = document.getElementById('pokemonSearch');
    var pokemonSelect = document.getElementById('pokemonList');
    var selectButton = document.getElementById('selectPokemon');
    var status = document.getElementById('pokemonPickerStatus');
    var profilePokemon = document.getElementById('profilePokemon');
    var pokemonPreview = document.getElementById('pokemonPreview');
    var pokemonPreviewName = document.getElementById('pokemonPreviewName');
    var pokemonList = [];

    function getPokemonImage(pokemon) {
        var image = pokemon.sprites.front_default;

        var artwork = pokemon.sprites.other && pokemon.sprites.other['official-artwork'];
        if (!image && artwork) {
            image = artwork.front_default;
        }

        if (!image) {
            throw new Error('Für dieses Pokémon wurde kein Bild gefunden.');
        }

        return image;
    }

    function showSelectedPokemon(pokemonId) {
        window.PokeAPI.getPokemon(pokemonId)
            .then(function (pokemon) {
                profilePokemon.src = getPokemonImage(pokemon);
                profilePokemon.alt = pokemon.name;
            })
            .catch(function (error) {
                console.error('Das Pokémon-Bild konnte nicht geladen werden.', error);
                status.textContent = 'Das Pokémon-Bild konnte nicht geladen werden.';
            });
    }

    function showPokemonPreview(pokemonId) {
        pokemonPreviewName.textContent = 'Lädt ...';
        window.PokeAPI.getPokemon(pokemonId)
            .then(function (pokemon) {
                pokemonPreview.src = getPokemonImage(pokemon);
                pokemonPreview.alt = pokemon.name;
                pokemonPreviewName.textContent = pokemon.name;
            })
            .catch(function (error) {
                console.error('Die Pokémon-Vorschau konnte nicht geladen werden.', error);
                pokemonPreviewName.textContent = 'Bild nicht verfügbar';
            });
    }

    function showPokemonList() {
        var searchText = searchInput.value.toLowerCase();
        pokemonSelect.innerHTML = '';
        selectButton.disabled = true;

        for (var i = 0; i < pokemonList.length; i++) {
            if (pokemonList[i].name.indexOf(searchText) !== -1) {
                var option = document.createElement('option');
                option.value = pokemonList[i].id;
                option.textContent = pokemonList[i].name;
                pokemonSelect.appendChild(option);
            }
        }

        pokemonSelect.selectedIndex = -1;
        status.textContent = pokemonSelect.options.length + ' Pokémon gefunden.';
    }

    function loadPokemonList() {
        status.textContent = 'Pokémon werden geladen ...';
        searchInput.disabled = true;

        window.PokeAPI.getPokemonList()
            .then(function (pokemon) {
                pokemonList = pokemon;
                searchInput.disabled = false;
                showPokemonList();
            })
            .catch(function (error) {
                console.error('Die Pokémon-Liste konnte nicht geladen werden.', error);
                status.textContent = 'Die Pokémon-Liste konnte nicht geladen werden.';
            });
    }

    function openPokemonPicker() {
        picker.showModal();
        showPokemonPreview(window.PokemoProfile.getStarterPokemonId());

        if (pokemonList.length === 0) {
            loadPokemonList();
        } else {
            searchInput.value = '';
            showPokemonList();
        }
    }

    profileCard.addEventListener('click', function (event) {
        if (event.target !== username) {
            openPokemonPicker();
        }
    });

    closeButton.addEventListener('click', function () {
        picker.close();
    });

    searchInput.addEventListener('input', showPokemonList);

    pokemonSelect.addEventListener('change', function () {
        selectButton.disabled = pokemonSelect.value === '';

        if (pokemonSelect.value !== '') {
            showPokemonPreview(Number(pokemonSelect.value));
        }
    });

    selectButton.addEventListener('click', function () {
        var pokemonId = Number(pokemonSelect.value);

        window.PokemoProfile.setStarterPokemonId(pokemonId);
        showSelectedPokemon(pokemonId);
        picker.close();
    });

    showSelectedPokemon(window.PokemoProfile.getStarterPokemonId());
})();
