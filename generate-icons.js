/**
 * Simple script to generate PNG icons for the Chrome extension
 * Run with: node generate-icons.js
 * Requires: npm install canvas (if you want to use this script)
 */

const fs = require('fs');
const path = require('path');

// Create a simple HTML file that can be used to generate icons
const iconGeneratorHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Icon Generator</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        canvas { border: 1px solid #ccc; margin: 10px; }
        button { padding: 10px; margin: 5px; }
    </style>
</head>
<body>
    <h1>Generate Extension Icons</h1>
    <p>Right-click each icon and save as PNG:</p>
    
    <div id="icons"></div>
    
    <script>
        const sizes = [16, 48, 128];
        const container = document.getElementById('icons');
        
        sizes.forEach(size => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            // Background
            ctx.fillStyle = '#0052a5';
            ctx.fillRect(0, 0, size, size);
            
            // Border
            ctx.strokeStyle = '#003d7a';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, size-2, size-2);
            
            // USPS text
            ctx.fillStyle = 'white';
            ctx.font = 'bold ' + Math.max(8, size/8) + 'px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('USPS', size/2, size/2 - size/8);
            
            // Mail icon
            const mailSize = size/4;
            const mailX = size/2 - mailSize/2;
            const mailY = size/2 + size/8;
            
            ctx.fillStyle = 'white';
            ctx.fillRect(mailX, mailY, mailSize, mailSize/1.5);
            ctx.strokeStyle = '#0052a5';
            ctx.lineWidth = 1;
            ctx.strokeRect(mailX, mailY, mailSize, mailSize/1.5);
            
            // Mail flap
            ctx.beginPath();
            ctx.moveTo(mailX, mailY);
            ctx.lineTo(size/2, mailY + mailSize/3);
            ctx.lineTo(mailX + mailSize, mailY);
            ctx.stroke();
            
            const div = document.createElement('div');
            div.innerHTML = '<h3>' + size + 'x' + size + '</h3>';
            div.appendChild(canvas);
            container.appendChild(div);
        });
    </script>
</body>
</html>`;

// Write the HTML file
fs.writeFileSync('icon-generator.html', iconGeneratorHTML);

console.log('Icon generator HTML file created: icon-generator.html');
console.log('Open this file in your browser to generate the icons.');
console.log('Right-click each icon and save as icon16.png, icon48.png, and icon128.png in the icons/ folder.');
console.log('');
console.log('Alternatively, you can use the extension without icons by keeping the manifest.json as is.');
