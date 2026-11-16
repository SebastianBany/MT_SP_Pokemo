(function (global) {
    const defaultStarterPokemonId = 1;
    const storageKey = 'pokemoStarterPokemonId';

    function getStarterPokemonId() {
        const savedId = localStorage.getItem(storageKey);
        if (savedId === null) {
            return defaultStarterPokemonId;
        }

        const pokemonId = Number(savedId);
        return Number.isInteger(pokemonId) && pokemonId > 0 ? pokemonId : defaultStarterPokemonId;
    }

    function setStarterPokemonId(pokemonId) {
        if (!Number.isInteger(pokemonId) || pokemonId < 1) {
            throw new RangeError('Choose a valid Pokémon.');
        }

        localStorage.setItem(storageKey, String(pokemonId));
        global.dispatchEvent(new CustomEvent('pokemo-starter-change', {
            detail: pokemonId
        }));
    }

    global.PokemoProfile = Object.freeze({
        getStarterPokemonId,
        setStarterPokemonId
    });
})(window);
