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

app.post('/run-query', (req, res) => {
  // Ensure the query is extracted correctly from the request body
  const query = req.body.sql; // <--- MAKE SURE YOU ARE ACCESSING 'sql' not 'query'

  if (!query) {
    return res.status(400).json({ error: 'SQL query is missing from the request body.' });
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting database connection:', err);
      // In a production environment, avoid sending raw database errors to the client
      return res.status(500).json({ error: 'Database connection error', details: err.message });
    }

    connection.query(query, (error, results, fields) => {
      connection.release();
      if (error) {
        console.error('Error executing query:', error);
        // Similarly, refine error messages for production
        return res.status(500).json({ error: 'Error executing query', details: error.message });
      }
      res.json({ results });
    });
  });
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});