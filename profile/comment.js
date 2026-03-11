const commentInput = document.querySelector('.comment_input');

commentInput.addEventListener('input', function() {
    this.style.height = 'auto';              // zurücksetzen
    this.style.height = this.scrollHeight + 'px'; // passt Höhe an Text an
});