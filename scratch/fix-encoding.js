const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '../src/pages/AIFeaturesPage.tsx'),
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace remaining â” with =
  content = content.replace(/â”/g, '=');

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Fixed encoding in ${file}`);
}
