#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
docker compose up -d --build
echo "启动完成：http://localhost:3000"
