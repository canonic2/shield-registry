# Baseline permissions 0.10.0

Supports Shield `>=0.2.0, <1.0.0`.

## Process metadata

Every profile allows `ps` (also `/bin/ps` and `/usr/bin/ps`) with both
`-p` and `-o`. PID selectors accept any positive decimal PID or comma-separated
list of positive PIDs. Output accepts any order and combination of `pid`,
`ppid`, `pgid`, `uid`, `gid`, `comm`, `stat`, `state`, `etime`,
`time`, `pcpu`, `pmem`, `rss` and `vsz`, separated by commas, spaces
or tabs. An empty heading (`pid=`) is supported. Both options may repeat;
every PID and output field must satisfy the same grammar. Attached short-option
values are supported, and the options may appear in either order.

For example, `ps -p 123 -o pid,ppid,comm` and
`ps -o 'comm pid etime' -p 7,89` inspect metadata. These PIDs are examples;
the rule contains no project paths or fixed process IDs. `comm` displays the
executable name (or path, depending on the host), without its arguments. Process
metadata can describe processes outside the current project; PID selection does
not prove project ownership. The host still controls which processes are visible.

Full command lines (`command`, `args`), environment output, default output
without `-o`, additional default columns through `-O`, unrestricted process
selection and unknown options or fields ask for approval. Command arguments and
environments can contain credentials. The rule uses the shared short options on
macOS/BSD and Linux; each host decides which listed metadata fields it supports.

Other permissions and fixtures match [0.9.0](../0.9.0/README.md).

Generate with `node scripts/build-baseline-process-metadata.mjs`.
Requested validation uses
`npm test -- --shield /absolute/path/to/shield scripts/baseline-process-metadata.test.mjs`.
The focused suite includes additional adversarial process fixtures across all
three profiles. Published previous releases retain their original bytes.

Licensed under MIT.
