# every-db-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)

**every-db-mcp** 是一个多数据库 Model Context Protocol (MCP) 服务器，支持 MySQL、GaussDB、Oracle 和达梦 (DM8) 四种数据库。它提供了统一的接口来执行查询、数据操作和结构查看，让 AI 助手能够安全地与多种数据库进行交互。

## ✨ 特性

- 🗄️ **多数据库支持**: MySQL、GaussDB、Oracle、达梦 (DM8)
- 🔒 **权限控制**: 细粒度的读写权限管理，支持按数据库配置 INSERT/UPDATE/DELETE/DDL 权限
- ⚡ **连接池管理**: 自动管理数据库连接池，提高性能和资源利用率
- 🛡️ **安全保护**: 自动 LIMIT 保护、SQL 类型检查、操作权限验证
- 🔧 **灵活配置**: 支持静态配置文件，可配置多个数据库实例
- 🌐 **跨平台**: 支持 Windows、Linux、macOS

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────┐
│                    AI Assistant                         │
│              (Claude, Codex, CodeBuddy)                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼ MCP Protocol
┌─────────────────────────────────────────────────────────┐
│                  every-db-mcp                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   MySQL     │  │  GaussDB    │  │   Oracle    │     │
│  │  (Node.js)  │  │  (Python)   │  │  (Python)   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│  ┌─────────────┐                                       │
│  │    DM8      │                                       │
│  │  (Python)   │                                       │
│  └─────────────┘                                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Database Servers                           │
│    MySQL    GaussDB    Oracle    DM8                    │
└─────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 前置要求

- **Node.js** 22.0 或更高版本
- **npm**（随 Node.js 一起安装）
- **Python** 3.10 或更高版本（仅用于 GaussDB、Oracle、DM8）
- 一个已启动且可访问的目标数据库

> 如果只使用 MySQL，不需要安装 Python 及 `requirements.txt` 中的依赖。

### 1. 获取代码并进入项目根目录

克隆仓库或解压项目后，进入包含 `package.json` 和 `db-config.json` 的目录：

```bash
git clone https://github.com/vmayfuture/every-db-mcp.git
cd every-db-mcp
```

如果使用下载的 ZIP，直接解压并在终端中进入解压后的目录即可。

### 2. 安装 Node.js 依赖

```bash
npm install
```

### 3. 安装 Python 依赖（可选）

只有使用 GaussDB、Oracle 或 DM8 时才执行：

```bash
python -m pip install -r requirements.txt
```

MySQL 使用 Node.js 的 `mysql2` 驱动，请跳过这一步。

### 4. 配置数据库连接

#### 方式 A：编辑 `db-config.json`（推荐用于多数据库）

直接编辑项目根目录中的 `db-config.json`。当前程序**不会读取** `db-config.local.json`，因此不要把配置文件改成该名称。

下面是一个最小 MySQL 配置示例：

```json
{
  "defaultDatabase": "mysql-local",
  "defaultAllowInsert": false,
  "defaultAllowUpdate": false,
  "defaultAllowDelete": false,
  "defaultAllowDDL": false,
  "databases": [
    {
      "id": "mysql-local",
      "name": "Local MySQL",
      "type": "mysql",
      "host": "127.0.0.1",
      "port": 3306,
      "user": "your-mysql-user",
      "password": "your-mysql-password",
      "database": "your-database",
      "allowInsert": false,
      "allowUpdate": false,
      "allowDelete": false,
      "allowDDL": false
    }
  ]
}
```

请替换用户名、密码和数据库名。建议使用专门的只读账号，不要使用生产环境的 root 账号。

#### 方式 B：使用环境变量（仅支持单个 MySQL）

如果只连接一个 MySQL，也可以在启动服务前设置环境变量。设置了 `MYSQL_HOST` 后，环境变量配置会优先于 `db-config.json`。

PowerShell：

