(function (global) {
    const storageKey = 'pokemoPoints';
    const initialBalance = 500;
    const previousInitialBalance = 100;
    const balanceElement = document.getElementById('pokemonPoints');
    const savedBalance = localStorage.getItem(storageKey);

    if (savedBalance === null || savedBalance === String(previousInitialBalance)) {
        localStorage.setItem(storageKey, String(initialBalance));
    }

    function getBalance() {
        const balance = Number(localStorage.getItem(storageKey));
        const roundedBalance = Math.ceil(balance);
        if (!Number.isFinite(balance) || balance < 0 || !Number.isSafeInteger(roundedBalance)) {
            throw new Error('The saved Pokemo points balance is invalid.');
        }
        if (roundedBalance !== balance) {
            localStorage.setItem(storageKey, String(roundedBalance));
        }
        return roundedBalance;
    }

    function formatBalance(balance) {
        return balance.toLocaleString('de-DE');
    }

    function renderBalance() {
        if (balanceElement) {
            balanceElement.textContent = formatBalance(getBalance());
        }
    }

    function setBalance(balance) {
        if (typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0) {
            throw new TypeError('The Pokemo points balance must be a non-negative number.');
        }

        const normalizedBalance = Math.ceil(balance);
        if (!Number.isSafeInteger(normalizedBalance)) {
            throw new RangeError('The Pokemo points balance is too large.');
        }

        localStorage.setItem(storageKey, String(normalizedBalance));
        renderBalance();
        global.dispatchEvent(new CustomEvent('pokemo-points-change', {
            detail: normalizedBalance
        }));
    }

    function reset() {
        setBalance(initialBalance);
    }

    global.PokemoPoints = Object.freeze({
        getBalance,
        setBalance,
        reset
    });

    global.addEventListener('storage', (event) => {
        if (event.key === storageKey) {
            renderBalance();
        }
    });

    renderBalance();
})(window);
