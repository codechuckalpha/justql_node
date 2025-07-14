if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
};
const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const fs = require('fs');
const ConnectionManager = require('./lib/connectionManager');

const app = express();

const port = process.argv[3] || process.env.PORT;

// Middleware to parse JSON request bodies
app.use(express.json()); // <--- ADD THIS LINE

app.use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('index');
});

const isProduction = process.env.NODE_ENV === 'production';

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

if (isProduction) {
  dbConfig.socketPath = `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`;
} else {
  dbConfig.host = process.env.DB_HOST;
}
const pool = mysql.createPool(dbConfig);

// Initialize connection manager
const connectionManager = new ConnectionManager();

app.get('/schema', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting database connection:', err);
      return res.status(500).json({ error: 'Database connection error', details: err.message });
    }

    // Get tables and views
    const schemaQueries = {
      tables: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      views: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_TYPE = 'VIEW' ORDER BY TABLE_NAME`
    };

    let results = { tables: [], views: [] };
    let completed = 0;

    Object.keys(schemaQueries).forEach(type => {
      connection.query(schemaQueries[type], (error, queryResults) => {
        if (error) {
          console.error(`Error fetching ${type}:`, error);
        } else {
          results[type] = queryResults.map(row => row.TABLE_NAME);
        }
        
        completed++;
        if (completed === 2) {
          connection.release();
          res.json(results);
        }
      });
    });
  });
});

// Get detailed schema with columns
app.get('/schema/detailed', (req, res) => {
  // Check if there's an active connection from connection manager
  const activePool = connectionManager.getActivePool();
  const activeConnectionInfo = connectionManager.getActiveConnection();
  
  if (activePool && activeConnectionInfo) {
    executeSchemaQuery(activePool, activeConnectionInfo, res);
  } else {
    // Fallback to original pool
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting database connection:', err);
        return res.status(500).json({ error: 'Database connection error', details: err.message });
      }

      // Get tables with their columns
      const query = `
        SELECT 
          t.TABLE_NAME,
          t.TABLE_TYPE,
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.IS_NULLABLE,
          c.COLUMN_DEFAULT,
          c.COLUMN_KEY
        FROM INFORMATION_SCHEMA.TABLES t
        LEFT JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        WHERE t.TABLE_SCHEMA = '${process.env.DB_NAME}'
        ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
      `;

      connection.query(query, (error, results) => {
        connection.release();
        
        if (error) {
          console.error('Error fetching detailed schema:', error);
          return res.status(500).json({ error: 'Query execution error', details: error.message });
        }

        // Group results by table
        const schema = processSchemaResults(results);
        res.json(schema);
      });
    });
  }
});

// Helper function to execute schema queries on active connections
function executeSchemaQuery(activePool, connectionInfo, res) {
  const dbType = connectionInfo.type;
  const dbName = connectionInfo.database;
  
  if (dbType === 'mysql') {
    activePool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting active MySQL connection:', err);
        return res.status(500).json({ error: 'Database connection error', details: err.message });
      }

      const query = `
        SELECT 
          t.TABLE_NAME,
          t.TABLE_TYPE,
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.IS_NULLABLE,
          c.COLUMN_DEFAULT,
          c.COLUMN_KEY
        FROM INFORMATION_SCHEMA.TABLES t
        LEFT JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        WHERE t.TABLE_SCHEMA = '${dbName}'
        ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
      `;

      connection.query(query, (error, results) => {
        connection.release();
        
        if (error) {
          console.error('Error fetching detailed schema:', error);
          return res.status(500).json({ error: 'Query execution error', details: error.message });
        }

        const schema = processSchemaResults(results);
        res.json(schema);
      });
    });
  } else if (dbType === 'postgresql') {
    activePool.connect((err, client, release) => {
      if (err) {
        console.error('Error getting active PostgreSQL connection:', err);
        return res.status(500).json({ error: 'Database connection error', details: err.message });
      }

      const query = `
        SELECT 
          t.table_name as "TABLE_NAME",
          CASE WHEN t.table_type = 'BASE TABLE' THEN 'BASE TABLE' ELSE 'VIEW' END as "TABLE_TYPE",
          c.column_name as "COLUMN_NAME",
          c.data_type as "DATA_TYPE",
          c.is_nullable as "IS_NULLABLE",
          c.column_default as "COLUMN_DEFAULT",
          CASE WHEN pk.column_name IS NOT NULL THEN 'PRI' ELSE '' END as "COLUMN_KEY"
        FROM information_schema.tables t
        LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        LEFT JOIN information_schema.key_column_usage pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name AND pk.constraint_name LIKE '%_pkey'
        WHERE t.table_schema = 'public'
        ORDER BY t.table_name, c.ordinal_position
      `;

      client.query(query, (error, result) => {
        release();
        
        if (error) {
          console.error('Error fetching detailed schema:', error);
          return res.status(500).json({ error: 'Query execution error', details: error.message });
        }

        const schema = processSchemaResults(result.rows);
        res.json(schema);
      });
    });
  } else {
    return res.status(500).json({ error: 'Schema queries not yet supported for SQL Server' });
  }
}

// Helper function to process schema query results
function processSchemaResults(results) {
  const schema = { tables: [], views: [] };
  const tablesMap = new Map();

  results.forEach(row => {
    const tableName = row.TABLE_NAME;
    const tableType = row.TABLE_TYPE === 'BASE TABLE' ? 'tables' : 'views';
    
    if (!tablesMap.has(tableName)) {
      tablesMap.set(tableName, {
        name: tableName,
        type: tableType,
        columns: []
      });
    }

    if (row.COLUMN_NAME) {
      tablesMap.get(tableName).columns.push({
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        nullable: row.IS_NULLABLE === 'YES',
        default: row.COLUMN_DEFAULT,
        key: row.COLUMN_KEY
      });
    }
  });

  // Convert map to arrays
  tablesMap.forEach(table => {
    schema[table.type].push(table);
  });

  return schema;
}

// Get complete table schema for CREATE TABLE script
app.get('/schema/table/:tableName', (req, res) => {
  const tableName = req.params.tableName;
  
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting database connection:', err);
      return res.status(500).json({ error: 'Database connection error', details: err.message });
    }

    // Get complete table information
    const queries = {
      // Basic column information
      columns: `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          COLUMN_KEY,
          EXTRA,
          CHARACTER_MAXIMUM_LENGTH,
          NUMERIC_PRECISION,
          NUMERIC_SCALE,
          COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
        AND TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `,
      
      // Index information
      indexes: `
        SELECT 
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE,
          SEQ_IN_INDEX,
          INDEX_TYPE,
          COMMENT
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
        AND TABLE_NAME = '${tableName}'
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
      `,
      
      // Foreign key information
      foreignKeys: `
        SELECT 
          CONSTRAINT_NAME,
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME,
          UPDATE_RULE,
          DELETE_RULE
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
        AND TABLE_NAME = '${tableName}'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `,
      
      // Table information
      tableInfo: `
        SELECT 
          ENGINE,
          TABLE_COLLATION,
          TABLE_COMMENT,
          AUTO_INCREMENT
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
        AND TABLE_NAME = '${tableName}'
      `
    };

    const results = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;

    Object.keys(queries).forEach(queryType => {
      connection.query(queries[queryType], (error, queryResults) => {
        if (error) {
          console.error(`Error fetching ${queryType} for ${tableName}:`, error);
          results[queryType] = [];
        } else {
          results[queryType] = queryResults;
        }
        
        completed++;
        if (completed === totalQueries) {
          connection.release();
          res.json({
            tableName: tableName,
            ...results
          });
        }
      });
    });
  });
});

// Export table to CSV
app.get('/export/csv/:tableName', (req, res) => {
  const tableName = req.params.tableName;
  
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting database connection:', err);
      return res.status(500).json({ error: 'Database connection error', details: err.message });
    }

    // Sanitize table name to prevent SQL injection
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    
    // Query to get all data from the table
    const query = `SELECT * FROM \`${sanitizedTableName}\``;
    
    connection.query(query, (error, results) => {
      connection.release();
      
      if (error) {
        console.error(`Error exporting table ${tableName} to CSV:`, error);
        return res.status(500).json({ error: 'Query execution error', details: error.message });
      }

      if (!results || results.length === 0) {
        // Handle empty table
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${tableName}.csv"`);
        return res.send('');
      }

      // Generate CSV content
      const csvContent = generateCsvFromResults(results);
      
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${tableName}.csv"`);
      
      res.send(csvContent);
    });
  });
});

