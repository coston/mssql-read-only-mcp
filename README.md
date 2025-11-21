# MSSQL Read-Only MCP Server

A lightweight, read-only MSSQL MCP server.

## Features

- **Read-Only by Design** - Safe database querying with no write operations
- **Single File Implementation** - All code in one easy-to-understand file (~240 lines)
- **Three Essential Tools** - List tables, describe structure, query data

## Installation

### Option 1: Using npx (Recommended)

No installation required! Use npx to run the server directly:

#### With Claude Code CLI

```bash
claude mcp add --transport stdio mssql-read-only \
  --env SERVER_NAME=your-server.database.windows.net \
  --env DATABASE_NAME=YourDatabase \
  --env SQL_USER=username \
  --env SQL_PASSWORD=password \
  --env SQL_PORT=1433 \
  --env TRUST_SERVER_CERTIFICATE=false \
  -- npx -y mssql-read-only-mcp
```

**Windows users**: On native Windows (not WSL), use:
```bash
claude mcp add --transport stdio mssql-read-only --env SERVER_NAME=... -- cmd /c npx -y mssql-read-only-mcp
```

#### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mssql-read-only": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mssql-read-only-mcp"],
      "env": {
        "SERVER_NAME": "your-server.database.windows.net",
        "DATABASE_NAME": "YourDatabase",
        "SQL_USER": "username",
        "SQL_PASSWORD": "password",
        "SQL_PORT": "1433",
        "TRUST_SERVER_CERTIFICATE": "false"
      }
    }
  }
}
```

**Windows users**: On native Windows (not WSL), use:
```json
{
  "mcpServers": {
    "mssql-read-only": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "mssql-read-only-mcp"],
      "env": {
        "SERVER_NAME": "your-server.database.windows.net",
        "DATABASE_NAME": "YourDatabase",
        "SQL_USER": "username",
        "SQL_PASSWORD": "password"
      }
    }
  }
}
```

### Option 2: Local Development

For local development or modifications:

```bash
git clone <repository-url>
cd mssql-read-only-mcp
npm install
npm run build
```

Then configure with the local path:

```bash
claude mcp add --transport stdio mssql-read-only \
  --env SERVER_NAME=your-server.database.windows.net \
  --env DATABASE_NAME=YourDatabase \
  --env SQL_USER=username \
  --env SQL_PASSWORD=password \
  -- node /path/to/mssql-read-only-mcp/dist/index.js
```

## Configuration

Required environment variables:
- `SERVER_NAME` - MSSQL server hostname
- `DATABASE_NAME` - Database name
- `SQL_USER` - SQL authentication username
- `SQL_PASSWORD` - SQL authentication password

Optional environment variables:
- `SQL_PORT` - Port number (default: 1433)
- `TRUST_SERVER_CERTIFICATE` - Set to "true" to trust self-signed certs (default: false)
- `CONNECTION_TIMEOUT` - Connection timeout in seconds (default: 30)

## Available Tools

- `list_table` - List all tables in the database (with optional schema filter)
- `describe_table` - Show table structure (columns and types)
- `read_data` - Execute SELECT queries

## License

MIT
