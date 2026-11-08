# Workbench permission pack

Pack: `canonic/workbench@0.1.0`. Requires Shield `>=0.20.0, <1.0.0`.

All 18 current Workbench MCP tools are **Allow** in Loose, Recommended and Strict, including canvas changes, private page creation, interaction and cleanup. Unknown tools are **Ask**.

## Coverage

| MCP tool | Operation | Loose / Recommended / Strict |
| --- | --- | --- |
| `view_show` | Read the current canvas and its artboard targets. | Allow / Allow / Allow |
| `view_set` | Change the selected artboard in the last-used canvas. | Allow / Allow / Allow |
| `annotation_list` | Read the user’s annotations from the canvas. | Allow / Allow / Allow |
| `config_show` | List configured spaces, pages, scenarios, sizes and lenses. | Allow / Allow / Allow |
| `page_screenshot` | Render a target privately and capture its image. | Allow / Allow / Allow |
| `page_console` | Read a private page’s console entries. | Allow / Allow / Allow |
| `page_snapshot` | Read a private page’s structure and text. | Allow / Allow / Allow |
| `page_check` | Check builds, console errors and layout at selected sizes. | Allow / Allow / Allow |
| `page_inspect` | Inspect matching elements, boxes and computed styles. | Allow / Allow / Allow |
| `page_sheet` | Capture one page at several sizes. | Allow / Allow / Allow |
| `page_compare` | Compare two private targets or open page handles. | Allow / Allow / Allow |
| `page_start` | Start a private browser page for inspection or interaction. | Allow / Allow / Allow |
| `page_list` | List the MCP connection’s private page handles. | Allow / Allow / Allow |
| `page_interact` | Interact with a private page and run its project behavior. | Allow / Allow / Allow |
| `page_stop` | Close a private page handle. | Allow / Allow / Allow |
| `docs_list` | List the bundled Workbench documentation. | Allow / Allow / Allow |
| `docs_search` | Search the bundled Workbench documentation. | Allow / Allow / Allow |
| `docs_read` | Read a bundled Workbench documentation page. | Allow / Allow / Allow |

## Connection

The pack matches the stdio launch `workbench mcp serve` with exactly those arguments. It accepts the PATH command, standard Unix install paths, the extension’s macOS/Linux `~/.local/bin/workbench` link, and its Windows `workbench.cmd` launcher under the user’s `.local/bin`. A renamed MCP server can bind to the `workbench` integration. Merely naming a server Workbench grants no permissions. Extra launch arguments (including an explicit `--project`), wrapper commands, arbitrary executable paths and HTTP connections do not match this integration and require a separately reviewed connection. Executable identity and PATH remain host responsibilities.

## Limits

This is an MCP-only pack: CLI, shell and general file-tool requests remain outside its coverage. It authorizes these MCP tools’ documented effects, including saved captures and project code run for rendering and interaction. Page interaction can trigger the project’s requests. Workbench still owns schema validation, project trust, page lifetimes and resource limits; the pack allows known tool names even when arguments are missing or malformed. Other installed policies can make the effective decision stricter. Native agent approval and hook trust remain separate.

## Evidence and maintenance

Reviewed against Workbench 0.19’s `server/src/mcp/catalog.rs`, bundled documentation tools, `extension/src/modules/command-link/index.ts` and `workbench mcp serve --check`. The policy inventory and independent request fixtures are maintained separately in `scripts/workbench-policy.mjs` and `scripts/workbench-cases.mjs`. Regenerate with `node scripts/build-workbench-pack.mjs` and validate with `npm test -- --shield /absolute/path/to/shield --workbench /absolute/path/to/workbench scripts/workbench-pack.test.mjs`. Fixture validation does not establish native host or cross-platform launch acceptance.
