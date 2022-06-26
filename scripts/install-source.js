require('dotenv').config();
const fs = require('fs-extra');

const source = process.env.BUILD_DIR_NAME ? 'external/a32nx/' + process.env.BUILD_DIR_NAME : 'external/a32nx';
console.log('installManifest source is: ' + source);

const installManifest = fs.readJSONSync('./PackageSources/install.json');
installManifest.source = source;
fs.writeJSONSync('./PackageSources/install.json', installManifest);
