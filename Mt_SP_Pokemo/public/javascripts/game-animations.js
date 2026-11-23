(function (global) {
    const fallDuration = 650;
    const payoutDuration = 850;

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

    global.PokemoAnimations = Object.freeze({
        animateProgress,
        animateFall,
        animatePayout
    });
})(window);
