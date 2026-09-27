const reg = require('registry-js');
const vals = reg.enumerateValues(reg.HKEY.HKEY_CURRENT_USER, 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run');
console.log(vals);
