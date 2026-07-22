import { DatabaseConfig, IConnectionPool, QueryResult, WriteResult } from '../types.js';
import { spawn } from 'node:child_process';

// GaussDB via Python py_opengauss bridge
// Node.js pg driver is incompatible with GaussDB SCRAM auth

// Auto-detect Python path or use environment variable
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';

const BRIDGE_SCRIPT = `
import sys
import json
import py_opengauss

def main():
    request = json.loads(sys.stdin.read())
    action = request.get('action')
    conn_str = request.get('conn_str')
    sql = request.get('sql', '')
    schema = request.get('schema', '')

    try:
        conn = py_opengauss.open(conn_str)

        if schema:
            ps_schema = conn.prepare('SET search_path TO ' + schema)
            ps_schema()

        if action == 'test':
            ps = conn.prepare('SELECT 1')
            ps()
            print(json.dumps({'success': True, 'message': 'Connection successful'}))

        elif action == 'query':
            ps = conn.prepare(sql)
            rows = ps()
            columns = ps.column_names if hasattr(ps, 'column_names') else []
            result_rows = []
            for row in rows:
                row_dict = {}
                for i, col in enumerate(columns):
                    val = row[i]
                    if val is not None:
                        val = str(val)
                    row_dict[col] = val
                result_rows.append(row_dict)
            print(json.dumps({'success': True, 'rows': result_rows, 'rowCount': len(result_rows)}))

        elif action == 'execute':
            ps = conn.prepare(sql)
            ps()
            print(json.dumps({'success': True, 'affectedRows': 0, 'message': 'Operation successful'}))

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

export class GaussDBPool implements IConnectionPool {
  private config: DatabaseConfig;
  private connStr: string;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.connStr = `pq://${config.user}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/${config.database || 'test'}`;
  }

  private async runPython(action: string, sql?: string): Promise<any> {
    const request: any = {
      action,
      conn_str: this.connStr,
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
      console.error('[GaussDB] Connection test failed:', error);
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