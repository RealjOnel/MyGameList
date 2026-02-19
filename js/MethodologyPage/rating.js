document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('scoreRange');
    const displayValue = document.getElementById('scoreValue');
    const displayText = document.getElementById('scoreText');
    const simBox = document.getElementById('simBox');

    // definitions for every score
    const definitions = {
        1: "Unplayable. Broken mechanics or technical disaster.",
        2: "Terrible. Fundamental flaws, barely functional.",
        3: "Bad. Boring, frustrating, or poorly designed.",
        4: "Weak. Has ideas, but fails to execute them.",
        5: "Mediocre. Generic, forgettable, but works.",
        6: "Okay. Decent fun for fans of the genre.",
        7: "Good. Solid experience, worth playing.",
        8: "Great. High quality, polished, and memorable.",
        9: "Amazing. A must-play title with minor flaws.",
        10: "Masterpiece. Genre-defining and legendary."
    };

    function updateSimulator() {
        const val = parseInt(slider.value);
        
        displayValue.textContent = val;
        displayText.textContent = definitions[val];

        displayValue.className = 'huge-number';
        simBox.style.borderColor = 'rgba(255,255,255,0.1)'; 

        if (val <= 4) {
            // LOW SCORE (Red)
            displayValue.classList.add('score-low');
            slider.style.color = '#ff4757'; 
            simBox.style.background = 'var(--sim-bg-low)';
            simBox.style.borderColor = 'rgba(255, 71, 87, 0.3)';
        } else if (val <= 7) {
            // MID SCORE (Orange)
            displayValue.classList.add('score-mid');
            slider.style.color = '#ffa502';
            simBox.style.background = 'var(--sim-bg-mid)';
            simBox.style.borderColor = 'rgba(255, 165, 2, 0.3)';
        } else {
            // HIGH SCORE (Green)
            displayValue.classList.add('score-high');
            slider.style.color = '#2ed573';
            simBox.style.background = 'var(--sim-bg-high)';
            simBox.style.borderColor = 'rgba(46, 213, 115, 0.3)';
        }

        displayValue.classList.remove('animating');
        void displayValue.offsetWidth;
        displayValue.classList.add('animating');

        displayText.classList.remove('animating');
        void displayText.offsetWidth;
        displayText.classList.add('animating');
    }

    function triggerGlitch() {
        displayValue.style.transform = "skewX(15deg) scale(1.1)";
        displayValue.style.filter = "hue-rotate(90deg)"; 
        
        setTimeout(() => { 
            displayValue.style.transform = "skewX(0deg) scale(1)"; 
            displayValue.style.filter = "hue-rotate(0deg)";
        }, 80);
    }

    slider.addEventListener('input', updateSimulator);

    slider.addEventListener('change', triggerGlitch);

    updateSimulator();
});