async function loadDynamicGallery() {
    try {
        const response = await fetch('http://localhost:3000/api/trending-games');
        const games = await response.json();
        
        const track = document.querySelector('.gallery-track');
        if (!track) return;

        track.innerHTML = '';

        games.forEach(game => {
            const imgId = game.cover.image_id;
            const imgUrl = `https://images.igdb.com/igdb/image/upload/t_1080p/${imgId}.jpg`;
            
            const div = document.createElement('div');
            div.className = 'gallery-item';
            div.style.backgroundImage = `url('${imgUrl}')`;
            
            track.appendChild(div);
        });

        const items = track.innerHTML;
        track.innerHTML += items;

    } catch (error) {
        console.error("Konnte Galerie nicht laden:", error);
    }
}

document.addEventListener('DOMContentLoaded', loadDynamicGallery);