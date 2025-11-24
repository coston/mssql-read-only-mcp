# Contributing to MSSQL Read-Only MCP Server

Thank you for your interest in contributing! This document provides guidelines and instructions for development.

## Getting Started

```bash
git clone https://github.com/coston/mssql-read-only-mcp.git
cd mssql-read-only-mcp
npm install
npm run build
```

## Code Quality

### Linting
```bash
npm run lint         # Check for linting issues
npm run lint:fix     # Auto-fix linting issues
```

## Running Tests

### Unit Tests (No Dependencies)
```bash
npm run test:unit
```

Fast validation tests (~1s) that require no external dependencies.

### Integration Tests (Automatic SQL Server Setup)
```bash
npm run test:integration
```

Integration tests automatically:
1. ✅ Use existing SQL Server if available (localhost:1433), OR
2. ✅ Start SQL Server via Testcontainers (Docker/Podman), OR
3. ❌ Fail with clear instructions for manual setup

**No manual configuration required!**

### All Tests
```bash
npm test
```

Runs linting, build, unit tests, and integration tests.

### What if I get "Could not find container runtime"?

Integration tests need either:
- **Option A:** Docker Desktop or Podman installed (Testcontainers auto-detects)
- **Option B:** SQL Server running manually at localhost:1433

**To run SQL Server manually:**
```bash
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong@Passw0rd" \
  -p 1433:1433 --name mssql-test \
  mcr.microsoft.com/mssql/server:2022-latest
```

Then run tests:
```bash
npm run test:integration
```

**Note:** The SQL Server container is automatically started, shared across all test files within a single test run, then stopped and removed when tests complete. No manual cleanup needed!

## Test Coverage

Run tests with coverage reporting:
```bash
npm run test:coverage
```

Coverage requirements (enforced):
- **95% statement coverage**
- **95% branch coverage**
- **95% function coverage**
- **95% line coverage**

Test suite:
- **44 unit tests** - Configuration, security validation, query parsing
- **32 integration tests** - End-to-end MCP tool testing with real database
- **Total:** 76 tests covering all functionality

## Pre-commit Hooks

Git hooks are automatically installed via Husky when you run `npm install`. Before each commit, lint-staged will:

1. **ESLint** - Auto-fix linting issues on staged files
2. **Vitest** - Run tests related to changed files

The hooks are configured in [package.json](package.json) and managed by [Husky](.husky/).

To bypass the hook when needed:
```bash
git commit --no-verify
```

## Manual Testing with mcp-inspector

For interactive testing and debugging:

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

Opens a web UI where you can test all tools interactively.

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test changes
- `refactor`: Code refactoring
- `chore`: Build process or auxiliary tool changes
- `ci`: CI configuration changes

### Examples
```
feat(tools): add support for stored procedures
fix(security): prevent SQL injection in query validation
docs(readme): update installation instructions
test(integration): add tests for multiple schema support
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes using conventional commits
6. Push to your fork
7. Open a Pull Request

## Code Style

- Use TypeScript strict mode
- Follow ESLint rules (enforced by pre-commit hooks)
- Write tests for new features
- Maintain 95% code coverage

## Questions?

Open an issue on GitHub for any questions or concerns.
