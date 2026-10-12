# every-db-mcp — Multi-database MCP server for MySQL, GaussDB, Oracle and DM8

[中文](README.md) | [English](README.en.md)

[Online documentation](https://vmayfuture.github.io/every-db-mcp/)

every-db-mcp is a Model Context Protocol (MCP) stdio server for database queries, table structure inspection, connection tests and explicitly enabled writes. MySQL uses Node.js/mysql2; GaussDB, Oracle and Dameng DM8 use Python subprocess bridges. It selects configured database IDs, not automatic project detection or SQL dialect inference.

## Quick start

Requirements: Node.js 22+, npm and a reachable database. Python 3.10+ is needed for GaussDB, Oracle and DM8; MySQL does not need Python.

```bash
git clone https://github.com/vmayfuture/every-db-mcp.git
cd every-db-mcp
npm install
```

For Python-backed databases:

```bash
python -m pip install -r requirements.txt
```

Save this configuration as `db-config.json` in the project root, replacing placeholders with a dedicated account:

```json
{
  "defaultDatabase": "mysql-dev",
  "defaultAllowInsert": false,
  "defaultAllowUpdate": false,
  "defaultAllowDelete": false,
  "defaultAllowDDL": false,
  "databases": [{
    "id": "mysql-dev",
    "type": "mysql",
    "host": "127.0.0.1",
    "port": 3306,
    "user": "readonly_user",
    "password": "replace-with-local-secret",
    "database": "app_dev",
    "allowInsert": false,
    "allowUpdate": false,
    "allowDelete": false,
    "allowDDL": false
  }]
}
```

```bash
npm run build
npm start
```

The stdio server waits for MCP requests. A client can launch it automatically; manual startup is only needed for a launch check. Configure Codex with your actual absolute paths:

```toml
[mcp_servers.every-db-mcp]
command = "node"
args = ["/absolute/path/to/every-db-mcp/dist/index.js"]
cwd = "/absolute/path/to/every-db-mcp"
enabled = true
```

Windows paths can use `C:/tools/every-db-mcp/dist/index.js`. The working directory matters: the loader looks for `db-config.json` there and does not read `db-config.local.json`. A set `MYSQL_HOST` replaces file connections with one MySQL connection named `default`; remove it for file-based multi-database use.

Full per-driver configurations, client JSON and troubleshooting: [database guides](docs/database-guides.md). Detailed Chinese setup: [README.md](README.md).

## Use cases and calls

Use cases include development data inspection, schema understanding, troubleshooting missing records and comparing queries across configured environments. These sample prompts are not recorded execution results:

```text
Use every-db-mcp to list configured connections. Test mysql-dev, then run
SELECT 1 AS mcp_probe with maxRows 5. Report the selected ID and connection result.
```

```text
Inspect the orders table in gaussdb-dev and explain the columns.
Use only that connection; do not modify data.
```

| Tool | Arguments | Purpose |
| --- | --- | --- |
| `db_list_databases` | none | List configured connections |
| `db_test_connection` | `database?` | Test a connection |
| `db_query` | `sql`, `database?`, `maxRows?` | SELECT query |
| `db_get_table_structure` | `tableName`, `database?` | Inspect structure |
| `db_execute` | `sql`, `database?` | Permitted INSERT/UPDATE/DELETE/DDL |

An agent can call `db_test_connection` with `{"database":"mysql-dev"}`, then `db_query` with `{"database":"mysql-dev","sql":"SELECT 1 AS mcp_probe","maxRows":5}`. Oracle/DM8 probes use `SELECT 1 AS mcp_probe FROM DUAL`.

Give connections unique environment-specific IDs and state the intended ID in project instructions. Omitting `database` selects `defaultDatabase`; it does not bind the current project automatically. Use the selected database's SQL dialect.

## Permissions, FAQ and limits

Per-database `allowInsert`, `allowUpdate`, `allowDelete` and `allowDDL` control writes. Keep them explicitly false for read-only use and enforce privileges on the database account. SQL checks and limits do not replace database access control.

**Why is file configuration ignored?** Check the working directory and remove `MYSQL_HOST` when using the file's multiple connections.

**What does Oracle schema mean?** The bridge uses it as the **service name** in `host:port/service`, not as a table-owner selector.

**Why does Python import fail?** Set `PYTHON_PATH` to the interpreter containing the dependencies; it otherwise defaults to `python`. DM8 may need vendor runtime libraries.

Driver implementations do not prove every database version/platform compatible or establish successful live testing of all four drivers. Python bridges create connections per subprocess request; persistent pooling behavior differs from MySQL.

## Development and license

`npm run build` compiles TypeScript. There is no automated `test` script. Test each actual target with a connection check and read-only query; this documentation does not claim new integration tests.

MIT license: [LICENSE](LICENSE).
