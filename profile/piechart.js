const dbData = [
    {name: 'currently playing', points: 120},
    {name: 'completed', points: 90},
    {name: 'dropped', points: 150},
    {name: 'on hold', points: 75},
    {name: 'plan to play', points: 60} 
];

const canvas = document.getElementById('pieChart');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip'); // Tooltip div für Hover

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

// Radius exakt bis zur Innenkante der 3px Border
const radius = (canvas.width / 2) - 3;

// Farben der Segmente
const colors = ['#06a700de', '#3b83f6e3', '#ff0000da', '#ffd000', '#6d6d6d'];

// Array speichert Start- und Endwinkel jedes Segments
let startAngles = [];
const total = dbData.reduce((sum, d) => sum + d.points, 0);
let currentAngle = 0;

// ---------------------------
// Pie Chart zeichnen
// ---------------------------
dbData.forEach((data, index) => {
    const sliceAngle = (data.points / total) * 2 * Math.PI;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();

    // Start- und Endwinkel speichern, um später Hover zu erkennen
    startAngles.push({
        start: currentAngle,
        end: currentAngle + sliceAngle,
        name: data.name
    });

    currentAngle += sliceAngle;
});

// ---------------------------
// Hover-Funktion für Tooltip
// ---------------------------
canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; // Maus X relativ zum Canvas
    const mouseY = e.clientY - rect.top;  // Maus Y relativ zum Canvas

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const distance = Math.sqrt(dx*dx + dy*dy);

    let angle = Math.atan2(dy, dx);
    let adjustedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

    if(distance <= radius) {
        // prüfen, welches Segment unter der Maus ist
        const segment = startAngles.find(s => adjustedAngle >= s.start && adjustedAngle <= s.end);
        if(segment) {
            tooltip.style.display = 'block';
            tooltip.style.left = (mouseX + 30) + 'px';
            tooltip.style.top = (mouseY + 30) + 'px';  
            tooltip.textContent = segment.name; 
        }
    } else {
        tooltip.style.display = 'none'; 
    }
});

// Maus verlässt Canvas → Tooltip ausblenden
canvas.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
});