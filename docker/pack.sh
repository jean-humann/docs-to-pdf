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

# Find the created tarball
# Yarn 1 (classic) creates: docs-to-pdf-v0.6.2.tgz
# Yarn 4+ (modern) creates: package.tgz
if [ -f "package.tgz" ]; then
  TARBALL="package.tgz"
else
  TARBALL=$(ls docs-to-pdf-v*.tgz 2>/dev/null | head -n 1)
fi

if [ -z "$TARBALL" ]; then
  echo "Error: Could not find tarball created by yarn pack"
  exit 1
fi

rm -f "docker/${OS}/docs-to-pdf-latest.tgz"
mv "$TARBALL" "docker/${OS}/docs-to-pdf-latest.tgz"
