const fs = require('fs/promises');
const path = require('path');

async function testAccess(filePath) {
    try {
        await fs.access(filePath, fs.constants.W_OK);
        console.log(`${filePath}: W_OK success`);
    } catch (err) {
        console.log(`${filePath}: W_OK failed with ${err.code}`);
    }
}

async function run() {
    await testAccess('C:\\Windows\\System32\\notepad.exe');
    // create a read-only file
    const ro = path.join(__dirname, 'readonly.txt');
    await fs.writeFile(ro, 'test');
    await fs.chmod(ro, 0o444);
    await testAccess(ro);
    
    // open a file and keep it open to lock it
    const locked = path.join(__dirname, 'locked.txt');
    await fs.writeFile(locked, 'test');
    const fh = await fs.open(locked, 'w');
    await testAccess(locked);
    
    // cleanup
    await fs.chmod(ro, 0o666);
    await fs.unlink(ro);
    await fh.close();
    await fs.unlink(locked);
}
run();
