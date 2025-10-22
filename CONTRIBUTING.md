# Contributing to docs-to-pdf

Thank you for your interest in contributing to docs-to-pdf! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- [mise](https://mise.jit.su/) - Development environment manager (optional but recommended)

### Initial Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/jean-humann/docs-to-pdf.git
   cd docs-to-pdf
   ```

2. **Install dependencies using mise (recommended)**

   If you have mise installed, it will automatically install the correct Node.js version:

   ```bash
   mise install
   ```

   The `.mise.toml` file in the project root configures the required Node.js version.

3. **Install dependencies**

   ```bash
   yarn install
   ```

4. **Build the project**
   ```bash
   yarn build
   ```

## Development Workflow

### Running Tests

Always run tests before committing:

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch
```

### Linting

Always lint your code before committing:

```bash
# Run ESLint
yarn lint

# Auto-fix linting issues
yarn lint:fix
```

### Building

Build TypeScript to JavaScript:

```bash
yarn build
```

## Docker Development

The project includes comprehensive Docker support with E2E tests.

### Running Docker E2E Tests

```bash
# Quick test (Alpine + Node 24 for all Docusaurus versions)
cd docker
./test-quick.sh

# Full E2E test suite (all combinations)
./test-e2e.sh
```

See [docker/README.md](./docker/README.md) for more details on Docker development and testing.

## Code Quality Requirements

Before submitting a PR, ensure:

1. ✅ All tests pass: `yarn test`
2. ✅ Code is linted: `yarn lint`
3. ✅ TypeScript builds without errors: `yarn build`
4. ✅ No new TypeScript errors introduced
5. ✅ Docker tests pass (if modifying Docker-related code)

## Commit Messages

This project uses [release-please](https://github.com/googleapis/release-please) to automate releases and changelog generation.

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (white-space, formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes affecting the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files

#### Examples

```bash
feat: add support for custom footer templates
fix: resolve PDF generation timeout on large sites
docs: update Docker usage examples
refactor: improve error handling in openDetails function
test: add E2E tests for Docusaurus v3
```

#### Breaking Changes

For breaking changes, add `!` after the type or add `BREAKING CHANGE:` in the footer:

```bash
feat!: require Node.js 20 or higher

BREAKING CHANGE: Dropped support for Node.js 18
```

## Release Process

**Do NOT manually update the CHANGELOG.md file.**

The release process is automated using release-please:

1. When commits are merged to `master`, release-please analyzes commit messages
2. It automatically creates or updates a release PR
3. When the release PR is merged, it:
   - Updates the CHANGELOG.md
   - Bumps the version in package.json
   - Creates a GitHub release
   - Triggers npm publishing (if configured)
   - Triggers Docker image publishing

### Version Bumping

release-please determines version bumps based on commit types:

- `fix`: Patch version (0.0.x)
- `feat`: Minor version (0.x.0)
- Breaking changes: Major version (x.0.0)

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests and linting: `yarn test && yarn lint`
5. Build the project: `yarn build`
6. Commit using conventional commits
7. Push to your fork
8. Open a Pull Request with a clear description

### PR Checklist

- [ ] Tests pass locally
- [ ] Code is linted
- [ ] TypeScript builds successfully
- [ ] Commit messages follow Conventional Commits
- [ ] Documentation updated (if needed)
- [ ] Docker tests pass (if Docker-related changes)

## Project Structure

```
docs-to-pdf/
├── src/              # TypeScript source code
├── lib/              # Compiled JavaScript (generated)
├── tests/            # Test files
├── docker/           # Docker configuration and E2E tests
├── .github/          # GitHub Actions workflows
├── mise.toml         # mise configuration for Node.js version
└── package.json      # Project dependencies and scripts
```

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Be respectful and constructive in discussions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).
