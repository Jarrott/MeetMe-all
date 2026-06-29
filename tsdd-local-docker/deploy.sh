#!/usr/bin/env sh
set -eu

DOCKER_BIN="${DOCKER_BIN:-/Applications/Docker.app/Contents/Resources/bin/docker}"

cd "$(dirname "$0")"
"$DOCKER_BIN" compose up -d --build
"$DOCKER_BIN" compose ps
