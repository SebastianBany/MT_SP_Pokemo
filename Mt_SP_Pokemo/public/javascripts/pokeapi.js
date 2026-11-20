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
            const controller = new AbortController();
            const timeout = global.setTimeout(() => controller.abort(), 8000);
            const request = fetch(url, { signal: controller.signal })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`PokéAPI request failed with status ${response.status}.`);
                    }
                    return response.json();
                })
                .then((data) => {
                    global.clearTimeout(timeout);
                    return data;
                })
                .catch((error) => {
                    global.clearTimeout(timeout);
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
