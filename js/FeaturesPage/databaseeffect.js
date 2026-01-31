const textElement = document.getElementById('typewriter-text');
    const games = ["Search for Elden Ring...", "Search for Yakuza 0", "Search for GTA V...", "Search for Hollow Knight...", "Search for Cyberpunk 2077..."];
    let gameIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function type() {
        const currentGame = games[gameIndex];
        
        if (isDeleting) {
            textElement.textContent = currentGame.substring(0, charIndex - 1);
            charIndex--;
        } else {
            textElement.textContent = currentGame.substring(0, charIndex + 1);
            charIndex++;
        }

        let typeSpeed = isDeleting ? 50 : 100;

        if (!isDeleting && charIndex === currentGame.length) {
            typeSpeed = 2000; 
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            gameIndex = (gameIndex + 1) % games.length;
            typeSpeed = 500;
        }

        setTimeout(type, typeSpeed);
    }

type();