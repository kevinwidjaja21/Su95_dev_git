'use strict';

import ts from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import scss from 'rollup-plugin-scss';

const { join } = require('path');

export default {
    input: join(__dirname, 'instrument.tsx'),
    output: {
        dir: '../../../../PackageSources/html_ui/Pages/VCockpit/Instruments/A32NX_SU95/PFD',
        format: 'es',
    },
    plugins: [scss(
        { output: '../../../../PackageSources/html_ui/Pages/VCockpit/Instruments/A32NX_SU95/PFD/pfd.css' },
    ),
    resolve(), ts()],
};
