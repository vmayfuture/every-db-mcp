# Database connection guides / 数据库接入指南

[English overview](../README.en.md) | [中文说明](../README.md)

These templates match the current loader and bridges; they are not successful live-test reports. Replace credentials, hosts, databases and schemas with your values. Use a dedicated account and enforce database privileges.

## Build and interpreter

```bash
npm install
npm run build
```

MySQL uses Node.js mysql2. GaussDB, Oracle and DM8 need Python 3.10+:

```bash
python -m pip install -r requirements.txt
```

The bridges use `PYTHON_PATH`, falling back to `python`. Select the interpreter where dependencies were installed. Current requirements pin py-opengauss, oracledb, dmPython and supporting packages; installation availability depends on OS/interpreter. Installed drivers do not prove working server connections.

## Configuration loading

Save one complete example below as `db-config.json` in the process working directory. To combine connections, merge the `databases` arrays into one object, retain unique IDs and choose an existing ID as `defaultDatabase`.

Search order: `<cwd>/db-config.json`, `<cwd>/.db-config.json`, `~/.yg-multi-db-mcp.json`, `~/.config/yg-multi-db-mcp/config.json`. The loader does not read `db-config.local.json`. Setting `MYSQL_HOST` replaces file connections with the single MySQL connection ID `default`.

Set permissions explicitly per connection. The environment loader supplies false global defaults when `ALLOW_INSERT_OPERATION`, `ALLOW_UPDATE_OPERATION`, `ALLOW_DELETE_OPERATION` and `ALLOW_DDL_OPERATION` are absent; explicit connection flags avoid depending on file-level default merging. SQL checks do not replace account privileges.

## mysql

MySQL uses Node.js mysql2. `database` selects the database; no Python is needed.

```json
{
  "defaultDatabase": "mysql-dev",
  "defaultAllowInsert": false,
  "defaultAllowUpdate": false,
  "defaultAllowDelete": false,
  "defaultAllowDDL": false,
  "databases": [
    {
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
    }
  ]
}
```

Test `mysql-dev` using db_test_connection, then query `SELECT 1 AS mcp_probe` using that same ID.

## gaussdb

GaussDB uses `py_opengauss`. `database` selects the database; `schema` sets search_path. Use your actual port; 8000 is an example. Server/connector compatibility must be checked separately.

```json
{
  "defaultDatabase": "gaussdb-dev",
  "defaultAllowInsert": false,
  "defaultAllowUpdate": false,
  "defaultAllowDelete": false,
  "defaultAllowDDL": false,
  "databases": [
    {
      "id": "gaussdb-dev",
      "type": "gaussdb",
      "host": "127.0.0.1",
      "port": 8000,
      "user": "readonly_user",
      "password": "replace-with-local-secret",
      "database": "app_dev",
      "schema": "public",
      "allowInsert": false,
      "allowUpdate": false,
      "allowDelete": false,
      "allowDDL": false
    }
  ]
}
```

Test `gaussdb-dev` using db_test_connection, then query `SELECT 1 AS mcp_probe` using that same ID.

## oracle

Oracle uses Python oracledb in default Thin mode; this bridge does not initialize Thick mode. **schema supplies the service name** in host:port/service, not a table owner or SID. The database field is unused. Use qualified table names and suitable privileges for other owners.

```json
{
  "defaultDatabase": "oracle-dev",
  "defaultAllowInsert": false,
  "defaultAllowUpdate": false,
  "defaultAllowDelete": false,
  "defaultAllowDDL": false,
  "databases": [
    {
      "id": "oracle-dev",
      "type": "oracle",
      "host": "127.0.0.1",
      "port": 1521,
      "user": "readonly_user",
      "password": "replace-with-local-secret",
      "schema": "ORCLPDB1",
      "allowInsert": false,
      "allowUpdate": false,
      "allowDelete": false,
      "allowDDL": false
    }
  ]
}
```

Test `oracle-dev` using db_test_connection, then query `SELECT 1 AS mcp_probe FROM DUAL` using that same ID.

## dm8

