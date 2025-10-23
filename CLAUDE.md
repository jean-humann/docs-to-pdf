# Claude Development Guide for docs-to-pdf

This document provides specific guidance for AI assistants (particularly Claude) when working on the docs-to-pdf project.

## Project Overview

docs-to-pdf is a TypeScript-based tool that generates PDFs from documentation websites (like Docusaurus). It uses Puppeteer to crawl pages, combine them into a single HTML document, and generate a PDF.

## Development Environment Setup

### Using mise (Recommended)

This project uses [mise](https://mise.jit.su/) to manage the Node.js version:

```bash
# Install mise (if not already installed)
# See: https://mise.jit.su/getting-started.html

# Initialize the project - this will:
# - Read mise.toml
# - Install the specified Node.js version
# - Set it up for this project
mise install

# Verify Node.js version
node --version  # Should match version in mise.toml
```

The `mise.toml` file in the project root defines:

- Required Node.js version
- Any other development tool versions

### Manual Setup

If not using mise:

```bash
# Ensure Node.js >= 20.0.0 is installed
yarn install
yarn build
```

## Pre-Commit Checklist

Before committing ANY changes, you MUST:

### 1. Run Tests

```bash
yarn test
```

**Result**: All tests must pass. If any test fails, fix the issue before committing.

### 2. Run Linter

```bash
yarn lint
```

**Result**: No linting errors. Fix any issues with:

```bash
yarn lint:fix
```

### 3. Build TypeScript

```bash
yarn build
```

**Result**: TypeScript must compile without errors. The `lib/` directory will be generated.

### 4. Docker Tests (if modifying Docker files)

If you modified any Docker-related files:

```bash
cd docker
./test-quick.sh
```

**Result**: At least the quick tests should pass.

## Commit Message Requirements

### DO NOT Update CHANGELOG.md Manually

This project uses [release-please](https://github.com/googleapis/release-please) to:

- Automatically generate CHANGELOG.md
- Bump version numbers
- Create releases
- Trigger npm/Docker publishing

**NEVER** manually edit:

- `CHANGELOG.md`
- Version numbers in `package.json` (unless explicitly required for a specific reason)

### Use Conventional Commits

All commit messages MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

#### Common Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

#### Examples

```bash
feat(docker): add multi-Node.js version support

Added Docker images for Node 20, 22, and 24 with both Alpine and Debian variants.

fix: handle non-clickable details elements

Improved openDetails() to gracefully handle elements that cannot be clicked,
preventing failures on complex documentation sites.

docs: update README with Docker usage examples

test(e2e): add comprehensive Docker E2E tests

Created test suite covering all Node versions and Docusaurus versions.
```

#### Breaking Changes

For breaking changes, add `!` or `BREAKING CHANGE:` in footer:

```bash
feat!: require Node.js 20 or higher

BREAKING CHANGE: Dropped support for Node.js 18. Users must upgrade to Node.js 20+.
```

## Release Process

### Automated via release-please

This project uses [release-please-action](https://github.com/googleapis/release-please-action) (GitHub Action) to automate releases.

Configuration files:

- `release-please-config.json` - Release strategy and package configuration
- `.release-please-manifest.json` - Tracks current version

Workflow:

1. Commits merged to `master` → release-please GitHub Action analyzes them
2. release-please creates/updates a Release PR
3. When Release PR is merged → automated release happens:
   - CHANGELOG.md updated
   - package.json version bumped
   - GitHub release created
   - npm package published (if configured)
   - Docker images published

**Important:** The workflow is configured to use a Personal Access Token (`RELEASE_PLEASE_TOKEN`) to trigger downstream workflows like the Publish workflow. If this secret is not configured, it falls back to `GITHUB_TOKEN`, which **will not trigger** the `publish.yml` workflow due to GitHub's security restrictions.

#### Setting up the Personal Access Token

To enable automatic publishing when releases are created:

1. **Create a Personal Access Token (Classic)**:
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Give it a descriptive name (e.g., "release-please-workflow")
   - Select scopes:
     - `repo` (Full control of private repositories)
     - `workflow` (Update GitHub Action workflows)
   - Set an expiration date (recommended: 90 days or 1 year)
   - Click "Generate token" and copy it immediately

2. **Add the token as a repository secret**:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `RELEASE_PLEASE_TOKEN`
   - Value: Paste your PAT
   - Click "Add secret"

3. **How it works**:
   - When configured, release-please uses this PAT to create releases
   - GitHub recognizes this as a user action (not a bot action)
   - This triggers the `publish.yml` workflow which publishes to npm and Docker
   - Without the PAT, releases are created but publishing doesn't happen automatically

### Version Bumping Logic

release-please determines version based on commits since last release:

| Commit Type     | Version Bump | Example       |
| --------------- | ------------ | ------------- |
| `fix:`          | Patch        | 1.0.0 → 1.0.1 |
| `feat:`         | Minor        | 1.0.0 → 1.1.0 |
| Breaking change | Major        | 1.0.0 → 2.0.0 |

## Code Quality Standards

### TypeScript

- Use strict TypeScript configuration
- Avoid `any` types when possible
- Export types for public APIs
- Document complex type definitions

### Testing

- Write tests for new features
- Update tests when modifying existing code
- Ensure test coverage for bug fixes
- Use descriptive test names

#### Test Website Auto-Build

The test suite includes a `tests/website/` directory containing a Docusaurus test site. To optimize test performance, the project uses `tests/globalSetup.ts` to automatically build this website before running tests.

**How it works:**

1. Before tests run, Jest executes `globalSetup.ts`
2. Checks if `tests/website/build/` exists and is recent
3. Skips rebuild if build is less than 5 minutes old (configurable)
4. Validates build completeness by checking for `index.html`
5. Rebuilds if directory is missing, incomplete, or stale

**Configuration:**

Set the `REBUILD_THRESHOLD_MINUTES` environment variable to customize the cache duration:

```bash
# Skip rebuild for builds less than 10 minutes old
REBUILD_THRESHOLD_MINUTES=10 yarn test

# Force rebuild on every test run
REBUILD_THRESHOLD_MINUTES=0 yarn test
```

**Default behavior:** 5-minute threshold balances CI performance with local development iteration speed.

**Build validation:**

- Checks `buildStats.isDirectory()` to ensure path is a directory
- Verifies `index.html` exists as a marker of complete builds
- Handles race conditions and permission errors gracefully
- Logs detailed error messages to aid debugging

### Error Handling

- Use try-catch for async operations
- Provide meaningful error messages
- Log errors with appropriate context
- Gracefully handle edge cases

### Docker

- Support multiple Node.js versions (20, 22, 24)
- Support both Alpine and Debian variants
- Use build args for configurability
- Test all combinations before committing

## Project-Specific Patterns

### Puppeteer Operations

- Always use `--no-sandbox` and `--disable-setuid-sandbox` in Docker
- Handle timeouts gracefully
- Scroll elements into view before interacting
- Wrap clickable operations in try-catch

### PDF Generation

- Process pages sequentially to maintain order
- Expand all `<details>` elements before generating PDF
- Handle large documentation sites (may take 10-30+ minutes)
- Provide progress feedback to users

## Using GitHub CLI (`gh` command)

This project requires extensive use of the GitHub CLI (`gh`) for managing issues, pull requests, and other GitHub interactions. The `gh` command is the **preferred** way to interact with GitHub.

### Common `gh` Commands

#### Viewing Issues

```bash
# View a specific issue
gh issue view 485

# View issue with full details (including comments)
gh issue view 485 --json title,body,comments

# List all open issues
gh issue list

# List issues with specific labels
gh issue list --label bug
```

#### Creating Issues

```bash
# Create an issue interactively
gh issue create

# Create an issue with title and body
gh issue create --title "Bug: Something is broken" --body "Description of the bug"
```

#### Commenting on Issues

```bash
# Add a comment to an issue
gh issue comment 485 --body "I'm working on this issue"
```

#### Closing Issues

```bash
# Close an issue
gh issue close 485

# Close with a comment
gh issue close 485 --comment "Fixed in PR #527"
```

#### Viewing Pull Requests

```bash
# View a specific PR
gh pr view 527

# View PR diff
gh pr diff 527

# List all open PRs
gh pr list

# Check PR status and checks
gh pr checks 527
```

#### Creating Pull Requests

```bash
# Create a PR interactively
gh pr create

# Create a PR with title and body
gh pr create --title "feat: add new feature" --body "Description" --base master

# Create a draft PR
gh pr create --draft --title "WIP: feature" --body "Work in progress"
```

#### Managing Pull Requests

```bash
# Edit PR details
gh pr edit 527 --title "New title"

# Add reviewers
gh pr edit 527 --add-reviewer username

# Comment on a PR
gh pr comment 527 --body "Looks good!"

# Close a PR
gh pr close 527

# Merge a PR (use with caution)
gh pr merge 527
```

## Git Workflow and Branch Management

### CRITICAL: Always Create New Branches from Updated Master

Every new change, feature, or bug fix MUST follow this workflow:

#### 1. Update Master Branch

Before starting ANY new work, ensure your master branch is up to date:

```bash
# Switch to master
git checkout master

# Pull latest changes from remote
git pull origin master

# Verify you're on the latest commit
git log --oneline -5
```

#### 2. Create a New Branch

**ALWAYS** create a new branch from the updated master:

```bash
# Create and switch to a new branch
git checkout -b feat/your-feature-name

# OR for bug fixes
git checkout -b fix/issue-number-description

# OR for documentation
git checkout -b docs/update-readme
```

**Branch Naming Conventions:**

- `feat/feature-name` - New features
- `fix/issue-number-description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates
- `chore/description` - Maintenance tasks

#### 3. Make Changes and Commit

```bash
# Make your changes
# ... edit files ...

# Run all checks
yarn test
yarn lint
yarn build

# Stage and commit
git add .
git commit -m "feat: add amazing new feature"
```

#### 4. Push Branch and Create PR

```bash
# Push the branch to remote
git push -u origin feat/your-feature-name

# Create a PR using gh CLI
gh pr create --title "feat: add amazing new feature" \
  --body "Description of changes" \
  --base master
```

#### 5. Address Review Comments

If reviewers request changes:

```bash
# Make the requested changes
# ... edit files ...

# Commit the changes
git add .
git commit -m "fix: address review comments"

# Push to the same branch
git push
```

The PR will automatically update with your new commits.

#### 6. After PR is Merged

Once your PR is merged, clean up:

```bash
# Switch back to master
git checkout master

# Pull the merged changes
git pull origin master

# Delete the local branch (optional)
git branch -d feat/your-feature-name

# Delete the remote branch (usually done automatically by GitHub)
git push origin --delete feat/your-feature-name
```

### IMPORTANT: Never Commit Directly to Master

- ❌ **NEVER** commit directly to the `master` branch
- ❌ **NEVER** push directly to `master`
- ✅ **ALWAYS** create a new branch for changes
- ✅ **ALWAYS** create a PR for review
- ✅ **ALWAYS** wait for CI checks to pass before merging

### Multiple Changes in Progress

If you need to work on multiple features/fixes simultaneously:

1. Each change gets its own branch from master
2. Each branch gets its own PR
3. Keep branches focused and small
4. Update each branch if master advances:

```bash
# While on your feature branch
git fetch origin
git rebase origin/master

# Resolve any conflicts
# ... fix conflicts ...

git add .
git rebase --continue

# Force push (only for your own branches, never shared branches)
git push --force-with-lease
```

## Common Tasks

### Adding a New Feature

1. **Update master**: `git checkout master && git pull origin master`
2. **Create feature branch**: `git checkout -b feat/feature-name`
3. **View related issues** (if any): `gh issue view <number>`
4. **Implement feature with tests**
5. **Run checks**: `yarn test && yarn lint && yarn build`
6. **Commit with `feat:` prefix**
7. **Push branch**: `git push -u origin feat/feature-name`
8. **Create PR**: `gh pr create --title "feat: description" --body "Details" --base master`
9. **Reference issues in PR**: Use "Closes #123" in PR body to auto-close issues

### Fixing a Bug

1. **View the issue**: `gh issue view <issue-number>`
2. **Update master**: `git checkout master && git pull origin master`
3. **Create bug fix branch**: `git checkout -b fix/issue-number-description`
4. **Write failing test that reproduces bug**
5. **Fix the bug**
6. **Ensure test passes**
7. **Run checks**: `yarn test && yarn lint && yarn build`
8. **Commit with `fix:` prefix**
9. **Push and create PR**: 
   ```bash
   git push -u origin fix/issue-number-description
   gh pr create --title "fix: description" --body "Fixes #123" --base master
   ```
10. **The issue will auto-close when PR is merged** (if you used "Fixes #123" or "Closes #123")

### Updating Documentation

1. **Update master**: `git checkout master && git pull origin master`
2. **Create docs branch**: `git checkout -b docs/description`
3. **Update relevant `.md` files**
4. **Commit with `docs:` prefix**
5. **No tests required for docs-only changes**
6. **Still run linter**: `yarn lint` to check markdown formatting
7. **Push and create PR**:
   ```bash
   git push -u origin docs/description
   gh pr create --title "docs: description" --body "Details" --base master
   ```

### Working on an Existing Issue

```bash
# 1. View the issue to understand the problem
gh issue view 485

# 2. Comment that you're working on it
gh issue comment 485 --body "I'm working on this issue"

# 3. Update master and create branch
git checkout master && git pull origin master
git checkout -b fix/485-iframe-extraction

# 4. Implement the fix
# ... make changes ...

# 5. Create PR that references the issue
gh pr create --title "fix: add iframe content extraction" \
  --body "Fixes #485

This PR adds support for extracting iframe content..." \
  --base master

# The issue will automatically close when the PR is merged
```

## File Structure Reference

```
docs-to-pdf/
├── src/
│   ├── command.ts         # CLI command definitions
│   ├── core.ts            # Core PDF generation logic
│   ├── utils.ts           # Utility functions (e.g., openDetails)
│   ├── provider/          # Documentation provider implementations
│   └── ...
├── lib/                   # Compiled JavaScript (gitignored)
├── tests/                 # Jest test files
├── docker/
│   ├── alpine/           # Alpine-based Dockerfile
│   ├── debian/           # Debian-based Dockerfile
│   ├── docker-compose.e2e.yml  # E2E test definitions
│   ├── test-e2e.sh       # Full E2E test script
│   ├── test-quick.sh     # Quick E2E test script
│   └── README.md         # Docker documentation
├── .github/
│   └── workflows/
│       ├── ci.yml        # Node.js CI workflow
│       ├── docker-ci.yml # Docker E2E CI workflow
│       └── publish.yml   # Publishing workflow
├── mise.toml             # mise configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── eslint.config.mjs     # ESLint configuration
├── README.md             # Main documentation
├── CONTRIBUTING.md       # Contribution guidelines
└── CLAUDE.md            # This file
```

## Important Reminders

1. ✅ **ALWAYS** run tests before committing
2. ✅ **ALWAYS** run linter before committing
3. ✅ **ALWAYS** ensure TypeScript builds before committing
4. ✅ **ALWAYS** use Conventional Commits format
5. ❌ **NEVER** manually edit CHANGELOG.md
6. ❌ **NEVER** manually bump versions in package.json
7. ✅ **ALWAYS** use mise for Node.js version management (when available)
8. ✅ **ALWAYS** document breaking changes explicitly

## Getting Help

- Check existing issues and PRs
- Review recent commits for patterns
- Consult README.md and CONTRIBUTING.md
- Test locally before submitting PR

## Summary: Complete Workflow for Any Change

```bash
# 1. Update master branch
git checkout master
git pull origin master

# 2. Create a new branch from master
git checkout -b feat/feature-name

# 3. Ensure correct Node.js version
mise install  # or verify with: node --version

# 4. Make your changes
# ... edit files ...

# 5. Run all checks
yarn test
yarn lint
yarn build

# 6. Run Docker tests (if applicable)
cd docker && ./test-quick.sh

# 7. Stage and commit with Conventional Commits format
git add .
git commit -m "feat: add amazing new feature"

# 8. Push branch to remote
git push -u origin feat/feature-name

# 9. Create PR using gh CLI
gh pr create --title "feat: add amazing new feature" \
  --body "Detailed description

Closes #123" \
  --base master

# 10. After PR is merged, clean up
git checkout master
git pull origin master
git branch -d feat/feature-name
```

## Quick Reference: Key Rules

### ✅ DO

- **ALWAYS** update master before creating a new branch
- **ALWAYS** create a new branch for every change
- **ALWAYS** use `gh` command for GitHub interactions
- **ALWAYS** create a PR for every change
- **ALWAYS** run tests, lint, and build before committing
- **ALWAYS** use Conventional Commits format
- **ALWAYS** reference issues in PR body using "Fixes #123" or "Closes #123"
- **ALWAYS** use mise for Node.js version management

### ❌ DON'T

- **NEVER** commit directly to master
- **NEVER** push directly to master
- **NEVER** manually edit CHANGELOG.md
- **NEVER** manually bump version numbers
- **NEVER** skip tests or linting
- **NEVER** create a branch from an outdated master
- **NEVER** work on multiple unrelated changes in the same branch

Remember: Quality over speed. Take time to ensure all checks pass!
