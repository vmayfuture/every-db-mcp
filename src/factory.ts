import { DatabaseConfig, DatabaseType, IConnectionPool, QueryResult, WriteResult } from './types.js';
import { MySQLPool } from './pools/mysql.js';
import { DM8Pool } from './pools/dm8.js';
import { OraclePool } from './pools/oracle.js';
import { GaussDBPool } from './pools/gaussdb.js';

export class ConnectionPoolFactory {
  private static pools: Map<string, IConnectionPool> = new Map();

  static async createPool(config: DatabaseConfig): Promise<IConnectionPool> {
    const cacheKey = config.id;

    // 检查缓存
    if (this.pools.has(cacheKey)) {
      return this.pools.get(cacheKey)!;
    }

    let pool: IConnectionPool;

    switch (config.type) {
      case DatabaseType.MYSQL:
        pool = new MySQLPool(config);
        break;
      case DatabaseType.DM8:
        pool = new DM8Pool(config);
        break;
      case DatabaseType.ORACLE:
        pool = new OraclePool(config);
        break;
      case DatabaseType.GAUSSDB:
        pool = new GaussDBPool(config);
        break;
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }

    // 测试连接
    const isValid = await pool.testConnection();
    if (!isValid) {
      throw new Error(`Failed to connect to database '${config.id}'`);
    }

    this.pools.set(cacheKey, pool);
    return pool;
  }

  static async getPool(config: DatabaseConfig): Promise<IConnectionPool> {
    return this.createPool(config);
  }

  static async closeAll(): Promise<void> {
    for (const pool of this.pools.values()) {
      await pool.close();
    }
    this.pools.clear();
  }

  static async closePool(dbId: string): Promise<void> {
    const pool = this.pools.get(dbId);
    if (pool) {
      await pool.close();
      this.pools.delete(dbId);
    }
  }

  static listPools(): string[] {
    return Array.from(this.pools.keys());
  }
}
