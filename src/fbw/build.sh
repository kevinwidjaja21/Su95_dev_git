#!/bin/bash

# get directory of this script relative to root
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

OUTPUT="${DIR}/../../PackageSources/SimObjects/AirPlanes/SU95/panel/fbw.wasm"

if [ "$1" == "--debug" ]; then
  CLANG_ARGS="-g"
else
  WASMLD_ARGS="--strip-debug"
fi

set -ex

# create temporary folder for o files
mkdir -p "${DIR}/obj"
pushd "${DIR}/obj"

# compile c code
clang \
  -c \
  -Wno-unused-command-line-argument \
  -Wno-implicit-function-declaration \
  --sysroot "${MSFS_SDK}/WASM/wasi-sysroot" \
  -target wasm32-unknown-wasi \
  -flto \
  -D_MSFS_WASM=1 \
  -D__wasi__ \
  -D_LIBCPP_HAS_NO_THREADS \
  -D_WINDLL \
  -D_MBCS \
  -mthread-model single \
  -fno-exceptions \
  -fms-extensions \
  -fvisibility=hidden \
  -O3 \
  -I "${MSFS_SDK}/WASM/include" \
  -I "${DIR}/src/zlib" \
  "${DIR}/src/zlib/adler32.c" \
  "${DIR}/src/zlib/crc32.c" \
  "${DIR}/src/zlib/deflate.c" \
  "${DIR}/src/zlib/gzclose.c" \
  "${DIR}/src/zlib/gzlib.c" \
  "${DIR}/src/zlib/gzread.c" \
  "${DIR}/src/zlib/gzwrite.c" \
  "${DIR}/src/zlib/infback.c" \
  "${DIR}/src/zlib/inffast.c" \
  "${DIR}/src/zlib/inflate.c" \
  "${DIR}/src/zlib/inftrees.c" \
  "${DIR}/src/zlib/trees.c" \
  "${DIR}/src/zlib/zutil.c"

# compile c++ code
clang++ \
  -c \
  ${CLANG_ARGS} \
  -std=c++20 \
  -Wno-unused-command-line-argument \
  -Wno-ignored-attributes \
  -Wno-macro-redefined \
  --sysroot "${MSFS_SDK}/WASM/wasi-sysroot" \
  -target wasm32-unknown-wasi \
  -flto \
  -D_MSFS_WASM=1 \
  -D__wasi__ \
  -D_LIBCPP_HAS_NO_THREADS \
  -D_WINDLL \
  -D_MBCS \
  -mthread-model single \
  -fno-exceptions \
  -fms-extensions \
  -fvisibility=hidden \
  -O3 \
  -I "${MSFS_SDK}/WASM/include" \
  -I "${MSFS_SDK}/SimConnect SDK/include" \
  -I "${DIR}/src/inih" \
  -I "${DIR}/src/interface" \
  "${DIR}/src/interface/SimConnectInterface.cpp" \
  -I "${DIR}/src/busStructures" \
  -I "${DIR}/src/elac" \
  "${DIR}/src/elac/Elac.cpp" \
  -I "${DIR}/src/sec" \
  "${DIR}/src/sec/Sec.cpp" \
  -I "${DIR}/src/fcdc" \
  "${DIR}/src/fcdc/Fcdc.cpp" \
  -I "${DIR}/src/fac" \
  "${DIR}/src/fac/Fac.cpp" \
  -I "${DIR}/src/failures" \
  "${DIR}/src/failures/FailuresConsumer.cpp" \
  -I "${DIR}/src/utils" \
  "${DIR}/src/utils/ConfirmNode.cpp" \
  "${DIR}/src/utils/SRFlipFLop.cpp" \
  "${DIR}/src/utils/PulseNode.cpp" \
  "${DIR}/src/utils/HysteresisNode.cpp" \
  -I "${DIR}/src/model" \
  "${DIR}/src/model/AutopilotLaws_data.cpp" \
  "${DIR}/src/model/AutopilotLaws.cpp" \
  "${DIR}/src/model/AutopilotStateMachine_data.cpp" \
  "${DIR}/src/model/AutopilotStateMachine.cpp" \
  "${DIR}/src/model/Autothrust_data.cpp" \
  "${DIR}/src/model/Autothrust.cpp" \
  "${DIR}/src/model/Double2MultiWord.cpp" \
  "${DIR}/src/model/ElacComputer_data.cpp" \
  "${DIR}/src/model/ElacComputer.cpp" \
  "${DIR}/src/model/SecComputer_data.cpp" \
  "${DIR}/src/model/SecComputer.cpp" \
  "${DIR}/src/model/PitchNormalLaw.cpp" \
  "${DIR}/src/model/PitchAlternateLaw.cpp" \
  "${DIR}/src/model/PitchDirectLaw.cpp" \
  "${DIR}/src/model/LateralNormalLaw.cpp" \
  "${DIR}/src/model/LateralDirectLaw.cpp" \
  "${DIR}/src/model/FacComputer_data.cpp" \
  "${DIR}/src/model/FacComputer.cpp" \
  "${DIR}/src/model/look1_binlxpw.cpp" \
  "${DIR}/src/model/look2_binlcpw.cpp" \
  "${DIR}/src/model/look2_binlxpw.cpp" \
  "${DIR}/src/model/mod_mvZvttxs.cpp" \
  "${DIR}/src/model/MultiWordIor.cpp" \
  "${DIR}/src/model/rt_modd.cpp" \
  "${DIR}/src/model/rt_remd.cpp" \
  "${DIR}/src/model/uMultiWord2Double.cpp" \
  -I "${DIR}/src/zlib" \
  "${DIR}/src/zlib/zfstream.cc" \
  "${DIR}/src/FlyByWireInterface.cpp" \
  "${DIR}/src/FlightDataRecorder.cpp" \
  "${DIR}/src/Arinc429.cpp" \
  "${DIR}/src/Arinc429Utils.cpp" \
  "${DIR}/src/LocalVariable.cpp" \
  "${DIR}/src/InterpolatingLookupTable.cpp" \
  "${DIR}/src/SpoilersHandler.cpp" \
  "${DIR}/src/ThrottleAxisMapping.cpp" \
  "${DIR}/src/CalculatedRadioReceiver.cpp" \
  "${DIR}/src/main.cpp" \

# restore directory
popd

# link modules
wasm-ld \
  --no-entry \
  --allow-undefined \
  -L "${MSFS_SDK}/WASM/wasi-sysroot/lib/wasm32-wasi" \
  -lc "${MSFS_SDK}/WASM/wasi-sysroot/lib/wasm32-wasi/libclang_rt.builtins-wasm32.a" \
  --export __wasm_call_ctors \
  --export-dynamic \
  --export malloc \
  --export free \
  --export __wasm_call_ctors \
  --export-table \
  --gc-sections \
  ${WASMLD_ARGS} \
  -O3 --lto-O3 \
  -lc++ -lc++abi \
  ${DIR}/obj/*.o \
  -o $OUTPUT
