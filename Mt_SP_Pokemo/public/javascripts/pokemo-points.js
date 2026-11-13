(function (global) {
    const storageKey = 'pokemoPoints';
    const initialBalance = 100;
    const balanceElement = document.getElementById('pokemonPoints');

    if (localStorage.getItem(storageKey) === null) {
        localStorage.setItem(storageKey, String(initialBalance));
    }

    function getBalance() {
        const balance = Number(localStorage.getItem(storageKey));
        if (!Number.isFinite(balance) || balance < 0 || !Number.isSafeInteger(balance * 10)) {
            throw new Error('The saved Pokémo points balance is invalid.');
        }
        return balance;
    }

    function formatBalance(balance) {
        return balance.toLocaleString('de-DE', { maximumFractionDigits: 1 });
    }

    function renderBalance() {
        if (balanceElement) {
            balanceElement.textContent = formatBalance(getBalance());
        }
    }

    function setBalance(balance) {
        if (typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0) {
            throw new TypeError('The Pokémo points balance must be a non-negative number.');
        }

        const normalizedBalance = Math.round(balance * 10) / 10;
        if (!Number.isSafeInteger(normalizedBalance * 10)) {
            throw new RangeError('The Pokémo points balance is too large.');
        }

        localStorage.setItem(storageKey, String(normalizedBalance));
        renderBalance();
        global.dispatchEvent(new CustomEvent('pokemo-points-change', {
            detail: normalizedBalance
        }));
    }

    global.PokemoPoints = Object.freeze({
        getBalance,
        setBalance
    });

    global.addEventListener('storage', (event) => {
        if (event.key === storageKey) {
            renderBalance();
        }
    });

    renderBalance();
})(window);