// Helper function to generate CSV from query results
function generateCsvFromResults(results) {
  if (!results || results.length === 0) {
    return '';
  }
  
  // Get column names from the first row
  const columns = Object.keys(results[0]);
  
  // Create CSV header
  const csvHeader = columns.map(col => `"${col.replace(/"/g, '""')}"`).join(',');
  
  // Create CSV rows
  const csvRows = results.map(row => {
    return columns.map(col => {
      let value = row[col];
      
      // Handle null/undefined values
      if (value === null || value === undefined) {
        return '';
      }
      
      // Convert value to string and escape quotes
      value = String(value).replace(/"/g, '""');
      
      // Wrap in quotes if contains comma, newline, or quote
      if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        return `"${value}"`;
      }
      
      return value;
    }).join(',');
  });
  
  // Combine header and rows
  return [csvHeader, ...csvRows].join('\n');
}

// Store active connections for cancellation
const activeConnections = new Map();

app.post('/run-query', (req, res) => {
  const query = req.body.sql;
  const queryId = req.body.queryId || Date.now().toString();
  
  if (!query) {
    return res.status(400).json({ error: 'SQL query is missing from the request body.' });
  }

  // Check if there's an active connection from connection manager
  const activePool = connectionManager.getActivePool();
  const activeConnectionInfo = connectionManager.getActiveConnection();
  
  if (activePool && activeConnectionInfo) {
    // Use the active connection from connection manager
    executeQueryOnActiveConnection(activePool, activeConnectionInfo, query, queryId, res);
  } else {
    // Fallback to the original pool for backward compatibility
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting database connection:', err);
        return res.status(500).json({ error: 'Database connection error', details: err.message });
      }

      // Store connection info for potential cancellation
      activeConnections.set(queryId, { connection, startTime: Date.now() });

      connection.query(query, (error, results, fields) => {
        // Remove from active connections when query completes
        activeConnections.delete(queryId);
        connection.release();
        
        if (error) {
          console.error('Error executing query:', error);
          if (error.code === 'ER_QUERY_INTERRUPTED' || error.sqlState === '70100') {
            return res.status(499).json({ error: 'Query was cancelled', cancelled: true });
          }
          return res.status(500).json({ error: 'Error executing query', details: error.message });
        }
        res.json({ results, fields });
      });
    });
  }
});

