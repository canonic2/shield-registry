// Independent expected decisions. Do not import policy inventories or decisions.
const allow = ['allow', 'allow', 'allow'];
const routine = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];
const change = ['ask', 'ask', 'deny'];
export function iacCases(id) {
  const executable = id === 'terraform' ? 'terraform' : 'tofu';
  const rows = [
    ['empty', [], allow], ['help', ['-help'], allow], ['help-long', ['--help'], allow],
    ['version', ['version'], allow], ['version-json', ['version', '-json'], allow],
    ['version-flag', ['-version'], allow], ['version-long', ['--version'], allow],
    ['version-operand', ['version', '/outside/state'], review],
    ['fmt', ['fmt'], routine], ['fmt-file', ['fmt', 'main.tf'], routine],
    ['fmt-dir', ['fmt', 'modules'], routine], ['fmt-check', ['fmt', '-check', '-diff'], routine],
    ['fmt-booleans', ['fmt', '-list=false', '-write=false', 'main.tf'], routine],
    ['fmt-recursive', ['fmt', '-recursive', '.'], review],
    ['fmt-recursive-implicit', ['fmt', '-recursive'], review],
    ['fmt-recursive-false', ['fmt', '-recursive=false', 'main.tf'], routine],
    ['fmt-recursive-numeric', ['fmt', '-recursive=1'], review],
    ['fmt-recursive-capital', ['fmt', '-recursive=True'], review],
    ['fmt-recursive-short-bool', ['fmt', '-recursive=t'], review],
    ['fmt-multiple', ['fmt', 'main.tf', 'modules'], routine],
    ['fmt-new-display-option', ['fmt', '-future-display', 'main.tf'], routine],
    ['fmt-stdin', ['fmt', '-'], review], ['fmt-outside', ['fmt', '/outside/main.tf'], review],
    ['fmt-parent', ['fmt', '../main.tf'], review],
    ['fmt-mixed', ['fmt', 'main.tf', '/outside/main.tf'], review],
    ['fmt-protected', ['fmt', '.shield/config.tf'], review],
    ['fmt-git', ['fmt', '.git/config.tf'], review],
    ['fmt-agent', ['fmt', '.codex/config.tf'], review],
    ['fmt-separator', ['fmt', '--', '/outside/main.tf'], review],
    ['fmt-chdir', ['-chdir=.', 'fmt', 'main.tf'], routine],
    ['fmt-chdir-operand-outside', ['-chdir=.', 'fmt', '/outside/main.tf'], review],
    ['fmt-chdir-protected', ['-chdir=.codex', 'fmt'], review],
    ['fmt-chdir-escape', ['-chdir=.', 'fmt', '../main.tf'], review],
    ['fmt-chdir-outside', ['-chdir=/outside', 'fmt'], review],
    ['fmt-chdir-split', ['-chdir', 'modules', 'fmt'], review],
    ['init', ['init'], review], ['init-backend', ['init', '-backend-config=/outside/backend.hcl'], review],
    ['init-migrate', ['init', '-migrate-state', '-force-copy'], review],
    ['get', ['get', '-update'], review], ['validate', ['validate', '-json'], review],
    ['plan', ['plan'], review], ['plan-out', ['plan', '-out=/outside/plan'], review],
    ['plan-var-file', ['plan', '-var-file=/outside/prod.tfvars'], review],
    ['plan-destroy', ['plan', '-destroy'], review],
    ['plan-no-refresh', ['plan', '-refresh=false', '-lock=false'], review],
    ['plan-invoke', ['plan', '-invoke=action.example.test'], review],
    ['console', ['console'], review], ['graph', ['graph', '-plan=/outside/plan'], review],
    ['output-json', ['output', '-json'], review], ['output-raw', ['output', '-raw', 'password'], review],
    ['show', ['show', '-json', '/outside/state'], review],
    ['providers', ['providers'], review], ['providers-schema', ['providers', 'schema', '-json'], review],
    ['providers-lock', ['providers', 'lock', '-fs-mirror=/outside'], review],
    ['providers-mirror', ['providers', 'mirror', '/outside'], review],
    ['metadata', ['metadata', 'functions', '-json'], review],
    ['state-list', ['state', 'list'], review], ['state-show', ['state', 'show', 'aws_instance.web'], review],
    ['state-pull', ['state', 'pull'], review],
    ['workspace-list', ['workspace', 'list'], review], ['workspace-show', ['workspace', 'show'], review],
    ['workspace-select', ['workspace', 'select', '-or-create', 'prod'], review],
    ['workspace-new', ['workspace', 'new', '-state=/outside/state', 'prod'], review],
    ['apply', ['apply'], change], ['apply-auto', ['apply', '-auto-approve'], change],
    ['apply-plan', ['apply', 'saved.plan'], change], ['apply-destroy', ['apply', '-destroy'], change],
    ['destroy', ['destroy', '-auto-approve'], change],
    ['test', ['test'], change], ['test-filter', ['test', '-filter=tests/main.tftest.hcl'], change],
    ['import', ['import', 'aws_instance.web', 'i-example'], change],
    ['refresh', ['refresh'], change], ['taint', ['taint', 'aws_instance.web'], change],
    ['untaint', ['untaint', 'aws_instance.web'], change],
    ['unlock', ['force-unlock', '-force', 'example-lock'], change],
    ['state-mv', ['state', 'mv', 'aws_instance.old', 'aws_instance.web'], change],
    ['state-rm', ['state', 'rm', 'aws_instance.web'], change],
    ['state-push', ['state', 'push', '-force', '/outside/state'], change],
    ['state-replace', ['state', 'replace-provider', 'example/old', 'example/new'], change],
    ['state-unknown', ['state', 'future-operation'], change],
    ['workspace-delete', ['workspace', 'delete', '-force', 'prod'], change],
    ['login', ['login', 'app.terraform.io'], change], ['logout', ['logout'], change],
    ['autocomplete', ['-install-autocomplete'], change],
    ['uninstall-autocomplete', ['-uninstall-autocomplete'], change],
    ['unknown', ['future-operation'], review], ['missing-chdir', ['-chdir'], review],
    ['repeated-chdir', ['-chdir=modules', '-chdir=/outside', 'fmt'], review],
    ['mutation-help', ['destroy', '-help'], allow],
    ['test-help', ['test', '-help'], allow], ['state-help', ['state', 'rm', '-help'], allow],
    ['help-plus-execution', ['apply', '-help', 'saved.plan'], change],
    ['global-help-mutation', ['-help', 'apply'], review],
  ];
  rows.push(...(id === 'terraform' ? [
    ['modules', ['modules', '-json'], review], ['stacks', ['stacks', 'deployment', 'apply'], change],
  ] : [
    ['env-list', ['env', 'list'], review], ['env-select', ['env', 'select', 'prod'], review],
    ['env-delete', ['env', 'delete', '-force', 'prod'], change],
    ['tofu-var', ['plan', '-var-file=values.tofuvars', '-exclude=module.legacy'], review],
  ]));
  const cases = [];
  for (const [index, profile] of ['loose', 'recommended', 'strict'].entries()) {
    for (const [label, args, expected] of rows)
      cases.push({name: `${label}-${profile}`, profile, argv: [executable, ...args], expected: expected[index]});
    // Directory selection must preserve the stronger effect classification.
    for (const prefix of [['-chdir=.'], ['-chdir', '.']])
      for (const args of [['apply', 'saved.plan'], ['destroy'], ['test'], ['state', 'rm', 'aws_instance.web'],
        ['workspace', 'delete', 'prod'], ['login']])
        cases.push({name: `chdir-${prefix.length}-${args.join('-')}-${profile}`, profile,
          argv: [executable, ...prefix, ...args], expected: prefix.length === 1 ? change[index] : 'ask'});
    for (const prefix of ['/usr/bin/', '/usr/local/bin/', '/opt/homebrew/bin/'])
      cases.push({name: `installed-${prefix.replaceAll('/', '-')}-${profile}`, profile,
        argv: [prefix + executable, 'version'], expected: 'allow'});
    for (const name of [`${executable}-evil`, `/outside/bin/${executable}`, id === 'terraform' ? 'tofu' : 'terraform'])
      cases.push({name: `unmatched-${name.replaceAll('/', '-')}-${profile}`, profile,
        argv: [name, 'version'], expected: 'ask'});
    cases.push({name: `unbound-mcp-${profile}`, profile, expected: 'ask',
      input: {kind: 'mcp', server: executable, tool: 'apply', arguments: {}, original_input: {}}});
  }
  return {schema_version: 1, cases};
}