```powershell
$env:MYSQL_HOST = "127.0.0.1"
$env:MYSQL_PORT = "3306"
$env:MYSQL_USER = "your-mysql-user"
$env:MYSQL_PASS = "your-mysql-password"
$env:MYSQL_DB = "your-database"
```

Bash：

```bash
export MYSQL_HOST="127.0.0.1"
export MYSQL_PORT="3306"
export MYSQL_USER="your-mysql-user"
export MYSQL_PASS="your-mysql-password"
export MYSQL_DB="your-database"
```

### 5. 编译 TypeScript

```bash
npm run build
```

### 6. 启动服务

```bash
npm start
```

看到下面的日志表示 MCP stdio 服务已启动：

```text
[MCP] every-db-mcp server started on stdio
```

stdio 服务启动后会等待 MCP 客户端请求，终端看起来没有继续输出是正常现象。按 `Ctrl+C` 可以停止手动启动的服务。如果 MCP 客户端负责自动拉起服务，则不需要另外执行 `npm start`。

### 7. 验证连接和查询

在已经配置好 every-db-mcp 的 Agent 对话框中输入下面这句话：

> 请使用 every-db-mcp 测试默认数据库能否连接。如果连接成功，再执行只读查询 `SELECT 1 AS mcp_probe, VERSION() AS mysql_version`，最多返回 5 行，并用中文告诉我结果。

Agent 会根据这段自然语言自动选择 MCP 工具。成功时，它会告诉你连接状态，并返回一行包含探测值和 MySQL 版本的结果；用户不需要手动输入工具函数。

首次调用外部 MCP 时，Agent 可能会显示工具批准提示。连接测试和只读查询确认无误后可以批准；涉及写入、删除或 DDL 的操作应先核对数据库和影响范围。

### MCP 配置

完成 `npm run build` 后，将以下配置添加到 MCP 客户端。`args` 应使用本机 `dist/index.js` 的绝对路径。

下面的示例使用 `MYSQL_*` 环境变量连接单个 MySQL，请替换其中的连接信息。如果改用 `db-config.json`，可以删除 `env`，但必须确保 MCP 客户端从项目根目录启动该进程。

**Codex** (`~/.codex/config.toml`；Windows 为 `$HOME\.codex\config.toml`)：

```toml
[mcp_servers.every-db-mcp]
command = "node"
args = ["/absolute/path/to/every-db-mcp/dist/index.js"]
cwd = "/absolute/path/to/every-db-mcp"
enabled = true

[mcp_servers.every-db-mcp.env]
MYSQL_HOST = "127.0.0.1"
MYSQL_PORT = "3306"
MYSQL_USER = "your-mysql-user"
MYSQL_PASS = "your-mysql-password"
MYSQL_DB = "your-database"
```

Windows 路径可以写成 `C:/path/to/every-db-mcp/dist/index.js`。保存配置后，请新建 Agent 会话或重启 Codex，使新注册的 MCP 生效。

**CodeBuddy** (`~/.codebuddy/mcp.json`):

```json
{
  "mcpServers": {
    "every-db-mcp": {
      "command": "node",
      "args": ["path/to/every-db-mcp/dist/index.js"],
      "env": {
        "MYSQL_HOST": "127.0.0.1",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your-mysql-user",
        "MYSQL_PASS": "your-mysql-password",
        "MYSQL_DB": "your-database"
      },
      "disabled": false,
      "type": "stdio"
    }
  }
}
```

## 📖 使用指南

在支持 MCP 的 Agent（例如 Codex）中，用户只需要描述目标。Agent 会理解自然语言，并在后台选择和调用合适的 every-db-mcp 工具。

### 在实际项目中选择正确的数据库

`every-db-mcp` **不会自动把当前项目与某个数据库连接绑定，也不会只根据 SQL 猜测数据库类型**。实际调用分为两步：

