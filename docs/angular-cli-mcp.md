# Angular CLI MCP with Codex

Workshop task 1569 is implemented with Codex instead of Cursor. The Angular CLI
MCP server supplies workspace information and coding guidance; Codex applies and
verifies the resulting application changes.

## Local setup

Install the repository dependencies with `npm ci`. Configure the server in your
personal `~/.codex/config.toml`, preserving existing entries:

```toml
[mcp_servers.angular-cli]
command = "node"
args = ["node_modules/@angular/cli/bin/ng.js", "mcp", "--read-only"]
cwd = "<absolute repository directory>"
```

Replace the placeholder with your checkout's absolute directory. On Windows,
forward slashes are supported in the TOML string. Back up the configuration before
editing it. Keep personal paths and MCP configuration outside version control.

This starts the installed CLI version rather than downloading a newer CLI through
`npx`. Reload the Codex MCP connection or restart the Codex session after adding
the entry. `codex mcp get angular-cli` checks registration; a successful tool call
is still required to establish that the live connection works.

With Angular CLI 20.2.0, the read-only server exposes `list_projects`,
`get_best_practices`, and `search_documentation`. Tool availability depends on the
installed CLI version. Ask Codex to list this workspace and retrieve its Angular
best practices before changing code. No separate MCP login or OpenAI API key is
required by this local server. It does not start a development server in this
configuration or configure GitHub Actions.

## Application modernisation

The application now uses built-in template control flow, signal inputs,
signal-backed list/cover state, `OnPush` components, `inject()`-based service
dependencies, and lazy feature routes. Existing URLs, page-size defaults, the
300 ms search delay, API contracts, detail request cancellation, error/cover
fallbacks, keyboard operation, theme behavior, and styling are preserved.

The simple search field retains template-driven binding. Detail request state
retains its existing `AsyncPipe`/RxJS composition. No framework/dependency upgrade,
zoneless migration, or rewrite of the deferred search lifecycle is included.
See [the review](../REFACTORING.md) for findings and actual verification, and
[the architecture](../ARCHITECTURE.md) for current implementation boundaries.

## Official references

- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Angular CLI MCP server](https://angular.dev/ai/mcp)
