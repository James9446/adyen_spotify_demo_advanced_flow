// // Mock player functionality
let isPlaying = false;

function togglePlay() {
    const playButton = document.getElementById('play-button');
    isPlaying = !isPlaying;
    playButton.textContent = isPlaying ? '⏸' : '▶️';
}

function updateProgressBar() {
    const progressBar = document.querySelector('.progress-bar');
    let width = 0;
    const interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
        } else {
            width++;
            progressBar.style.width = width + '%';
        }
    }, 1000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // const premiumButton = document.getElementById('premium-btn');
    // premiumButton.addEventListener('click', initializeDropin);
    
    const playButton = document.getElementById('play-button');
    playButton.addEventListener('click', () => {
        togglePlay();
        if (isPlaying) {
            updateProgressBar();
        }
    });

    // Check if we need to start or finalize the checkout
    if (!sessionId) {
        // No session ID, so we're starting a new checkout
        // We don't auto-start the checkout here, it will be triggered by the premium button
    } else {
        // Existing session: complete Checkout
        finalizeCheckout();
    }
});