DM8 uses dmPython. `schema` is applied using SET SCHEMA for queries and writes. Connection testing does not apply it, so verify schema access with a subsequent query. Use a trusted configured schema identifier. Vendor runtime libraries may be required; the bridge looks for an installed dmssl directory in Python site-packages and prepends it to PATH before importing dmPython. The database field is unused.

```json
{
  "defaultDatabase": "dm8-dev",
  "defaultAllowInsert": false,
  "defaultAllowUpdate": false,
  "defaultAllowDelete": false,
  "defaultAllowDDL": false,
  "databases": [
    {
      "id": "dm8-dev",
      "type": "dm8",
      "host": "127.0.0.1",
      "port": 5236,
      "user": "readonly_user",
      "password": "replace-with-local-secret",
      "schema": "APP",
      "allowInsert": false,
      "allowUpdate": false,
      "allowDelete": false,
      "allowDDL": false
    }
  ]
}
```

Test `dm8-dev` using db_test_connection, then query `SELECT 1 AS mcp_probe FROM DUAL` using that same ID.

## MCP clients

Codex file-based configuration:

```toml
[mcp_servers.every-db-mcp]
command = "node"
args = ["C:/tools/every-db-mcp/dist/index.js"]
cwd = "C:/tools/every-db-mcp"
enabled = true

[mcp_servers.every-db-mcp.env]
PYTHON_PATH = "C:/tools/every-db-mcp/.venv/Scripts/python.exe"
```

Use your actual paths; omit PYTHON_PATH for MySQL-only use. On macOS/Linux use corresponding paths such as `/opt/every-db-mcp/.venv/bin/python`. Do not set MYSQL_HOST for file-based multi-database access.

For clients accepting mcpServers JSON and a process working directory:

```json
{
  "mcpServers": {
    "every-db-mcp": {
      "command": "node",
      "args": ["C:/tools/every-db-mcp/dist/index.js"],
      "cwd": "C:/tools/every-db-mcp",
      "env": {"PYTHON_PATH": "C:/tools/every-db-mcp/.venv/Scripts/python.exe"}
    }
  }
}
```

Client schemas differ. If cwd is unsupported, use a supported user-level configuration path. An absolute args path does not change the working directory. Reload/restart the host as required.

For single MySQL, environment configuration avoids working-directory dependence:

```json
{
  "mcpServers": {
    "every-db-mcp": {
      "command": "node",
      "args": ["C:/tools/every-db-mcp/dist/index.js"],
      "env": {
        "MYSQL_HOST": "127.0.0.1",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "readonly_user",
        "MYSQL_PASS": "replace-with-local-secret",
        "MYSQL_DB": "app_dev",
        "ALLOW_INSERT_OPERATION": "false",
        "ALLOW_UPDATE_OPERATION": "false",
        "ALLOW_DELETE_OPERATION": "false",
        "ALLOW_DDL_OPERATION": "false"
      }
    }
  }
}
```

This creates ID `default`, not the file example's IDs.

## Verify and troubleshoot

```text
List every-db-mcp connections. Test oracle-dev, then run
SELECT 1 AS mcp_probe FROM DUAL on oracle-dev with maxRows 5.
Report the ID, database type and any error; do not modify data.
```

Use the appropriate ID and SQL probe. The tool's database parameter selects the ID; type chooses the driver; omission selects defaultDatabase. Projects are not automatically bound to a connection. Keep IDs and rules in project instructions, not credentials.

- No configuration: check process cwd and supported filenames.
- Only MySQL appears: remove inherited/client MYSQL_HOST for file connections.
- Python import error: install dependencies into the PYTHON_PATH interpreter.
- Oracle service error: verify listener host, port and service name in schema.
- GaussDB/DM8 schema error: check schema name and privileges.
- Driver installed but connection fails: verify network, version compatibility, credentials and vendor libraries separately.

Keep local credentials out of public commits. Python bridges create a connection per subprocess request, so pooling differs from MySQL. SQL dialects differ, and row limits are not isolation. The repository has no automated test script; perform a real connection test and read-only query for each actual target. No live database validation is claimed by these documentation examples.
