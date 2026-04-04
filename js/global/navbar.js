window.initNavbar = function initNavbar() {
    const nav = document.querySelector(".navbar.navbar--unified");
    const dock = document.getElementById("navDock");

    if (!nav || !dock) return;

    /* prevent double init */
    if (dock.dataset.initialized === "true") return;
    dock.dataset.initialized = "true";

    const nodes = [...dock.querySelectorAll(".nav-dock__node")];
    const indicator = dock.querySelector(".nav-dock__indicator");
    const currentFile = getFileName(window.location.pathname) || "index.html";

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

    let activeNode = findMatchingNode(currentFile) || nodes[0];

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

    function initNavbarUtilityMenus() {
        const friendBell = document.getElementById("friendBell");
        const friendBellBtn = document.getElementById("friendBellBtn");
        const friendBellDropdown = document.getElementById("friendBellDropdown");

        const userMenu = document.getElementById("userMenu");
        const userIcon = document.getElementById("userIcon");
        const userDropdown = document.getElementById("userDropdown");

        /* prevent double init */
        if (friendBellBtn && friendBellBtn.dataset.bound === "true" &&
            userIcon && userIcon.dataset.bound === "true") {
            return;
        }

        function closeFriendBell() {
            if (!friendBellDropdown) return;
            friendBellDropdown.classList.remove("open");
            friendBellDropdown.setAttribute("aria-hidden", "true");
        }

        function closeUserMenu() {
            if (!userDropdown) return;
            userDropdown.classList.remove("open");
            userDropdown.setAttribute("aria-hidden", "true");
        }

        if (friendBellBtn && friendBellDropdown) {
            friendBellBtn.dataset.bound = "true";

            friendBellBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                const isOpen = friendBellDropdown.classList.contains("open");

                closeUserMenu();

                if (isOpen) {
                    closeFriendBell();
                } else {
                    friendBellDropdown.classList.add("open");
                    friendBellDropdown.setAttribute("aria-hidden", "false");
                }
            });
        }

        if (userIcon && userDropdown) {
            userIcon.dataset.bound = "true";

            userIcon.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                const isOpen = userDropdown.classList.contains("open");

                closeFriendBell();

                if (isOpen) {
                    closeUserMenu();
                } else {
                    userDropdown.classList.add("open");
                    userDropdown.setAttribute("aria-hidden", "false");
                }
            });
        }

        document.addEventListener("click", (e) => {
            if (friendBell && !friendBell.contains(e.target)) {
                closeFriendBell();
            }

            if (userMenu && !userMenu.contains(e.target)) {
                closeUserMenu();
            }
        });

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeFriendBell();
                closeUserMenu();
            }
        });
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

    initNavbarUtilityMenus();

    /* Initial state: place everything instantly, no animation */
    setActive(activeNode);

    /* Make sure indicator is positioned before navbar becomes visible */
        requestAnimationFrame(() => {
            moveIndicator(getVisualNode());

            requestAnimationFrame(() => {
                dock.classList.add("is-ready");
                nav.classList.add("is-mounted");
                const navPlaceholder = nav.closest("#navbar-placeholder");
                if (navPlaceholder) navPlaceholder.dataset.loaded = "true";
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
};