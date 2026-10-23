// Independent expected outcomes; do not derive expectations from policy rules.
import {writeFile} from 'node:fs/promises';

const scenarios = [
  ['node-version', ['node', '--version'], ['allow', 'allow', 'allow']],
  ['npm-version', ['npm', '--version'], ['allow', 'allow', 'allow']],
  ['npx-help', ['npx', '--help'], ['allow', 'allow', 'allow']],
  ['npm-help-topic', ['npm', 'help', 'install'], ['allow', 'allow', 'allow']],
  ['metadata', ['npm', 'view', 'express', 'version'], ['allow', 'allow', 'allow']],
  ['metadata-json', ['npm', 'info', '@acme/web@5', '--json'], ['allow', 'allow', 'allow']],
  ['metadata-homebrew', ['/opt/homebrew/bin/npm', 'view', 'express', 'version'], ['allow', 'allow', 'allow']],
  ['metadata-local-bin', ['/usr/local/bin/npm', 'view', 'express', 'version'], ['allow', 'allow', 'allow']],
  ['metadata-unknown-path', ['/acme/bin/npm', 'view', 'express', 'version'], ['ask', 'ask', 'ask']],
  ['metadata-unknown-flag', ['npm', 'view', 'express', '--unknown'], ['ask', 'ask', 'ask']],
  ['metadata-registry', ['npm', 'view', 'express', '--registry=https://example.com'], ['ask', 'ask', 'deny']],
  ['metadata-global', ['npm', '-g', 'view', 'express'], ['ask', 'deny', 'deny']],
  ['metadata-empty', ['npm', 'view'], ['ask', 'ask', 'ask']],
  ['init', ['npm', 'init', '-y'], ['allow', 'allow', 'ask']],
  ['initializer', ['npm', 'init', 'express-app'], ['ask', 'ask', 'deny']],
  ['initializer-yes', ['npm', 'init', '-y', 'express-app'], ['ask', 'ask', 'deny']],
  ['test', ['npm', 'test'], ['ask', 'ask', 'ask']],
  ['test-arguments', ['npm', 'test', '--', '--runInBand'], ['ask', 'ask', 'ask']],
  ['dev-server', ['npm', 'run', 'dev', '--', '--port', '3000'], ['ask', 'ask', 'ask']],
  ['node-script', ['node', './scripts/server.mjs', '--port', '3000'], ['ask', 'ask', 'ask']],
  ['node-test', ['node', '--test', 'test/acme.test.mjs'], ['ask', 'ask', 'ask']],
  ['audit-report', ['npm', 'audit', '--omit=dev', '--json'], ['allow', 'allow', 'allow']],
  ['audit-fix', ['npm', 'audit', 'fix'], ['ask', 'ask', 'ask']],
  ['audit-registry', ['npm', 'audit', '--registry=https://example.com'], ['ask', 'ask', 'deny']],
  ['node-script-argument', ['node', 'server.js', '-e', 'literal script argument'], ['ask', 'ask', 'deny']],
  ['node-outside', ['node', '../server.js'], ['ask', 'ask', 'deny']],
  ['node-absolute', ['node', '/acme/server.js'], ['ask', 'ask', 'deny']],
  ['node-stdin', ['node', '-'], ['ask', 'ask', 'deny']],
  ['node-inline', ['node', '-e', 'console.log(1)'], ['ask', 'ask', 'deny']],
  ['node-inline-attached', ['node', '-econsole.log(1)'], ['ask', 'ask', 'deny']],
  ['node-preload', ['node', '--require', './hook.cjs', 'server.js'], ['ask', 'ask', 'deny']],
  ['node-import', ['node', '--import=./hook.mjs', 'server.js'], ['ask', 'ask', 'deny']],
  ['node-loader', ['node', '--loader', './hook.mjs', 'server.js'], ['ask', 'ask', 'deny']],
  ['node-version-preload', ['node', '--version', '--import=./hook.mjs'], ['ask', 'ask', 'deny']],
  ['unlisted-syntax-node', ['node', '--check', 'server.js'], ['ask', 'ask', 'deny']],
  ['install-express', ['npm', 'install', 'express@5'], ['allow', 'allow', 'deny']],
  ['install-ignore-scripts', ['npm', 'install', '--ignore-scripts', 'express@5'], ['allow', 'allow', 'deny']],
  ['ci', ['npm', 'ci'], ['allow', 'allow', 'deny']],
  ['install-dev', ['npm', 'i', '-DE', '@acme/web@1'], ['allow', 'allow', 'deny']],
  ['install-unknown-option', ['npm', 'install', '--force', 'express'], ['ask', 'ask', 'ask']],
  ['install-git-source', ['npm', 'install', 'git+https://example.com/acme/web.git'], ['ask', 'ask', 'ask']],
  ['install-global', ['npm', 'install', '-g', 'express'], ['ask', 'deny', 'deny']],
  ['install-global-cluster', ['npm', 'install', '-gD', 'express'], ['ask', 'deny', 'deny']],
  ['install-global-equals', ['npm', '--global=true', 'install', 'express'], ['ask', 'deny', 'deny']],
  ['install-location', ['npm', '--location=global', 'install', 'express'], ['ask', 'deny', 'deny']],
  ['install-location-separate', ['npm', '--location', 'global', 'install', 'express'], ['ask', 'deny', 'deny']],
  ['test-prefix', ['npm', '--prefix', '/acme/other', 'test'], ['ask', 'ask', 'ask']],
  ['test-prefix-attached', ['npm', 'test', '--prefix=/acme/other'], ['ask', 'ask', 'ask']],
  ['test-userconfig', ['npm', 'test', '--userconfig=/acme/npmrc'], ['ask', 'ask', 'deny']],
  ['test-script-shell', ['npm', 'test', '--script-shell=/bin/bash'], ['ask', 'ask', 'deny']],
  ['exec', ['npm', 'exec', '--', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['npx', ['npx', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['npx-no-install', ['npx', '--no-install', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['npx-package', ['npx', '--package=acme-cli', '-c', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['publish', ['npm', 'publish'], ['ask', 'ask', 'deny']],
  ['publish-dry-run', ['npm', 'publish', '--dry-run'], ['ask', 'ask', 'deny']],
  ['unpublish', ['npm', 'unpublish', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['login', ['npm', 'login'], ['ask', 'deny', 'deny']],
  ['token', ['npm', 'token', 'list'], ['ask', 'deny', 'deny']],
  ['config', ['npm', 'config', 'set', 'registry', 'https://example.com'], ['ask', 'deny', 'deny']],
  ['unknown', ['npm', 'unknown-operation'], ['ask', 'ask', 'ask']],
  ['pnpm-install', ['pnpm', 'install'], ['allow', 'allow', 'deny']],
  ['pnpm-add', ['pnpm', 'add', '-D', 'express@5'], ['allow', 'allow', 'deny']],
  ['pnpm-frozen', ['pnpm', 'install', '--frozen-lockfile'], ['allow', 'allow', 'deny']],
  ['pnpm-ignore', ['pnpm', 'install', '--ignore-scripts'], ['allow', 'allow', 'deny']],
  ['pn-alias', ['pn', 'install'], ['allow', 'allow', 'deny']],
  ['pnpm-dev-server', ['pnpm', 'run', 'dev', '--port', '3000'], ['ask', 'ask', 'ask']],
  ['pnpm-global', ['pnpm', 'add', '-g', 'express'], ['ask', 'deny', 'deny']],
  ['pnpm-directory', ['pnpm', '--dir', '/acme/other', 'install'], ['ask', 'ask', 'ask']],
  ['pnpm-directory-attached', ['pnpm', 'test', '-C/acme/other'], ['ask', 'ask', 'ask']],
  ['pnpm-exec', ['pnpm', 'exec', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['pnpm-dlx', ['pnpm', 'dlx', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['pnpx-execution', ['pnpx', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['pnx-execution', ['pnx', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['pnpm-publish', ['pnpm', 'publish'], ['ask', 'ask', 'deny']],
  ['pnpm-login', ['pnpm', 'login'], ['ask', 'deny', 'deny']],
  ['pnpm-config', ['pnpm', 'config', 'set', 'registry', 'https://example.com'], ['ask', 'deny', 'deny']],
  ['pnpm-unknown', ['pnpm', 'unknown-command'], ['ask', 'ask', 'ask']],
  ['yarn-install', ['yarn', 'install'], ['allow', 'allow', 'deny']],
  ['yarnpkg-install', ['yarnpkg', 'install'], ['allow', 'allow', 'deny']],
  ['yarn-immutable', ['yarn', 'install', '--immutable'], ['allow', 'allow', 'deny']],
  ['yarn-frozen', ['yarn', 'install', '--frozen-lockfile'], ['allow', 'allow', 'deny']],
  ['yarn-add', ['yarn', 'add', '--dev', 'express@5'], ['allow', 'allow', 'deny']],
  ['yarn-script', ['yarn', 'run', 'dev'], ['ask', 'ask', 'ask']],
  ['yarn-cwd', ['yarn', '--cwd', '/acme/other', 'install'], ['ask', 'ask', 'ask']],
  ['yarn-exec', ['yarn', 'exec', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['yarn-dlx', ['yarn', 'dlx', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['yarn-global', ['yarn', 'global', 'add', 'express'], ['ask', 'deny', 'deny']],
  ['yarn-publish', ['yarn', 'npm', 'publish'], ['ask', 'ask', 'deny']],
  ['yarn-login', ['yarn', 'npm', 'login'], ['ask', 'deny', 'deny']],
  ['yarn-plugin', ['yarn', 'plugin', 'import', 'acme-plugin'], ['ask', 'deny', 'deny']],
  ['yarn-config', ['yarn', 'config', 'set', 'npmRegistryServer', 'https://example.com'], ['ask', 'deny', 'deny']],
  ['yarn-implicit-script', ['yarn', 'acme-custom-script'], ['ask', 'ask', 'ask']],
  ['corepack-install', ['corepack', 'install'], ['allow', 'allow', 'deny']],
  ['corepack-npm-install', ['corepack', 'npm', 'install', 'express@5'], ['allow', 'allow', 'deny']],
  ['corepack-pnpm-install', ['corepack', 'pnpm', 'install'], ['allow', 'allow', 'deny']],
  ['corepack-yarn-install', ['corepack', 'yarn', 'install', '--immutable'], ['allow', 'allow', 'deny']],
  ['corepack-script', ['corepack', 'pnpm', 'run', 'dev'], ['ask', 'ask', 'ask']],
  ['corepack-metadata', ['corepack', 'npm', 'view', 'express', 'version'], ['allow', 'allow', 'allow']],
  ['corepack-npx', ['corepack', 'npx', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['corepack-pnpx', ['corepack', 'pnpx', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['corepack-exec', ['corepack', 'pnpm', 'exec', 'acme-cli'], ['ask', 'ask', 'deny']],
  ['corepack-global', ['corepack', 'install', '-g', 'pnpm'], ['ask', 'deny', 'deny']],
  ['corepack-enable', ['corepack', 'enable'], ['ask', 'deny', 'deny']],
  ['corepack-prepare', ['corepack', 'prepare', 'yarn@4', '--activate'], ['ask', 'deny', 'deny']],
  ['corepack-use', ['corepack', 'use', 'pnpm@9'], ['ask', 'deny', 'deny']],
  ['corepack-publish', ['corepack', 'yarn', 'npm', 'publish'], ['ask', 'ask', 'deny']],
  ['corepack-config', ['corepack', 'pnpm', 'config', 'set', 'registry', 'https://example.com'], ['ask', 'deny', 'deny']],
  ['corepack-version-override', ['corepack', 'pnpm@9', 'install'], ['ask', 'ask', 'deny']],
];
// Registry mutations must not become ordinary unlisted-script Asks in Strict.
// Expectations are independent of the generated rules, including wrong-manager
// gates, aliases and explicit Corepack dispatch.
const tagMutations = [
  ['npm-tag-add', 'npm', ['dist-tags', 'add', 'acme-package@1.0.0', 'latest']],
  ['npm-tag-remove', 'npm', ['dist-tags', 'rm', 'acme-package', 'latest']],
  ['yarn-classic-tag-add', 'yarn', ['tag', 'add', 'acme-package@1.0.0', 'latest']],
  ['yarn-classic-tag-remove', 'yarn', ['tag', 'remove', 'acme-package', 'latest']],
  ['yarn-modern-tag-add', 'yarn', ['npm', 'tag', 'add', 'acme-package@1.0.0', 'latest']],
  ['yarn-modern-tag-remove', 'yarn', ['npm', 'tag', 'remove', 'acme-package', 'latest']],
];
for (const [name, argv, decisions] of [
  ['npm-prefix-tag', ['npm', '--prefix', 'packages/web', 'dist-tags', 'add', 'acme-package@1.0.0', 'latest'], ['ask', 'ask', 'deny']],
  ['yarn-workspace-tag', ['yarn', 'workspace', '@acme/web', 'npm', 'tag', 'remove', 'acme-package', 'latest'], ['ask', 'ask', 'deny']],
  ['corepack-yarn-cwd-tag', ['corepack', 'yarn', '--cwd', 'packages/web', 'tag', 'add', 'acme-package@1.0.0', 'latest'], ['ask', 'ask', 'deny']],
  ['yarnpkg-tag', ['yarnpkg', 'npm', 'tag', 'remove', 'acme-package', 'latest'], ['ask', 'ask', 'deny']],
  ['npm-tag-list', ['npm', 'dist-tags', 'ls', 'acme-package'], ['ask', 'ask', 'ask']],
  ['npm-tag-set', ['npm', 'dist-tags', 'set', 'acme-package@1.0.0', 'latest'], ['ask', 'deny', 'deny']],
  ['yarn-classic-tag-list', ['yarn', 'tag', 'list', 'acme-package'], ['ask', 'ask', 'ask']],
  ['yarn-modern-tag-list', ['yarn', 'npm', 'tag', 'list', 'acme-package'], ['ask', 'ask', 'ask']],
  ['yarn-custom-tag-script', ['yarn', 'run', 'tag', 'add'], ['ask', 'ask', 'ask']],
  ['npm-custom-dist-tags-script', ['npm', 'run', 'dist-tags', '--', 'add'], ['ask', 'ask', 'ask']],
]) scenarios.push([name, argv, decisions]);
for (const operation of ['a', 's', 'r', 'del', 'd', 'remove']) {
  scenarios.push([`npm-tag-alias-${operation}`, ['npm', 'dist-tags', operation, 'acme-package@1.0.0', 'latest'], ['ask', 'ask', 'deny']]);
}
// Generic monorepo grammar, independent from route generation. An operation's
// effects, not the package selector or a familiar script name, decide permission.
for (const [name, argv] of [
  ['npm-prefix', ['npm', '--prefix', 'packages/web']],
  ['npm-prefix-attached', ['npm', '--prefix=packages/web']],
  ['npm-workspace', ['npm', '-w', '@acme/web']],
  ['npm-workspace-attached', ['npm', '--workspace=@acme/web']],
  ['npm-workspaces', ['npm', '--workspaces']],
  ['pnpm-dir', ['pnpm', '--dir', 'packages/web']],
  ['pnpm-dir-attached', ['pnpm', '--dir=packages/web']],
  ['pnpm-filter', ['pnpm', '--filter', '@acme/web']],
  ['pnpm-filter-attached', ['pnpm', '--filter=@acme/web']],
  ['pnpm-recursive', ['pnpm', '-r']],
  ['yarn-cwd', ['yarn', '--cwd', 'packages/web']],
  ['yarn-workspace', ['yarn', 'workspace', '@acme/web']],
]) {
  scenarios.push([`${name}-install`, [...argv, 'install'], ['allow', 'allow', 'deny']]);
  scenarios.push([`${name}-script`, [...argv, 'run', 'acme-custom'], ['ask', 'ask', 'ask']]);
  scenarios.push([`${name}-build`, [...argv, 'build'], ['ask', 'ask', 'ask']]);
  scenarios.push([`${name}-corepack-script`, ['corepack', ...argv, 'run', 'acme-custom'], ['ask', 'ask', 'ask']]);
}
const cases = scenarios.flatMap(([name, argv, decisions]) => ['loose', 'recommended', 'strict']
  .map((profile, i) => ({name: `${name}-${profile}`, profile, argv, expected: decisions[i]})));

for (const [name, manager, args] of tagMutations) {
  for (const selected of [undefined, 'npm', 'pnpm', 'yarn']) {
    for (const profile of ['loose', 'recommended', 'strict']) {
      const expected = (selected && selected !== manager) || profile === 'strict' ? 'deny' : 'ask';
      for (const corepack of [false, true]) cases.push({
        name: `${name}-${selected ?? 'unset'}-${corepack ? 'corepack' : 'direct'}-${profile}`,
        profile, ...(selected ? {variables: {package_manager: selected}} : {}),
        argv: [...(corepack ? ['corepack'] : []), manager, ...args], expected,
      });
    }
  }
}

// Independent manager-choice matrix. Family selection never grants execution.
const families = {npm: ['npm', 'npx'], pnpm: ['pnpm', 'pn', 'pnpx', 'pnx'], yarn: ['yarn', 'yarnpkg']};
for (const selected of ['npm', 'pnpm', 'yarn']) {
  for (const [family, names] of Object.entries(families)) for (const name of names) {
    for (const profile of ['loose', 'recommended', 'strict']) {
      const execution = ['npx', 'pnpx', 'pnx'].includes(name);
      const expected = family !== selected ? 'deny' : profile === 'strict' ? 'deny' : execution ? 'ask' : 'allow';
      cases.push({name: `selected-${selected}-${name}-${profile}`, profile, variables: {package_manager: selected}, argv: [name, execution ? 'acme-cli' : 'install'], expected});
      cases.push({name: `selected-${selected}-version-${name}-${profile}`, profile, variables: {package_manager: selected}, argv: [name, '--version'], expected: family === selected ? 'allow' : 'deny'});
      // Absolute forms participate in the same selection gate.
      cases.push({name: `selected-${selected}-absolute-${name}-${profile}`, profile, variables: {package_manager: selected}, argv: [`/usr/local/bin/${name}`, execution ? 'acme-cli' : 'install'], expected});
      if (['npm', 'npx', 'pnpm', 'pnpx', 'yarn', 'yarnpkg'].includes(name)) {
        cases.push({name: `selected-${selected}-corepack-${name}-${profile}`, profile, variables: {package_manager: selected}, argv: ['corepack', name, execution ? 'acme-cli' : 'install'], expected});
      }
    }
  }
  for (const profile of ['loose', 'recommended', 'strict']) for (const [name, argv, expected] of [
    ['node-version', ['node', '--version'], 'allow'],
    ['corepack-version', ['corepack', '--version'], 'allow'],
    ['corepack-unqualified', ['corepack', 'install'], 'deny'],
    ['corepack-hidden-route', ['corepack', '--', selected, 'install'], 'deny'],
    ['corepack-version-override', ['corepack', `${selected}@9`, 'install'], 'deny'],
    ['chosen-publish', [selected, 'publish'], profile === 'strict' ? 'deny' : 'ask'],
    ['chosen-global', [selected, ...(selected === 'yarn' ? ['global', 'add'] : ['install', '-g']), 'express'], profile === 'loose' ? 'ask' : 'deny'],
    ['chosen-unknown', [selected, 'acme-unknown'], 'ask'],
  ]) cases.push({name: `selected-${selected}-${name}-${profile}`, profile, variables: {package_manager: selected}, argv, expected});
}
await writeFile(new URL('../packs/canonic/node/0.1.0/cases.json', import.meta.url), JSON.stringify({schema_version: 1, cases}, null, 2) + '\n');
