fetch ("/NavFooter/footer.html")
    .then(res => res.text())
    .then(data => document.getElementById('footer-placeholder').innerHTML = data);
