let mouseX = 0;
let mouseY = 0;
let currentX = 0;
let currentY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) - 0.5;
    mouseY = (e.clientY / window.innerHeight) - 0.5;
});

function animate() {
    currentX += (mouseX - currentX) * 0.05;
    currentY += (mouseY - currentY) * 0.05;

    const cards = document.querySelectorAll('.floating-card');
    cards.forEach((card, index) => {
        const depth = (index + 1) * 20;
        const x = currentX * depth;
        const y = currentY * depth;
        
        card.style.setProperty('--move-x', `${x}px`);
        card.style.setProperty('--move-y', `${y}px`);
    });

    requestAnimationFrame(animate);
}

animate();