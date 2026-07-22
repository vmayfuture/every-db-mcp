import { DatabaseConfig } from './types.js';

// SQL 操作类型
export enum SqlOperationType {
  SELECT = 'SELECT',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  DDL = 'DDL',
  OTHER = 'OTHER',
}

// 解析 SQL 操作类型
export function getSqlOperationType(sql: string): SqlOperationType {
  const trimmed = sql.trim().toLowerCase();

  // 移除注释
  const cleanSql = trimmed
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();

  if (cleanSql.startsWith('select') ||
      cleanSql.startsWith('with') ||
      cleanSql.startsWith('show') ||
      cleanSql.startsWith('desc') ||
      cleanSql.startsWith('describe') ||
      cleanSql.startsWith('explain')) {
    return SqlOperationType.SELECT;
  }

  if (cleanSql.startsWith('insert')) {
    return SqlOperationType.INSERT;
  }

  if (cleanSql.startsWith('update') || cleanSql.startsWith('merge')) {
    return SqlOperationType.UPDATE;
  }

  if (cleanSql.startsWith('delete') || cleanSql.startsWith('truncate')) {
    return SqlOperationType.DELETE;
  }

  if (cleanSql.startsWith('create') ||
      cleanSql.startsWith('alter') ||
      cleanSql.startsWith('drop') ||
      cleanSql.startsWith('grant') ||
      cleanSql.startsWith('revoke') ||
      cleanSql.startsWith('comment')) {
    return SqlOperationType.DDL;
  }

  return SqlOperationType.OTHER;
}

// 检查是否为只读操作
export function isReadOnlyOperation(sql: string): boolean {
  return getSqlOperationType(sql) === SqlOperationType.SELECT;
}

// 权限检查结果
export interface PermissionCheck {
  allowed: boolean;
  operationType: SqlOperationType;
  reason?: string;
}

// 检查操作权限
export function checkPermission(sql: string, config: DatabaseConfig): PermissionCheck {
  const opType = getSqlOperationType(sql);

  switch (opType) {
    case SqlOperationType.SELECT:
      return { allowed: true, operationType: opType };

    case SqlOperationType.INSERT:
      if (!config.allowInsert) {
        return {
          allowed: false,
          operationType: opType,
          reason: `INSERT operations are not allowed for database '${config.id}'. Set allowInsert: true in config.`
        };
      }
      return { allowed: true, operationType: opType };

    case SqlOperationType.UPDATE:
      if (!config.allowUpdate) {
        return {
          allowed: false,
          operationType: opType,
          reason: `UPDATE operations are not allowed for database '${config.id}'. Set allowUpdate: true in config.`
        };
      }
      return { allowed: true, operationType: opType };

    case SqlOperationType.DELETE:
      if (!config.allowDelete) {
        return {
          allowed: false,
          operationType: opType,
          reason: `DELETE operations are not allowed for database '${config.id}'. Set allowDelete: true in config.`
        };
      }
      return { allowed: true, operationType: opType };

    case SqlOperationType.DDL:
      if (!config.allowDDL) {
        return {
          allowed: false,
          operationType: opType,
          reason: `DDL operations are not allowed for database '${config.id}'. Set allowDDL: true in config.`
        };
      }
      return { allowed: true, operationType: opType };

    default:
      // 其他操作（如存储过程调用）默认按 UPDATE 权限处理
      if (!config.allowUpdate) {
        return {
          allowed: false,
          operationType: opType,
          reason: `This operation requires write permission for database '${config.id}'.`
        };
      }
      return { allowed: true, operationType: opType };
  }
}
