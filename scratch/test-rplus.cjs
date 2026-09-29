const fs = require('fs/promises');
const path = require('path');

async function testRPlus(filePath) {
    try {
        const fh = await fs.open(filePath, 'r+');
        await fh.close();
        console.log(`${filePath}: open('r+') success`);
    } catch (err) {
        console.log(`${filePath}: open('r+') failed with ${err.code}`);
    }
}

async function run() {
    await testRPlus('C:\\Windows\\System32\\notepad.exe');
}
run();
