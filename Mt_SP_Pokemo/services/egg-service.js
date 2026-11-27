const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const dataDirectory = process.env.POKEMO_EGG_DATA_DIR
    || path.join(__dirname, '..', 'data');
const catalogFile = path.join(dataDirectory, 'pokemon-catalog.json');
const collectionFile = process.env.POKEMO_EGG_COLLECTION_FILE
    || path.join(dataDirectory, 'egg-collection.json');
const pokemonApiUrl = 'https://pokeapi.co/api/v2/pokemon/';
const pokemonCsvUrl = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
const pokemonGoApiUrl = 'https://pogoapi.net/api/v1/';

const hatchRarityOdds = Object.freeze([
    { id: 'legendary', name: 'Legendär', chance: 10000, color: '#d5a500' }
]);

const variantOdds = Object.freeze([
    { id: 'normal', name: 'Normal', chance: 9700 },
    { id: 'shiny', name: 'Shiny', chance: 200 },
    { id: 'golden', name: 'Golden', chance: 80 },
    { id: 'diamond', name: 'Diamond', chance: 15 },
    { id: 'rainbow', name: 'Rainbow', chance: 4 },
    { id: 'shadow', name: 'Shadow', chance: 1 }
]);

const duplicateBonuses = Object.freeze({
    legendary: 100
});

let catalogPromise;
let goAvailabilityPromise;
let storeQueue = Promise.resolve();
const pokemonDetailsCache = new Map();

function sumOdds(odds) {
    return odds.reduce((sum, item) => sum + item.chance, 0);
}

function checkOdds() {
    if (sumOdds(hatchRarityOdds) !== 10000 || sumOdds(variantOdds) !== 10000) {
        throw new Error('Legendary and variant chances must each add up to 100%.');
    }
}

function drawFromOdds(odds, draw) {
    if (!Number.isInteger(draw) || draw < 0 || draw >= 10000) {
        throw new RangeError('The random number must be between 0 and 9999.');
    }

    let limit = 0;
    for (const item of odds) {
        limit += item.chance;
        if (draw < limit) {
            return item;
        }
    }

    throw new Error('The random number did not match a chance range.');
}

function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
        throw new Error('The PokeAPI CSV file did not contain any data.');
    }

    const headings = lines[0].split(',');
    return lines.slice(1).map((line) => {
        const values = line.split(',');
        const row = {};
        headings.forEach((heading, index) => {
            row[heading] = values[index] || '';
        });
        return row;
    });
}

