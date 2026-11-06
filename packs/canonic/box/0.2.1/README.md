# Box permissions 0.2.1

Requires Shield `>=0.20.0, <1.0.0`.

Preserves [0.2.0](../0.2.0/README.md) and adds the short bundled documentation
tool names: `docs_list`, `docs_search` and `docs_read`. Legacy names and server
binding checks remain supported. No other operation changes its decision.

Generate with `node scripts/build-docs-tool-packs.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/docs-tool-packs.test.mjs`.
