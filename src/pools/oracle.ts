import { DatabaseConfig, IConnectionPool, QueryResult, WriteResult } from '../types.js';
import { spawn } from 'node:child_process';

// Oracle via Python oracledb bridge (Thin mode, no client needed)

// Auto-detect Python path or use environment variable
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';

const BRIDGE_SCRIPT = `
import sys
import json
import oracledb

def main():
    request = json.loads(sys.stdin.read())
    action = request.get('action')
    user = request.get('user')
    password = request.get('password')
    dsn = request.get('dsn')
    sql = request.get('sql', '')

    try:
        conn = oracledb.connect(user=user, password=password, dsn=dsn)

        if action == 'test':
            cursor = conn.cursor()
            cursor.execute('SELECT 1 FROM DUAL')
            cursor.fetchone()
            cursor.close()
            print(json.dumps({'success': True, 'message': 'Connection successful'}))

        elif action == 'query':
            cursor = conn.cursor()
            cursor.execute(sql)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = []
            for row in cursor.fetchall():
                row_dict = {}
                for i, col in enumerate(columns):
                    val = row[i]
                    if val is not None:
                        val = str(val)
                    row_dict[col] = val
                rows.append(row_dict)
            cursor.close()
            print(json.dumps({'success': True, 'rows': rows, 'rowCount': len(rows)}))

        elif action == 'execute':
            cursor = conn.cursor()
            cursor.execute(sql)
            conn.commit()
            affected = cursor.rowcount if hasattr(cursor, 'rowcount') else 0
            cursor.close()
            print(json.dumps({'success': True, 'affectedRows': affected, 'message': 'Operation successful'}))

        conn.close()
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == '__main__':
    main()
`;

function runPythonBridge(request: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_PATH, ['-X', 'utf8', '-c', BRIDGE_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code: number) => {
      try {
        const result = JSON.parse(stdout.trim());
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error || 'Unknown error'));
        }
      } catch (e) {
        reject(new Error(`Python bridge error (code=${code}): ${stderr || stdout || e}`));
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });

    proc.stdin.write(JSON.stringify(request));
    proc.stdin.end();
  });
}

export class OraclePool implements IConnectionPool {
  private config: DatabaseConfig;
  private dsn: string;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.dsn = `${config.host}:${config.port}/${config.schema || ''}`;
  }

  private async runPython(action: string, sql?: string): Promise<any> {
    const request: any = {
      action,
      user: this.config.user,
      password: this.config.password,
      dsn: this.dsn,
    };
    if (sql) request.sql = sql;
    return runPythonBridge(request);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.runPython('test');
      return true;
    } catch (error) {
      console.error('[Oracle] Connection test failed:', error);
      return false;
    }
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();
    const result = await this.runPython('query', sql);
    const executionTime = Date.now() - startTime;

    return {
      rows: result.rows || [],
      rowCount: result.rowCount || 0,
      executionTime,
    };
  }

  async execute(sql: string, params?: any[]): Promise<WriteResult> {
    const startTime = Date.now();
    const result = await this.runPython('execute', sql);
    const executionTime = Date.now() - startTime;

    return {
      affectedRows: result.affectedRows || 0,
      executionTime,
      message: result.message || 'Operation successful',
    };
  }

  async close(): Promise<void> {
    // Python subprocess closes connection automatically
  }
}