document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.querySelector('.search-input');
    const genreSelect = document.querySelector('.filter-select');
    const gameCards = document.querySelectorAll('.game-card');

    function filterGames() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedGenre = genreSelect.value;

        gameCards.forEach(card => {
            const title = card.querySelector('h4').innerText.toLowerCase();
            const cardGenre = card.getAttribute('data-genre');

            const matchesSearch = title.includes(searchTerm);
            
            const matchesGenre = (selectedGenre === 'all' || cardGenre === selectedGenre);

            if (matchesSearch && matchesGenre) {
                card.style.display = "flex";
                setTimeout(() => card.classList.add('active'), 10);
            } else {
                card.style.display = "none";
                card.classList.remove('active');
            }
        });
    }

    searchInput.addEventListener('input', filterGames);
    genreSelect.addEventListener('change', filterGames);
});