if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
};
const express = require('express');
const path = require('path');
const mysql = require('mysql');
const fs = require('fs');

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

app.post('/run-query', (req, res) => {
  const query = req.body.sql; // This is correct
  
  if (!query) {
    return res.status(400).json({ error: 'SQL query is missing from the request body.' });
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting database connection:', err);
      return res.status(500).json({ error: 'Database connection error', details: err.message });
    }

    connection.query(query, (error, results, fields) => {
      connection.release();
      if (error) {
        console.error('Error executing query:', error);
        return res.status(500).json({ error: 'Error executing query', details: error.message });
      }
      res.json({ results, fields }); // Include fields for table headers
    });
  });
});

// Saved Queries API endpoints
const SAVED_QUERIES_FILE = path.join(__dirname, 'data', 'saved-queries.json');

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

// Get all saved queries
app.get('/api/saved-queries', (req, res) => {
  const queries = readSavedQueries();
  res.json(queries);
});

// Save a new query
app.post('/api/saved-queries', (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query text is required' });
  }
  
  const queries = readSavedQueries();
  
  // Generate incremental name
  const existingNumbers = queries
    .map(q => q.name.match(/^Query (\d+)$/))
    .filter(match => match)
    .map(match => parseInt(match[1]));
  
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  const newQuery = {
    id: Date.now().toString(),
    name: `Query ${nextNumber}`,
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

// Update a saved query (rename)
app.put('/api/saved-queries/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const queries = readSavedQueries();
  const queryIndex = queries.findIndex(q => q.id === id);
  
  if (queryIndex === -1) {
    return res.status(404).json({ error: 'Query not found' });
  }
  
  queries[queryIndex].name = name;
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

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});