async function fetchText(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}: ${url}`);
        }
        return await response.text();
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchJson(url) {
    const text = await fetchText(url);
    return JSON.parse(text);
}

function buildCatalog(pokemonRows, speciesRows) {
    const speciesById = new Map();
    speciesRows.forEach((species) => {
        speciesById.set(Number(species.id), species);
    });

    const catalog = { legendary: [] };
    const speciesIds = new Set();

    pokemonRows.forEach((pokemon) => {
        const speciesId = Number(pokemon.species_id);
        const species = speciesById.get(speciesId);
        if (!species || species.is_legendary !== '1' || pokemon.is_default !== '1'
            || speciesIds.has(speciesId)) {
            return;
        }

        speciesIds.add(speciesId);
        catalog.legendary.push({
            id: Number(pokemon.id),
            speciesId: speciesId,
            name: pokemon.identifier,
            isLegendary: true,
            isDefault: true
        });
    });

    if (catalog.legendary.length === 0) {
        throw new Error('No default legendary Pokémon were found in the PokeAPI data.');
    }

    return catalog;
}

async function loadCatalog() {
    try {
        const savedCatalog = JSON.parse(await fs.readFile(catalogFile, 'utf8'));
        const legendary = getLegendaryPool(savedCatalog);
        if (legendary.length > 0) {
            return { legendary: legendary };
        }
        throw new Error('The saved Pokémon catalog contains no legendary base forms.');
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }

    const [pokemonText, speciesText] = await Promise.all([
        fetchText(`${pokemonCsvUrl}pokemon.csv`),
        fetchText(`${pokemonCsvUrl}pokemon_species.csv`)
    ]);
    const catalog = buildCatalog(parseCsv(pokemonText), parseCsv(speciesText));

    try {
        await fs.mkdir(dataDirectory, { recursive: true });
        const temporaryFile = `${catalogFile}.${crypto.randomBytes(6).toString('hex')}.tmp`;
        await fs.writeFile(temporaryFile, JSON.stringify(catalog), 'utf8');
        await fs.rename(temporaryFile, catalogFile);
    } catch (error) {
        console.error('Pokémon catalog could not be cached on disk.', error);
    }

    return catalog;
}

function getCatalog() {
    if (!catalogPromise) {
        catalogPromise = loadCatalog().catch((error) => {
            catalogPromise = null;
            throw error;
        });
    }
    return catalogPromise;
}

function idsFromAvailability(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('The Pokémon GO availability response is invalid.');
    }

    return new Set(Object.keys(data)
        .map((id) => Number(id))
        .filter((id) => Number.isSafeInteger(id) && id > 0));
}

async function loadGoAvailability() {
    const results = await Promise.all([
        fetchJson(`${pokemonGoApiUrl}shiny_pokemon.json`)
            .then(idsFromAvailability)
            .catch((error) => {
                console.error('Pokémon GO Shiny availability could not be loaded.', error);
                return new Set();
            }),
        fetchJson(`${pokemonGoApiUrl}shadow_pokemon.json`)
            .then(idsFromAvailability)
            .catch((error) => {
                console.error('Pokémon GO Shadow availability could not be loaded.', error);
                return new Set();
            })
    ]);

    return { shinyIds: results[0], shadowIds: results[1] };
}

function getGoAvailability() {
    if (!goAvailabilityPromise) {
        goAvailabilityPromise = loadGoAvailability();
    }
    return goAvailabilityPromise;
}

async function getPokemonDetails(pokemonId) {
    if (!pokemonDetailsCache.has(pokemonId)) {
        const request = fetchJson(`${pokemonApiUrl}${pokemonId}/`)
            .catch((error) => {
                pokemonDetailsCache.delete(pokemonId);
                throw error;
            });
        pokemonDetailsCache.set(pokemonId, request);
    }
    return pokemonDetailsCache.get(pokemonId);
}

function getImages(pokemon) {
    const sprites = pokemon.sprites || {};
    const artwork = sprites.other && sprites.other['official-artwork']
        ? sprites.other['official-artwork']
        : {};

    return {
        normal: artwork.front_default || sprites.front_default || null,
        shiny: artwork.front_shiny || sprites.front_shiny || null
    };
}

function formatRarity(rarityId, poolSize) {
    const rarity = hatchRarityOdds.find((item) => item.id === rarityId);
    return {
        id: rarity.id,
        name: rarity.name,
        chancePercent: rarity.chance / 100,
        color: rarity.color,
        poolSize: poolSize
    };
}

function formatVariant(variantId) {
    const variant = variantOdds.find((item) => item.id === variantId);
    return {
        id: variant.id,
        name: variant.name,
        chancePercent: variant.chance / 100
    };
}

function getVariantResult(requestedVariant, shinyAvailable, shadowAvailable) {
    let variant = requestedVariant;
    let fallbackMessage = '';

    if (requestedVariant.id === 'shiny' && !shinyAvailable) {
        variant = variantOdds[0];
        fallbackMessage = 'Shiny ist für dieses Pokemo derzeit nicht verfügbar. Es wurde Normal vergeben.';
    } else if (requestedVariant.id === 'shadow' && !shadowAvailable) {
        variant = variantOdds[0];
        fallbackMessage = 'Shadow ist für dieses Pokemo nicht in den GO-Daten gelistet. Es wurde Normal vergeben.';
    }

    let effectiveChance = variant.chance;
    if (variant.id === 'normal') {
        effectiveChance = variantOdds[0].chance;
        if (!shinyAvailable) {
            effectiveChance += variantOdds.find((item) => item.id === 'shiny').chance;
        }
        if (!shadowAvailable) {
            effectiveChance += variantOdds.find((item) => item.id === 'shadow').chance;
        }
    }

    return {
        variant: variant,
        fallbackMessage: fallbackMessage,
        effectiveChance: effectiveChance
    };
}

async function getLegendaryPokemon(catalog) {
    const pool = getLegendaryPool(catalog);
    if (!Array.isArray(pool) || pool.length === 0) {
        throw new Error('No legendary Pokémon are available.');
    }

    const firstIndex = crypto.randomInt(pool.length);
    const attempts = Math.min(pool.length, 8);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const entry = pool[(firstIndex + attempt) % pool.length];
        try {
            const details = await getPokemonDetails(entry.id);
            const images = getImages(details);
            if (images.normal) {
                return { entry: entry, details: details, images: images, poolSize: pool.length };
            }
        } catch (error) {
            console.error(`Pokémon ${entry.id} could not be loaded from PokéAPI.`, error);
        }
    }

    throw new Error('No usable legendary Pokémon image could be loaded.');
}

function getLegendaryPool(catalog) {
    const pool = Array.isArray(catalog.legendary) ? catalog.legendary : [];
    const speciesIds = new Set();

    return pool.filter((pokemon) => {
        if (!pokemon.isLegendary || !pokemon.isDefault || speciesIds.has(pokemon.speciesId)) {
            return false;
        }
        speciesIds.add(pokemon.speciesId);
        return true;
    });
}

function getDuplicateBonus(rarityId) {
    return duplicateBonuses[rarityId] || 0;
}

async function readStore() {
    try {
        const store = JSON.parse(await fs.readFile(collectionFile, 'utf8'));
        if (!store.players || typeof store.players !== 'object') {
            throw new Error('The Pokémon collection file has an invalid format.');
        }
        return store;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { players: {} };
        }
        throw error;
    }
}

async function writeStore(store) {
    const directory = path.dirname(collectionFile);
    await fs.mkdir(directory, { recursive: true });
    const temporaryFile = `${collectionFile}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(temporaryFile, JSON.stringify(store, null, 2), 'utf8');
    await fs.rename(temporaryFile, collectionFile);
}

