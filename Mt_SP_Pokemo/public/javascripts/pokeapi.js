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

    function request(url) {
        if (!cache.has(url)) {
            const fetchRequest = fetch(url)
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
            cache.set(url, fetchRequest);
        }

        return cache.get(url);
    }

    async function get(resource, identifier) {
        const path = [normalizeSegment(resource, 'Resource')];
        if (identifier !== undefined && identifier !== null) {
            path.push(normalizeSegment(identifier, 'Identifier'));
        }

        return request(`${apiUrl}/${path.join('/')}/`);
    }

    function getPokemonList() {
        const url = `${apiUrl}/pokemon?limit=100000&offset=0`;
        return request(url).then(function (data) {
            return data.results.map(function (pokemon) {
                const urlParts = pokemon.url.split('/');
                return {
                    id: Number(urlParts[urlParts.length - 2]),
                    name: pokemon.name
                };
            });
        });
    }

    global.PokeAPI = Object.freeze({
        get,
        getPokemonList,
        getPokemon(identifier) {
            return get('pokemon', identifier);
        }
    });
})(window);
