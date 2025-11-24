import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMCPClient, closeMCPClient, parseToolResult } from '../helpers/mcp-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('list_table tool integration tests', () => {
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
    it('should list all tables without schema filter', async () => {
      const result = await client.callTool({
        name: 'list_table',
        arguments: {}
      });

      const response = parseToolResult(result) as { success: boolean; tables: string[] };

      expect(response.success).toBe(true);
      expect(response.tables).toBeInstanceOf(Array);
      expect(response.tables.length).toBeGreaterThan(0);

      // Verify expected tables exist
      expect(response.tables).toContain('dbo.Users');
      expect(response.tables).toContain('dbo.Products');
      expect(response.tables).toContain('dbo.Orders');
      expect(response.tables).toContain('etl.DataImport');
      expect(response.tables).toContain('staging.TempUsers');
    });

    it('should filter tables by single schema', async () => {
      const result = await client.callTool({
        name: 'list_table',
        arguments: { schemas: ['dbo'] }
      });

      const response = parseToolResult(result) as { success: boolean; tables: string[] };

      expect(response.success).toBe(true);
      expect(response.tables).toBeInstanceOf(Array);

      // All returned tables should be in dbo schema
      response.tables.forEach((table: string) => {
        expect(table).toMatch(/^dbo\./);
      });

      // Should not include tables from other schemas
      expect(response.tables).not.toContain('etl.DataImport');
      expect(response.tables).not.toContain('staging.TempUsers');
    });

    it('should filter tables by multiple schemas', async () => {
      const result = await client.callTool({
        name: 'list_table',
        arguments: { schemas: ['dbo', 'etl'] }
      });

      const response = parseToolResult(result) as { success: boolean; tables: string[] };

      expect(response.success).toBe(true);

      // Should include tables from both schemas
      const dboTables = response.tables.filter((t: string) => t.startsWith('dbo.'));
      const etlTables = response.tables.filter((t: string) => t.startsWith('etl.'));

      expect(dboTables.length).toBeGreaterThan(0);
      expect(etlTables.length).toBeGreaterThan(0);

      // Should not include staging schema
      const stagingTables = response.tables.filter((t: string) => t.startsWith('staging.'));
      expect(stagingTables.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for non-existent schema', async () => {
      const result = await client.callTool({
        name: 'list_table',
        arguments: { schemas: ['nonexistent_schema'] }
      });

      const response = parseToolResult(result) as { success: boolean; tables: string[]; message: string };

      expect(response.success).toBe(true);
      expect(response.tables).toEqual([]);
      expect(response.message).toContain('Found 0 table(s)');
    });

    it('should handle empty schema array same as no filter', async () => {
      const result = await client.callTool({
        name: 'list_table',
        arguments: { schemas: [] }
      });

      const response = parseToolResult(result) as { success: boolean; tables: string[] };

      expect(response.success).toBe(true);
      expect(response.tables.length).toBeGreaterThan(0);
    });
  });
});
