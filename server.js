if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
};
const express = require('express');
const path = require('path');
const mysql = require('mysql');

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

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});