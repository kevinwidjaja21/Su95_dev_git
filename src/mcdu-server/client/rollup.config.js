'use strict';

const copy = require('rollup-plugin-copy');
const babel = require('@rollup/plugin-babel').default;
const nodeResolve = require('@rollup/plugin-node-resolve').default;
const commonjs = require('@rollup/plugin-commonjs');
const postcss = require('rollup-plugin-postcss');
const replace = require('@rollup/plugin-replace');
const path = require('path');

export default {
    input: path.join(__dirname, 'src/index.jsx'),
    output: {
        file: path.join(__dirname, './build/bundle.js'),
        format: 'iife',
        sourcemap: false,
    },
    plugins: [
        replace({ 'process.env.NODE_ENV': JSON.stringify('production') }),
        postcss(),
        copy({
            targets: [
                {
                    src: `${path.join(__dirname, './public/')}*`,
                    dest: path.join(__dirname, './build/'),
                },
                {
                    src: [
                        path.join(__dirname, '../../../PackageSources/html_ui/Fonts_SU95/HoneywellMCDU.ttf'),
                        path.join(__dirname, '../../../PackageSources/html_ui/Fonts_SU95/HoneywellMCDUSmall.ttf'),
                    ],
                    dest: path.join(__dirname, './build/'),
                },
            ],
        }),
        nodeResolve({ extensions: ['.js', '.jsx', '.ts', '.tsx'] }),
        babel({ presets: ['@babel/preset-react'] }),
        commonjs(),
    ],
};
