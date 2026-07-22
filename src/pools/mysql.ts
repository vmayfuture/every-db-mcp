import * as mysql from 'mysql2/promise';
import { DatabaseConfig, IConnectionPool, QueryResult, WriteResult } from '../types.js';

export class MySQLPool implements IConnectionPool {
  private pool: mysql.Pool;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionLimit: config.connectionLimit || 10,
      connectTimeout: config.connectTimeout || 10000,
      waitForConnections: true,
      queueLimit: 100,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const conn = await this.pool.getConnection();
      await conn.ping();
      conn.release();
      return true;
    } catch (error) {
      console.error('[MySQL] Connection test failed:', error);
      return false;
    }
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();
    const conn = await this.pool.getConnection();
    try {
      const [rows, fields] = await conn.query(sql, params);
      const executionTime = Date.now() - startTime;

      return {
        rows: Array.isArray(rows) ? rows : [rows],
        rowCount: Array.isArray(rows) ? rows.length : 1,
        fields: fields?.map((f: any) => ({ name: f.name, type: f.type })),
        executionTime,
      };
    } finally {
      conn.release();
    }
  }

  async execute(sql: string, params?: any[]): Promise<WriteResult> {
    const startTime = Date.now();
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(sql, params);
      const executionTime = Date.now() - startTime;

      await conn.commit();

      const header = result as mysql.ResultSetHeader;

      // 判断操作类型
      const sqlLower = sql.trim().toLowerCase();
      let message = 'Operation successful';
      if (sqlLower.startsWith('insert')) {
        message = `Insert successful. Affected rows: ${header.affectedRows}, Last insert ID: ${header.insertId}`;
      } else if (sqlLower.startsWith('update')) {
        message = `Update successful. Affected rows: ${header.affectedRows}, Changed rows: ${header.changedRows || 0}`;
      } else if (sqlLower.startsWith('delete')) {
        message = `Delete successful. Affected rows: ${header.affectedRows}`;
      } else if (sqlLower.startsWith('create') || sqlLower.startsWith('alter') || sqlLower.startsWith('drop')) {
        message = `DDL operation successful.`;
      }

      return {
        affectedRows: header.affectedRows || 0,
        insertId: header.insertId,
        changedRows: header.changedRows,
        executionTime,
        message,
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
