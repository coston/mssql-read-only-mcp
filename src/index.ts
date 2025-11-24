#!/usr/bin/env node

import sql from "mssql";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Global SQL connection pool
let pool: sql.ConnectionPool | null = null;

// SQL connection configuration from environment variables
export function getConfig(): sql.config {
  const required = ["SERVER_NAME", "DATABASE_NAME", "SQL_USER", "SQL_PASSWORD"] as const;
  for (const env of required) {
    if (!process.env[env]) {
      throw new Error(`Missing required environment variable: ${env}`);
    }
  }

  // Safe to use non-null assertion after validation above
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return {
    server: process.env.SERVER_NAME!,
    port: parseInt(process.env.SQL_PORT || "1433"),
    database: process.env.DATABASE_NAME!,
    user: process.env.SQL_USER!,
    password: process.env.SQL_PASSWORD!,
    options: {
      encrypt: true,
      trustServerCertificate:
        process.env.TRUST_SERVER_CERTIFICATE?.toLowerCase() === "true",
    },
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || "30") * 1000,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

// Connect to database with error handling
async function connect(): Promise<sql.ConnectionPool> {
  if (pool?.connected) {
    return pool;
  }

  const config = getConfig();
  pool = new sql.ConnectionPool(config);
  pool.on("error", (err) => console.error(`[${new Date().toISOString()}] Pool error:`, err.message));
  await pool.connect();
  return pool;
}

// Graceful shutdown
async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

// Tool definitions (read-only)
const tools = {
  list_table: {
    name: "list_table",
    description: "Lists all tables in the database with their schema names",
    inputSchema: {
      type: "object",
      properties: {
        schemas: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional: Filter by specific schemas (e.g., ['dbo', 'etl'])",
        },
      },
    },
  },

  describe_table: {
    name: "describe_table",
    description:
      "Describes the structure of a table including column names, types, and constraints",
    inputSchema: {
      type: "object",
      properties: {
        tableName: {
          type: "string",
          description:
            "Name of the table (can include schema like 'dbo.Owner')",
        },
      },
      required: ["tableName"],
    },
  },

  read_data: {
    name: "read_data",
    description: "Executes a SELECT query to read data from the database. Automatically limited to 10,000 rows.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL SELECT query to execute (must start with SELECT)",
        },
        maxRows: {
          type: "number",
          description: "Maximum rows to return (default: 10000, max: 10000)",
        },
      },
      required: ["query"],
    },
  },
};

// Type definitions for tool arguments
interface ListTableArgs {
  schemas?: string[];
}

interface DescribeTableArgs {
  tableName: string;
}

interface ReadDataArgs {
  query: string;
  maxRows?: number;
}

// Tool handlers
export async function handleListTable(args: ListTableArgs) {
  const conn = await connect();
  const schemas = args.schemas || [];

  const schemaFilter = schemas.length > 0
    ? `AND TABLE_SCHEMA IN (${schemas.map((_, i) => `@schema${i}`).join(",")})`
    : "";

  const query = `
    SELECT TABLE_SCHEMA + '.' + TABLE_NAME AS TableName
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ${schemaFilter}
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `;

  const request = schemas.reduce(
    (req, schema, i) => req.input(`schema${i}`, sql.VarChar, schema),
    conn.request()
  );

  const result = await request.query(query);
  return {
    success: true,
    message: `Found ${result.recordset.length} table(s)`,
    tables: result.recordset.map((r) => r.TableName),
  };
}

export async function handleDescribeTable(args: DescribeTableArgs) {
  const conn = await connect();
  const tableName = args.tableName;

  const query = `
    SELECT
      COLUMN_NAME as name,
      DATA_TYPE +
      CASE
        WHEN CHARACTER_MAXIMUM_LENGTH IS NOT NULL AND CHARACTER_MAXIMUM_LENGTH != -1
        THEN '(' + CAST(CHARACTER_MAXIMUM_LENGTH AS VARCHAR) + ')'
        WHEN CHARACTER_MAXIMUM_LENGTH = -1
        THEN '(MAX)'
        WHEN NUMERIC_PRECISION IS NOT NULL
        THEN '(' + CAST(NUMERIC_PRECISION AS VARCHAR) + ',' + CAST(NUMERIC_SCALE AS VARCHAR) + ')'
        ELSE ''
      END as type,
      IS_NULLABLE as nullable,
      COLUMN_DEFAULT as [default]
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @tableName
    OR (TABLE_SCHEMA + '.' + TABLE_NAME) = @tableName
    ORDER BY ORDINAL_POSITION
  `;

  const result = await conn
    .request()
    .input("tableName", sql.VarChar, tableName)
    .query(query);

  if (result.recordset.length === 0) {
    throw new Error(`Table not found: ${tableName}`);
  }

  return {
    success: true,
    columns: result.recordset,
  };
}

