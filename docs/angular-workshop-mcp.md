# Custom Angular MCP tools with Codex

Workshop task 1572 adds a local stdio MCP server in `tools/angular-mcp/index.ts`.
It complements the official read-only [Angular CLI MCP server](angular-cli-mcp.md).
It runs the workspace's installed Angular CLI, without downloading a different
Angular version, starting a development server, or calling the OpenAI API.

## Build and verify

Use Node.js 22.19 or newer and install the locked development dependencies:

```sh
npm ci
npm run build.angular-mcp
npm run test.angular-mcp
```

The compiled entry point is `dist/angular-mcp/index.js`; generated output remains
ignored by Git. Rebuild after changing the server or running a clean checkout.
The server uses the supported SDK v1 maintenance line matching the workshop's
`@modelcontextprotocol/sdk` example. SDK and Zod are development dependencies,
not application imports.

The integration tests use real stdio MCP clients and the installed CLI in
temporary Angular workspaces. They verify tool discovery, component creation,
actual control-flow conversion, all advertised migration previews, non-writing
defaults, collision handling, invalid inputs, source links, workspace errors,
and concurrent-operation rejection. The repository-validation workflow runs
these tests without secrets.

For an independent protocol check with MCP Inspector:

```sh
npx --yes @modelcontextprotocol/inspector@2.15.0 --cli node dist/angular-mcp/index.js --method tools/list
npx --yes @modelcontextprotocol/inspector@2.15.0 --cli node dist/angular-mcp/index.js --method tools/call --tool-name generate_component --tool-arg name=user-profile --tool-arg path=src/app/components --tool-arg dryRun=true
npx --yes @modelcontextprotocol/inspector@2.15.0 --cli node dist/angular-mcp/index.js --method tools/call --tool-name run_migration --tool-arg migration=control-flow --tool-arg dryRun=true
```

Run these commands from the repository root. For the graphical Inspector, omit
`--cli` and the method/tool arguments. It prints a local connection URL containing
a session token; keep that URL private and stop the Inspector when finished.

## Register in Codex

Back up your personal `~/.codex/config.toml`, preserve existing entries, and add:

```toml
[mcp_servers.angular-workshop]
command = "node"
args = ["dist/angular-mcp/index.js"]
cwd = "<absolute repository directory>"
startup_timeout_sec = 20
tool_timeout_sec = 150
```

Replace the placeholder with your checkout's absolute directory. Forward slashes
work in Windows TOML paths. Keep this machine-specific configuration outside Git.
The official `angular-cli` server can remain registered alongside this server.

Reload the MCP connection or restart your Codex session. Check registration with
`codex mcp get angular-workshop`, then verify a live tool call. Registration alone
does not establish that the server was loaded in the current session. Codex's
configured approval policy still applies; this server does not grant approval.

## Tools and examples

Both tools default to `dryRun: true`. To write files, explicitly pass
`dryRun: false` after reviewing the preview. CLI output is returned as tool
content; failures set `isError: true`. Standard output carries MCP messages only.

`generate_component` accepts a kebab-case `name` and an optional `path` beneath
`src/app`. Both `components` and `src/app/components` address that directory;
omitting it uses `src/app`. It creates a flat standalone OnPush component with
inline template/style and a `.component.ts` filename. It skips test scaffolding
and automatic imports, preserves existing files, and does not add routes.

Example prompt for Codex:

> Use angular-workshop.generate_component to preview user-profile in
> src/app/components. Show the proposed files. After I approve, call the same tool
> with dryRun false, inspect the generated component, and run the development build.

`run_migration` accepts one of the migration identifiers supported by the installed
Angular 20.2 schematics:

| Migration                | Default scope / options                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| `control-flow`           | `src/app`; optional source-directory `path`                                  |
| `inject`                 | `src/app`; optional `path`                                                   |
| `route-lazy-loading`     | `src/app`; optional `path`                                                   |
| `signal-inputs`          | `src/app`; optional `path`; references may change elsewhere in the workspace |
| `signal-queries`         | `src/app`; optional `path`; references may change elsewhere in the workspace |
| `outputs`                | `src/app`; optional `path`; references may change elsewhere in the workspace |
| `self-closing-tag`       | `src/app`; optional `path`                                                   |
| `cleanup-unused-imports` | Entire workspace; does not accept `path`                                     |
| `standalone`             | `src/app`; optional `path` and `mode`                                        |

Standalone modes are `convert-to-standalone` (default), `prune-ng-modules`, and
`standalone-bootstrap`. Run its phases deliberately; they are not chained
automatically. Newer Angular documentation can list migrations unavailable in
Angular 20.2; this tool does not upgrade Angular or run arbitrary schematics.

Example prompt:

> Use angular-workshop.run_migration to preview control-flow for src/app/books.
> If the preview is empty, report that no conversion is needed. Otherwise show
> the affected files and wait for my approval before applying the migration.

After applying a migration, review `git diff`, follow `src/AGENTS.md`, and run the
appropriate application tests and builds. CLI completion alone is not proof of
correct behavior. Start with a clean task branch so the diff is attributable.
The earlier modernization already converted the book templates; an empty preview
there is expected.

## Execution boundaries

The server operates in its configured working directory, requiring exactly one
Angular project with `sourceRoot: "src"`. It assumes a trusted local checkout,
including dependencies, Angular configuration, and TypeScript project references;
it is not an operating-system sandbox for untrusted repositories. Do not expose
it over a public network.

Tool inputs cannot select another workspace, arbitrary commands, CLI flags, or
packages. Source paths reject traversal, absolute paths, and symbolic links or
junctions. CLI execution uses an argument array with no shell, a two-minute
timeout, bounded output, and one operation at a time per server process. Do not
run several server processes against the same checkout concurrently.

## Official references

- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [MCP TypeScript SDK v1 server API](https://ts.sdk.modelcontextprotocol.io/server.html)
- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
- [Angular migrations](https://angular.dev/reference/migrations)
