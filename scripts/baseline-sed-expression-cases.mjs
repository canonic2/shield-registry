export function sedExpressionCases() {
  const cases = [];
  const bsdEdit = ["sed -i ''",
    String.raw`-e '12s|pnpm, run, dev\]|node, --watch, --import, tsx, src/server.ts]|'`,
    String.raw`-e '14s|pnpm, run, dev\]|node, --watch, --import, tsx, src/server.ts]|'`,
    String.raw`-e '16s|pnpm, run, dev\]|node, --watch, --import, tsx, src/server.ts]|'`,
    String.raw`-e '18s|\[pnpm, run, dev\]|[node, --watch, --import, tsx, src/server.ts]|'`,
    String.raw`-e '20s|\[pnpm, run, dev\]|[node, --watch, --import, tsx, src/server.ts]|'`,
    'README.md',
  ].join(' ');
  for (const profile of ['loose', 'recommended', 'strict']) {
    cases.push({name: `sed-expressions-bsd-edit-${profile}`, profile,
      expected: profile === 'strict' ? 'ask' : 'allow',
      input: {kind: 'shell', source: bsdEdit, dialect: 'bash', dialect_version: null, original_input: {}},
    });
    for (const [name, argv, expected] of [
      ['read', ['sed', '-n', '-e1p', '-e', '/start/,/end/p', 'README.md'], 'allow'],
      ['execute', ['sed', '-i', '', '-e', '1p', '-e', 's/a/b/e', 'README.md'], 'ask'],
      ['script-file', ['sed', '-i', '', '-e', 's/a/b/', '-f', 'extra.sed', 'README.md'], 'ask'],
      ['named-write-outside', ['sed', '-i', '', '-e', '1p', '-e', 'w /shield-baseline-unapproved/out', 'README.md'], 'deny'],
      ['named-read-protected', ['sed', '-e', '1p', '-e', 'r .aws/credentials', 'README.md'], 'deny'],
    ]) cases.push({name: `sed-expressions-${name}-${profile}`, profile, argv, expected});
  }
  cases.push(
    {name: 'sed-expressions-gnu-edit', profile: 'recommended', expected: 'allow',
      argv: ['sed', '-e', '1s/a/b/', '--in-place', '-e', '2s/c/d/', 'README.md']},
    {name: 'sed-expressions-stdin', profile: 'strict', expected: 'allow',
      argv: ['sed', '-n', '-e', '1p', '-e', '$p']},
  );
  return cases;
}
