# Project Database Routing README Design

## Goal

Explain how every-db-mcp selects a configured database in a real project, and provide a copyable `AGENTS.md` policy that prevents an Agent from silently using the wrong default database.

## Scope

This change updates `README.md` only. It documents existing behavior and does not add automatic project detection or change MCP tool behavior.

## Placement

Add a new subsection named `在实际项目中选择正确的数据库` near the start of `使用指南`, immediately after the introductory paragraph and before the developer tool reference. This keeps the guidance visible to Agent users without interrupting installation steps.

## Content

The subsection will:

1. Separate the responsibilities of the Agent and MCP server: the Agent chooses a configured database `id`, while the server uses that entry's `type` to select the MySQL, GaussDB, Oracle, or DM8 driver.
2. State that every-db-mcp does not automatically associate the current workspace with a database connection.
3. Explain that omitting `database` uses `defaultDatabase`, which can target the wrong system when one MCP registration serves several projects.
4. Recommend unique IDs in the form `project-database-environment`, such as `order-system-gaussdb-dev`.
5. Include a copyable `AGENTS.md` example that pins a project to one database ID, prohibits implicit switching, and keeps production access read-only.
6. Include natural-language examples for the default database and an explicitly selected database.
7. Advise testing the connection before the first query and keeping write permissions disabled unless deliberately required.

## Acceptance Criteria

- A new user can explain how `id`, `type`, and `defaultDatabase` interact without reading the source code.
- A project maintainer can copy the supplied `AGENTS.md` block and replace one database ID.
- The documentation clearly warns that project-to-database routing is not automatic.
- The examples use natural language rather than requiring users to call MCP functions manually.
- Existing installation, configuration, and tool-reference content remains intact.

## Verification

- Review the Markdown heading hierarchy and fenced code blocks.
- Search the finished README for the new routing explanation, `defaultDatabase`, and `AGENTS.md` example.
- Inspect the diff to ensure only the intended documentation files changed and `.idea/` remains untracked.
