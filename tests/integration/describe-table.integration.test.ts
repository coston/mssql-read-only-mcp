import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMCPClient, closeMCPClient, parseToolResult } from '../helpers/mcp-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('describe_table tool integration tests', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    const setup = await createMCPClient();
    client = setup.client;
    transport = setup.transport;
  });

  afterAll(async () => {
    await closeMCPClient(client, transport);
  });

  describe('success cases', () => {
    it('should describe table with schema prefix', async () => {
      const result = await client.callTool({
        name: 'describe_table',
        arguments: { tableName: 'dbo.Users' }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.columns).toBeInstanceOf(Array);
      expect(response.columns.length).toBeGreaterThan(0);

      // Verify expected columns exist
      const columnNames = response.columns.map((c: any) => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('username');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('first_name');
      expect(columnNames).toContain('last_name');
    });

    it('should describe table without schema prefix', async () => {
      const result = await client.callTool({
        name: 'describe_table',
        arguments: { tableName: 'Users' }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.columns).toBeInstanceOf(Array);
      expect(response.columns.length).toBeGreaterThan(0);
    });

    it('should return correct column metadata for Users table', async () => {
      const result = await client.callTool({
        name: 'describe_table',
        arguments: { tableName: 'dbo.Users' }
      });

      const response = parseToolResult(result);

      // Find the 'id' column
      const idColumn = response.columns.find((c: any) => c.name === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn.type).toMatch(/^int/);  // Can be 'int' or 'int(10,0)'
      expect(idColumn.nullable).toBe('NO');

      // Find the 'username' column
      const usernameColumn = response.columns.find((c: any) => c.name === 'username');
      expect(usernameColumn).toBeDefined();
      expect(usernameColumn.type).toMatch(/varchar\(50\)/);
      expect(usernameColumn.nullable).toBe('NO');

      // Find the 'email' column
      const emailColumn = response.columns.find((c: any) => c.name === 'email');
      expect(emailColumn).toBeDefined();
      expect(emailColumn.type).toMatch(/varchar\(100\)/);
      expect(emailColumn.nullable).toBe('NO');

      // Find the 'age' column (nullable)
      const ageColumn = response.columns.find((c: any) => c.name === 'age');
      expect(ageColumn).toBeDefined();
      expect(ageColumn.type).toMatch(/^int/);  // Can be 'int' or 'int(10,0)'
      expect(ageColumn.nullable).toBe('YES');
    });

    it('should handle tables with various column types', async () => {
      const result = await client.callTool({
        name: 'describe_table',
        arguments: { tableName: 'dbo.Products' }
      });

      const response = parseToolResult(result);

      // Verify decimal type
      const priceColumn = response.columns.find((c: any) => c.name === 'price');
      expect(priceColumn).toBeDefined();
      expect(priceColumn.type).toMatch(/decimal\(10,2\)/);

      // Verify varchar(MAX)
      const descColumn = response.columns.find((c: any) => c.name === 'description');
      expect(descColumn).toBeDefined();
      expect(descColumn.type).toMatch(/varchar\(MAX\)/);

      // Verify datetime
      const createdColumn = response.columns.find((c: any) => c.name === 'created_at');
      expect(createdColumn).toBeDefined();
      expect(createdColumn.type).toBe('datetime');
    });

    it('should describe table in etl schema', async () => {
      const result = await client.callTool({
        name: 'describe_table',
        arguments: { tableName: 'etl.DataImport' }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.columns).toBeInstanceOf(Array);

      const columnNames = response.columns.map((c: any) => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('source_system');
      expect(columnNames).toContain('import_date');
    });
  });

  describe('error cases', () => {
    it('should return error for non-existent table', async () => {
      const result = await client.callTool({
        name: 'describe_table',
        arguments: { tableName: 'NonExistentTable' }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Table not found');
    });

    it('should return error for invalid table name with schema', async () => {
      const result = await client.callTool({
        name: 'describe_table',
        arguments: { tableName: 'dbo.FakeTable123' }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Table not found');
    });
  });
});