1. Agent 根据用户指令、项目约定和工具描述选择一个已配置的数据库 `id`。
2. MCP 服务器根据该配置项的 `type`，选择 MySQL、GaussDB、Oracle 或 DM8 驱动。

| 配置或约定 | 作用 |
|------|------|
| 项目中的 `AGENTS.md` | 告诉 Agent 当前项目应使用哪个数据库 `id` |
| `database` 工具参数 | 指定本次调用使用的数据库 `id` |
| `type` | 决定 MCP 使用哪一种数据库驱动 |
| `defaultDatabase` | 未传入 `database` 时使用的默认连接 |

例如，Agent 选择 `order-system-gaussdb-dev` 后，MCP 会读取该配置项。如果它的 `type` 是 `gaussdb`，查询就会交给 GaussDB 驱动执行。多个项目共用同一个 MCP 服务时，如果 Agent 没有传入 `database`，请求会落到 `defaultDatabase`；因此仅依赖默认值可能误连到其他项目的数据库。

建议为连接使用包含项目、数据库类型和环境的唯一 ID：

```text
<project>-<database-type>-<environment>

order-system-gaussdb-dev
user-system-mysql-test
reporting-oracle-prod
```

然后在实际项目根目录的 `AGENTS.md` 中固定该项目使用的连接。可以复制下面的模板，并替换数据库 ID：

```md
## Database

本项目的数据库操作统一使用 every-db-mcp 中的
`order-system-gaussdb-dev` 数据库连接。

除非用户明确指定并确认，否则禁止连接其他数据库。
首次查询前，先测试该连接，并报告数据库 ID、类型和连接状态。
生产数据库只允许执行只读查询；不得执行 INSERT、UPDATE、DELETE 或 DDL。
```

`AGENTS.md` 中只保存数据库 ID 和操作规则，不要写用户名、密码或其他密钥。数据库凭据仍应保存在 every-db-mcp 的配置文件或 MCP 客户端环境变量中。

配置完成后，可以直接使用自然语言：

> 按照本项目的数据库约定，先测试连接；成功后查询 `orders` 表的前 10 条数据，并告诉我实际使用的数据库 ID 和类型。

如果需要临时访问另一个已配置的连接，应明确写出 ID：

> 使用 `reporting-oracle-prod` 执行只读查询；先确认连接和权限，不要执行任何写操作。

### Agent 可调用的工具（开发者参考）

下表用于说明 MCP 服务器提供的底层能力，方便开发和排障；普通用户不需要手动输入这些工具名或参数。

| 工具 | 描述 | 参数 |
|------|------|------|
| `db_query` | 执行 SELECT 查询 | `sql`, `database?`, `maxRows?` |
| `db_execute` | 执行 INSERT/UPDATE/DELETE/DDL | `sql`, `database?` |
| `db_list_databases` | 列出所有配置的数据库 | - |
| `db_test_connection` | 测试数据库连接 | `database?` |
| `db_get_table_structure` | 获取表结构 | `tableName`, `database?` |

### 自然语言使用示例

#### 查询数据

> 查询默认数据库中 `users` 表的前 10 条数据，并用表格展示。

> 使用 `gaussdb-dev` 数据库查询 `orders` 表，并概括查询结果。

> 查询 `products` 表，最多返回 50 行。

#### 数据操作

> 请先检查默认数据库是否允许新增数据。如果允许，在 `users` 表中新增一位名为 John、邮箱为 `john@example.com` 的用户，并告诉我执行结果。

> 将 `users` 表中 ID 为 1 的用户姓名改为 Jane；执行前先说明将影响哪条记录。

> 删除 `users` 表中 ID 为 1 的记录；先确认当前连接是否允许删除，并在执行前向我确认。

写入、更新、删除和 DDL 操作只有在对应权限开关已启用时才会执行。生产环境建议保持这些权限关闭。

#### 查看表结构

> 查看默认数据库中 `users` 表的结构，并说明每个字段的类型。

