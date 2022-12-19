import { ExecTask, TaskOfTasks } from '@flybywiresim/igniter';
import { getInstrumentsIgniterTasks } from './src/instruments/buildSrc/igniter/tasks.mjs';

export default new TaskOfTasks('a32nx-su95', [
    new TaskOfTasks('preparation', [
        new ExecTask('efb-translation', 'npm run build:efb-translation'),
    ]),

    new TaskOfTasks('wasm', [
        new ExecTask('systems', [
            'cargo build -p a320_systems_wasm --target wasm32-wasi --release',
            'wasm-opt -O1 -o PackageSources/SimObjects/AirPlanes/SU95/panel/systems.wasm target/wasm32-wasi/release/a320_systems_wasm.wasm',
        ], ['src/systems', 'Cargo.lock', 'Cargo.toml', 'PackageSources/SimObjects/AirPlanes/SU95/panel/systems.wasm']),
        new ExecTask('systems-autopilot', [
            'src/fbw/build.sh',
            'wasm-opt -O1 -o PackageSources/SimObjects/AirPlanes/SU95/panel/fbw.wasm PackageSources/SimObjects/AirPlanes/SU95/panel/fbw.wasm'
        ], ['src/fbw', 'PackageSources/SimObjects/AirPlanes/SU95/panel/fbw.wasm']),
        new ExecTask('systems-fadec', [
            'src/fadec/build.sh',
            'wasm-opt -O1 -o PackageSources/SimObjects/AirPlanes/SU95/panel/fadec.wasm PackageSources/SimObjects/AirPlanes/SU95/panel/fadec.wasm'
        ], ['src/fadec', 'PackageSources/SimObjects/AirPlanes/SU95/panel/fadec.wasm']),
        new ExecTask('flypad-backend', [
            'src/flypad-backend/build.sh',
            'wasm-opt -O1 -o PackageSources/SimObjects/AirPlanes/SU95/panel/flypad-backend.wasm PackageSources/SimObjects/AirPlanes/SU95/panel/flypad-backend.wasm'
        ], ['src/flypad-backend', 'PackageSources/SimObjects/AirPlanes/SU95/panel/flypad-backend.wasm']),
    ], true),

    new TaskOfTasks('build', [
        new TaskOfTasks('instruments',
            [...getInstrumentsIgniterTasks(),
                new ExecTask('pfd',
                    'npm run build:pfd',
                    ['src/instruments/src/PFD','PackageSources/html_ui/Pages/VCockpit/Instruments/A32NX_SU95/PFD']
                )
            ],
            true),
        new ExecTask('atsu','npm run build:atsu', ['src/atsu', 'PackageSources/html_ui/JS_SU95/atsu']),
        new ExecTask('sentry-client','npm run build:sentry-client', ['src/sentry-client', 'PackageSources/html_ui/JS_SU95/sentry-client']),
        new ExecTask('failures','npm run build:failures', ['src/failures', 'PackageSources/html_ui/JS_SU95/generated/failures.js']),
        new ExecTask('behavior','node src/behavior/build.js', ['src/behavior', 'PackageSources/ModelBehaviorDefs/SU95/generated']),
        new ExecTask('model','node src/model/build.js', ['src/model', 'PackageSources/SimObjects/AirPlanes/SU95/model']),
        new ExecTask('fmgc','npm run build:fmgc', ['src/fmgc', 'PackageSources/html_ui/JS_SU95/fmgc']),
        new TaskOfTasks('simbridge', [
            new ExecTask('client', ['npm run build:simbridge-client'], ['src/simbridge-client', 'PackageSources/html_ui/JS_SU95/simbridge-client']),
        ]),
    ], true),
]);
