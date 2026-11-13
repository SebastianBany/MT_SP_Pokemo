(function (global) {
    const starterPokemonIds = Object.freeze([1, 4, 7]);
    const defaultStarterPokemonId = starterPokemonIds[0];
    const storageKey = 'pokemoStarterPokemonId';

    function getStarterPokemonId() {
        const savedId = localStorage.getItem(storageKey);
        if (savedId === null) {
            return defaultStarterPokemonId;
        }

        const pokemonId = Number(savedId);
        return starterPokemonIds.includes(pokemonId) ? pokemonId : defaultStarterPokemonId;
    }

    function setStarterPokemonId(pokemonId) {
        if (!starterPokemonIds.includes(pokemonId)) {
            throw new RangeError('Choose one of the configured starter Pokémon.');
        }

        localStorage.setItem(storageKey, String(pokemonId));
        global.dispatchEvent(new CustomEvent('pokemo-starter-change', {
            detail: pokemonId
        }));
    }

    global.PokemoProfile = Object.freeze({
        starterPokemonIds,
        getStarterPokemonId,
        setStarterPokemonId
    });
})(window);