// Validate that a query is read-only
export function validateReadOnlyQuery(query: string): void {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    throw new Error("Query cannot be empty");
  }

  // Validate query is read-only
  const lowerQuery = trimmedQuery.toLowerCase().replace(/\/\*.*?\*\//g, "").trim();

  if (!lowerQuery.startsWith("select")) {
    throw new Error("Query must start with SELECT");
  }

  // Prevent multiple statements (check this first as it's most dangerous)
  if (trimmedQuery.includes(";") && trimmedQuery.indexOf(";") !== trimmedQuery.length - 1) {
    throw new Error("Multiple statements are not allowed");
  }

  // Check for dangerous keywords using word boundaries
  // Word boundary \b matches before/after alphanumeric and underscore, so we need to be more specific
  // Match keyword only if preceded by whitespace/start and followed by whitespace/punctuation/end
  const dangerousKeywords = ["insert", "update", "delete", "drop", "create", "alter", "truncate", "exec", "execute", "sp_", "xp_", "merge"];
  const forbiddenKeyword = dangerousKeywords.find(keyword => {
    // Match keyword with proper boundaries (whitespace, punctuation, start, or end)
    const pattern = new RegExp(`(^|\\s|[,;()])${keyword.replace(/_/g, "\\_")}($|\\s|[,;()])`, "i");
    return pattern.test(lowerQuery);
  });

  if (forbiddenKeyword) {
    throw new Error(`Query contains forbidden keyword: ${forbiddenKeyword}. Only SELECT queries are allowed.`);
  }
}

export async function handleReadData(args: ReadDataArgs) {
  const conn = await connect();
  const query = args.query.trim();
  const maxRows = Math.min(args.maxRows || 10000, 10000);

  validateReadOnlyQuery(query);

  // Smart row limiting - inject TOP if not already present
  const cleanQuery = query.replace(/;$/, "");
  const lowerQuery = cleanQuery.toLowerCase();
  const needsTopClause = !lowerQuery.includes(" top ") && !lowerQuery.includes(" top(");
  const finalQuery = needsTopClause
    ? cleanQuery.replace(/^select\s+/i, `SELECT TOP ${maxRows} `)
    : cleanQuery;

  const result = await conn.request().query(finalQuery);
  const wasCapped = result.recordset.length === maxRows;

  return {
    success: true,
    message: `Retrieved ${result.recordset.length} record(s)${wasCapped ? ` (capped at ${maxRows})` : ""}`,
    data: result.recordset,
    recordCount: result.recordset.length,
  };
}

// MCP Server setup
const server = new Server(
  {
    name: "mssql-read-only-mcp",
    version: "1.0.2",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools (read-only only)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [tools.list_table, tools.describe_table, tools.read_data],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const executeToolCall = async () => {
    switch (name) {
      case "list_table":
        return await handleListTable(args || {});
      case "describe_table":
        if (!args) {
          throw new Error("Missing required argument: tableName");
        }
        return await handleDescribeTable(args as unknown as DescribeTableArgs);
      case "read_data":
        if (!args) {
          throw new Error("Missing required argument: query");
        }
        return await handleReadData(args as unknown as ReadDataArgs);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };

  try {
    const result = await executeToolCall();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    // Log full error for debugging
    console.error(`Error in ${name}:`, error);

    // Return safe error message to user
    const userMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";

    return {
      content: [{ type: "text", text: `Error: ${userMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("MSSQL MCP Read-Only server started");
    console.error(`Server: ${process.env.SERVER_NAME}`);
    console.error(`Database: ${process.env.DATABASE_NAME}`);

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.error("Shutting down...");
      await closePool();
      process.exit(0);
    });
    process.on("SIGTERM", async () => {
      console.error("Shutting down...");
      await closePool();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
