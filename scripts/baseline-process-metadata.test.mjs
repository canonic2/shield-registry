import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {destination, previous, processMetadataPack, processMetadataCases, processMetadataCommands} from './build-baseline-process-metadata.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor} from './pack-formats.mjs';

const read = (name, directory = destination) => JSON.parse(readFileSync(new URL(name, directory)));
const compatibleShield = shieldFor(read('pack.yml'));

test('Baseline process metadata release is reproducible and preserves previous rules and cases', async () => {
  const pack = read('pack.yml');
  assert.deepEqual(pack, await processMetadataPack());
  assert.deepEqual(read('cases.json'), await processMetadataCases());
  assert.deepEqual(read('commands.json'), await processMetadataCommands());
  assert.deepEqual(pack.rules.slice(0, -2), read('pack.yml', previous).rules);
  const oldCases = read('cases.json', previous).cases;
  assert.deepEqual(read('cases.json').cases.slice(0, oldCases.length), oldCases);
  const validate = schemaValidator(schema);
  for (const name of ['pack.yml', 'cases.json']) {
    assert.equal(validate(read(name)), true, JSON.stringify(validate.errors));
  }
});

// Independent argv expectations: no fixed PID or field combination in policy.
const allowed = [
  ['ps', '-p', '1', '-o', 'comm'],
  ['/bin/ps', '-p', '54321', '-o', 'pid,ppid,comm'],
  ['/usr/bin/ps', '-o', 'comm,pid,etime', '-p', '7,89'],
  ['ps', '-p7,89', '-opid,comm'],
  ['ps', '-p', '1', '-p', '222', '-o', 'pid', '-o', 'comm'],
  ['ps', '-p', '1', '-o', 'pid=', '-o', 'comm='],
  ['ps', '-p', '9', '-o', 'comm pid\tppid'],
  ['ps', '-o', 'vsz,rss,pmem,pcpu,time,etime,state,stat,comm,gid,uid,pgid,ppid,pid', '-p', '3'],
  ['ps', '-p', '1', '-o', 'comm', '--'],
];
const reviewed = [
  ['ps'], ['ps', '-p', '123'], ['ps', '-o', 'pid,comm'],
  ['ps', '-p', '123', '-o', 'pid,ppid,command'],
  ['ps', '-p', '123', '-o', 'args'],
  ['ps', '-p', '123', '-o', 'comm,args'],
  ['ps', '-p', '123', '-o', 'pid', '-o', 'command'],
  ['ps', '-p', '123', '-o', 'command', '-o', 'comm'],
  ['ps', '-p', '123', '-o', 'comm=command'],
  ['ps', '-p', '123', '-o', 'comm,command='],
  ['ps', '-p', '123', '-o', 'command=', '-o', 'comm='],
  ['ps', '-p', '123', '-o', 'comm\ncommand'],
  ['ps', '-p', '123', '-o', 'comm', '-E'],
  ['ps', 'e', '-p', '123', '-o', 'comm'],
  ['ps', 'aux'], ['ps', 'auxe'], ['ps', '-ef'],
  ['ps', '-p', '123', '-o', 'comm', '-f'],
  ['ps', '-p', '123', '-O', 'comm'],
  ['ps', '-A', '-o', 'comm'],
  ['ps', '-p', '123', '-o', 'comm', '-A'],
  ['ps', '-p', '0', '-o', 'comm'],
  ['ps', '-p', '-1', '-o', 'comm'],
  ['ps', '-p', '1,0', '-o', 'comm'],
  ['ps', '-p', '1,', '-o', 'comm'],
  ['ps', '-p', '1', '-p', 'other', '-o', 'comm'],
  ['ps', '-p', '1', '-o', ''],
  ['ps', '-p', '1', '-o', 'comm', 'command'],
  ['ps', '-p', '1', '--', '-o', 'comm'],
  ['ps', '--pid=1', '--format=comm'],
  ['ps', '-p', '1', '-o', 'comm', '--unknown'],
];

function evaluate(cases) {
  const directory = mkdtempSync(join(tmpdir(), 'shield-process-metadata-'));
  try {
    const path = join(directory, 'cases.json');
    writeFileSync(path, JSON.stringify({schema_version: 1, cases}));
    const result = spawnSync(compatibleShield, ['__internal', 'test-pack', '--pack',
      new URL('pack.yml', destination).pathname, '--cases', path],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
  } finally { rmSync(directory, {recursive: true, force: true}); }
}

test('Baseline permits generic PID metadata and reviews argument/environment exposure in every profile',
  {skip: !compatibleShield}, () => {
    const cases = [];
    for (const profile of ['loose', 'recommended', 'strict']) {
      for (const [expected, commands] of [['allow', allowed], ['ask', reviewed]]) {
        for (const [index, argv] of commands.entries()) {
          cases.push({name: `ps-${expected}-${index}-${profile}`, profile, argv, expected});
        }
      }
    }
    evaluate(cases);
  });

test('Baseline process release retains the complete previous fixture suite', {skip: !compatibleShield}, () => {
  evaluate(read('cases.json').cases);
});
