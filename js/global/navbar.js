document.addEventListener("DOMContentLoaded", () => {
    const dock = document.getElementById("navDock");
    if (!dock) return;

    const nodes = [...dock.querySelectorAll(".nav-dock__node")];
    const indicator = dock.querySelector(".nav-dock__indicator");
    const currentFile = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

    let activeNode =
        nodes.find(node => (node.dataset.route || "").toLowerCase() === currentFile) ||
        nodes[0];

    function getVisualNode() {
        return nodes.find(node => node.classList.contains("is-open")) || activeNode;
    }

    function syncDockOpenState() {
        const hasOpenMenu = nodes.some(node => node.classList.contains("is-open"));
        dock.classList.toggle("has-open-menu", hasOpenMenu);
    }

    function moveIndicator(node) {
        if (!node || !indicator) return;

        const dockRect = dock.getBoundingClientRect();
        const target =
            node.querySelector(".nav-dock__node--link, .nav-dock__button") || node;

        const targetRect = target.getBoundingClientRect();
        const indicatorWidth = indicator.offsetWidth;

        const x =
            targetRect.left - dockRect.left + (targetRect.width - indicatorWidth) / 2;

        indicator.style.transform = `translateX(${x}px)`;
    }

    function setActive(node) {
        nodes.forEach(n => n.classList.remove("is-active"));
        if (!node) return;

        node.classList.add("is-active");
        activeNode = node;
        moveIndicator(getVisualNode());
        syncDockOpenState();
    }

    function closeMenus() {
        nodes.forEach(node => {
            node.classList.remove("is-open");

            if (node !== activeNode) {
                node.classList.remove("is-active");
            }

            const toggle = node.querySelector("[data-dropdown-toggle]");
            if (toggle) {
                toggle.setAttribute("aria-expanded", "false");
            }
        });

        if (activeNode) {
            activeNode.classList.add("is-active");
        }

        syncDockOpenState();
    }

    /* Initial state: place everything instantly, no animation */
    setActive(activeNode);

    /* Make sure the indicator is positioned before showing transitions/visibility */
    requestAnimationFrame(() => {
        moveIndicator(getVisualNode());

        requestAnimationFrame(() => {
            dock.classList.add("is-ready");
        });
    });

    nodes.forEach(node => {
        node.addEventListener("mouseenter", () => {
            moveIndicator(node);
        });

        node.addEventListener("mouseleave", () => {
            moveIndicator(getVisualNode());
        });
    });

    dock.querySelectorAll("[data-dropdown-toggle]").forEach(toggle => {
        toggle.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const node = toggle.closest(".nav-dock__node");
            const willOpen = !node.classList.contains("is-open");

            closeMenus();

            if (willOpen) {
                node.classList.add("is-open");
                toggle.setAttribute("aria-expanded", "true");
                syncDockOpenState();
                moveIndicator(node);
            } else {
                setActive(activeNode);
            }
        });
    });

    dock.querySelectorAll(".nav-dock__menu").forEach(menu => {
        menu.addEventListener("mouseenter", () => {
            moveIndicator(getVisualNode());
        });

        menu.addEventListener("mouseleave", () => {
            moveIndicator(getVisualNode());
        });
    });

    dock.querySelectorAll(".nav-dock__menu a").forEach(link => {
        link.addEventListener("click", () => {
            const node = link.closest(".nav-dock__node");
            setActive(node);
        });
    });

    document.addEventListener("click", (e) => {
        if (!dock.contains(e.target)) {
            closeMenus();
            setActive(activeNode);
        }
    });

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeMenus();
            setActive(activeNode);
        }
    });

    window.addEventListener("resize", () => {
        moveIndicator(getVisualNode());
    });
});