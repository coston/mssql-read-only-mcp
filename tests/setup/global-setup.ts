import { MSSQLServerContainer, StartedMSSQLServerContainer } from '@testcontainers/mssqlserver';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

let container: StartedMSSQLServerContainer | null = null;

interface ConnectionInfo {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

const TEST_PASSWORD = 'YourStrong@Passw0rd';
const TEMP_CONNECTION_FILE = path.join(process.cwd(), '.test-db-connection.json');

/**
 * Check if SQL Server is already running (e.g., in dev container)
 */
async function isExistingSqlServerAvailable(): Promise<boolean> {
  try {
    const host = process.env.SERVER_NAME || 'localhost';
    const port = process.env.SQL_PORT || '1433';
    const password = process.env.SQL_PASSWORD || TEST_PASSWORD;

    execSync(
      `/opt/mssql-tools/bin/sqlcmd -S ${host},${port} -U sa -P "${password}" -Q "SELECT 1" -b`,
      { stdio: 'pipe', timeout: 5000 }
    );

    console.log('✅ Existing SQL Server detected, will use it for tests');
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Wait for SQL Server to be ready to accept connections via container
 */
async function waitForSqlServerViaContainer(container: StartedMSSQLServerContainer, password: string): Promise<void> {
  const maxRetries = 60;  // 60 attempts
  const retryDelay = 1000;  // 1 second between retries (reduced from 2s)

  console.log(`⏳ Waiting for SQL Server to be ready...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await container.exec([
        '/opt/mssql-tools18/bin/sqlcmd',  // SQL Server 2022 uses mssql-tools18
        '-S', 'localhost',
        '-U', 'sa',
        '-P', password,
        '-Q', 'SELECT 1',
        '-b',
        '-C'  // Trust server certificate
      ]);

      if (result.exitCode === 0) {
        console.log(`✅ SQL Server is ready (after ${(i + 1) * retryDelay / 1000}s)`);
        return;
      }
    } catch (_error) {
      // Retry
    }

    if (i === maxRetries - 1) {
      throw new Error(`SQL Server failed to become ready after ${maxRetries} attempts (${maxRetries * retryDelay / 1000}s)`);
    }

    // Log progress every 10 attempts
    if ((i + 1) % 10 === 0) {
      console.log(`   Still waiting... (${i + 1}/${maxRetries} attempts)`);
    }

    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
}

/**
 * Check if database is already initialized (for container reuse)
 */
async function isDatabaseInitialized(container: StartedMSSQLServerContainer, password: string): Promise<boolean> {
  try {
    const result = await container.exec([
      '/opt/mssql-tools18/bin/sqlcmd',
      '-S', 'localhost',
      '-U', 'sa',
      '-P', password,
      '-Q', 'SELECT COUNT(*) FROM TestDB.dbo.Users',
      '-b',
      '-C'
    ]);

    // If query succeeds, database is already initialized
    return result.exitCode === 0;
  } catch (_error) {
    return false;
  }
}

/**
 * Initialize database with test data from init-db.sql via container
 */
async function initializeDatabaseViaContainer(container: StartedMSSQLServerContainer, password: string): Promise<void> {
  // Check if database is already initialized (for container reuse)
  if (await isDatabaseInitialized(container, password)) {
    console.log('✅ Database already initialized (reused container)');
    return;
  }

  const setupScript = path.join(process.cwd(), 'tests', 'fixtures', 'init-db.sql');

  if (!fs.existsSync(setupScript)) {
    throw new Error(
      `Database initialization script not found at: ${setupScript}\n` +
      'Expected location: tests/fixtures/init-db.sql'
    );
  }

  console.log('📊 Initializing test database...');

  try {
    // Read the SQL script
    const sqlContent = fs.readFileSync(setupScript, 'utf-8');

    // Execute via container
    const result = await container.exec([
      '/opt/mssql-tools18/bin/sqlcmd',  // SQL Server 2022 uses mssql-tools18
      '-S', 'localhost',
      '-U', 'sa',
      '-P', password,
      '-Q', sqlContent,
      '-b',
      '-C'  // Trust server certificate
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`SQL script execution failed with exit code ${result.exitCode}\n${result.output}`);
    }

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Write connection info to temp file for tests to read
 */
function writeConnectionInfo(info: ConnectionInfo): void {
  fs.writeFileSync(TEMP_CONNECTION_FILE, JSON.stringify(info, null, 2));
  console.log(`📝 Connection info written to ${TEMP_CONNECTION_FILE}`);
}

/**
 * Setup function runs before all tests
 */
export async function setup() {
  // Check if running unit tests only by looking at the file filter
  const isRunningUnitTestsOnly = process.argv.some(arg =>
    arg.includes('tests/unit') && !arg.includes('tests/integration')
  );

  if (isRunningUnitTestsOnly) {
    console.log('ℹ️  Skipping SQL Server setup (not running integration tests)');
    return async () => {
      // No-op cleanup
    };
  }

  console.log('🚀 Starting integration test setup...\n');

  // Check if SQL Server is already running
  if (await isExistingSqlServerAvailable()) {
    // Use existing SQL Server (dev container scenario)
    const connectionInfo: ConnectionInfo = {
      host: process.env.SERVER_NAME || 'localhost',
      port: process.env.SQL_PORT || '1433',
      database: process.env.DATABASE_NAME || 'TestDB',
      user: process.env.SQL_USER || 'sa',
      password: process.env.SQL_PASSWORD || TEST_PASSWORD
    };

    writeConnectionInfo(connectionInfo);

    console.log('✅ Using existing SQL Server');
    console.log(`   Host: ${connectionInfo.host}:${connectionInfo.port}`);
    console.log(`   Database: ${connectionInfo.database}\n`);

    // Return cleanup function
    return async () => {
      console.log('🧹 Cleaning up temp files...');
      if (fs.existsSync(TEMP_CONNECTION_FILE)) {
        fs.unlinkSync(TEMP_CONNECTION_FILE);
      }
    };
  }

  // Start new SQL Server container
  console.log('🐳 Starting SQL Server 2022 container with Testcontainers...');
  console.log('   (Container will be shared across all test files, then removed when done)');

  try {
    container = await new MSSQLServerContainer('mcr.microsoft.com/mssql/server:2022-latest')
      .acceptLicense() // Required for MSSQL
      .withPassword(TEST_PASSWORD)
      .withStartupTimeout(120000) // 2 minutes for SQL Server to start
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(1433);

    console.log(`✅ SQL Server container started`);
    console.log(`   Container ID: ${container.getId()}`);
    console.log(`   Host: ${host}:${port}`);

    // Wait for SQL Server to accept connections
    await waitForSqlServerViaContainer(container, TEST_PASSWORD);

    // Initialize database with test data
    await initializeDatabaseViaContainer(container, TEST_PASSWORD);

    // Write connection info for tests
    const connectionInfo: ConnectionInfo = {
      host,
      port: port.toString(),
      database: 'TestDB',
      user: 'sa',
      password: TEST_PASSWORD
    };

    writeConnectionInfo(connectionInfo);

    console.log('✅ Global setup complete\n');

    // Return cleanup function
    return async () => {
      console.log('\n🧹 Cleaning up test environment...');

      // Always stop and remove container after test session
      // This ensures no containers are left running after tests complete
      if (container) {
        console.log('🛑 Stopping SQL Server container...');
        await container.stop();
        console.log('✅ Container stopped and removed');
        container = null;
      }

      if (fs.existsSync(TEMP_CONNECTION_FILE)) {
        fs.unlinkSync(TEMP_CONNECTION_FILE);
        console.log('✅ Temp files cleaned up');
      }

      console.log('✅ Cleanup complete');
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide helpful error message
    console.error('\n❌ Failed to start SQL Server container\n');
    console.error('Integration tests require either:');
    console.error('  1. Docker/Podman installed (Testcontainers will auto-detect), OR');
    console.error('  2. SQL Server running manually at localhost:1433\n');
    console.error('To start SQL Server manually:');
    console.error('  docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong@Passw0rd" \\');
    console.error('    -p 1433:1433 --name mssql-test \\');
    console.error('    mcr.microsoft.com/mssql/server:2022-latest\n');
    console.error(`Original error: ${errorMessage}\n`);

    throw new Error(
      'Integration tests cannot run: No container runtime found and no existing SQL Server available. ' +
      'See error output above for manual setup instructions.'
    );
  }
}
