#!/bin/bash

# ./src/fadec/build.sh && wasm-opt -O1 -o PackageSources/SimObjects/Airplanes/SU95/panel/fadec.wasm PackageSources/SimObjects/Airplanes/SU95/panel/fadec.wasm
./src/fbw/build.sh && wasm-opt -O1 -o PackageSources/SimObjects/Airplanes/SU95/panel/fbw.wasm PackageSources/SimObjects/Airplanes/SU95/panel/fbw.wasm
# ./build_system.sh
