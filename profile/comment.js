const commentInput = document.querySelector('.comment_input');

commentInput.addEventListener('input', function() {
    this.style.height = 'auto';              // reset
    this.style.height = this.scrollHeight + 'px'; // set to scrollHeight
});