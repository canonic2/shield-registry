import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {destination} from './build-aws-pack.mjs';
import {shieldFor} from './pack-formats.mjs';
const read = name => JSON.parse(readFileSync(new URL(name, destination)));

test('AWS MCP separates knowledge, scripts, data, access and omitted profile gates', {skip: !process.env.SHIELD_BINARY}, t => {
  const pack = read('pack.yml');
  if (!shieldFor(pack)) return t.skip(`AWS ${pack.version} needs Shield ${pack.engines.shield}`);
  const owner = mkdtempSync(join(tmpdir(), 'shield-aws-mcp-'));
  t.after(() => rmSync(owner, {recursive: true, force: true}));
  const cases = [];
  const check = (name, profile, tool, args, expected, variables) => cases.push({name, profile, expected, ...(variables ? {variables} : {}),
    mcp: {hosted: {transport: {type: 'defaults', pack: 'canonic/aws', integration: variables?.profile ? 'hosted-profile' : 'hosted'}, agents: {codex: 'aws'}, packs: {'canonic/aws': variables?.profile ? 'hosted-profile' : 'hosted'}}},
    input: {kind: 'mcp', server: 'hosted', tool, arguments: args, original_input: {}}});
  for (const profile of ['loose', 'recommended', 'strict']) {
    const strict = profile === 'strict';
    check(`knowledge-${profile}`, profile, 'aws___search_documentation', {search_phrase: 'S3'}, 'allow');
    check(`script-${profile}`, profile, 'aws___run_script', {script: 'print(1)'}, strict ? 'deny' : 'ask');
    check(`presign-${profile}`, profile, 'aws___get_presigned_url', {}, profile === 'loose' ? 'ask' : 'deny');
    check(`tasks-${profile}`, profile, 'aws___get_tasks', {}, strict ? 'deny' : 'ask');
    check(`unknown-${profile}`, profile, 'aws___new_tool', {}, strict ? 'deny' : 'ask');
    for (const args of [{aws_profile: null}, {aws_profile: 'acme-admin'}])
      check(`profile-denied-${profile}-${cases.length}`, profile, 'aws___run_script', args, 'deny', {profile: 'acme-ro'});
    check(`profile-pass-${profile}`, profile, 'aws___run_script', {aws_profile: 'acme-ro'}, strict ? 'deny' : 'ask', {profile: 'acme-ro'});
    check(`profile-reviewed-default-${profile}`, profile, 'aws___run_script', {}, strict ? 'deny' : 'ask', {profile: 'acme-ro'});
    check(`region-unavailable-${profile}`, profile, 'aws___run_script', {region: 'us-east-1'}, 'deny', {regions: ['us-east-1']});
    check(`unknown-region-unavailable-${profile}`, profile, 'aws___new_tool', {}, 'deny', {regions: ['us-east-1']});
    check(`unknown-profile-unavailable-${profile}`, profile, 'aws___new_tool', {aws_profile: 'acme-admin'}, 'deny', {profile: 'acme-ro'});
    check(`knowledge-under-region-gate-${profile}`, profile, 'aws___list_regions', {}, 'allow', {regions: ['us-east-1']});
  }
  const path = join(owner, 'cases.json');
  writeFileSync(path, JSON.stringify({schema_version: 1, cases}));
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname, '--cases', path],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
});
