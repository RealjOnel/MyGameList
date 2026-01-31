document.addEventListener("DOMContentLoaded", () => {
    
    const masterBox = document.getElementById('master-box');
    const tags = document.querySelectorAll('.status-tag');

    const colors = {
        'playing': '#10b981',  
        'completed': '#3b82f6', 
        'on-hold': '#f59e0b',   
        'dropped': '#ef4444',   
        'planned': '#94a3b8'    
    };

    tags.forEach(tag => {
        tag.addEventListener('mouseenter', () => {
            let color = '';
            for (const [key, value] of Object.entries(colors)) {
                if (tag.classList.contains(key)) {
                    color = value;
                    break;
                }
            }

            if (color) {
                masterBox.style.borderColor = color;
                
                masterBox.style.backgroundColor = `${color}15`; 
                
                masterBox.style.boxShadow = `0 20px 40px -10px ${color}50`; 
                
                masterBox.style.transform = "translateY(-5px)";
            }
        });

        tag.addEventListener('mouseleave', () => {
            masterBox.style.borderColor = "";
            masterBox.style.backgroundColor = "";
            masterBox.style.boxShadow = "";
            masterBox.style.transform = "";
        });
    });
});