#!/bin/bash

# get directory of this script relative to root
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

OUTPUT="${DIR}/../../Su95_git_dev/"

set -ex

# go to right dir
pushd "${DIR}"

# create build files
cmake -B build

# build
cmake --build build --config Release

# restore directory
popd
