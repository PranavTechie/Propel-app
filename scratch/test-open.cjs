const fs = require('fs/promises');
const path = require('path');

async function testOpen(filePath) {
    try {
        const fh = await fs.open(filePath, 'a');
        await fh.close();
        console.log(`${filePath}: open('a') success`);
    } catch (err) {
        console.log(`${filePath}: open('a') failed with ${err.code}`);
    }
}

async function run() {
    await testOpen('C:\\Windows\\System32\\notepad.exe');
    // create a read-only file
    const ro = path.join(__dirname, 'readonly2.txt');
    await fs.writeFile(ro, 'test');
    await fs.chmod(ro, 0o444);
    await testOpen(ro);
    
    // open a file and keep it open to lock it
    const locked = path.join(__dirname, 'locked2.txt');
    await fs.writeFile(locked, 'test');
    const fh = await fs.open(locked, 'w');
    await testOpen(locked);
    
    // cleanup
    await fs.chmod(ro, 0o666);
    await fs.unlink(ro);
    await fh.close();
    await fs.unlink(locked);
}
run();