> 查看 `oracle-dev` 数据库中 `orders` 表的结构。

#### 测试连接

> 测试默认数据库是否可以正常连接，并告诉我数据库类型和连接状态。

> 测试 `dm8-dev` 数据库是否可以正常连接；如果失败，请概括错误原因。

## 🗄️ 数据库配置

### MySQL

```json
{
  "id": "mysql-dev",
  "type": "mysql",
  "host": "127.0.0.1",
  "port": 3306,
  "user": "your-mysql-user",
  "password": "your-mysql-password",
  "database": "your-database",
  "allowInsert": false,
  "allowUpdate": false,
  "allowDelete": false,
  "allowDDL": false
}
```

### GaussDB

```json
{
  "id": "gaussdb-dev",
  "type": "gaussdb",
  "host": "localhost",
  "port": 8000,
  "user": "user",
  "password": "password",
  "database": "postgres",
  "schema": "public",
  "allowInsert": false,
  "allowUpdate": false,
  "allowDelete": false,
  "allowDDL": false
}
```

### Oracle

```json
{
  "id": "oracle-dev",
  "type": "oracle",
  "host": "localhost",
  "port": 1521,
  "user": "user",
  "password": "password",
  "schema": "ORCL",
  "allowInsert": false,
  "allowUpdate": false,
  "allowDelete": false,
  "allowDDL": false
}
```

### DM8 (达梦)

```json
{
  "id": "dm8-dev",
  "type": "dm8",
  "host": "localhost",
  "port": 5236,
  "user": "user",
  "password": "password",
  "schema": "SYSDBA",
  "allowInsert": false,
  "allowUpdate": false,
  "allowDelete": false,
  "allowDDL": false
}
```

## 🔒 权限说明

| 权限 | 描述 | 默认值 |
|------|------|--------|
| `allowInsert` | 允许 INSERT 操作 | `false` |
| `allowUpdate` | 允许 UPDATE 操作 | `false` |
| `allowDelete` | 允许 DELETE 操作 | `false` |
| `allowDDL` | 允许 DDL 操作 (CREATE/ALTER/DROP) | `false` |

> **安全提示**: 生产环境建议将所有写操作权限设置为 `false`，仅开启 SELECT 查询。

## 🛠️ 开发

### 项目结构

```
every-db-mcp/
├── src/
│   ├── index.ts          # MCP Server 入口
│   ├── config.ts         # 配置加载
│   ├── factory.ts        # 连接池工厂
│   ├── permissions.ts    # 权限控制
│   ├── types.ts          # 类型定义
│   └── pools/
│       ├── mysql.ts      # MySQL 连接池
│       ├── gaussdb.ts    # GaussDB 连接池
│       ├── oracle.ts     # Oracle 连接池
│       └── dm8.ts        # DM8 连接池
├── package.json          # Node.js 依赖
├── tsconfig.json         # TypeScript 配置
├── db-config.json        # 数据库配置
├── requirements.txt      # Python 依赖
└── README.md             # 项目文档
```

### 构建

```bash
npm run build
```

### 运行

```bash
npm start
```

### 测试

当前仓库尚未配置自动化 `test` 脚本。提交改动前至少应执行 `npm run build`，然后在 Agent 中用自然语言要求它测试数据库连接并执行一条只读查询，完成端到端验证。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP 协议支持
- [mysql2](https://github.com/sidorares/node-mysql2) - MySQL Node.js 驱动
- [py-opengauss](https://gitee.com/opengauss/openGauss-connector-python) - GaussDB Python 驱动
- [oracledb](https://oracle.github.io/python-oracledb/) - Oracle Python 驱动
- [dmPython](https://www.dameng.com/) - 达梦数据库 Python 驱动

---

**注意**: 本项目仅供学习和开发使用。在生产环境中使用时，请确保遵循最佳安全实践，包括使用只读权限、定期轮换密码、启用 SSL 连接等。
