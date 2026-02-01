PLATZHALTER HTML FÜR NAVBAR UND FOOTER

```<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyGameList | Home</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>
<body>

<nav class="navbar">
    <div class="logo">
        <a href="index.html">MY<span class="accent">GAMELIST</span></a>
    </div>
    <div class="nav-links">
        <a href="#" class="nav-item">Features</a>
    
        <div class="nav-item dropdown">
            <a href="./OtherPages/explore.html">Explore</a>
            <ul class="dropdown-menu">
                <li><a href="#">Upcoming Games</a></li>
                <li><a href="#">New Releases</a></li>
            </ul>
        </div>

        <div class="nav-item dropdown">
            <a href="#">Statistics</a>
            <ul class="dropdown-menu">
                <li><a href="#">Top Games</a></li>
                <li><a href="#">Hidden Gems</a></li>
                <li><a href="#">Overhyped Titles</a></li>
            </ul>
        </div>

        <button class="btn-login">LOGIN</button>
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
                <a href="#">Guidelines</a>
            </div>
            <div class="link-group">
                <h4>Legal</h4>
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Cookie Policy</a>
            </div>
        </div>
    </div>
    <div class="footer-bottom">
        <p>&copy; 2026 MyGameList. All rights reserved. Built with love for gamers.</p>
    </div>
</footer>

</body>
</html> ```