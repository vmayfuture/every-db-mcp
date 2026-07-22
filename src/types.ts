// 数据库类型枚举
export enum DatabaseType {
  MYSQL = 'mysql',
  DM8 = 'dm8',
  ORACLE = 'oracle',
  GAUSSDB = 'gaussdb'
}

// 数据库连接配置
export interface DatabaseConfig {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
  schema?: string;
  allowInsert?: boolean;
  allowUpdate?: boolean;
  allowDelete?: boolean;
  allowDDL?: boolean;
  connectionLimit?: number;
  connectTimeout?: number;
}

// 全局配置
export interface GlobalConfig {
  databases: DatabaseConfig[];
  defaultDatabase?: string;
  defaultAllowInsert?: boolean;
  defaultAllowUpdate?: boolean;
  defaultAllowDelete?: boolean;
  defaultAllowDDL?: boolean;
}

// 查询结果
export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields?: Array<{ name: string; type: string }>;
  executionTime: number;
}

// 写操作结果
export interface WriteResult {
  affectedRows: number;
  insertId?: number | string;
  changedRows?: number;
  executionTime: number;
  message: string;
}

// MCP 工具响应 - 兼容 MCP SDK 的 CallToolResult
export interface McpToolResponse {
  [x: string]: unknown;
  content: Array<{
    type: string;
    text: string;
  }>;
  isError: boolean;
}

// 连接池接口
export interface IConnectionPool {
  query(sql: string, params?: any[]): Promise<QueryResult>;
  execute(sql: string, params?: any[]): Promise<WriteResult>;
  close(): Promise<void>;
  testConnection(): Promise<boolean>;
}

// Schema 权限
export interface SchemaPermissions {
  [schema: string]: boolean;
}
