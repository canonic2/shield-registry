// Extend the address grammar for every modeled sed operation together.
// The Shield file-effects parser remains responsible for the actual targets.
const numeric = String.raw`(?:(?:[0-9]+|\$)(?:,(?:[0-9]+|\$))?)?`;
const item = String.raw`(?:[0-9]+|\$|/(?:[^/\\\n]|\\[^\n])*/[IM]*)`;
const addressed = String.raw`(?:${item}[ \t]*(?:,[ \t]*${item}[ \t]*)?!?[ \t]*)?`;
export const sedAddressRules = ['stdin-sed-read', 'read-sed', 'edit-sed', 'edit-sed-gnu', 'write-sed'];

export function addSedAddresses(pack) {
  for (const id of sedAddressRules) {
    const rule = pack.rules.find(rule => rule.id === id);
    const prefix = rule.conditions.arguments.prefix[0];
    if (!prefix.regex.includes(numeric)) throw Error(`Missing inherited sed address grammar: ${id}`);
    prefix.regex = prefix.regex.replaceAll(numeric, addressed);
    if (prefix.regex.length > 4096) throw Error(`Sed pattern exceeds policy limit: ${id}`);
  }
  pack.rules.find(rule => rule.id === 'review-sed').guidance.message =
    'Supported sed reads, in-place edits and file writes use numeric or slash-delimited regex addresses and ranges and are decided by path. Blocks, execution and unmodeled script forms need review.';
  return pack;
}

export function sedAddressCases() {
  const fixtures = [];
  for (const profile of ['loose', 'recommended', 'strict']) {
    const write = profile === 'strict' ? 'ask' : 'allow';
    for (const [name, argv, expected] of [
      ['range', ['sed', '-n', '/^  rabbitmq:/,/^  redis:/p', 'README.md'], 'allow'],
      ['single', ['sed', '-n', '/acme/p', 'README.md'], 'allow'],
      ['stdin', ['sed', '-n', '/start/,/end/p'], 'allow'],
      ['escaped', ['sed', '-n', '/path\\/name/,200!p', 'README.md'], 'allow'],
      ['flags', ['sed', '-n', '1,/end/Id', 'README.md'], 'allow'],
      ['read', ['sed', '/acme/r README.md', 'README.md'], 'allow'],
      ['write', ['sed', '/acme/w out.txt', 'README.md'], write],
      ['edit', ['sed', '-i', '', '/acme/s/a/b/', 'README.md'], write],
      ['outside', ['sed', '-n', '/acme/p', '/shield-baseline-unapproved/acme.txt'], 'deny'],
      ['credential', ['sed', '/acme/r .aws/credentials', 'README.md'], 'deny'],
      ['write-outside', ['sed', '/acme/w /shield-baseline-unapproved/out', 'README.md'], 'deny'],
      ['write-git', ['sed', '/acme/w .git/config', 'README.md'], 'deny'],
      ['execute', ['sed', '/acme/e id', 'README.md'], 'ask'],
      ['execute-after', ['sed', '/acme/p; e id', 'README.md'], 'ask'],
      ['execute-flag', ['sed', '/acme/s/a/b/e', 'README.md'], 'ask'],
      ['malformed', ['sed', '-n', '/unclosed p', 'README.md'], 'ask'],
      ['missing-end', ['sed', '-n', '/acme/,p', 'README.md'], 'ask'],
    ]) fixtures.push({name: `sed-address-${name}-${profile}`, profile, argv, expected});
  }
  return fixtures;
}
