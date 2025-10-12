const fs = require('fs');

// Based on the image provided, these are the combination caps shown
// The image shows 18 combination caps in a grid (9 in top row, 9 in bottom row)
const combinationCaps = [
  // Top row (left to right)
  {
    colorName: "Black/Black/White",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Black.jpg,White.jpg,White.jpg,Black.jpg,Black.jpg,Black.jpg"
  },
  {
    colorName: "Navy/Navy/White",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Navy.jpg,Navy.jpg,White.jpg,White.jpg,Navy.jpg,Navy.jpg,Navy.jpg"
  },
  {
    colorName: "Columbia Blue/Columbia Blue/White",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Columbia%20Blue.jpg,Columbia%20Blue.jpg,White.jpg,White.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg"
  },
  {
    colorName: "Grey/Grey/White",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Light-Grey.jpg,Light-Grey.jpg,White.jpg,White.jpg,Light-Grey.jpg,Light-Grey.jpg,Light-Grey.jpg"
  },
  {
    colorName: "Charcoal/Charcoal/White",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Charcoal.jpg,White.jpg,White.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg"
  },
  {
    colorName: "Brown/Brown/White",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Brown.jpg,Brown.jpg,White.jpg,White.jpg,Brown.jpg,Brown.jpg,Brown.jpg"
  },
  {
    colorName: "White/White/Grey",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=White.jpg,White.jpg,Light-Grey.jpg,Light-Grey.jpg,White.jpg,White.jpg,White.jpg"
  },
  {
    colorName: "White/White/Columbia Blue",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=White.jpg,White.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg,White.jpg,White.jpg,White.jpg"
  },
  {
    colorName: "White/White/Black",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=White.jpg,White.jpg,Black.jpg,Black.jpg,White.jpg,White.jpg,White.jpg"
  },
  
  // Bottom row (left to right)
  {
    colorName: "White/White/Navy",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=White.jpg,White.jpg,Navy.jpg,Navy.jpg,White.jpg,White.jpg,White.jpg"
  },
  {
    colorName: "White/White/Green",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=White.jpg,White.jpg,Kelly.jpg,Kelly.jpg,White.jpg,White.jpg,White.jpg"
  },
  {
    colorName: "White/White/Royal",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=White.jpg,White.jpg,Royal.jpg,Royal.jpg,White.jpg,White.jpg,White.jpg"
  },
  {
    colorName: "White/White/Red",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=White.jpg,White.jpg,Red.jpg,Red.jpg,White.jpg,White.jpg,White.jpg"
  },
  {
    colorName: "Khaki/Khaki/Black",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Khaki-112.jpg,Khaki-112.jpg,Black.jpg,Black.jpg,Khaki-112.jpg,Khaki-112.jpg,Khaki-112.jpg"
  },
  {
    colorName: "Khaki/Khaki/Columbia Blue",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Khaki-112.jpg,Khaki-112.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg,Khaki-112.jpg,Khaki-112.jpg,Khaki-112.jpg"
  },
  {
    colorName: "Khaki/Khaki/Kelly",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Khaki-112.jpg,Khaki-112.jpg,Kelly.jpg,Kelly.jpg,Khaki-112.jpg,Khaki-112.jpg,Khaki-112.jpg"
  },
  {
    colorName: "Khaki/Khaki/Orange",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Khaki-112.jpg,Khaki-112.jpg,Orange.jpg,Orange.jpg,Khaki-112.jpg,Khaki-112.jpg,Khaki-112.jpg"
  },
  {
    colorName: "Khaki/Khaki/Navy",
    fullSizeUrl: "https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Khaki-112.jpg,Khaki-112.jpg,Navy.jpg,Navy.jpg,Khaki-112.jpg,Khaki-112.jpg,Khaki-112.jpg"
  }
];

// Save the data to a JSON file
fs.writeFileSync('richardson-combination-caps.json', JSON.stringify(combinationCaps, null, 2));
console.log('Data saved to richardson-combination-caps.json');

// Create a markdown file with the URLs
let markdown = '# Richardson 112 Combination Cap URLs\n\n';
combinationCaps.forEach((cap, index) => {
  markdown += `${index + 1}. **${cap.colorName}**\n`;
  markdown += `   - Full-size URL: \`${cap.fullSizeUrl}\`\n\n`;
});

fs.writeFileSync('richardson-combination-caps.md', markdown);
console.log('Markdown saved to richardson-combination-caps.md');

// Create a simple HTML file to view the caps
let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Richardson 112 Combination Caps</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; }
    .caps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .cap-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; }
    .cap-card img { max-width: 100%; height: auto; }
    .cap-name { font-weight: bold; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Richardson 112 Combination Caps</h1>
  <div class="caps-grid">
`;

combinationCaps.forEach(cap => {
  html += `
    <div class="cap-card">
      <img src="${cap.fullSizeUrl}" alt="${cap.colorName}">
      <div class="cap-name">${cap.colorName}</div>
    </div>
  `;
});

html += `
  </div>
</body>
</html>
`;

fs.writeFileSync('richardson-combination-caps.html', html);
console.log('HTML viewer saved to richardson-combination-caps.html');