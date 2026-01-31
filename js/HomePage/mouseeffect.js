const rotations = {
    'card-1': -12,
    'card-2': -5,
    'card-3': 15,
    'card-4': 8
};

let mouseX = 0;
let mouseY = 0;
let currentX = 0;
let currentY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) - 0.5;
    mouseY = (e.clientY / window.innerHeight) - 0.5;
});

function animate() {
    currentX += (mouseX - currentX) * 0.08;
    currentY += (mouseY - currentY) * 0.08;

    const time = Date.now() * 0.002;

    const cards = document.querySelectorAll('.floating-card');
    cards.forEach((card) => {
        const cardClass = [...card.classList].find(cls => rotations[cls]);
        const baseRotation = rotations[cardClass] || 0;

        const index = parseInt(cardClass?.replace('card-', '')) || 1;
        const intensity = index * 35; 

        const x = currentX * intensity;
        const y = currentY * intensity + (Math.sin(time + index) * 10); 

        card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${baseRotation}deg)`;
    });

    requestAnimationFrame(animate);
}

if (document.readyState === 'complete') {
    animate();
} else {
    window.addEventListener('load', animate);
}