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
function getConfig(): sql.config {
  const required = ["SERVER_NAME", "DATABASE_NAME", "SQL_USER", "SQL_PASSWORD"];
  for (const env of required) {
    if (!process.env[env]) {
      throw new Error(`Missing required environment variable: ${env}`);
    }
  }

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
}

// Connect to database
async function connect(): Promise<sql.ConnectionPool> {
  if (pool?.connected) {
    return pool;
  }

  const config = getConfig();
  pool = await sql.connect(config);
  return pool;
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
    description: "Executes a SELECT query to read data from the database",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL SELECT query to execute (must start with SELECT)",
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
}

// Tool handlers
async function handleListTable(args: ListTableArgs) {
  const conn = await connect();
  const schemas = args.schemas || [];

  let query = `
    SELECT TABLE_SCHEMA + '.' + TABLE_NAME AS TableName
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
  `;

  const request = conn.request();

  if (schemas.length > 0) {
    // Use parameterized queries to prevent SQL injection
    schemas.forEach((schema, i) => {
      request.input(`schema${i}`, sql.VarChar, schema);
    });
    const paramList = schemas.map((_, i) => `@schema${i}`).join(",");
    query += ` AND TABLE_SCHEMA IN (${paramList})`;
  }

  query += " ORDER BY TABLE_SCHEMA, TABLE_NAME";

  const result = await request.query(query);
  return {
    success: true,
    message: `Found ${result.recordset.length} table(s)`,
    tables: result.recordset.map((r) => r.TableName),
  };
}

async function handleDescribeTable(args: DescribeTableArgs) {
  const conn = await connect();
  const tableName = args.tableName;

  const query = `
    SELECT
      COLUMN_NAME as name,
      DATA_TYPE +
      CASE
        WHEN CHARACTER_MAXIMUM_LENGTH IS NOT NULL
        THEN '(' + CAST(CHARACTER_MAXIMUM_LENGTH AS VARCHAR) + ')'
        ELSE ''
      END as type
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @tableName
    OR (TABLE_SCHEMA + '.' + TABLE_NAME) = @tableName
    ORDER BY ORDINAL_POSITION
  `;

  const result = await conn
    .request()
    .input("tableName", sql.VarChar, tableName)
    .query(query);

  return {
    success: true,
    columns: result.recordset,
  };
}

async function handleReadData(args: ReadDataArgs) {
  const conn = await connect();
  const query = args.query.trim();

  // Validate query is read-only
  const lowerQuery = query
    .toLowerCase()
    .replace(/\/\*.*?\*\//g, "")
    .trim();

  if (!lowerQuery.startsWith("select")) {
    throw new Error("Query must start with SELECT");
  }

  // Check for dangerous keywords that indicate write operations
  const dangerousKeywords = [
    "insert",
    "update",
    "delete",
    "drop",
    "create",
    "alter",
    "truncate",
    "exec",
    "execute",
  ];
  for (const keyword of dangerousKeywords) {
    if (lowerQuery.includes(keyword)) {
      throw new Error(
        "Query contains forbidden operations. Only SELECT queries are allowed"
      );
    }
  }

  // Prevent multiple statements
  if (
    query.includes(";") &&
    query.trim().indexOf(";") !== query.trim().length - 1
  ) {
    throw new Error("Multiple statements are not allowed");
  }

  // Add row limit to prevent memory issues (10000 rows max)
  const limitedQuery = `SELECT TOP 10000 * FROM (${query.replace(
    /;$/,
    ""
  )}) AS limited_query`;

  const result = await conn.request().query(limitedQuery);

  return {
    success: true,
    message: `Query executed successfully. Retrieved ${result.recordset.length} record(s)`,
    data: result.recordset,
    recordCount: result.recordset.length,
  };
}

// MCP Server setup
const server = new Server(
  {
    name: "mssql-read-only-mcp",
    version: "1.0.1",
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

  try {
    let result;

    switch (name) {
      case "list_table":
        result = await handleListTable(args || {});
        break;
      case "describe_table":
        if (!args) {
          throw new Error("Missing required argument: tableName");
        }
        result = await handleDescribeTable(
          args as unknown as DescribeTableArgs
        );
        break;
      case "read_data":
        if (!args) {
          throw new Error("Missing required argument: query");
        }
        result = await handleReadData(args as unknown as ReadDataArgs);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

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
      content: [
        {
          type: "text",
          text: `Error: ${userMessage}`,
        },
      ],
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
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
