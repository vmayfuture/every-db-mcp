#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig, getDatabaseConfig } from './config.js';
import { ConnectionPoolFactory } from './factory.js';
import { checkPermission, isReadOnlyOperation, getSqlOperationType } from './permissions.js';
import { GlobalConfig, McpToolResponse } from './types.js';

// 加载配置
let config: GlobalConfig;
try {
  config = loadConfig();
  console.error(`[MCP] Loaded ${config.databases.length} database configuration(s)`);
  for (const db of config.databases) {
    console.error(`[MCP]   - ${db.id}: ${db.type}://${db.host}:${db.port}/${db.database || db.schema || ''} (insert=${db.allowInsert}, update=${db.allowUpdate}, delete=${db.allowDelete}, ddl=${db.allowDDL})`);
  }
} catch (error) {
  console.error('[MCP] Configuration error:', error);
  process.exit(1);
}

// 创建 MCP Server
const server = new Server(
  {
    name: 'every-db-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 生成工具描述
function buildToolDescription(): string {
  const dbList = config.databases.map(db => {
    const perms: string[] = ['SELECT'];
    if (db.allowInsert) perms.push('INSERT');
    if (db.allowUpdate) perms.push('UPDATE');
    if (db.allowDelete) perms.push('DELETE');
    if (db.allowDDL) perms.push('DDL');
    return `  - ${db.id} (${db.type}): ${perms.join(', ')}`;
  }).join('\n');

  return `Execute SQL queries against configured databases (MySQL, DM8, Oracle, GaussDB).

Available databases:
${dbList}

Default database: ${config.defaultDatabase}

Use 'db_query' for SELECT queries, 'db_execute' for INSERT/UPDATE/DELETE/DDL operations.`;
}

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'db_query',
        description: buildToolDescription(),
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'The SQL SELECT query to execute',
            },
            database: {
              type: 'string',
              description: `Database ID to query (default: ${config.defaultDatabase}). Available: ${config.databases.map(d => d.id).join(', ')}`,
            },
            maxRows: {
              type: 'number',
              description: 'Maximum number of rows to return (default: 100)',
            },
          },
          required: ['sql'],
        },
      },
      {
        name: 'db_execute',
        description: `Execute INSERT/UPDATE/DELETE/DDL operations against configured databases. Respects per-database permissions.`,
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'The SQL statement to execute (INSERT/UPDATE/DELETE/DDL)',
            },
            database: {
              type: 'string',
              description: `Database ID to execute against (default: ${config.defaultDatabase}). Available: ${config.databases.map(d => d.id).join(', ')}`,
            },
          },
          required: ['sql'],
        },
      },
      {
        name: 'db_list_databases',
        description: 'List all configured database connections and their permissions',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'db_test_connection',
        description: 'Test connectivity to a specific database',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: `Database ID to test (default: ${config.defaultDatabase}). Available: ${config.databases.map(d => d.id).join(', ')}`,
            },
          },
        },
      },
      {
        name: 'db_get_table_structure',
        description: 'Get table structure (columns, indexes, constraints) for a specific table',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Name of the table',
            },
            database: {
              type: 'string',
              description: `Database ID (default: ${config.defaultDatabase})`,
            },
          },
          required: ['tableName'],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'db_query':
        return await handleQuery(args);
      case 'db_execute':
        return await handleExecute(args);
      case 'db_list_databases':
        return await handleListDatabases();
      case 'db_test_connection':
        return await handleTestConnection(args);
      case 'db_get_table_structure':
        return await handleGetTableStructure(args);
      default:
        return errorResponse(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return errorResponse(`Error executing ${name}: ${error.message || error}`);
  }
});

// 查询处理
async function handleQuery(args: any): Promise<McpToolResponse> {
  const { sql, database, maxRows = 100 } = args;

  if (!sql) {
    return errorResponse('SQL query is required');
  }

  // 检查是否为只读操作
  if (!isReadOnlyOperation(sql)) {
    return errorResponse(`This tool only supports SELECT queries. Use db_execute for ${getSqlOperationType(sql)} operations.`);
  }

  const dbConfig = getDatabaseConfig(config, database);
  const pool = await ConnectionPoolFactory.getPool(dbConfig);

  // 添加 LIMIT 保护（只对 SELECT/WITH 查询添加，SHOW/DESC/EXPLAIN 不加）
  let finalSql = sql;
  const sqlLower = sql.toLowerCase().trim();
  const isSelectQuery = sqlLower.startsWith('select') || sqlLower.startsWith('with');
  if (isSelectQuery && !sqlLower.includes('limit') && !sqlLower.includes('rownum') && !sqlLower.includes('fetch first')) {
    // 根据数据库类型添加限制
    if (dbConfig.type === 'mysql' || dbConfig.type === 'gaussdb') {
      finalSql = `${sql.replace(/;?\s*$/, '')} LIMIT ${maxRows}`;
    } else if (dbConfig.type === 'oracle' || dbConfig.type === 'dm8') {
      finalSql = `SELECT * FROM (${sql.replace(/;?\s*$/, '')}) WHERE ROWNUM <= ${maxRows}`;
    }
  }

  const result = await pool.query(finalSql);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result.rows, null, 2),
      },
      {
        type: 'text',
        text: `\n--- Query Info ---\nDatabase: ${dbConfig.id} (${dbConfig.type})\nRows returned: ${result.rowCount}\nExecution time: ${result.executionTime}ms`,
      },
    ],
    isError: false,
  };
}

