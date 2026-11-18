// Independent expected decisions, shared by the artifact and its focused suite.
export function base64Cases() {
  const examples = [
    ['encode-stdin', ['base64'], 'allow'],
    ['decode-stdin', ['base64', '-d'], 'allow'],
    ['decode-upper', ['/usr/bin/base64', '-D'], 'allow'],
    ['decode-long', ['base64', '--decode'], 'allow'],
    ['stdin-explicit', ['base64', '--input=-', '--output=-'], 'allow'],
    ['encode-file', ['base64', 'README.md'], 'allow'],
    ['decode-file', ['base64', '-d', 'README.md'], 'allow'],
    ['wrap-short', ['base64', '-w0', 'README.md'], 'allow'],
    ['wrap-long', ['base64', '--wrap=76', 'README.md'], 'allow'],
    ['break-cluster', ['base64', '-db64'], 'allow'],
    ['ignore-garbage', ['base64', '--ignore-garbage', '-d'], 'allow'],
    ['input-output', ['base64', '--input=README.md', '--output=result.txt'], 'allow'],
    ['output-short', ['base64', '-d', '-oresult.txt'], 'allow'],
    ['output-separate', ['base64', '-o', 'result.txt'], 'allow'],
    ['options-after-file', ['base64', 'README.md', '--decode'], 'allow'],
    ['input-outside', ['base64', '--input=../outside'], 'deny'],
    ['operand-outside', ['base64', '../outside'], 'deny'],
    ['output-outside', ['base64', '-o../outside'], 'deny'],
    ['input-secret', ['base64', '--input=.aws/credentials'], 'deny'],
    ['input-secret-attached', ['base64', '--input=.ssh/id_ed25519'], 'deny'],
    ['output-git', ['base64', '--output=.git/config'], 'deny'],
    ['output-state', ['base64', '-o.shield/state/state.json'], 'deny'],
    ['output-cache', ['base64', '--output=.shield/cache/plan'], 'deny'],
    ['repeat-input-outside', ['base64', '--input=../outside', '--input=README.md'], 'deny'],
    ['repeat-output-outside', ['base64', '-o../outside', '-oresult.txt'], 'deny'],
    ['unknown-option', ['base64', '--unknown'], 'deny'],
    ['missing-output', ['base64', '-o'], 'deny'],
    ['missing-input', ['base64', '--input'], 'deny'],
    ['missing-wrap', ['base64', '-w'], 'deny'],
    ['invalid-count', ['base64', '--wrap=no'], 'deny'],
    ['empty-output', ['base64', '--output='], 'deny'],
    ['multiple-inputs', ['base64', 'README.md', 'LICENSE'], 'deny'],
    ['unknown-tool', ['acme-base64', '-d'], 'ask'],
  ];
  const fixtures = examples.flatMap(([name, argv, expected]) => ['loose', 'recommended', 'strict'].map(profile => ({
    name: `base64-${name}-${profile}`, profile, argv, expected,
  })));
  for (const [name, source, expected] of [
    ['log-pipeline', "jq -r .data.bytes README.md | base64 -d | grep -E 'unhealthy|error' | head -80", 'allow'],
    ['pipeline-output', "printf 'QWNtZQ==' | base64 -d > result.txt", 'allow'],
    ['pipeline-output-outside', "printf 'QWNtZQ==' | base64 -d > ../outside", 'deny'],
    ['pipeline-downstream', "printf 'QWNtZQ==' | base64 -d | acme-run", 'ask'],
  ]) for (const profile of ['loose', 'recommended', 'strict']) fixtures.push({
    name: `base64-${name}-${profile}`, profile,
    expected: name === 'pipeline-output' && profile === 'strict' ? 'ask' : expected,
    input: {kind: 'shell', source, dialect: 'bash', dialect_version: null, original_input: {}},
  });
  return fixtures;
}
