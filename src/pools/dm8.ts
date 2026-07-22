import { DatabaseConfig, IConnectionPool, QueryResult, WriteResult } from '../types.js';
import { spawn } from 'node:child_process';

// DM8 via Python dmPython bridge
// Node.js oracledb driver is not fully compatible with DM8

// Auto-detect Python path or use environment variable
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';

const BRIDGE_SCRIPT = `
import sys
import json
import os
import site
import glob

# Add dmssl to PATH for encryption module
dmssl_paths = []
for sp in site.getsitepackages():
    dmssl_paths.extend(glob.glob(os.path.join(sp, 'dmssl')))
if dmssl_paths:
    os.environ['PATH'] = dmssl_paths[0] + os.pathsep + os.environ.get('PATH', '')

import dmPython

def main():
    request = json.loads(sys.stdin.read())
    action = request.get('action')
    host = request.get('host')
    port = request.get('port')
    user = request.get('user')
    password = request.get('password')
    schema = request.get('schema', '')
    sql = request.get('sql', '')

    try:
        conn = dmPython.connect(
            user=user,
            password=password,
            server=host,
            port=port
        )

        if action == 'test':
            cursor = conn.cursor()
            cursor.execute('SELECT 1 FROM DUAL')
            cursor.fetchone()
            cursor.close()
            print(json.dumps({'success': True, 'message': 'Connection successful'}))

        elif action == 'query':
            cursor = conn.cursor()
            if schema:
                cursor.execute('SET SCHEMA ' + schema)
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
            if schema:
                cursor.execute('SET SCHEMA ' + schema)
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

export class DM8Pool implements IConnectionPool {
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  private async runPython(action: string, sql?: string): Promise<any> {
    const request: any = {
      action,
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
    };
    if (sql) request.sql = sql;
    if (this.config.schema) request.schema = this.config.schema;
    return runPythonBridge(request);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.runPython('test');
      return true;
    } catch (error) {
      console.error('[DM8] Connection test failed:', error);
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