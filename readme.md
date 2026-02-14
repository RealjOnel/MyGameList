PLATZHALTER HTML FÜR NAVBAR UND FOOTER

```
<!DOCTYPE html>
<html lang="en" data-auth="loading">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script>
    (function () {
        try {
        const token = localStorage.getItem("token");
        document.documentElement.dataset.auth = token ? "in" : "out";
        } catch (e) {
        document.documentElement.dataset.auth = "out";
        }
    })();
    </script>
    <title>MyGameList | Home</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>

<nav class="navbar">
    <div class="logo">
        <a href="index.html">MY<span class="accent">GAMELIST</span></a>
    </div>
    <div class="nav-links">
        <a href="./OtherPages/features.html" class="nav-item">Features</a>
    
        <div class="nav-item dropdown">
            <a href="./OtherPages/explore.html">Games</a>
            <ul class="dropdown-menu">
                <li><a href="#">Trending Games</a></li>
                <li><a href="#">Upcoming Games</a></li>
                <li><a href="#">New Releases</a></li>
            </ul>
        </div>

        <div class="nav-item dropdown">
            <a href="./OtherPages/statistics.html">Statistics</a>
            <ul class="dropdown-menu">
                <li><a href="./OtherPages/methodology.html">Our Methodology</a></li>
                <li><a href="#">Top Games</a></li>
                <li><a href="#">Hidden Gems</a></li>
                <li><a href="#">Overhyped Titles</a></li>
            </ul>
        </div>

        <div class="nav-item dropdown">
            <a href="./OtherPages/help.html">Help</a>
            <ul class="dropdown-menu">
                <li><a href="./OtherPages/about.html">About</a></li>
                <li><a href="./OtherPages/faq.html">FAQ</a></li>
                <li><a href="./OtherPages/support.html">Support</a></li>
                <li><a href="./OtherPages/staff.html">Staff</a></li>
            </ul>
        </div>

        <button id="loginBtn" class="btn-login" onclick="window.location.href='./LoginPageAndLogic/login.html'">LOGIN</button>

        <div id="userMenu" class="user-menu">
        <img id="userIcon" src="./assets/User/Default_User_Icon.png" alt="User" class="user-icon">

        <div id="userDropdown" class="user-dropdown" aria-hidden="true">
            <a class="dropdown-item" href="./OtherPages/profile.html">Profile</a>
            <a class="dropdown-item" href="./OtherPages/settings.html">Settings</a>

            <div class="dropdown-divider"></div>

            <button id="logoutBtn" class="dropdown-item danger" type="button">Logout</button>
        </div>
        </div>
    </div>
</nav>

<footer class="main-footer">
    <div class="footer-content">
        <div class="footer-brand">
            <div class="logo">MY<span class="accent">GAMELIST</span></div>
            <p>Your ultimate destination to track, discover, and share your gaming journey.</p>
        </div>
        
        <div class="footer-links">
            <div class="link-group">
                <h4>Platform</h4>
                <a href="#">Explore</a>
                <a href="#">Top Games</a>
                <a href="#">Statistics</a>
            </div>
            <div class="link-group">
                <h4>Community</h4>
                <a href="#">Discord</a>
                <a href="#">Forum</a>
                <a href="./guidelines.html">Guidelines</a>
            </div>
            <div class="link-group">
                <h4>Legal</h4>
                <a href="./terms_of_service.html">Terms of Service</a>
                <a href="./legal_notice.html">Legal Notice</a>                
                <a href="./privacy_policy.html">Privacy Policy</a>
                <a href="#">Cookie Policy</a>
            </div>
            <div class="link-group">
                <h4>Help</h4>
                <a href="#">About</a>
                <a href="#">FAQ</a>
                <a href="#">Support</a>
                <a href="#">Staff</a>
            </div>
        </div>
    </div>
    <div class="footer-bottom">
        <p>&copy; 2026 MyGameList. All rights reserved. Built with love for gamers.</p>
    </div>
</footer>

    <script src="../js/global/reveal.js"></script>
    <script src="../js/global/active.js"></script>
    <script src="../js/global/storeuser.js"></script>

</body>
</html>```
