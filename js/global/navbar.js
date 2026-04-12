document.addEventListener("DOMContentLoaded", () => {
    const dock = document.getElementById("navDock");
    if (!dock) return;

    const nodes = [...dock.querySelectorAll(".nav-dock__node")];
    const indicator = dock.querySelector(".nav-dock__indicator");
    const currentFile = getFileName(window.location.pathname) || "index.html";
    const hasNoDefaultActive = (dock.dataset.defaultActive || "").trim().toLowerCase() === "none";

    function getFileName(value) {
        if (!value) return "";
        const clean = value.split("#")[0].split("?")[0];
        const file = clean.split("/").pop() || "";
        return file.toLowerCase();
    }

    function collectNodeFiles(node) {
        const files = new Set();

        const route = (node.dataset.route || "").trim().toLowerCase();
        if (route) files.add(route);

        const mainLink = node.querySelector(".nav-dock__node--link[href]");
        if (mainLink) {
            const file = getFileName(mainLink.getAttribute("href"));
            if (file) files.add(file);
        }

        node.querySelectorAll(".nav-dock__menu a[href]").forEach(link => {
            const href = link.getAttribute("href");
            if (!href || href === "#" || href.startsWith("javascript:")) return;

            const file = getFileName(href);
            if (file) files.add(file);
        });

        const extraMatches = (node.dataset.match || "")
            .split(",")
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);

        extraMatches.forEach(file => files.add(file));

        return [...files];
    }

    const nodeFilesMap = new Map(
        nodes.map(node => [node, collectNodeFiles(node)])
    );

    function findMatchingNode(fileName) {
        return nodes.find(node => {
            const files = nodeFilesMap.get(node) || [];
            return files.includes(fileName);
        });
    }

    let activeNode = findMatchingNode(currentFile) || (hasNoDefaultActive ? null : nodes[0]);
    let transientIndicatorVisible = false;

    function setIndicatorVisible(visible) {
        if (!indicator) return;
        indicator.style.opacity = visible ? "1" : "0";
        indicator.style.visibility = visible ? "visible" : "hidden";
    }

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
        activeNode = node || null;
        if (node) {
            node.classList.add("is-active");
            moveIndicator(getVisualNode());
        } else {
            transientIndicatorVisible = false;
            setIndicatorVisible(false);
        }
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
        } else if (hasNoDefaultActive) {
            transientIndicatorVisible = false;
            setIndicatorVisible(false);
        }

        syncDockOpenState();
    }

    setActive(activeNode);

    requestAnimationFrame(() => {
        moveIndicator(getVisualNode());

        requestAnimationFrame(() => {
            dock.classList.add("is-ready");
        });
    });

    nodes.forEach(node => {
        node.addEventListener("mouseenter", () => {
            if (!activeNode && hasNoDefaultActive) {
                transientIndicatorVisible = true;
                setIndicatorVisible(true);
            }
            moveIndicator(node);
        });

        node.addEventListener("mouseleave", () => {
            if (!activeNode && hasNoDefaultActive) {
                transientIndicatorVisible = false;
                setIndicatorVisible(false);
            }
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
                setIndicatorVisible(true);
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
        if (!activeNode && hasNoDefaultActive && !transientIndicatorVisible) {
            setIndicatorVisible(false);
        }
    });
});