// Helper function to execute queries on active connections
function executeQueryOnActiveConnection(activePool, connectionInfo, query, queryId, res) {
  const dbType = connectionInfo.type;
  
  if (dbType === 'mysql') {
    activePool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting active MySQL connection:', err);
        return res.status(500).json({ error: 'Database connection error', details: err.message });
      }

      activeConnections.set(queryId, { connection, startTime: Date.now() });

      connection.query(query, (error, results, fields) => {
        activeConnections.delete(queryId);
        connection.release();
        
        if (error) {
          console.error('Error executing query:', error);
          if (error.code === 'ER_QUERY_INTERRUPTED' || error.sqlState === '70100') {
            return res.status(499).json({ error: 'Query was cancelled', cancelled: true });
          }
          return res.status(500).json({ error: 'Error executing query', details: error.message });
        }
        res.json({ results, fields });
      });
    });
  } else if (dbType === 'postgresql') {
    activePool.connect((err, client, release) => {
      if (err) {
        console.error('Error getting active PostgreSQL connection:', err);
        return res.status(500).json({ error: 'Database connection error', details: err.message });
      }

      activeConnections.set(queryId, { client, startTime: Date.now() });

      client.query(query, (error, result) => {
        activeConnections.delete(queryId);
        release();
        
        if (error) {
          console.error('Error executing query:', error);
          return res.status(500).json({ error: 'Error executing query', details: error.message });
        }
        
        // Convert PostgreSQL result to MySQL-like format
        const results = result.rows;
        const fields = result.fields ? result.fields.map(field => ({ name: field.name })) : [];
        res.json({ results, fields });
      });
    });
  } else if (dbType === 'sqlserver') {
    const request = activePool.request();
    request.query(query, (error, result) => {
      if (error) {
        console.error('Error executing query:', error);
        return res.status(500).json({ error: 'Error executing query', details: error.message });
      }
      
      // Convert SQL Server result to MySQL-like format
      const results = result.recordset;
      const fields = result.recordset.columns ? Object.keys(result.recordset.columns).map(name => ({ name })) : [];
      res.json({ results, fields });
    });
  } else {
    return res.status(500).json({ error: 'Unsupported database type for active connection' });
  }
}

