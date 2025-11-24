import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMCPClient, closeMCPClient, parseToolResult } from '../helpers/mcp-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('read_data tool integration tests', () => {
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

  describe('success cases - SELECT queries', () => {
    it('should execute simple SELECT query', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: { query: 'SELECT TOP 5 * FROM dbo.Users' }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.data).toBeInstanceOf(Array);
      expect(response.data.length).toBe(5);
      expect(response.recordCount).toBe(5);
      expect(response.data[0]).toHaveProperty('username');
      expect(response.data[0]).toHaveProperty('email');
    });

    it('should execute SELECT with WHERE clause', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: 'SELECT * FROM dbo.Users WHERE is_active = 1'
        }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.data).toBeInstanceOf(Array);

      // All returned users should be active
      response.data.forEach((user: any) => {
        expect(user.is_active).toBe(true);
      });
    });

    it('should execute SELECT with JOIN', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: `
            SELECT TOP 5 u.username, p.name as product_name, o.quantity
            FROM dbo.Users u
            INNER JOIN dbo.Orders o ON u.id = o.user_id
            INNER JOIN dbo.Products p ON o.product_id = p.id
          `
        }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.data).toBeInstanceOf(Array);
      expect(response.data[0]).toHaveProperty('username');
      expect(response.data[0]).toHaveProperty('product_name');
      expect(response.data[0]).toHaveProperty('quantity');
    });

    it('should execute SELECT with aggregation', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: 'SELECT COUNT(*) as user_count FROM dbo.Users'
        }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.data[0]).toHaveProperty('user_count');
      expect(response.data[0].user_count).toBe(10); // We seeded 10 users
    });

    it('should respect explicit TOP clause', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: 'SELECT TOP 3 * FROM dbo.Products'
        }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.data.length).toBe(3);
    });

    it('should inject TOP clause when missing', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: 'SELECT * FROM dbo.Users',
          maxRows: 5
        }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.data.length).toBeLessThanOrEqual(5);
    });

    it('should query from different schema', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: 'SELECT * FROM etl.DataImport'
        }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.data).toBeInstanceOf(Array);
      expect(response.data.length).toBe(4); // We seeded 4 records
    });
  });

  describe('security validation - dangerous queries', () => {
    it('should reject INSERT query', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "INSERT INTO dbo.Users (username, email) VALUES ('hacker', 'hack@example.com')"
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query must start with SELECT');
    });

    it('should reject UPDATE query', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "UPDATE dbo.Users SET username = 'hacked' WHERE id = 1"
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query must start with SELECT');
    });

    it('should reject DELETE query', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "DELETE FROM dbo.Users WHERE id = 1"
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query must start with SELECT');
    });

    it('should reject DROP query', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "DROP TABLE dbo.Users"
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query must start with SELECT');
    });

    it('should reject multiple statements', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "SELECT * FROM dbo.Users; SELECT * FROM dbo.Products"
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Multiple statements are not allowed');
    });

    it('should reject query with DELETE keyword', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "SELECT * FROM dbo.Users WHERE id = 1; DELETE FROM dbo.Users"
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Multiple statements|forbidden keyword: delete/);
    });

    it('should reject empty query', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: ""
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query cannot be empty');
    });

    it('should reject whitespace-only query', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "   \n\t  "
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query cannot be empty');
    });
  });

  describe('edge cases - word boundaries', () => {
    it('should allow column names containing forbidden words', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "SELECT id, created_at, updated_at FROM dbo.Users"
        }
      });

      // This should NOT throw an error - "create", "update" are part of column names
      expect(result.isError).toBeFalsy();
      const response = parseToolResult(result);
      expect(response.success).toBe(true);
    });

    it('should detect standalone DELETE keyword', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "SELECT * FROM dbo.Users WHERE 1=1 DELETE FROM dbo.Users"
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('forbidden keyword: delete');
    });
  });

  describe('data validation', () => {
    it('should return correct user data', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "SELECT username, email FROM dbo.Users WHERE username = 'jdoe'"
        }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.data.length).toBe(1);
      expect(response.data[0].username).toBe('jdoe');
      expect(response.data[0].email).toBe('john.doe@example.com');
    });

    it('should return correct product data with price', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "SELECT name, price FROM dbo.Products WHERE name = 'Laptop Pro 15'"
        }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.data.length).toBe(1);
      expect(response.data[0].name).toBe('Laptop Pro 15');
      expect(response.data[0].price).toBe(1299.99);
    });

    it('should return correct order count', async () => {
      const result = await client.callTool({
        name: 'read_data',
        arguments: {
          query: "SELECT COUNT(*) as order_count FROM dbo.Orders"
        }
      });

      const response = parseToolResult(result);

      expect(response.success).toBe(true);
      expect(response.data[0].order_count).toBe(13); // We seeded 13 orders
    });
  });
});
