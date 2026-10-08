import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('Common allowed inspection forms work against a real isolated Git repository', async t => {
  const root = await mkdtemp(join(tmpdir(), 'shield-git-smoke-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, 'home'), repo = join(root, 'repo');
  await mkdir(home); await mkdir(repo);
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  Object.assign(env, { HOME: home, XDG_CONFIG_HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' });
  const git = args => {
    const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args], { cwd: repo, env, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
    return result.stdout;
  };
  git(['init', '--initial-branch=main', `--template=${home}`]);
  git(['config', 'user.name', 'Acme']); git(['config', 'user.email', 'developer@example.com']);
  await writeFile(join(repo, 'README.md'), '# Fixture\nTODO: review\n');
  git(['add', 'README.md']); git(['commit', '-m', 'Initial fixture']);
  const cases = JSON.parse(await readFile(new URL('../packs/canonic/git/0.2.0/cases.json', import.meta.url)));
  const commands = [
    ['status', '--short', '--branch'], ['status', '--porcelain=v2', '-z'], ['log', '--oneline', '--graph', '-n5', 'HEAD'],
    ['diff', '--cached', '--stat'], ['diff', '--no-ext-diff', '--no-textconv', '--', 'src'],
    ['grep', '-n', '-e', 'TODO', '--', 'README.md'], ['branch', '--list', 'feature/*'],
    ['config', '--get', 'user.name'], ['worktree', 'list', '--porcelain'], ['clean', '-nd'],
  ];
  for (const args of commands) {
    git(args);
    const fixture = cases.cases.find(value => value.profile === 'strict' && JSON.stringify(value.argv) === JSON.stringify(['git', ...args]));
    assert.equal(fixture?.expected, 'allow', args.join(' '));
  }
  assert.equal(git(['status', '--porcelain']), '');
});