function runStoreOperation(operation) {
    const task = storeQueue.then(operation);
    storeQueue = task.catch(() => {});
    return task;
}

function saveHatch(playerId, hatch) {
    return runStoreOperation(async () => {
        const store = await readStore();
        const playerCollection = store.players[playerId] || {};
        const speciesId = hatch.pokemon.speciesId;
        const previousEntries = Object.values(playerCollection)
            .filter((entry) => entry.pokemon.speciesId === speciesId);
        const isDuplicate = previousEntries.length > 0;
        const pointsBonus = isDuplicate ? getDuplicateBonus(hatch.rarity.id) : 0;
        const key = `${hatch.pokemon.id}:${hatch.variant.id}`;
        const previousEntry = playerCollection[key];
        const count = previousEntry ? previousEntry.count + 1 : 1;
        const savedHatch = Object.assign({}, hatch, {
            count: count,
            hatchedAt: new Date().toISOString()
        });

        playerCollection[key] = savedHatch;
        store.players[playerId] = playerCollection;
        await writeStore(store);

        const pokemonCount = Object.values(playerCollection)
            .filter((entry) => entry.pokemon.speciesId === speciesId)
            .reduce((sum, entry) => sum + entry.count, 0);

        return Object.assign({}, hatch, {
            duplicate: isDuplicate,
            pointsBonus: pointsBonus,
            pokemonCount: pokemonCount
        });
    });
}

function getCollection(playerId) {
    return runStoreOperation(async () => {
        const store = await readStore();
        const collection = store.players[playerId] || {};
        return Object.values(collection);
    });
}

async function hatchPokemon(playerId) {
    checkOdds();
    const catalog = await getCatalog();
    const availability = await getGoAvailability();
    const rarity = hatchRarityOdds[0];
    const pokemonResult = await getLegendaryPokemon(catalog);
    const requestedVariant = drawFromOdds(variantOdds, crypto.randomInt(10000));
    const pokemonData = pokemonResult.entry;
    const pokemonImages = pokemonResult.images;

    let image = pokemonImages.normal;
    const shinyAvailable = availability.shinyIds.has(pokemonData.speciesId)
        && Boolean(pokemonImages.shiny)
        && pokemonImages.shiny !== pokemonImages.normal;
    const shadowAvailable = availability.shadowIds.has(pokemonData.speciesId);
    const variantResult = getVariantResult(requestedVariant, shinyAvailable, shadowAvailable);
    const variant = variantResult.variant;

    if (requestedVariant.id === 'shiny' && shinyAvailable) {
        image = pokemonImages.shiny;
    }

    const effectiveVariantChance = variantResult.effectiveChance;
    const rarityInfo = formatRarity(rarity.id, pokemonResult.poolSize);
    const variantInfo = formatVariant(variant.id);

    const hatch = {
        pokemon: {
            id: pokemonData.id,
            speciesId: pokemonData.speciesId,
            name: pokemonResult.details.name,
            form: 'Standardform',
            isLegendary: pokemonData.isLegendary,
            isDefault: pokemonData.isDefault,
            shinyAvailable: shinyAvailable,
            shadowAvailable: shadowAvailable,
            image: image,
            normalImage: pokemonImages.normal
        },
        rarity: rarityInfo,
        variant: variantInfo,
        requestedVariant: formatVariant(requestedVariant.id),
        fallbackMessage: variantResult.fallbackMessage,
        probability: {
            variantPercent: effectiveVariantChance / 100
        }
    };

    return saveHatch(playerId, hatch);
}

checkOdds();

module.exports = {
    hatchRarityOdds,
    variantOdds,
    buildCatalog,
    drawFromOdds,
    getCollection,
    getLegendaryPool,
    getVariantResult,
    hatchPokemon,
    sumOdds
};
