import { ExecTask, TaskOfTasks } from '@flybywiresim/igniter';
import { getInstrumentsIgniterTasks } from './src/instruments/buildSrc/igniter/tasks.mjs';

export default new TaskOfTasks('a32nx', [
    new TaskOfTasks('build', [
        new TaskOfTasks('instruments', getInstrumentsIgniterTasks(), true),
        new ExecTask('failures','npm run build:failures', ['src/failures', 'PackageSources/html_ui/JS_SU95/generated/failures.js']),
        new ExecTask('behavior','node src/behavior/build.js', ['src/behavior', 'PackageSources/ModelBehaviorDefs/SU95/generated']),
        new ExecTask('model','node src/model/build.js', ['src/model', 'PackageSources/SimObjects/AirPlanes/SU95/model']),
        new ExecTask('systems', [
            'cargo build --target wasm32-wasi --release',
            'wasm-opt -O3 -o PackageSources/SimObjects/AirPlanes/SU95/panel/systems.wasm target/wasm32-wasi/release/systems.wasm',
        ], ['src/systems', 'Cargo.lock', 'Cargo.toml', 'PackageSources/SimObjects/AirPlanes/SU95/panel/systems.wasm']),
        new ExecTask('systems-autopilot', [
            'src/fbw/build.sh',
            'wasm-opt -O1 -o PackageSources/SimObjects/AirPlanes/SU95/panel/fbw.wasm PackageSources/SimObjects/AirPlanes/SU95/panel/fbw.wasm'
        ], ['src/fbw', 'PackageSources/SimObjects/AirPlanes/SU95/panel/fbw.wasm']),
        new ExecTask('systems-fadec', [
            'src/fadec/build.sh',
            'wasm-opt -O1 -o PackageSources/SimObjects/AirPlanes/SU95/panel/fadec.wasm PackageSources/SimObjects/AirPlanes/SU95/panel/fadec.wasm'
        ], ['src/fadec', 'PackageSources/SimObjects/AirPlanes/SU95/panel/fadec.wasm']),
    ], true),

]);
