#!/bin/bash

# Packs docs-to-pdf using yarn and moves the archive file to docker/docs-to-pdf-latest.tgz.
# Expected cwd: project root directory.
# Take first argument as os, default to alpine

if [ -z "$1" ]; then
  OS=alpine
else
  OS=$1
fi
yarn pack
rm -f "docker/${OS}/docs-to-pdf-latest.tgz"
mv package.tgz "docker/${OS}/docs-to-pdf-latest.tgz"
