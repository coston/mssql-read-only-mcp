-- Create test database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'TestDB')
BEGIN
    CREATE DATABASE TestDB;
END
GO

USE TestDB;
GO

-- Create additional schemas for testing
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'etl')
BEGIN
    EXEC('CREATE SCHEMA etl');
END
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'staging')
BEGIN
    EXEC('CREATE SCHEMA staging');
END
GO

-- Create Users table in dbo schema
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL
    DROP TABLE dbo.Users;
GO

CREATE TABLE dbo.Users (
    id INT PRIMARY KEY IDENTITY(1,1),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    age INT,
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);
GO

-- Create Products table in dbo schema
IF OBJECT_ID('dbo.Products', 'U') IS NOT NULL
    DROP TABLE dbo.Products;
GO

CREATE TABLE dbo.Products (
    id INT PRIMARY KEY IDENTITY(1,1),
    name VARCHAR(100) NOT NULL,
    description VARCHAR(MAX),
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(50),
    stock_quantity INT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- Create Orders table in dbo schema
IF OBJECT_ID('dbo.Orders', 'U') IS NOT NULL
    DROP TABLE dbo.Orders;
GO

CREATE TABLE dbo.Orders (
    id INT PRIMARY KEY IDENTITY(1,1),
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    total_amount DECIMAL(10,2),
    order_date DATETIME DEFAULT GETDATE(),
    status VARCHAR(20) DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES dbo.Users(id),
    FOREIGN KEY (product_id) REFERENCES dbo.Products(id)
);
GO

-- Create ETL staging table
IF OBJECT_ID('etl.DataImport', 'U') IS NOT NULL
    DROP TABLE etl.DataImport;
GO

CREATE TABLE etl.DataImport (
    id INT PRIMARY KEY IDENTITY(1,1),
    source_system VARCHAR(50),
    import_date DATETIME DEFAULT GETDATE(),
    record_count INT,
    status VARCHAR(20)
);
GO

-- Create Staging table
IF OBJECT_ID('staging.TempUsers', 'U') IS NOT NULL
    DROP TABLE staging.TempUsers;
GO

CREATE TABLE staging.TempUsers (
    id INT PRIMARY KEY IDENTITY(1,1),
    username VARCHAR(50),
    email VARCHAR(100),
    staging_date DATETIME DEFAULT GETDATE()
);
GO

-- Insert sample data into Users
INSERT INTO dbo.Users (username, email, first_name, last_name, age, is_active) VALUES
('jdoe', 'john.doe@example.com', 'John', 'Doe', 30, 1),
('asmith', 'alice.smith@example.com', 'Alice', 'Smith', 28, 1),
('bjones', 'bob.jones@example.com', 'Bob', 'Jones', 35, 1),
('cwhite', 'carol.white@example.com', 'Carol', 'White', 42, 0),
('dblack', 'david.black@example.com', 'David', 'Black', 25, 1),
('egreen', 'emma.green@example.com', 'Emma', 'Green', 31, 1),
('fbrown', 'frank.brown@example.com', 'Frank', 'Brown', 38, 1),
('gsilver', 'grace.silver@example.com', 'Grace', 'Silver', 29, 1),
('hgold', 'henry.gold@example.com', 'Henry', 'Gold', 45, 0),
('icopper', 'ivy.copper@example.com', 'Ivy', 'Copper', 27, 1);
GO

-- Insert sample data into Products
INSERT INTO dbo.Products (name, description, price, category, stock_quantity) VALUES
('Laptop Pro 15', 'High-performance laptop with 16GB RAM', 1299.99, 'Electronics', 50),
('Wireless Mouse', 'Ergonomic wireless mouse with USB receiver', 29.99, 'Electronics', 200),
('Office Chair', 'Comfortable ergonomic office chair', 199.99, 'Furniture', 30),
('Standing Desk', 'Adjustable height standing desk', 449.99, 'Furniture', 15),
('USB-C Hub', '7-in-1 USB-C hub with HDMI and ethernet', 49.99, 'Electronics', 100),
('Mechanical Keyboard', 'RGB mechanical keyboard with blue switches', 89.99, 'Electronics', 75),
('Monitor 27"', '4K UHD 27-inch monitor', 349.99, 'Electronics', 40),
('Desk Lamp', 'LED desk lamp with adjustable brightness', 39.99, 'Furniture', 120),
('Webcam HD', '1080p HD webcam with built-in microphone', 79.99, 'Electronics', 60),
('Notebook Set', 'Set of 3 premium notebooks', 24.99, 'Stationery', 150);
GO

-- Insert sample data into Orders
INSERT INTO dbo.Orders (user_id, product_id, quantity, total_amount, status) VALUES
(1, 1, 1, 1299.99, 'completed'),
(1, 2, 2, 59.98, 'completed'),
(2, 3, 1, 199.99, 'completed'),
(2, 5, 1, 49.99, 'shipped'),
(3, 7, 1, 349.99, 'completed'),
(3, 6, 1, 89.99, 'completed'),
(4, 4, 1, 449.99, 'pending'),
(5, 9, 1, 79.99, 'shipped'),
(6, 8, 2, 79.98, 'completed'),
(7, 10, 3, 74.97, 'completed'),
(8, 1, 1, 1299.99, 'pending'),
(9, 2, 5, 149.95, 'cancelled'),
(10, 5, 2, 99.98, 'shipped');
GO

-- Insert sample data into ETL schema
INSERT INTO etl.DataImport (source_system, record_count, status) VALUES
('CRM System', 1000, 'completed'),
('ERP System', 5000, 'completed'),
('External API', 250, 'failed'),
('Data Warehouse', 10000, 'completed');
GO

-- Insert sample data into Staging schema
INSERT INTO staging.TempUsers (username, email) VALUES
('tempuser1', 'temp1@example.com'),
('tempuser2', 'temp2@example.com'),
('tempuser3', 'temp3@example.com');
GO

-- Create a view for testing
IF OBJECT_ID('dbo.vw_UserOrders', 'V') IS NOT NULL
    DROP VIEW dbo.vw_UserOrders;
GO

CREATE VIEW dbo.vw_UserOrders AS
SELECT
    u.username,
    u.email,
    p.name AS product_name,
    o.quantity,
    o.total_amount,
    o.order_date,
    o.status
FROM dbo.Users u
INNER JOIN dbo.Orders o ON u.id = o.user_id
INNER JOIN dbo.Products p ON o.product_id = p.id;
GO

PRINT 'Database setup completed successfully!';
PRINT 'Available tables:';
PRINT '- dbo.Users (10 records)';
PRINT '- dbo.Products (10 records)';
PRINT '- dbo.Orders (13 records)';
PRINT '- etl.DataImport (4 records)';
PRINT '- staging.TempUsers (3 records)';
PRINT '- dbo.vw_UserOrders (view)';
