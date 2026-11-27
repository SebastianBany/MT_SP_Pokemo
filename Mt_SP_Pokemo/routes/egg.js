const crypto = require('crypto');
const express = require('express');
const eggService = require('../services/egg-service');

const router = express.Router();
const cookieName = 'pokemoEggPlayer';
const cookieMaxAge = 60 * 60 * 24 * 365;

function getPlayerId(request, response) {
    const cookieHeader = request.headers.cookie || '';
    const savedCookie = cookieHeader.split(';')
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${cookieName}=`));

    if (savedCookie) {
        const savedId = savedCookie.slice(cookieName.length + 1);
        if (/^[a-f0-9]{64}$/.test(savedId)) {
            return savedId;
        }
    }

    const playerId = crypto.randomBytes(32).toString('hex');
    let cookie = `${cookieName}=${playerId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cookieMaxAge}`;
    if (process.env.NODE_ENV === 'production') {
        cookie += '; Secure';
    }
    response.append('Set-Cookie', cookie);
    return playerId;
}

router.post('/hatch', async (request, response) => {
    if (request.get('X-Pokemo-Request') !== 'egg-hatch') {
        response.status(403).json({ error: 'Diese Ei-Anfrage wurde abgelehnt.' });
        return;
    }

    const playerId = getPlayerId(request, response);

    try {
        const result = await eggService.hatchPokemon(playerId);
        response.json(result);
    } catch (error) {
        console.error('The Pokémon egg could not be hatched.', error);
        response.status(503).json({
            error: 'Das Ei konnte gerade nicht ausgebrütet werden. Bitte versuche es später erneut.'
        });
    }
});

router.get('/collection', async (request, response) => {
    const playerId = getPlayerId(request, response);

    try {
        const collection = await eggService.getCollection(playerId);
        response.json(collection);
    } catch (error) {
        console.error('The Pokémon collection could not be loaded.', error);
        response.status(503).json({
            error: 'Deine Sammlung konnte gerade nicht geladen werden.'
        });
    }
});

module.exports = router;
