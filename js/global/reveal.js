document.addEventListener("DOMContentLoaded", function() {
    const revealElements = document.querySelectorAll(".reveal");

    const revealOptions = {
        threshold: 0.15, 
        
        rootMargin: "0px 0px -130px 0px"
    };

    const revealOnScroll = new IntersectionObserver(function(entries, revealOnScroll) {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            } else {
                entry.target.classList.add("active");
                revealOnScroll.unobserve(entry.target);
            }
        });
    }, revealOptions);

    revealElements.forEach((el) => {
        revealOnScroll.observe(el);
    });
});