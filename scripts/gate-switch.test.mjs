import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {gateSwitchPack, gateSwitchCases, gateSwitchDirectory} from './build-gate-switch-pack.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

test('Gate engineering revision reproduces and preserves destructive boundaries', async () => {
  const pack = await gateSwitchPack();
  const cases = await gateSwitchCases();
  const read = file => JSON.parse(readFileSync(new URL(file, gateSwitchDirectory)));
  assert.deepEqual(read('pack.yml'), pack);
  assert.deepEqual(read('cases.json'), cases);
  const validate = schemaValidator(schema);
  for (const document of [pack, cases])
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  const previous = JSON.parse(readFileSync(new URL('../packs/canonic/gate/0.2.0/pack.yml', import.meta.url)));
  for (const old of previous.rules) {
    if (old.id === 'project-option') continue;
    const next = pack.rules.find(rule => rule.id === old.id);
    assert.ok(next, old.id);
    if (old.id !== 'mcp-unlisted') {
      const conditions = structuredClone(old.conditions);
      if (next.conditions.cwd?.within?.root === 'read') conditions.cwd = {within:{root:'read'}};
      assert.deepEqual(next.conditions, conditions, old.id);
    }
    if (old.decision.strict === 'deny') assert.equal(next.decision.strict, 'deny', old.id);
  }
  for (const id of ['commit-amend', 'branch-remove-force', 'push-force-with-lease'])
    assert.deepEqual(pack.rules.find(row => row.id === id).decision,
      previous.rules.find(row => row.id === id).decision, id);
});

test('Gate switches and adjacent review boundaries use production decisions', {skip: !process.env.SHIELD_BINARY}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack',
    '--pack', new URL('pack.yml', gateSwitchDirectory).pathname,
    '--cases', new URL('cases.json', gateSwitchDirectory).pathname],
  {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
});

test('Gate explicit projects and worktrees check physical paths without bypassing risky forms', {skip:!process.env.SHIELD_BINARY}, () => {
  const temporary = mkdtempSync(join(tmpdir(), 'gate-paths-'));
  const outside = mkdtempSync(join(tmpdir(), 'gate-outside-'));
  try {
    const binding = {gate:{transport:{type:'defaults', pack:'canonic/gate', integration:'gate'},
      agents:{codex:'gate'}, packs:{'canonic/gate':'gate'}}};
    const cases = [];
    const add = (name, tool, arguments_, expected, profile='recommended') => cases.push({name, profile,
      mcp:binding, input:{kind:'mcp', server:'gate', tool, arguments:arguments_, original_input:{}}, expected});
    add('read-current', 'status', {project:temporary}, 'allow');
    add('switch-current', 'switch', {project:temporary, revision:'main', force_create:'feature'}, 'allow');
    add('switch-outside', 'switch', {project:outside, revision:'main'}, 'ask');
    add('switch-relative', 'switch', {project:'.', revision:'main'}, 'ask');
    add('force-push-current', 'push', {project:temporary, remote:'origin', branch:'main', force_with_lease:'abc'}, 'deny', 'strict');
    add('force-delete-current', 'branch_remove', {project:temporary, branches:['old'], force:true}, 'deny', 'strict');
    add('worktree-current', 'worktree_add', {project:temporary, path:join(temporary,'feature'), branch:'feature'}, 'allow');
    add('worktree-outside', 'worktree_add', {path:outside, branch:'feature'}, 'ask');
    add('worktree-relative-project', 'worktree_add', {project:temporary, path:'.gate/tasks/feature', branch:'feature'}, 'ask');
    add('worktree-protected', 'worktree_add', {path:join(temporary,'.shield','feature'), branch:'feature'}, 'ask');
    add('project-protected', 'switch', {project:join(temporary,'.shield'), revision:'main'}, 'ask');
    add('worktree-removal-outside', 'worktree_remove', {path:outside}, 'ask');
    add('worktree-repair-outside', 'worktree_repair', {path:outside}, 'ask');
    if (process.platform !== 'win32') {
      symlinkSync(outside, join(temporary,'escape'));
      add('worktree-symlink-escape', 'worktree_add', {path:'escape/feature', branch:'feature'}, 'ask');
      add('project-symlink-escape', 'status', {project:join(temporary,'escape')}, 'ask');
    }
    cases.push({name:'repeated-projects', profile:'recommended', argv:['gate','--project',outside,'--project',temporary,'status'],expected:'ask'});
    const file = join(temporary,'cases.json');
    writeFileSync(file, JSON.stringify({schema_version:1,cases}));
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal','test-pack',
      '--pack',new URL('pack.yml',gateSwitchDirectory).pathname,'--cases',file],
    {cwd:temporary,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  } finally {
    rmSync(temporary,{recursive:true,force:true});
    rmSync(outside,{recursive:true,force:true});
  }
});