app.post('/cancel-query', (req, res) => {
  const { queryId } = req.body;
  
  if (!queryId) {
    return res.status(400).json({ error: 'Query ID is missing from the request body.' });
  }

  const connectionInfo = activeConnections.get(queryId);
  if (connectionInfo) {
    try {
      // Get a new connection to send KILL command
      pool.getConnection((err, killConnection) => {
        if (err) {
          console.error('Error getting connection for kill command:', err);
          return res.status(500).json({ error: 'Error getting connection to cancel query' });
        }
        
        // Kill the specific query using the connection ID
        killConnection.query(`KILL QUERY ${connectionInfo.connection.threadId}`, (killError) => {
          killConnection.release();
          
          if (killError) {
            console.error('Error killing query:', killError);
            // Try to destroy the connection as fallback
            connectionInfo.connection.destroy();
          }
          
          activeConnections.delete(queryId);
          res.json({ success: true, message: 'Query successfully cancelled' });
        });
      });
    } catch (error) {
      console.error('Error cancelling query:', error);
      res.status(500).json({ error: 'Error cancelling query', details: error.message });
    }
  } else {
    res.status(404).json({ error: 'No active query found with the provided ID' });
  }
});

// Connection Management API endpoints
app.get('/api/connections', (req, res) => {
  const connections = connectionManager.getConnections();
  res.json(connections);
});

