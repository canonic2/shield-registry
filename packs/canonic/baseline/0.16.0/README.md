# Baseline permissions 0.16.0

Supports Shield `>=0.40.0, <1.0.0` with the Base64 file-effects model.

Sed's modeled commands accept numeric and slash-delimited regex addresses,
mixed ranges, escaped slashes, case/multiline address flags and address
inversion. For example, `sed -n '/start/,/end/p' FILE` is a read in every
profile. Named reads and writes and in-place edits keep their existing path
and profile boundaries. Execution commands and flags and unmodeled scripts
still require review. This needs the Shield build with regex-address effects.

Base64 encoding and decoding are allowed in every profile when their input and
output files are in approved locations. This includes Base64's explicit output
options; independent shell redirections retain their existing decisions.
Piped input and standard output name no
file, so `COMMAND | base64 -d | grep PATTERN` is allowed. Every other operation
in a pipeline retains its own decision; this permission does not execute decoded
bytes.

Shield parses GNU and macOS options, including decoding, line wrapping, input
and output files, short clusters, attached values, repeated options and `--`.
GNU `-i` ignores garbage; on macOS it names the input file. Prefer the explicit
`--input` form for macOS file input. File operands and input options use read
permissions; output options use write permissions. `-` selects the corresponding
standard stream. Outside paths, protected files, symbolic-link escapes, unknown
options and malformed arguments are refused. Windows Base64 semantics remain
unmodeled. Older Shield builds without this model refuse these forms.

Interface sources: [GNU Coreutils](https://www.gnu.org/software/coreutils/manual/html_node/base64-invocation.html)
and the macOS SDK's `base64(1)` / `bintrans(1)` manual and system utility's
`--help` output. This coverage does not extend to `uudecode` or `bintrans`,
whose other algorithms can derive output filenames from their input.

Other rules, profiles and cases match [0.15.0](../0.15.0/README.md).
The inherited missing-path ripgrep fixture expects the stable-absence behavior
of this release's minimum Shield engine; its command and policy are unchanged.
Strict's existing approval for shell redirection writes is retained.

Generate with `node scripts/build-baseline-base64.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/baseline-base64.test.mjs`.
Published previous releases retain their original bytes. This source candidate
does not activate policy in existing projects.

Licensed under MIT.
