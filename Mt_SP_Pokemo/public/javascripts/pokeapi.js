(function (global) {
    const apiUrl = 'https://pokeapi.co/api/v2';
    const cache = new Map();

    function normalizeSegment(value, name) {
        const segment = String(value).trim().toLowerCase();
        if (!/^[a-z0-9-]+$/.test(segment)) {
            throw new TypeError(`${name} must contain only letters, numbers, and hyphens.`);
        }
        return segment;
    }

    async function get(resource, identifier) {
        const path = [normalizeSegment(resource, 'Resource')];
        if (identifier !== undefined && identifier !== null) {
            path.push(normalizeSegment(identifier, 'Identifier'));
        }

        const url = `${apiUrl}/${path.join('/')}/`;
        if (!cache.has(url)) {
            const request = fetch(url)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`PokéAPI request failed with status ${response.status}.`);
                    }
                    return response.json();
                })
                .catch((error) => {
                    cache.delete(url);
                    throw error;
                });
            cache.set(url, request);
        }

        return cache.get(url);
    }

    global.PokeAPI = Object.freeze({
        get,
        getPokemon(identifier) {
            return get('pokemon', identifier);
        }
    });
})(window);
