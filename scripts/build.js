// Copyright (c) 2022 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

'use strict';

const fs = require('fs');
const path = require('path');

function* readdir(d) {
    for (const dirent of fs.readdirSync(d, { withFileTypes: true })) {
        if (['layout.json', 'manifest.json'].includes(dirent.name)) {
            continue;
        }
        const resolved = path.join(d, dirent.name);
        if (dirent.isDirectory()) {
            yield* readdir(resolved);
        } else {
            yield resolved;
        }
    }
}

const { execSync } = require('child_process');

function executeGitCommand(command) {
    return execSync(command)
        .toString('utf8')
        .replace(/[\n\r]+$/, '');
}

const isPullRequest = process.env.GITHUB_REF && process.env.GITHUB_REF.startsWith('refs/pull/');

let GIT_BRANCH;
if (isPullRequest) {
    GIT_BRANCH = process.env.GITHUB_REF.match('^refs/pull/([0-9]+)/.*$')[1];
} else {
    GIT_BRANCH = process.env.GITHUB_REF_NAME
        ? process.env.GITHUB_REF_NAME
        : executeGitCommand('git rev-parse --abbrev-ref HEAD');
}

const GIT_COMMIT_SHA = process.env.GITHUB_SHA
    ? process.env.GITHUB_SHA.substring(0, 9)
    : executeGitCommand('git rev-parse --short HEAD');

const MS_FILETIME_EPOCH = 116444736000000000n;
const A32NX = path.resolve(__dirname, '..', 'PackageSources');

const edition = require('../package.json').edition;

let titlePostfix;
if (edition === 'stable') {
    titlePostfix = 'Stable';
} else if (GIT_BRANCH === 'master') {
    titlePostfix = 'Development';
} else if (GIT_BRANCH === 'experimental') {
    titlePostfix = 'Experimental';
} else if (isPullRequest) {
    titlePostfix = `PR #${GIT_BRANCH}`;
} else {
    titlePostfix = `branch ${GIT_BRANCH}`;
}
const title = `A32NX (${titlePostfix})`;

// This copies one of two prepared DDS files from the src folder
// (src/Textures/decals 4k/) to the aircraft folder
// (PackageSources/SimObjects/AirPlanes/SU95/TEXTURE/)
// based on the current branch the build is executed from.
// Stable and Master will get the DDS with the yellow INOP label.
// All other branches get the DDS with the red INOP label.
// Stable will not show the label (encoded in the src/model build.js)
// Development will show a yellow label
// All other branches show a red label

function copyDDSFiles(src_dds) {
    const TARGET_PATH = '/SimObjects/AirPlanes/SU95/TEXTURE/A320NEO_COCKPIT_DECALSTEXT_ALBD.TIF.dds';
    // destination will be created or overwritten by default.
    fs.copyFile(path.join(path.resolve(__dirname, '..', 'src'), src_dds), path.join(A32NX, TARGET_PATH),
        (err) => {
            if (err) {
                throw err;
            }
            console.log('copying ' + src_dds + ` to ` + TARGET_PATH + "failed: " + err);
        });
}

if (edition === 'stable') {
    copyDDSFiles('/Textures/decals 4k/A320NEO_COCKPIT_DECALSTEXT_ALBD.TIF-stable.dds');
} else if (GIT_BRANCH === 'master') {
    copyDDSFiles('/Textures/decals 4k/A320NEO_COCKPIT_DECALSTEXT_ALBD.TIF-master.dds');
} else {
    copyDDSFiles('/Textures/decals 4k/A320NEO_COCKPIT_DECALSTEXT_ALBD.TIF-exp.dds');
}

const contentEntries = [];
let totalPackageSize = 0;

for (const filename of readdir(A32NX)) {
    const stat = fs.statSync(filename, { bigint: true });
    contentEntries.push({
        path: path.relative(A32NX, filename.replace(path.sep, '/')),
        size: Number(stat.size),
        date: Number((stat.mtimeNs / 100n) + MS_FILETIME_EPOCH),
    });
    totalPackageSize += Number(stat.size);
}

fs.writeFileSync(path.join(A32NX, 'layout.json'), JSON.stringify({
    content: contentEntries,
}, null, 2));

fs.writeFileSync(path.join(A32NX, 'manifest.json'), JSON.stringify({
    ...require('../manifest-base.json'),
    title: title,
    package_version: require('../package.json').version + `-${GIT_COMMIT_SHA}`,
    total_package_size: totalPackageSize.toString().padStart(20, '0'),
}, null, 2));