app.post('/api/connections', async (req, res) => {
  try {
    const connection = await connectionManager.addConnection(req.body);
    if (connection) {
      res.json(connection);
    } else {
      res.status(500).json({ error: 'Failed to save connection' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/connections/test', async (req, res) => {
  try {
    const result = await connectionManager.testConnection(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/connections/:id/activate', async (req, res) => {
  try {
    const result = await connectionManager.activateConnection(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/connections/:id', (req, res) => {
  try {
    const success = connectionManager.deleteConnection(req.params.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Connection not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/connections/active', (req, res) => {
  const activeConnection = connectionManager.getActiveConnection();
  res.json(activeConnection);
});

// Saved Queries API endpoints
const SAVED_QUERIES_FILE = path.join(__dirname, 'data', 'saved-queries.json');
const FAVOURITE_QUERIES_FILE = path.join(__dirname, 'data', 'favourite-queries.json');

function readSavedQueries() {
  try {
    if (!fs.existsSync(SAVED_QUERIES_FILE)) {
      return [];
    }
    const data = fs.readFileSync(SAVED_QUERIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading saved queries:', error);
    return [];
  }
}

function writeSavedQueries(queries) {
  try {
    fs.writeFileSync(SAVED_QUERIES_FILE, JSON.stringify(queries, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing saved queries:', error);
    return false;
  }
}

function readFavouriteQueries() {
  try {
    if (!fs.existsSync(FAVOURITE_QUERIES_FILE)) {
      return [];
    }
    const data = fs.readFileSync(FAVOURITE_QUERIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading favourite queries:', error);
    return [];
  }
}

function writeFavouriteQueries(queries) {
  try {
    fs.writeFileSync(FAVOURITE_QUERIES_FILE, JSON.stringify(queries, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing favourite queries:', error);
    return false;
  }
}

// Get all saved queries
app.get('/api/saved-queries', (req, res) => {
  const queries = readSavedQueries();
  res.json(queries);
});

// Save a new query
app.post('/api/saved-queries', (req, res) => {
  const { query, name } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query text is required' });
  }
  
  const queries = readSavedQueries();
  
  // Use provided name or generate incremental name
  let queryName = name;
  if (!queryName) {
    const existingNumbers = queries
      .map(q => q.name.match(/^Query (\d+)$/))
      .filter(match => match)
      .map(match => parseInt(match[1]));
    
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    queryName = `Query ${nextNumber}`;
  }
  
  const newQuery = {
    id: Date.now().toString(),
    name: queryName,
    query: query,
    createdAt: new Date().toISOString()
  };
  
  queries.unshift(newQuery); // Add to beginning for most recent first
  
  if (writeSavedQueries(queries)) {
    res.json(newQuery);
  } else {
    res.status(500).json({ error: 'Failed to save query' });
  }
});

// Update a saved query (rename or update content)
app.put('/api/saved-queries/:id', (req, res) => {
  const { id } = req.params;
  const { name, query } = req.body;
  
  if (!name && !query) {
    return res.status(400).json({ error: 'Name or query is required' });
  }
  
  const queries = readSavedQueries();
  const queryIndex = queries.findIndex(q => q.id === id);
  
  if (queryIndex === -1) {
    return res.status(404).json({ error: 'Query not found' });
  }
  
  if (name) {
    queries[queryIndex].name = name;
  }
  if (query) {
    queries[queryIndex].query = query;
  }
  queries[queryIndex].updatedAt = new Date().toISOString();
  
  if (writeSavedQueries(queries)) {
    res.json(queries[queryIndex]);
  } else {
    res.status(500).json({ error: 'Failed to update query' });
  }
});

// Delete a saved query
app.delete('/api/saved-queries/:id', (req, res) => {
  const { id } = req.params;
  
  const queries = readSavedQueries();
  const filteredQueries = queries.filter(q => q.id !== id);
  
  if (filteredQueries.length === queries.length) {
    return res.status(404).json({ error: 'Query not found' });
  }
  
  if (writeSavedQueries(filteredQueries)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete query' });
  }
});

// Add to favourites endpoint
app.post('/api/saved-queries/:id/add-to-favourites', (req, res) => {
  const { id } = req.params;
  
  const savedQueries = readSavedQueries();
  const query = savedQueries.find(q => q.id === id);
  
  if (!query) {
    return res.status(404).json({ error: 'Query not found' });
  }
  
  const favouriteQueries = readFavouriteQueries();
  
  // Check if already in favourites
  if (favouriteQueries.find(q => q.id === id)) {
    return res.status(400).json({ error: 'Query already in favourites' });
  }
  
  // Add to favourites
  favouriteQueries.push({
    ...query,
    addedToFavourites: new Date().toISOString()
  });
  
  // Remove from saved queries (move, not copy)
  const updatedSavedQueries = savedQueries.filter(q => q.id !== id);
  
  // Write both files
  if (!writeFavouriteQueries(favouriteQueries)) {
    return res.status(500).json({ error: 'Failed to add to favourites' });
  }
  
  if (!writeSavedQueries(updatedSavedQueries)) {
    return res.status(500).json({ error: 'Failed to remove from saved queries' });
  }
  
  res.json({ success: true });
});

// Favourite Queries API endpoints

// Get all favourite queries
app.get('/api/favourite-queries', (req, res) => {
  const queries = readFavouriteQueries();
  res.json(queries);
});

// Update a favourite query (rename or update content)
app.put('/api/favourite-queries/:id', (req, res) => {
  const { id } = req.params;
  const { name, query } = req.body;
  
  if (!name && !query) {
    return res.status(400).json({ error: 'Name or query is required' });
  }
  
  const queries = readFavouriteQueries();
  const queryIndex = queries.findIndex(q => q.id === id);
  
  if (queryIndex === -1) {
    return res.status(404).json({ error: 'Query not found' });
  }
  
  if (name) queries[queryIndex].name = name;
  if (query) queries[queryIndex].query = query;
  queries[queryIndex].updatedAt = new Date().toISOString();
  
  if (writeFavouriteQueries(queries)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to update query' });
  }
});

// Delete a favourite query
app.delete('/api/favourite-queries/:id', (req, res) => {
  const { id } = req.params;
  
  const queries = readFavouriteQueries();
  const filteredQueries = queries.filter(q => q.id !== id);
  
  if (filteredQueries.length === queries.length) {
    return res.status(404).json({ error: 'Query not found' });
  }
  
  if (writeFavouriteQueries(filteredQueries)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete query' });
  }
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});