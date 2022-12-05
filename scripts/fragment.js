const fragmenter = require('@flybywiresim/fragmenter');
const fs = require('fs');

const execute = async () => {
    try {
        const result = await fragmenter.pack({
            packOptions: { splitFileSize: 536_870_912, keepCompleteModulesAfterSplit: true },
            baseDir: './PackageSources',
            outDir: './build-modules',
            modules: [{
                name: 'effects',
                sourceDir: './effects'
            }, {
                name: 'html_ui',
                sourceDir: './html_ui'
            }, {
                name: 'CUSTOMIZE',
                sourceDir: './CUSTOMIZE'
            }, {
                name: 'ModelBehaviorDefs',
                sourceDir: './ModelBehaviorDefs'
            }, {
                name: 'Textures',
                sourceDir: './SimObjects/AirPlanes/SU95/TEXTURE'
            }, {
                name: 'Sound',
                sourceDir: './SimObjects/AirPlanes/SU95/sound'
            }, {
                name: 'Model',
                sourceDir: './SimObjects/AirPlanes/SU95/model'
            }, {
                name: 'Panels',
                sourceDir: './SimObjects/AirPlanes/SU95/panel'
            }]
        });
        console.log(result);
        console.log(fs.readFileSync('./build-modules/modules.json').toString());
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

execute();
