// Extend the published baseline without rewriting historical artifacts.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {base64Cases} from './base64-cases.mjs';
import {addSedAddresses, sedAddressCases} from './sed-addresses.mjs';

export const previous = new URL('../packs/canonic/baseline/0.15.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.16.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
export const engine = '>=0.40.0, <1.0.0';
export const ruleId = 'transform-base64';

export async function base64Pack() {
  const pack = await read('pack.yml');
  pack.version = '0.16.0';
  pack.engines = {shield: engine};
  const readTarget = structuredClone(pack.rules.find(rule => rule.id === 'read-grep').requirements.targets);
  const writeTarget = structuredClone(pack.rules.find(rule => rule.id === 'write-tee').requirements.targets);
  // Current private runtime state is protected in addition to the retained name.
  writeTarget.all.exclude.push({root: 'write', path: '.shield/state'});
  pack.rules.push({
    id: ruleId,
    conditions: {domain: 'argv', executable: {one_of: ['base64', '/bin/base64', '/usr/bin/base64']}},
    requirements: {arguments: {kind: 'any'}, targets: [readTarget, writeTarget]},
    decision: {loose: 'allow', recommended: 'allow', strict: 'allow'},
    on_unmet: {
      decision: {loose: 'deny', recommended: 'deny', strict: 'deny'},
      message: 'Use approved input and output paths. Protected files, unresolved paths and Base64 options whose effects cannot be parsed are refused.',
      alternatives: ['COMMAND | base64 -d', 'base64 --decode FILE', 'base64 --input=FILE --output=FILE'],
    },
    reason: 'Transform Base64 data, checking every input read and output write; standard streams name no file.',
  });
  return addSedAddresses(pack);
}

export async function base64Commands() {
  const commands = await read('commands.json');
  commands.commands.push({name: 'base64', rule_ids: [ruleId], source_rule_ids: [ruleId]});
  return commands;
}

export async function base64ReleaseCases() {
  const cases = await read('cases.json');
  // Shield 0.40 verifies stable absent ripgrep operands through their existing
  // ancestors. This successor requires that engine; historical bytes stay frozen.
  const missing = cases.cases.find(fixture => fixture.name === 'rg-missing-recommended');
  if (JSON.stringify(missing?.argv) !== JSON.stringify(['rg', 'Shield', 'missing-folder']) || missing.expected !== 'deny') {
    throw Error('Review the inherited missing-path fixture before changing it');
  }
  missing.expected = 'allow';
  cases.cases.push(...base64Cases(), ...sedAddressCases());
  return cases;
}

export async function build() {
  await mkdir(destination, {recursive: true});
  for (const [name, document] of [
    ['pack.yml', await base64Pack()], ['cases.json', await base64ReleaseCases()], ['commands.json', await base64Commands()],
  ]) await writeFile(new URL(name, destination), JSON.stringify(document, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), `# Baseline permissions 0.16.0

Supports Shield \`${engine}\` with the Base64 file-effects model.

Sed's modeled commands accept numeric and slash-delimited regex addresses,
mixed ranges, escaped slashes, case/multiline address flags and address
inversion. For example, \`sed -n '/start/,/end/p' FILE\` is a read in every
profile. Named reads and writes and in-place edits keep their existing path
and profile boundaries. Execution commands and flags and unmodeled scripts
still require review. This needs the Shield build with regex-address effects.

Base64 encoding and decoding are allowed in every profile when their input and
output files are in approved locations. This includes Base64's explicit output
options; independent shell redirections retain their existing decisions.
Piped input and standard output name no
file, so \`COMMAND | base64 -d | grep PATTERN\` is allowed. Every other operation
in a pipeline retains its own decision; this permission does not execute decoded
bytes.

Shield parses GNU and macOS options, including decoding, line wrapping, input
and output files, short clusters, attached values, repeated options and \`--\`.
GNU \`-i\` ignores garbage; on macOS it names the input file. Prefer the explicit
\`--input\` form for macOS file input. File operands and input options use read
permissions; output options use write permissions. \`-\` selects the corresponding
standard stream. Outside paths, protected files, symbolic-link escapes, unknown
options and malformed arguments are refused. Windows Base64 semantics remain
unmodeled. Older Shield builds without this model refuse these forms.

Interface sources: [GNU Coreutils](https://www.gnu.org/software/coreutils/manual/html_node/base64-invocation.html)
and the macOS SDK's \`base64(1)\` / \`bintrans(1)\` manual and system utility's
\`--help\` output. This coverage does not extend to \`uudecode\` or \`bintrans\`,
whose other algorithms can derive output filenames from their input.

Other rules, profiles and cases match [0.15.0](../0.15.0/README.md).
The inherited missing-path ripgrep fixture expects the stable-absence behavior
of this release's minimum Shield engine; its command and policy are unchanged.
Strict's existing approval for shell redirection writes is retained.

Generate with \`node scripts/build-baseline-base64.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-base64.test.mjs\`.
Published previous releases retain their original bytes. This source candidate
does not activate policy in existing projects.

Licensed under MIT.
`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
