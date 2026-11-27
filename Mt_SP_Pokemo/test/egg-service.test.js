const assert = require('node:assert/strict');
const test = require('node:test');
const eggService = require('../services/egg-service');

test('Only Legendary Pokémon can hatch and the chances add up to 100 percent', () => {
    assert.deepEqual(eggService.hatchRarityOdds.map((item) => item.id), ['legendary']);
    assert.equal(eggService.sumOdds(eggService.hatchRarityOdds), 10000);
    assert.equal(eggService.sumOdds(eggService.variantOdds), 10000);
});

test('Legendary is selected at every rarity boundary and variants keep their boundaries', () => {
    const variantBoundaries = [
        [0, 'normal'],
        [9700, 'shiny'],
        [9900, 'golden'],
        [9980, 'diamond'],
        [9995, 'rainbow'],
        [9999, 'shadow']
    ];

    [0, 9999].forEach((draw) => {
        assert.equal(eggService.drawFromOdds(eggService.hatchRarityOdds, draw).id, 'legendary');
    });
    variantBoundaries.forEach(([draw, expected]) => {
        assert.equal(eggService.drawFromOdds(eggService.variantOdds, draw).id, expected);
    });
});

test('The legendary pool excludes alternate forms and duplicate species', () => {
    const pool = eggService.getLegendaryPool({
        legendary: [
            { speciesId: 1, isLegendary: true, isDefault: true },
            { speciesId: 1, isLegendary: true, isDefault: false },
            { speciesId: 1, isLegendary: true, isDefault: true },
            { speciesId: 2, isLegendary: true, isDefault: true },
            { speciesId: 3, isLegendary: false, isDefault: true }
        ]
    });

    assert.deepEqual(pool.map((pokemon) => pokemon.speciesId), [1, 2]);
});

test('The catalog keeps only default legendary Pokémon', () => {
    const catalog = eggService.buildCatalog(
        [
            { id: '1', species_id: '1', identifier: 'legendary-one', is_default: '1' },
            { id: '2', species_id: '1', identifier: 'legendary-one-form', is_default: '0' },
            { id: '3', species_id: '2', identifier: 'regular-one', is_default: '1' },
            { id: '4', species_id: '3', identifier: 'legendary-two', is_default: '1' }
        ],
        [
            { id: '1', is_legendary: '1' },
            { id: '2', is_legendary: '0' },
            { id: '3', is_legendary: '1' }
        ]
    );

    assert.deepEqual(catalog.legendary.map((pokemon) => pokemon.id), [1, 4]);
});

test('Unavailable variants fall back to Normal and report the adjusted chance', () => {
    const normal = eggService.variantOdds.find((item) => item.id === 'normal');
    const shiny = eggService.variantOdds.find((item) => item.id === 'shiny');
    const shadow = eggService.variantOdds.find((item) => item.id === 'shadow');

    assert.equal(eggService.getVariantResult(normal, true, true).effectiveChance, 9700);
    assert.equal(eggService.getVariantResult(normal, false, true).effectiveChance, 9900);
    assert.equal(eggService.getVariantResult(normal, false, false).effectiveChance, 9901);

    const fallback = eggService.getVariantResult(shiny, false, false);
    assert.equal(fallback.variant.id, 'normal');
    assert.equal(fallback.effectiveChance, 9901);
    assert.ok(fallback.fallbackMessage.length > 0);

    assert.equal(eggService.getVariantResult(shadow, true, false).variant.id, 'normal');
});

test('A seeded simulation of 100,000 hatches always selects Legendary and follows variant chances', () => {
    const total = 100000;
    const rarityCounts = {};
    const variantCounts = {};
    let seed = 872341;

    function nextDraw() {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return Math.floor(seed / 4294967296 * 10000);
    }

    for (let hatch = 0; hatch < total; hatch += 1) {
        const rarity = eggService.drawFromOdds(eggService.hatchRarityOdds, nextDraw());
        const variant = eggService.drawFromOdds(eggService.variantOdds, nextDraw());
        rarityCounts[rarity.id] = (rarityCounts[rarity.id] || 0) + 1;
        variantCounts[variant.id] = (variantCounts[variant.id] || 0) + 1;
    }

    function checkDistribution(odds, counts) {
        odds.forEach((item) => {
            const expected = total * item.chance / 10000;
            const allowedDifference = Math.max(4 * Math.sqrt(expected), 4);
            assert.ok(
                Math.abs(counts[item.id] - expected) <= allowedDifference,
                `${item.id}: expected about ${expected}, received ${counts[item.id]}`
            );
        });
    }

    assert.equal(rarityCounts.legendary, total);
    checkDistribution(eggService.variantOdds, variantCounts);
    console.log('100,000 hatch simulation:', { rarityCounts, variantCounts });
});
