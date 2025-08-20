const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const mysqlSync = require('mysql2');
const { Pool } = require('pg');
const sql = require('mssql');

class ConnectionManager {
  constructor() {
    this.connectionsFile = path.join(__dirname, '../data/connections.json');
    this.activeConnection = null;
    this.activePool = null;
    this.connections = [];
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    this.loadConnections();
  }

  encrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const parts = encryptedText.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Error decrypting password:', error);
      throw new Error('Failed to decrypt password');
    }
  }

  loadConnections() {
    try {
      if (fs.existsSync(this.connectionsFile)) {
        const data = fs.readFileSync(this.connectionsFile, 'utf8');
        this.connections = JSON.parse(data);
        
        // Auto-activate the first connection if no active connection and connections exist
        if (this.connections.length > 0 && !this.activeConnection) {
          console.log('Auto-activating first saved connection:', this.connections[0].name);
          this.activateConnection(this.connections[0].id).then(result => {
            if (result.success) {
              console.log('Successfully auto-activated connection:', this.connections[0].name);
            } else {
              console.error('Failed to auto-activate connection:', result.error);
            }
          });
        }
      } else {
        this.connections = [];
      }
    } catch (error) {
      console.error('Error loading connections:', error);
      this.connections = [];
    }
  }

  saveConnections() {
    try {
      const dir = path.dirname(this.connectionsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.connectionsFile, JSON.stringify(this.connections, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving connections:', error);
      return false;
    }
  }

  async addConnection(connectionData) {
    try {
      const encryptedPassword = this.encrypt(connectionData.password);
      
      const connection = {
        id: Date.now().toString(),
        name: connectionData.name,
        type: connectionData.type,
        host: connectionData.host,
        port: connectionData.port,
        username: connectionData.username,
        password: encryptedPassword,
        database: connectionData.database,
        ssl: connectionData.ssl || false,
        sshTunnel: connectionData.sshTunnel || false,
        sshConfig: connectionData.sshConfig || {},
        createdAt: new Date().toISOString(),
        color: connectionData.color || '#4F46E5'
      };

      this.connections.push(connection);
      return this.saveConnections() ? connection : null;
    } catch (error) {
      console.error('Error adding connection:', error);
      return null;
    }
  }

  async testConnection(connectionData) {
    try {
      const testConfig = {
        host: connectionData.host,
        port: connectionData.port,
        user: connectionData.username,
        password: connectionData.password,
        database: connectionData.database,
        ssl: connectionData.ssl
      };

      switch (connectionData.type) {
        case 'mysql':
          return await this.testMySQLConnection(testConfig);
        case 'postgresql':
          return await this.testPostgreSQLConnection(testConfig);
        case 'sqlserver':
          return await this.testSQLServerConnection(testConfig);
        default:
          return { success: false, error: 'Unsupported database type' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testMySQLConnection(config) {
    try {
      const connection = await mysql.createConnection(config);
      await connection.end();
      return { success: true, message: 'MySQL connection successful' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testPostgreSQLConnection(config) {
    try {
      const pool = new Pool(config);
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      return { success: true, message: 'PostgreSQL connection successful' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testSQLServerConnection(config) {
    try {
      const pool = new sql.ConnectionPool({
        server: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        options: {
          encrypt: config.ssl,
          trustServerCertificate: true
        }
      });
      await pool.connect();
      await pool.close();
      return { success: true, message: 'SQL Server connection successful' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getConnections() {
    return this.connections.map(conn => ({
      id: conn.id,
      name: conn.name,
      type: conn.type,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      database: conn.database,
      ssl: conn.ssl,
      sshTunnel: conn.sshTunnel,
      createdAt: conn.createdAt,
      color: conn.color
    }));
  }

  deleteConnection(id) {
    const index = this.connections.findIndex(conn => conn.id === id);
    if (index !== -1) {
      this.connections.splice(index, 1);
      return this.saveConnections();
    }
    return false;
  }

  async activateConnection(id) {
    const connection = this.connections.find(conn => conn.id === id);
    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      // Close existing connection
      if (this.activePool) {
        await this.closeActiveConnection();
      }

      // Decrypt the password for database connection
      let password;
      try {
        password = this.decrypt(connection.password);
        console.log('Password decryption successful');
      } catch (decryptError) {
        console.error('Password decryption failed:', decryptError);
        return { success: false, error: 'Failed to decrypt password' };
      }
      
      const config = {
        host: connection.host,
        port: connection.port,
        user: connection.username,
        password: password,
        database: connection.database,
        ssl: connection.ssl
      };

      console.log('Attempting to connect with config:', {
        host: config.host,
        port: config.port,
        user: config.user,
        database: config.database,
        ssl: config.ssl
      });

      // Create new connection based on type
      switch (connection.type) {
        case 'mysql':
          this.activePool = mysqlSync.createPool({
            ...config,
            connectionLimit: 10,
            acquireTimeout: 60000,
            timeout: 60000,
            reconnect: true,
            idleTimeout: 300000
          });
          break;
        case 'postgresql':
          this.activePool = new Pool(config);
          break;
        case 'sqlserver':
          this.activePool = new sql.ConnectionPool({
            server: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            options: {
              encrypt: config.ssl,
              trustServerCertificate: true
            }
          });
          await this.activePool.connect();
          break;
      }

      this.activeConnection = connection;
      return { success: true, connection: this.getConnectionInfo(connection) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async closeActiveConnection() {
    if (this.activePool) {
      try {
        if (this.activeConnection?.type === 'mysql') {
          this.activePool.end();
        } else if (this.activeConnection?.type === 'postgresql') {
          await this.activePool.end();
        } else if (this.activeConnection?.type === 'sqlserver') {
          await this.activePool.close();
        }
      } catch (error) {
        console.error('Error closing connection:', error);
      }
      this.activePool = null;
      this.activeConnection = null;
    }
  }

  getConnectionInfo(connection) {
    return {
      id: connection.id,
      name: connection.name,
      type: connection.type,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      color: connection.color
    };
  }

  getActiveConnection() {
    return this.activeConnection ? this.getConnectionInfo(this.activeConnection) : null;
  }

  getActivePool() {
    return this.activePool;
  }
}

module.exports = ConnectionManager;