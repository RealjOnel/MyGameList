document.addEventListener("DOMContentLoaded", () => {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";

    const allLinks = document.querySelectorAll('.nav-links a');

    allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        if (href.includes(currentPath) && currentPath !== "") {
            
            let targetItem = link.classList.contains('nav-item') ? link : link.closest('.nav-item');

            if (targetItem) {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                
                targetItem.classList.add('active');
            }
        }
    });
});

window.addEventListener("pageshow", () => {
    document.body.style.opacity = "1";
});

document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        if (document.startViewTransition) {
            document.startViewTransition();
        }
    });
});