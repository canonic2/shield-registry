// Extend the published baseline with read-only loopback fetches, without
// rewriting historical artifacts.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {loopbackFetchCases} from './loopback-fetch-cases.mjs';

export const previous = new URL('../packs/canonic/baseline/0.16.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.17.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
export const engine = '>=0.49.0, <1.0.0';
export const ruleId = 'fetch-loopback';
export const capability = 'url-subdomains-v1';

export async function loopbackPack() {
  const pack = await read('pack.yml');
  pack.version = '0.17.0';
  pack.engines = {shield: engine};
  pack.capabilities = [...new Set([...pack.capabilities, capability])].sort();
  pack.rules.push({
    id: ruleId,
    conditions: {
      domain: 'web',
      action: 'fetch',
      // `localhost` with subdomains covers `*.localhost`, which resolves to
      // loopback (RFC 6761); the IP literal matches exactly. IPv6 `[::1]` URLs
      // are curl globbing syntax to Shield's recognizer and never reach here.
      url: {schemes: ['http', 'https'], hosts: ['localhost', '127.0.0.1'], subdomains: true},
      method: {one_of: ['GET', 'HEAD']},
      // A followed redirect could leave this machine without being observed.
      request_fields: {'/client': {exact: 'shell'}, '/redirects': {exact: 'none'}},
    },
    decision: {loose: 'allow', recommended: 'allow', strict: 'ask'},
    reason: 'Read local development servers on this machine with a recognized curl or wget fetch that does not follow redirects.',
  });
  return pack;
}

export async function loopbackCommands() {
  const commands = await read('commands.json');
  for (const entry of commands.commands) {
    if (['curl', 'wget'].includes(entry.name)) {
      entry.rule_ids = [...new Set([ruleId, ...entry.rule_ids])];
      entry.source_rule_ids = [...new Set([ruleId, ...entry.source_rule_ids])];
    }
  }
  return commands;
}

export async function loopbackReleaseCases() {
  const cases = await read('cases.json');
  cases.cases.push(...loopbackFetchCases());
  return cases;
}

export async function build() {
  await mkdir(destination, {recursive: true});
  for (const [name, document] of [
    ['pack.yml', await loopbackPack()], ['cases.json', await loopbackReleaseCases()], ['commands.json', await loopbackCommands()],
  ]) await writeFile(new URL(name, destination), JSON.stringify(document, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), `# Baseline permissions 0.17.0

Supports Shield \`${engine}\`.

Read-only fetches from development servers on this machine are allowed in
Loose and Recommended, and ask in Strict. They cover \`localhost\` and every
\`*.localhost\` name, such as \`http://api.acme.localhost:8080/\`, plus
\`127.0.0.1\`, over HTTP or HTTPS on any port. The fetch must be
a GET or HEAD request from a recognized curl or wget command that does not
follow redirects, for example \`curl -fsS http://localhost:3000/health\` or
\`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/ready\`.

Other forms keep their review. \`curl -L\`, and wget without
\`--max-redirect=0\`, can follow a redirect off this machine, so they ask. Other
loopback addresses such as \`127.0.0.2\` and IPv6 URLs such as
\`http://[::1]:8080/\`, whose brackets curl treats as globbing, lookalike names such as
\`localhost.example.com\`, uploads, other methods and credential options
(\`-u\`, \`-n\`) also ask. An output file named with \`-o\` or \`-O\` keeps the
existing write boundary: paths outside the approved locations and protected
files are refused. This rule applies to shell fetches only; an agent's own fetch
tool keeps its existing decision.

Other rules, profiles and cases match [0.16.0](../0.16.0/README.md).

Generate with \`node scripts/build-baseline-loopback.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-loopback.test.mjs\`.
Published previous releases retain their original bytes. This source candidate
does not activate policy in existing projects.

Licensed under MIT.
`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
