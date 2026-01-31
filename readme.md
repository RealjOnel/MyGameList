NIKS IDEEN

- [x] dieses mygamelist oben links wenn man drauf klickt dass der dich auch zum home bringt
- [ ] mehrere ansichten bei explore

BRANDONS IDEEN

- [x] Wenn wir eh über das mygamelist zeichen zu home gehen können dann brauchen wir eig home nich mehr und könnten das teoretisch für was anderes nutzen
- [ ] Eine New/Upcoming Games website   

NICOS IDEEN

- [ ] Template

JUSTINS IDEEN

- [ ] Ein "Active" strich unter dem Reiter in dem man sich gerade befindet (navbar)

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
            <a href="#" class="nav-item">Explore</a>
            <a href="#" class="nav-item">Statistics</a>
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