import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import fs from 'fs';

export interface MCPClientSetup {
  client: Client;
  transport: StdioClientTransport;
}

interface ConnectionInfo {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

/**
 * Read database connection info from temp file written by global setup
 */
function getConnectionInfo(): ConnectionInfo {
  const tempFile = path.join(process.cwd(), '.test-db-connection.json');

  if (!fs.existsSync(tempFile)) {
    throw new Error(
      'Database connection info not found. ' +
      'Did the global setup run successfully? ' +
      `Expected file: ${tempFile}`
    );
  }

  try {
    const content = fs.readFileSync(tempFile, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read connection info: ${error}`);
  }
}

/**
 * Creates an MCP client connected to the MSSQL server
 * Spawns the server as a child process via stdio transport
 */
export async function createMCPClient(): Promise<MCPClientSetup> {
  // Path to the built MCP server
  const serverPath = path.join(process.cwd(), 'dist', 'index.js');

  if (!fs.existsSync(serverPath)) {
    throw new Error(
      `MCP server not found at ${serverPath}. ` +
      'Did you run "npm run build"?'
    );
  }

  // Get database connection info from global setup
  const connectionInfo = getConnectionInfo();

  // Create stdio transport that spawns the server
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env: {
      ...process.env,
      // SQL Server connection configuration
      SERVER_NAME: connectionInfo.host,
      SQL_PORT: connectionInfo.port,
      DATABASE_NAME: connectionInfo.database,
      SQL_USER: connectionInfo.user,
      SQL_PASSWORD: connectionInfo.password,
      TRUST_SERVER_CERTIFICATE: 'true',
      CONNECTION_TIMEOUT: '30'
    }
  });

  // Create MCP client
  const client = new Client(
    {
      name: 'integration-test-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  // Connect to the server
  await client.connect(transport);

  return { client, transport };
}

/**
 * Closes MCP client and transport
 * Call this in afterAll() or afterEach()
 */
export async function closeMCPClient(
  client: Client | undefined,
  transport: StdioClientTransport | undefined
): Promise<void> {
  try {
    if (transport) {
      await transport.close();
    }
  } catch (error) {
    console.warn('Warning: Error closing MCP client:', error);
  }
}

/**
 * Helper to parse tool result JSON
 * Accepts any MCP tool result type and extracts the JSON content
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseToolResult(result: any): unknown {
  if (result.content && result.content[0]?.text) {
    try {
      return JSON.parse(result.content[0].text);
    } catch (_error) {
      throw new Error(`Failed to parse tool result: ${result.content[0].text}`);
    }
  }
  throw new Error('Invalid tool result format - missing content[0].text');
}
