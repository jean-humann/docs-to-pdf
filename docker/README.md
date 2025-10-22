# Docker E2E Testing

This directory contains Docker configurations and E2E tests for docs-to-pdf across multiple Node.js versions and Docusaurus versions.

## Supported Configurations

### Operating Systems

- **Alpine**: Lightweight Linux distribution
- **Debian**: Full-featured Debian-based distribution (Ubuntu)

### Node.js Versions

- Node 20
- Node 22
- Node 24

### Docusaurus Versions Tested

- **Docusaurus v1**: https://v1.docusaurus.io/docs/en/installation
- **Docusaurus v2**: https://docusaurus-archive-october-2023.netlify.app/docs/2.3.1
- **Docusaurus v3**: https://docusaurus.io/fr/docs

## Quick Testing

To quickly test all three Docusaurus versions with Alpine and Node 24:

```bash
cd docker
./test-quick.sh
```

This is the fastest way to verify that docs-to-pdf works with all Docusaurus versions.

## Full E2E Testing

To test all combinations (18 total tests: 3 Docusaurus versions × 2 OS × 3 Node versions):

```bash
cd docker
./test-e2e.sh
```

This will:

1. Build the docs-to-pdf package
2. Pack it for both Alpine and Debian
3. Build Docker images for all combinations
4. Test each image against all three Docusaurus versions
5. Generate PDFs in the `output/` directory
6. Display a summary of test results

## Manual Testing

### Using docker-compose

Test individual combinations:

```bash
# Build and run a specific test
docker-compose -f docker-compose.e2e.yml run --rm test-v3-alpine-node24

# Build a specific image
docker-compose -f docker-compose.e2e.yml build test-v2-debian-node22
```

### Using docker directly

Build and run images directly:

```bash
# Build an image
docker build --build-arg NODE_VERSION=24 -t docs-to-pdf:node24-alpine ./alpine

# Run with your own documentation
docker run --rm -v $(pwd)/output:/docs-to-pdf/output \
  docs-to-pdf:node24-alpine \
  bash -c "docs-to-pdf --initialDocURLs='YOUR_URL' --outputPDFFilename='output/docs.pdf'"
```

## CI/CD

### Docker CI Workflow

The `.github/workflows/docker-ci.yml` workflow runs on every push and pull request, testing all combinations to ensure compatibility across all supported configurations.

### Publishing Workflow

When a release is created, the `.github/workflows/publish.yml` workflow publishes Docker images to GitHub Container Registry with tags like:

- `latest-node20-alpine`
- `latest-node20-debian`
- `latest-node22-alpine`
- `latest-node22-debian`
- `latest-node24-alpine`
- `latest-node24-debian`
- `v1.2.3-node24-alpine` (version-specific tags)

## Using Published Images

```bash
# Pull and run a specific version
docker pull ghcr.io/your-org/docs-to-pdf:latest-node24-alpine

# Run with your documentation
docker run --rm -v $(pwd)/output:/docs-to-pdf/output \
  ghcr.io/your-org/docs-to-pdf:latest-node24-alpine \
  docs-to-pdf --initialDocURLs="YOUR_URL" --outputPDFFilename="output/docs.pdf"
```

## Building Custom Images

To build images for specific Node.js versions:

```bash
# Alpine with Node 20
docker build --build-arg NODE_VERSION=20 -t docs-to-pdf:node20-alpine ./alpine

# Debian with Node 22
docker build --build-arg NODE_VERSION=22 -t docs-to-pdf:node22-debian ./debian
```

## Output

Generated PDFs are saved to `docker/output/` with naming convention:

- `v1-alpine-node20.pdf`
- `v2-debian-node22.pdf`
- `v3-alpine-node24.pdf`
- etc.

## Troubleshooting

### Chrome/Chromium Issues

Both Alpine and Debian images include Chromium and are configured to work in Docker environments with the necessary flags (`--no-sandbox`, `--disable-setuid-sandbox`).

### Permission Issues

If you encounter permission issues with the output directory, ensure it's writable:

```bash
chmod 777 docker/output
```

### Memory Issues

For large documentation sites, you may need to increase Docker's memory limit:

```bash
docker run --memory=2g --rm -v $(pwd)/output:/docs-to-pdf/output ...
```

### Large Documentation Sites

When generating PDFs from large documentation sites (like Docusaurus v2/v3 full docs), the process may take considerable time (10-30+ minutes) as it:

1. Crawls and processes hundreds of pages
2. Clicks to expand all `<details>` elements
3. Scrolls through very long composite pages
4. Generates the final PDF

This is expected behavior. For faster testing, consider using a subset of pages or a smaller documentation site.
