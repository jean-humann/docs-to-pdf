#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create output directory
mkdir -p output
rm -f output/*.pdf

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Docker E2E Test Suite${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Build the package first
echo -e "${YELLOW}Building packages...${NC}"
cd ..
yarn build
echo ""

# Pack for alpine
echo -e "${YELLOW}Packing for Alpine...${NC}"
docker/pack.sh alpine
echo ""

# Pack for debian
echo -e "${YELLOW}Packing for Debian...${NC}"
docker/pack.sh debian
cd docker
echo ""

# Function to run a test
run_test() {
    local service=$1
    local description=$2

    echo -e "${YELLOW}Testing: ${description}${NC}"

    if docker-compose -f docker-compose.e2e.yml run --rm "$service"; then
        echo -e "${GREEN}✓ ${description} - PASSED${NC}"
        return 0
    else
        echo -e "${RED}✗ ${description} - FAILED${NC}"
        return 1
    fi
}

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test all combinations
VERSIONS=("v1" "v2" "v3")
OSS=("alpine" "debian")
NODES=("20" "22" "24")

for version in "${VERSIONS[@]}"; do
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}Testing Docusaurus ${version}${NC}"
    echo -e "${YELLOW}========================================${NC}"

    for os in "${OSS[@]}"; do
        for node in "${NODES[@]}"; do
            TOTAL_TESTS=$((TOTAL_TESTS + 1))
            service="test-${version}-${os}-node${node}"
            description="Docusaurus ${version} on ${os} with Node ${node}"

            if run_test "$service" "$description"; then
                PASSED_TESTS=$((PASSED_TESTS + 1))
            else
                FAILED_TESTS=$((FAILED_TESTS + 1))
            fi
            echo ""
        done
    done
done

# Print summary
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "Total tests:  ${TOTAL_TESTS}"
echo -e "${GREEN}Passed:       ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed:       ${FAILED_TESTS}${NC}"
echo ""

# Check generated PDFs
echo -e "${YELLOW}Generated PDFs:${NC}"
ls -lh output/*.pdf 2>/dev/null || echo "No PDFs generated"
echo ""

# Exit with error if any tests failed
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi
