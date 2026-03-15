/* =========================
   Canvas setup
   ========================= */

const canvas = document.getElementById("pieChart");
const tooltip = document.getElementById("tooltip");

if (!canvas || !tooltip) {
  console.warn("Pie chart elements not found.");
} else {
  const ctx = canvas.getContext("2d");

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const baseRadius = (canvas.width / 2) - 10;
  const innerRadius = baseRadius * 0.55;

  /* =========================
     Chart colors + labels
     ========================= */

  const STATUS_CONFIG = [
    { key: "playing", label: "Currently Playing", color: "rgba(107, 211, 59, 0.8)" },
    { key: "completed", label: "Completed", color: "#3b83f6" },
    { key: "dropped", label: "Dropped", color: "rgba(211, 27, 27, 0.77)" },
    { key: "on_hold", label: "On Hold", color: "rgba(228, 210, 46, 0.84)" },
    { key: "planned", label: "Planned", color: "#5a5a5aa2" }
  ];

  /* =========================
     Chart state
     ========================= */

  let chartData = STATUS_CONFIG.map(item => ({
    key: item.key,
    name: item.label,
    value: 0,
    color: item.color
  }));

  let segments = [];
  let hoverIndex = -1;
  let animationProgress = 0;
  let segmentHoverProgress = new Array(chartData.length).fill(0);
  const hoverSpeed = 0.15;

  function getTotal() {
    return chartData.reduce((sum, d) => sum + d.value, 0);
  }

  /* =========================
     Draw empty state
     ========================= */

  function drawEmptyState() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, innerRadius, Math.PI * 2, 0, true);
    ctx.closePath();

    ctx.fillStyle = "rgba(203, 213, 225, 0.45)";
    ctx.fill();

    segments = [];
  }

  /* =========================
     Draw donut chart
     ========================= */

  function drawChart(progress = 1) {
    const total = getTotal();

    if (!total) {
      drawEmptyState();
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let currentAngle = -Math.PI / 2;
    segments = [];

    const maxAngle = progress * 2 * Math.PI;

    chartData.forEach((data, index) => {
      if (!data.value) return;

      const sliceAngle = (data.value / total) * 2 * Math.PI;
      let endAngle = currentAngle + sliceAngle;

      if (endAngle > -Math.PI / 2 + maxAngle) endAngle = -Math.PI / 2 + maxAngle;
      if (currentAngle >= -Math.PI / 2 + maxAngle) return;

      const target = index === hoverIndex ? 1 : 0;
      segmentHoverProgress[index] += (target - segmentHoverProgress[index]) * hoverSpeed;
      const hoverAmount = segmentHoverProgress[index];

      const outerRadius = baseRadius + hoverAmount * 12;
      const inner = innerRadius - hoverAmount * 4;

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, currentAngle, endAngle);
      ctx.arc(centerX, centerY, inner, endAngle, currentAngle, true);
      ctx.closePath();

      ctx.fillStyle = data.color;
      ctx.fill();

      const start = (currentAngle + 2 * Math.PI) % (2 * Math.PI);
      const actualEnd = (endAngle + 2 * Math.PI) % (2 * Math.PI);

      segments.push({
        chartIndex: index,   // IMPORTANT: real Index in chartData
        start,
        end: actualEnd,
        name: data.name,
        value: data.value
      });

      currentAngle += sliceAngle;
    });
  }

  /* =========================
     Animation
     ========================= */

  function animateChart() {
    animationProgress = 0;

    function step() {
      animationProgress += 0.02;
      if (animationProgress > 1) animationProgress = 1;

      drawChart(animationProgress);

      if (animationProgress < 1) {
        requestAnimationFrame(step);
      } else {
        requestAnimationFrame(animationLoop);
      }
    }

    requestAnimationFrame(step);
  }

  function animationLoop() {
    drawChart(animationProgress);
    requestAnimationFrame(animationLoop);
  }

  /* =========================
     Public update function
     ========================= */

  function updateProfileChart(counts = {}) {
    chartData = STATUS_CONFIG.map(item => ({
      key: item.key,
      name: item.label,
      value: Number(counts[item.key] || 0),
      color: item.color
    }));

    segmentHoverProgress = new Array(chartData.length).fill(0);
    hoverIndex = -1;
    animateChart();
  }

  window.updateProfileChart = updateProfileChart;

  drawEmptyState();

  /* =========================
     Hover interaction
     ========================= */

  canvas.addEventListener("mousemove", (e) => {
    const total = getTotal();
    if (!total) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let angle = Math.atan2(dy, dx);
    let adjustedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

    if (distance <= baseRadius + 20 && distance >= innerRadius) {
      const seg = segments.find(s => {
        if (s.start < s.end) return adjustedAngle >= s.start && adjustedAngle <= s.end;
        return adjustedAngle >= s.start || adjustedAngle <= s.end;
      });

      hoverIndex = seg ? seg.chartIndex : -1;

      if (seg) {
        tooltip.style.display = "block";
        tooltip.innerHTML = `<strong>${seg.name}</strong><br>${seg.value}`;
        tooltip.classList.add("show");

        // position tooltip relative to canvas, but keep it within the parent container
        const parentRect = canvas.offsetParent
          ? canvas.offsetParent.getBoundingClientRect()
          : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

        let left = rect.left - parentRect.left + mouseX + 18;
        let top = rect.top - parentRect.top + mouseY + 18;

        // stay within parent bounds
        const maxLeft = parentRect.width - tooltip.offsetWidth - 8;
        const maxTop = parentRect.height - tooltip.offsetHeight - 8;

        if (left > maxLeft) left = rect.left - parentRect.left + mouseX - tooltip.offsetWidth - 18;
        if (top > maxTop) top = rect.top - parentRect.top + mouseY - tooltip.offsetHeight - 18;

        if (left < 8) left = 8;
        if (top < 8) top = 8;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      }
    } else {
      hoverIndex = -1;
      tooltip.classList.remove("show");
      setTimeout(() => { tooltip.style.display = "none"; }, 180);
    }
  });

  canvas.addEventListener("mouseleave", () => {
    hoverIndex = -1;
    tooltip.classList.remove("show");
    setTimeout(() => { tooltip.style.display = "none"; }, 180);
  });
}