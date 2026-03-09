/* =========================
   Data source
   ========================= */

const dbData = [
    { name: "currently playing", points: 120 },
    { name: "completed", points: 90 },
    { name: "dropped", points: 150 },
    { name: "on hold", points: 75 },
    { name: "plan to play", points: 60 }
];

/* =========================
   Canvas setup
   ========================= */

const canvas = document.getElementById("pieChart");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("tooltip");

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

const baseRadius = (canvas.width / 2) - 10;
const innerRadius = baseRadius * 0.55;

/* =========================
   Chart colors
   ========================= */

const colors = [
    "rgba(107, 211, 59, 0.8)",
    "#3b83f6",
    "rgba(211, 27, 27, 0.77)",
    "rgba(228, 210, 46, 0.84)",
    "#5a5a5aa2"
];

/* =========================
   Chart state
   ========================= */

let segments = [];
let hoverIndex = -1;
let animationProgress = 0; // Start bei 0 für Aufbautanimation

/* animation state for hover */
let segmentHoverProgress = new Array(dbData.length).fill(0);
const hoverSpeed = 0.15;

const total = dbData.reduce((sum, d) => sum + d.points, 0);

/* =========================
   Draw donut chart
   ========================= */

function drawChart(progress = 1) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let currentAngle = -Math.PI / 2;
    segments = [];

    const maxAngle = progress * 2 * Math.PI;

    dbData.forEach((data, index) => {
        const sliceAngle = (data.points / total) * 2 * Math.PI;
        let endAngle = currentAngle + sliceAngle;

        if (endAngle > -Math.PI / 2 + maxAngle) endAngle = -Math.PI / 2 + maxAngle;
        if (currentAngle >= -Math.PI / 2 + maxAngle) return;

        // Smooth hover animation
        const target = index === hoverIndex ? 1 : 0;
        segmentHoverProgress[index] += (target - segmentHoverProgress[index]) * hoverSpeed;
        const hoverAmount = segmentHoverProgress[index];

        const outerRadius = baseRadius + hoverAmount * 12;
        const inner = innerRadius - hoverAmount * 4;

        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, currentAngle, endAngle);
        ctx.arc(centerX, centerY, inner, endAngle, currentAngle, true);
        ctx.closePath();

        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();

        const start = (currentAngle + 2 * Math.PI) % (2 * Math.PI);
        const end = (currentAngle + sliceAngle + 2 * Math.PI) % (2 * Math.PI);

        segments.push({ start, end, name: data.name, value: data.points });

        currentAngle += sliceAngle;
    });
}

/* =========================
   Initial animation on load
   ========================= */

function animateChart() {
    animationProgress += 0.02; // Geschwindigkeit der Aufbautanimation
    if (animationProgress > 1) animationProgress = 1;

    drawChart(animationProgress);

    if (animationProgress < 1) {
        requestAnimationFrame(animateChart);
    } else {
        // Starte Hover-Loop nach Aufbau
        requestAnimationFrame(animationLoop);
    }
}

/* =========================
   Continuous loop for hover
   ========================= */

function animationLoop() {
    drawChart(animationProgress);
    requestAnimationFrame(animationLoop);
}

animateChart(); // Start der Aufbautanimation

/* =========================
   Hover interaction
   ========================= */

canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let angle = Math.atan2(dy, dx);
    let adjustedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

    if (distance <= baseRadius + 20 && distance >= innerRadius) {
        const index = segments.findIndex(s => {
            if (s.start < s.end) return adjustedAngle >= s.start && adjustedAngle <= s.end;
            return adjustedAngle >= s.start || adjustedAngle <= s.end;
        });

        hoverIndex = index;

        const segment = segments[index];
        if (segment) {
            tooltip.style.display = "block";
            tooltip.innerHTML = `<strong>${segment.name}</strong><br>${segment.value}`;
            tooltip.classList.add("show");

            // Tooltip im Viewport positionieren
            const pageWidth = document.documentElement.clientWidth;
            const pageHeight = document.documentElement.clientHeight;
            let left = mouseX + 20;
            let top = mouseY + 20;
            if(left + tooltip.offsetWidth > pageWidth) left = mouseX - tooltip.offsetWidth - 20;
            if(top + tooltip.offsetHeight > pageHeight) top = mouseY - tooltip.offsetHeight - 20;
            tooltip.style.left = left + "px";
            tooltip.style.top = top + "px";
        }
    } else {
        hoverIndex = -1;
        tooltip.classList.remove("show");
        setTimeout(() => { tooltip.style.display = "none"; }, 180);
    }
});

/* =========================
   Hide tooltip on leave
   ========================= */

canvas.addEventListener("mouseleave", () => {
    hoverIndex = -1;
    tooltip.classList.remove("show");
    setTimeout(() => { tooltip.style.display = "none"; }, 180);
});