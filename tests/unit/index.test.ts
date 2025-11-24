import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getConfig, validateReadOnlyQuery } from "../../src/index.js";

describe("getConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should throw error when SERVER_NAME is missing", () => {
    delete process.env.SERVER_NAME;
    process.env.DATABASE_NAME = "testdb";
    process.env.SQL_USER = "user";
    process.env.SQL_PASSWORD = "pass";

    expect(() => getConfig()).toThrow("Missing required environment variable: SERVER_NAME");
  });

  it("should throw error when DATABASE_NAME is missing", () => {
    process.env.SERVER_NAME = "localhost";
    delete process.env.DATABASE_NAME;
    process.env.SQL_USER = "user";
    process.env.SQL_PASSWORD = "pass";

    expect(() => getConfig()).toThrow("Missing required environment variable: DATABASE_NAME");
  });

  it("should throw error when SQL_USER is missing", () => {
    process.env.SERVER_NAME = "localhost";
    process.env.DATABASE_NAME = "testdb";
    delete process.env.SQL_USER;
    process.env.SQL_PASSWORD = "pass";

    expect(() => getConfig()).toThrow("Missing required environment variable: SQL_USER");
  });

  it("should throw error when SQL_PASSWORD is missing", () => {
    process.env.SERVER_NAME = "localhost";
    process.env.DATABASE_NAME = "testdb";
    process.env.SQL_USER = "user";
    delete process.env.SQL_PASSWORD;

    expect(() => getConfig()).toThrow("Missing required environment variable: SQL_PASSWORD");
  });

  it("should return valid config with all required env vars", () => {
    process.env.SERVER_NAME = "localhost";
    process.env.DATABASE_NAME = "testdb";
    process.env.SQL_USER = "user";
    process.env.SQL_PASSWORD = "pass";

    const config = getConfig();

    expect(config.server).toBe("localhost");
    expect(config.database).toBe("testdb");
    expect(config.user).toBe("user");
    expect(config.password).toBe("pass");
    expect(config.port).toBe(1433);
    expect(config.options?.encrypt).toBe(true);
    expect(config.options?.trustServerCertificate).toBe(false);
    expect(config.connectionTimeout).toBe(30000);
  });

  it("should use custom SQL_PORT when provided", () => {
    process.env.SERVER_NAME = "localhost";
    process.env.DATABASE_NAME = "testdb";
    process.env.SQL_USER = "user";
    process.env.SQL_PASSWORD = "pass";
    process.env.SQL_PORT = "1234";

    const config = getConfig();

    expect(config.port).toBe(1234);
  });

  it("should set trustServerCertificate to true when env var is 'true'", () => {
    process.env.SERVER_NAME = "localhost";
    process.env.DATABASE_NAME = "testdb";
    process.env.SQL_USER = "user";
    process.env.SQL_PASSWORD = "pass";
    process.env.TRUST_SERVER_CERTIFICATE = "true";

    const config = getConfig();

    expect(config.options?.trustServerCertificate).toBe(true);
  });

  it("should set trustServerCertificate to true when env var is 'TRUE'", () => {
    process.env.SERVER_NAME = "localhost";
    process.env.DATABASE_NAME = "testdb";
    process.env.SQL_USER = "user";
    process.env.SQL_PASSWORD = "pass";
    process.env.TRUST_SERVER_CERTIFICATE = "TRUE";

    const config = getConfig();

    expect(config.options?.trustServerCertificate).toBe(true);
  });

  it("should use custom CONNECTION_TIMEOUT when provided", () => {
    process.env.SERVER_NAME = "localhost";
    process.env.DATABASE_NAME = "testdb";
    process.env.SQL_USER = "user";
    process.env.SQL_PASSWORD = "pass";
    process.env.CONNECTION_TIMEOUT = "60";

    const config = getConfig();

    expect(config.connectionTimeout).toBe(60000);
  });
});

