const express = require('express');
const path = require('path')
const mysql = require('mysql');

const app = express();

const port = parseInt(process.env.PORT) || process.argv[3] || 8080;

app.use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('index');
});

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB
});

app.post('/run-query', (req, res) => {
  const query = req.body.query;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting database connection:', err);
      return res.status(500).json({ error: 'Database connection error' });
    }

    connection.query(query, (error, results, fields) => {
      connection.release();
      if (error) {
        console.error('Error executing query:', error);
        return res.status(500).json({ error: 'Error executing query' });
      }
      res.json({ results });
    });
  });
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
})