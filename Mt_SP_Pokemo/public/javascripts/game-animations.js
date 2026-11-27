(function (global) {
    const fallDuration = 650;
    const payoutDuration = 1300;

    function animateProgress(duration, onProgress, onComplete) {
        const startedAt = performance.now();

        function frame(now) {
            const progress = Math.min(1, (now - startedAt) / duration);
            onProgress(progress);

            if (progress < 1) {
                requestAnimationFrame(frame);
            } else {
                onComplete();
            }
        }

        requestAnimationFrame(frame);
    }

    function animateFall(onProgress, onComplete) {
        animateProgress(fallDuration, (progress) => {
            onProgress(progress * progress);
        }, onComplete);
    }

    function animatePayout(amountElement, amount, onComplete) {
        animateProgress(payoutDuration, (progress) => {
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const animatedAmount = Math.round(amount * easedProgress * 10) / 10;
            amountElement.textContent = `+${String(animatedAmount)}`;
        }, onComplete);
    }

    // Shares the stake balance with an all-in button.
    function bindAllInButton(button, stakeInput, getBalance, onStakeChange) {
        button.addEventListener('click', () => {
            const maximumStake = Math.floor(getBalance());
            if (maximumStake < 1) {
                return;
            }

            stakeInput.value = String(maximumStake);
            onStakeChange();
        });
    }

    // Reveals the shared game-over overlay and focuses its restart action.
    function setGameOverVisible(overlay, visible, focusTarget) {
        if (overlay.hidden === !visible) {
            return;
        }

        overlay.hidden = !visible;
        if (visible) {
            focusTarget.focus();
        }
    }

    global.PokemoAnimations = Object.freeze({
        animateProgress,
        animateFall,
        animatePayout,
        bindAllInButton,
        setGameOverVisible
    });
})(window);