describe("validateReadOnlyQuery", () => {
  describe("valid queries", () => {
    it("should accept simple SELECT query", () => {
      expect(() => validateReadOnlyQuery("SELECT * FROM users")).not.toThrow();
    });

    it("should accept SELECT query with WHERE clause", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT id, name FROM users WHERE active = 1")
      ).not.toThrow();
    });

    it("should accept SELECT query with JOIN", () => {
      expect(() =>
        validateReadOnlyQuery(
          "SELECT u.id, u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id"
        )
      ).not.toThrow();
    });

    it("should accept SELECT query with TOP clause", () => {
      expect(() => validateReadOnlyQuery("SELECT TOP 100 * FROM users")).not.toThrow();
    });

    it("should accept SELECT query with trailing semicolon", () => {
      expect(() => validateReadOnlyQuery("SELECT * FROM users;")).not.toThrow();
    });

    it("should accept SELECT query with mixed case", () => {
      expect(() => validateReadOnlyQuery("SeLeCt * FrOm users")).not.toThrow();
    });

    it("should accept SELECT query with comments", () => {
      expect(() =>
        validateReadOnlyQuery("/* comment */ SELECT * FROM users")
      ).not.toThrow();
    });

    it("should accept SELECT query with subquery", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)")
      ).not.toThrow();
    });
  });

  describe("invalid queries", () => {
    it("should reject empty query", () => {
      expect(() => validateReadOnlyQuery("")).toThrow("Query cannot be empty");
    });

    it("should reject whitespace-only query", () => {
      expect(() => validateReadOnlyQuery("   ")).toThrow("Query cannot be empty");
    });

    it("should reject INSERT query", () => {
      expect(() =>
        validateReadOnlyQuery("INSERT INTO users (name) VALUES ('test')")
      ).toThrow("Query must start with SELECT");
    });

    it("should reject UPDATE query", () => {
      expect(() => validateReadOnlyQuery("UPDATE users SET name = 'test'")).toThrow(
        "Query must start with SELECT"
      );
    });

    it("should reject DELETE query", () => {
      expect(() => validateReadOnlyQuery("DELETE FROM users WHERE id = 1")).toThrow(
        "Query must start with SELECT"
      );
    });

    it("should reject DROP query", () => {
      expect(() => validateReadOnlyQuery("DROP TABLE users")).toThrow(
        "Query must start with SELECT"
      );
    });

    it("should reject CREATE query", () => {
      expect(() => validateReadOnlyQuery("CREATE TABLE test (id INT)")).toThrow(
        "Query must start with SELECT"
      );
    });

    it("should reject ALTER query", () => {
      expect(() => validateReadOnlyQuery("ALTER TABLE users ADD COLUMN test VARCHAR(50)")).toThrow(
        "Query must start with SELECT"
      );
    });

    it("should reject TRUNCATE query", () => {
      expect(() => validateReadOnlyQuery("TRUNCATE TABLE users")).toThrow(
        "Query must start with SELECT"
      );
    });

    it("should reject EXEC query", () => {
      expect(() => validateReadOnlyQuery("EXEC sp_executesql N'SELECT * FROM users'")).toThrow(
        "Query must start with SELECT"
      );
    });

    it("should reject EXECUTE query", () => {
      expect(() => validateReadOnlyQuery("EXECUTE sp_help")).toThrow(
        "Query must start with SELECT"
      );
    });

    it("should reject stored procedure calls with sp_", () => {
      expect(() => validateReadOnlyQuery("SELECT * FROM users; sp_help")).toThrow(
        "Multiple statements are not allowed"
      );
    });

    it("should reject extended stored procedure calls with xp_", () => {
      expect(() => validateReadOnlyQuery("SELECT * FROM users; xp_cmdshell 'dir'")).toThrow(
        "Multiple statements are not allowed"
      );
    });

    it("should reject MERGE query", () => {
      expect(() =>
        validateReadOnlyQuery("MERGE INTO users USING temp ON users.id = temp.id")
      ).toThrow("Query must start with SELECT");
    });

    it("should reject query not starting with SELECT", () => {
      expect(() => validateReadOnlyQuery("WITH cte AS (SELECT 1) SELECT * FROM cte")).toThrow(
        "Query must start with SELECT"
      );
    });

    it("should reject multiple statements", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT * FROM users; SELECT * FROM orders")
      ).toThrow("Multiple statements are not allowed");
    });

    it("should accept string literals containing forbidden words", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT * FROM users WHERE name = 'insert'")
      ).not.toThrow();
    });

    it("should reject SELECT with dangerous keyword using word boundary", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT * FROM users; INSERT INTO logs VALUES (1)")
      ).toThrow("Multiple statements are not allowed");
    });

    it("should accept column names that contain forbidden words", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT inserted_at, updated_at FROM users")
      ).not.toThrow();
    });

    it("should accept table names that contain forbidden words", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT * FROM user_inserts")
      ).not.toThrow();
    });

    it("should reject query with forbidden keyword as standalone word", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT * FROM users WHERE 1=1; DROP TABLE users")
      ).toThrow("Multiple statements are not allowed");
    });
  });

  describe("SQL injection attempts", () => {
    it("should reject SQL injection with comment bypass", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT * FROM users WHERE id = 1; -- DROP TABLE users")
      ).toThrow("Multiple statements are not allowed");
    });

    it("should reject SQL injection with UNION and INSERT", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT * FROM users UNION SELECT * FROM admin; insert into logs")
      ).toThrow("Multiple statements are not allowed");
    });

    it("should reject batched queries", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT 1; DELETE FROM users; SELECT 2")
      ).toThrow("Multiple statements are not allowed");
    });

    it("should detect forbidden keywords in SELECT statements", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT * FROM users WHERE id = 1 AND 1=1 DROP TABLE users")
      ).toThrow("Query contains forbidden keyword: drop");
    });
  });

  describe("edge cases with word boundaries", () => {
    it("should allow INSERT as part of column name inserted_at", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT id, inserted_at, updated_at FROM users")
      ).not.toThrow();
    });

    it("should detect standalone INSERT keyword", () => {
      expect(() =>
        validateReadOnlyQuery("SELECT * FROM users; INSERT INTO logs VALUES (1)")
      ).toThrow("Multiple statements are not allowed");
    });
  });
});
