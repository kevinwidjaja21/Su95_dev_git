#!/bin/bash

# sed -i -e 's/\r$//' /external/src/fadec/build.sh
# sh ./src/fadec/build.sh && wasm-opt -O1 -o PackageSources/SimObjects/Airplanes/SU95/panel/fadec.wasm PackageSources/SimObjects/Airplanes/SU95/panel/fadec.wasm
# sed -i -e 's/\r$//' /external/src/fbw/build.sh
# ./src/fbw/build.sh && wasm-opt -O1 -o PackageSources/SimObjects/Airplanes/SU95/panel/fbw.wasm PackageSources/SimObjects/Airplanes/SU95/panel/fbw.wasm
cargo build --target wasm32-wasi --release
wasm-opt -O3 -o PackageSources/SimObjects/Airplanes/SU95/panel/systems.wasm target/wasm32-wasi/release/systems.wasm
