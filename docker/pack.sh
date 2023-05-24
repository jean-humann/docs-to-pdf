#!/bin/bash

# Packs docs-to-pdf using yarn and moves the archive file to docker/docs-to-pdf-latest.tgz.
# Expected cwd: project root directory.

yarn pack 
rm -f docker/docs-to-pdf-latest.tgz
mv docs-to-pdf-v[0-9]*.tgz docker/docs-to-pdf-latest.tgz