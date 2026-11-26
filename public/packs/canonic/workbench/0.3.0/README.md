# Workbench permission pack

Pack `canonic/workbench@0.3.0`. Requires Shield `>=0.55.0, <1.0.0` with MCP field path checks.

Workbench MCP tools are **Allow** in Loose, Recommended and Strict on a
verified connection. The pack checks caller-named image files and output
destinations against Shield’s approved folders in every profile. The 21
current tools are listed below. Unlisted tools on the verified connection are
also **Allow**.

## Coverage

| MCP tool | Operation | Loose / Recommended / Strict |
| --- | --- | --- |
| `view_show` | Read the current canvas and its artboard targets. | Allow / Allow / Allow |
| `view_set` | Change the selected artboard in the last-used canvas. | Allow / Allow / Allow |
| `annotation_list` | Read the user’s annotations from the canvas. | Allow / Allow / Allow |
| `config_show` | List configured spaces, pages, scenarios, sizes and lenses. | Allow / Allow / Allow |
| `page_screenshot` | Capture a private page and optionally save the PNG in the project’s handoff folder. | Allow / Allow / Allow |
| `page_console` | Read a private page’s console entries. | Allow / Allow / Allow |
| `page_snapshot` | Read a private page’s structure and text. | Allow / Allow / Allow |
| `page_check` | Check builds, console errors and layout at selected sizes. | Allow / Allow / Allow |
| `page_inspect` | Inspect matching elements, boxes and computed styles. | Allow / Allow / Allow |
| `page_sheet` | Capture one page at several sizes. | Allow / Allow / Allow |
| `page_compare` | Compare two private targets or open page handles. | Allow / Allow / Allow |
| `page_start` | Start a private browser page that stays open for its MCP connection. | Allow / Allow / Allow |
| `page_list` | List the MCP connection’s private page handles. | Allow / Allow / Allow |
| `page_interact` | Interact with a private page and run its project behavior. | Allow / Allow / Allow |
| `page_stop` | Close a private page handle. | Allow / Allow / Allow |
| `image_inspect` | Read an image file’s format, size, transparency, padding and colours. | Allow for approved paths, otherwise Ask (all profiles) |
| `image_list` | Render a page privately and list how its images fit their displayed sizes. | Allow / Allow / Allow |
| `image_edit` | Edit and encode an image, with optional mask files and a save destination. | Allow for approved paths, otherwise Ask (all profiles) |
| `docs_list` | List the bundled Workbench documentation. | Allow / Allow / Allow |
| `docs_search` | Search the bundled Workbench documentation. | Allow / Allow / Allow |
| `docs_read` | Read a bundled Workbench documentation page. | Allow / Allow / Allow |

Use absolute paths for `image_inspect.file` and `image_edit.file`, every
mask’s `file`, and optional `image_edit.out`. Shield checks image inputs
against read roots and output destinations against write roots. Relative
paths require review because Workbench resolves them from the manifest’s
project, which can differ from the Shield project. Workbench writes to the
named destination when given `out` and replaces an existing output when
given `replace: true`.

## Connection

The pack matches the stdio launch `workbench mcp serve` with exactly those
arguments, as `workbench mcp setup` writes it. It accepts the PATH command,
standard Unix install paths, the extension’s macOS/Linux
`~/.local/bin/workbench` link, and its Windows `workbench.cmd` launcher
under the user’s `.local/bin`. A renamed server can bind to the
`workbench` integration. Extra launch arguments such as `--project`
or `--config`, wrapper commands, arbitrary executable paths and HTTP
connections require a separately reviewed connection. Executable identity
and PATH remain host responsibilities.

## Limits

This pack covers MCP. CLI, shell and general file tools follow other policy.
Rendering and interaction can run project code and trigger the project’s
requests. Workbench validates schemas and owns project trust, page lifetimes,
and resource limits. Other installed policies can make the effective decision
stricter. Native agent approval and hook trust remain separate.

## Evidence and maintenance

Reviewed against Workbench 0.24’s CLI, `workbench mcp serve --check`, and
native registration and launcher sources. The reviewed names, including the
bundled docs tools, remain available. There are no retirements to schedule.

Workbench’s image handlers resolve source, mask and output paths on the host
and accept absolute paths outside the manifest project. This version tightens
the image permissions from 0.2.0. Pass absolute paths inside Shield’s approved
folders to keep those requests allowed.

Regenerate with `node scripts/build-workbench-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield --workbench /absolute/path/to/workbench scripts/workbench-pack.test.mjs`.
The independent cases live in `scripts/workbench-cases.mjs`. Fixture
validation exercises the policy decisions and catalog on the validation host.
