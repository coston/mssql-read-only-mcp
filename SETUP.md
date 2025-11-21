# MSSQL Read-Only MCP Server - Setup Guide

A simplified, read-only MSSQL MCP server with SQL authentication only. No Azure AD, no code modifications, no write operations.

## Prerequisites

- **Node.js** 14 or higher ([download here](https://nodejs.org/))
- **Git** ([download here](https://git-scm.com/downloads))
- **Claude Code** installed and configured
- **Database Access**: MSSQL server credentials (host, port, username, password, database name)

## Step 1: Clone or Download

### Option A: Clone from GitHub (if published)
```bash
git clone <repository-url> mssql-read-only-mcp
cd mssql-read-only-mcp
```

### Option B: Use Existing Directory
If you already have the `mssql-read-only-mcp` directory, navigate to it:
```bash
cd path/to/mssql-read-only-mcp
```

## Step 2: Install and Build

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

That's it! No code modifications needed.

## Step 3: Add to Claude Code

**✓ READ-ONLY BY DESIGN**

This MCP server is read-only only - no write operations are possible, making it safe for production databases.

```bash
claude mcp add-json mssql-read-only-mcp '{"type":"stdio","command":"node","args":["<FULL_PATH>/mssql-read-only-mcp/dist/index.js"],"env":{"SERVER_NAME":"your-server.database.windows.net","DATABASE_NAME":"YourDatabase","SQL_USER":"username","SQL_PASSWORD":"password","SQL_PORT":"1433","TRUST_SERVER_CERTIFICATE":"false"}}'
```

**Replace the following:**
- `<FULL_PATH>` - Full path to mssql-read-only-mcp directory (use forward slashes)
- `your-server.database.windows.net` - Your MSSQL server hostname
- `YourDatabase` - Your database name
- `username` - SQL authentication username (only needs SELECT permissions)
- `password` - SQL authentication password
- `1433` - Port number (change if using custom port)

### Path Examples

**Windows:**
```bash
"args":["C:/Users/YourName/projects/mssql-read-only-mcp/dist/index.js"]
```

**macOS/Linux:**
```bash
"args":["/home/yourname/projects/mssql-read-only-mcp/dist/index.js"]
```

## Step 4: Verify Installation

```bash
claude mcp list
```

Should show:
```
mssql-read-only-mcp: node <path>/dist/index.js - ✓ Connected
```

## Step 5: Restart Claude Code

Exit and restart Claude Code for the MCP tools to become available.

## Step 6: Test the Connection

Ask Claude:
```
Show me all tables in the database
```

Or:
```
Describe the Owner table
```

## Available Tools

All tools are read-only:
- **list_table** - List all tables with optional schema filter
- **describe_table** - Show table structure (columns, types)
- **read_data** - Execute SELECT queries

## Configuration Options

### Required Environment Variables
- **SERVER_NAME** - MSSQL server hostname
- **DATABASE_NAME** - Database name
- **SQL_USER** - SQL username
- **SQL_PASSWORD** - SQL password

### Optional Environment Variables
- **SQL_PORT** - Port number (default: 1433)
- **TRUST_SERVER_CERTIFICATE** - `"true"` to trust self-signed certs (default: false)
- **CONNECTION_TIMEOUT** - Connection timeout in seconds (default: 30)

## Key Advantages Over Original

✅ **Read-Only by Design** - No write operations possible, completely safe for production
✅ **No Code Modifications** - Works out of the box with SQL authentication
✅ **SQL Auth Only** - No Azure AD complexity or browser authentication
✅ **Built-in Port Support** - Custom ports work without changes
✅ **Single File** - All code in one easy-to-understand file (~240 lines)
✅ **Simpler Dependencies** - Only mssql and MCP SDK, no Azure libraries
✅ **Clear Structure** - Direct handler functions, no complex class hierarchy

## Troubleshooting

### Connection Failed
- Verify server name, port, and credentials
- Check firewall rules allow connection to SQL Server
- Test connectivity: `telnet your-server.com 1433`
- On Windows: `Test-NetConnection -ComputerName your-server.com -Port 1433`

### Tools Not Available
- Restart Claude Code completely
- Verify `claude mcp list` shows "Connected"
- Check that path in configuration is correct

### Permission Errors
- Ensure SQL user has SELECT permission on the database
- No write permissions needed - server is read-only by design

## Security Best Practices

⚠️ **EXPERIMENTAL USE ONLY** - For educational and experimental purposes.

**Recommendations:**
- **Read-Only Design**: Server cannot perform write operations - completely safe for production databases
- **Limited Database User**: Create dedicated SQL user with SELECT-only permissions
- **Credentials**: Stored in Claude Code configuration - consider environment variables for shared setups
- **Firewall Rules**: Restrict database access to known IP addresses
- **Connection Security**: Use `TRUST_SERVER_CERTIFICATE: "false"` for production

## Alternative: Project-Level Configuration

Create `.mcp.json` in your project directory:

```json
{
  "servers": {
    "mssql-read-only-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/full/path/to/mssql-read-only-mcp/dist/index.js"],
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

This allows team members to use the same configuration (consider using environment variables for credentials).

## Example Usage

Once configured, use natural language with Claude:

**List tables:**
```
Show me all tables in the dbo schema
```

**Describe structure:**
```
What are the columns in the Owner table?
```

**Query data:**
```
Show me the first 10 owners from Arkansas
Show me all owners where Payable is greater than 1000
```

## Resources

- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MSSQL Node.js Driver](https://www.npmjs.com/package/mssql)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify your SQL Server credentials and permissions
3. Review error messages in Claude Code
4. Check server logs (stderr output from MCP server)
