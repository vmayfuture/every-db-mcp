import * as fs from 'fs';
import * as path from 'path';
import { GlobalConfig, DatabaseConfig, DatabaseType } from './types.js';

// 默认配置路径
const DEFAULT_CONFIG_PATHS = [
  path.join(process.cwd(), 'db-config.json'),
  path.join(process.cwd(), '.db-config.json'),
  path.join(process.env.USERPROFILE || process.env.HOME || '', '.yg-multi-db-mcp.json'),
  path.join(process.env.USERPROFILE || process.env.HOME || '', '.config', 'yg-multi-db-mcp', 'config.json'),
];

// 从环境变量加载配置
function loadFromEnv(): Partial<GlobalConfig> {
  const config: Partial<GlobalConfig> = {};

  // 全局默认权限
  config.defaultAllowInsert = process.env.ALLOW_INSERT_OPERATION === 'true';
  config.defaultAllowUpdate = process.env.ALLOW_UPDATE_OPERATION === 'true';
  config.defaultAllowDelete = process.env.ALLOW_DELETE_OPERATION === 'true';
  config.defaultAllowDDL = process.env.ALLOW_DDL_OPERATION === 'true';

  // 单数据库配置（向后兼容 mcp_server_mysql）
  if (process.env.MYSQL_HOST) {
    const dbConfig: DatabaseConfig = {
      id: 'default',
      name: 'Default MySQL',
      type: DatabaseType.MYSQL,
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASS || '',
      database: process.env.MYSQL_DB,
      allowInsert: config.defaultAllowInsert,
      allowUpdate: config.defaultAllowUpdate,
      allowDelete: config.defaultAllowDelete,
      allowDDL: config.defaultAllowDDL,
    };
    config.databases = [dbConfig];
    config.defaultDatabase = 'default';
  }

  return config;
}

// 从文件加载配置
function loadFromFile(filePath: string): GlobalConfig | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content) as GlobalConfig;
    console.error(`[Config] Loaded from ${filePath}`);
    return config;
  } catch (error) {
    console.error(`[Config] Error loading ${filePath}:`, error);
    return null;
  }
}

// 合并配置
function mergeConfigs(fileConfig: GlobalConfig, envConfig: Partial<GlobalConfig>): GlobalConfig {
  // 如果环境变量有数据库配置，优先使用
  if (envConfig.databases && envConfig.databases.length > 0) {
    return envConfig as GlobalConfig;
  }

  // 合并全局默认权限
  return {
    ...fileConfig,
    defaultAllowInsert: envConfig.defaultAllowInsert ?? fileConfig.defaultAllowInsert,
    defaultAllowUpdate: envConfig.defaultAllowUpdate ?? fileConfig.defaultAllowUpdate,
    defaultAllowDelete: envConfig.defaultAllowDelete ?? fileConfig.defaultAllowDelete,
    defaultAllowDDL: envConfig.defaultAllowDDL ?? fileConfig.defaultAllowDDL,
  };
}

// 验证配置
function validateConfig(config: GlobalConfig): void {
  if (!config.databases || config.databases.length === 0) {
    throw new Error('No database configurations found. Please create db-config.json or set environment variables.');
  }

  for (const db of config.databases) {
    if (!db.id || !db.type || !db.host || !db.user) {
      throw new Error(`Invalid database config: ${JSON.stringify(db)}`);
    }

    // 应用全局默认权限
    db.allowInsert = db.allowInsert ?? config.defaultAllowInsert ?? false;
    db.allowUpdate = db.allowUpdate ?? config.defaultAllowUpdate ?? false;
    db.allowDelete = db.allowDelete ?? config.defaultAllowDelete ?? false;
    db.allowDDL = db.allowDDL ?? config.defaultAllowDDL ?? false;
  }

  // 设置默认数据库
  if (!config.defaultDatabase && config.databases.length > 0) {
    config.defaultDatabase = config.databases[0].id;
  }
}

// 加载配置
export function loadConfig(): GlobalConfig {
  const envConfig = loadFromEnv();

  // 尝试从文件加载
  for (const configPath of DEFAULT_CONFIG_PATHS) {
    const fileConfig = loadFromFile(configPath);
    if (fileConfig) {
      const merged = mergeConfigs(fileConfig, envConfig);
      validateConfig(merged);
      return merged;
    }
  }

  // 仅使用环境变量配置
  if (envConfig.databases && envConfig.databases.length > 0) {
    validateConfig(envConfig as GlobalConfig);
    return envConfig as GlobalConfig;
  }

  throw new Error('No configuration found. Please create db-config.json or set environment variables.');
}

// 获取数据库配置
export function getDatabaseConfig(config: GlobalConfig, dbId?: string): DatabaseConfig {
  const id = dbId || config.defaultDatabase;
  const db = config.databases.find(d => d.id === id);
  if (!db) {
    throw new Error(`Database '${id}' not found in configuration`);
  }
  return db;
}