// 写操作处理
async function handleExecute(args: any): Promise<McpToolResponse> {
  const { sql, database } = args;

  if (!sql) {
    return errorResponse('SQL statement is required');
  }

  const dbConfig = getDatabaseConfig(config, database);

  // 权限检查
  const permCheck = checkPermission(sql, dbConfig);
  if (!permCheck.allowed) {
    return errorResponse(permCheck.reason || 'Operation not allowed');
  }

  const pool = await ConnectionPoolFactory.getPool(dbConfig);
  const result = await pool.execute(sql);

  return {
    content: [
      {
        type: 'text',
        text: result.message,
      },
      {
        type: 'text',
        text: `\n--- Execution Info ---\nDatabase: ${dbConfig.id} (${dbConfig.type})\nOperation: ${permCheck.operationType}\nAffected rows: ${result.affectedRows}\nExecution time: ${result.executionTime}ms`,
      },
    ],
    isError: false,
  };
}

// 列出数据库
async function handleListDatabases(): Promise<McpToolResponse> {
  const dbInfo = config.databases.map(db => ({
    id: db.id,
    name: db.name,
    type: db.type,
    host: db.host,
    port: db.port,
    database: db.database,
    schema: db.schema,
    permissions: {
      select: true,
      insert: db.allowInsert || false,
      update: db.allowUpdate || false,
      delete: db.allowDelete || false,
      ddl: db.allowDDL || false,
    },
    isDefault: db.id === config.defaultDatabase,
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(dbInfo, null, 2),
      },
    ],
    isError: false,
  };
}

// 测试连接
async function handleTestConnection(args: any): Promise<McpToolResponse> {
  const { database } = args;
  const dbConfig = getDatabaseConfig(config, database);

  try {
    const pool = await ConnectionPoolFactory.getPool(dbConfig);
    const isValid = await pool.testConnection();

    if (isValid) {
      return {
        content: [
          {
            type: 'text',
            text: `✅ Connection to '${dbConfig.id}' (${dbConfig.type}://${dbConfig.host}:${dbConfig.port}) successful`,
          },
        ],
        isError: false,
      };
    } else {
      return errorResponse(`❌ Connection to '${dbConfig.id}' failed`);
    }
  } catch (error: any) {
    return errorResponse(`❌ Connection to '${dbConfig.id}' failed: ${error.message}`);
  }
}

// 获取表结构
async function handleGetTableStructure(args: any): Promise<McpToolResponse> {
  const { tableName, database } = args;

  if (!tableName) {
    return errorResponse('Table name is required');
  }

  const dbConfig = getDatabaseConfig(config, database);
  const pool = await ConnectionPoolFactory.getPool(dbConfig);

  let sql: string;

  switch (dbConfig.type) {
    case 'mysql':
      sql = `
        SELECT
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          IS_NULLABLE as is_nullable,
          COLUMN_DEFAULT as column_default,
          COLUMN_COMMENT as column_comment,
          COLUMN_KEY as column_key
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = '${dbConfig.database}' AND TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `;
      break;
    case 'gaussdb':
      sql = `
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = '${dbConfig.schema || 'public'}' AND table_name = '${tableName}'
        ORDER BY ordinal_position
      `;
      break;
    case 'oracle':
    case 'dm8':
      sql = `
        SELECT
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          NULLABLE as is_nullable,
          DATA_DEFAULT as column_default
        FROM ALL_TAB_COLUMNS
        WHERE TABLE_NAME = UPPER('${tableName}')
        ORDER BY COLUMN_ID
      `;
      break;
    default:
      return errorResponse(`Unsupported database type: ${dbConfig.type}`);
  }

  const result = await pool.query(sql);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result.rows, null, 2),
      },
      {
        type: 'text',
        text: `\n--- Table Structure ---\nDatabase: ${dbConfig.id} (${dbConfig.type})\nTable: ${tableName}\nColumns: ${result.rowCount}`,
      },
    ],
    isError: false,
  };
}

// 错误响应
function errorResponse(message: string): McpToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${message}`,
      },
    ],
    isError: true,
  };
}

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] every-db-mcp server started on stdio');
}

// 优雅退出
process.on('SIGINT', async () => {
  console.error('[MCP] Shutting down...');
  await ConnectionPoolFactory.closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[MCP] Shutting down...');
  await ConnectionPoolFactory.closeAll();
  process.exit(0);
});

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
