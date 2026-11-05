import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {reviewedCases} from './build-reviewed-profile-cases.mjs';
import {revisions} from './build-reviewed-profiles.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

const selected = {
  git: ['fetch', 'push', 'worktree-remove', 'worktree-force', 'credential-disclosure'],
  node: ['install', 'publish', 'pnpm-directory-token', 'wrong-manager'],
  rust: ['fetch', 'install', 'registry', 'protected-output'],
  aws: ['data', 'policy', 'secret', 'delete', 'required-profile', 'mcp-script', 'mcp-profile-wrong'],
  gate: ['fetch', 'push', 'push-force', 'mcp-push-project', 'mcp-push-project-force'],
  box: ['setup', 'exec', 'headers', 'cleanup', 'mcp-remove-project', 'mcp-remove-project-data'],
  testrun: ['build', 'build-environment', 'mcp-build', 'mcp-build-inline'],
};
const path = (name, file = 'pack.yml') => new URL(`../packs/canonic/${name}/${revisions[name][1]}/${file}`, import.meta.url).pathname;
function evaluate(t, name, cases, baseline) {
  const directory = mkdtempSync(join(tmpdir(), 'shield-reviewed-composition-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const file = join(directory, 'cases.json');
  writeFileSync(file, JSON.stringify({schema_version: 1, cases}));
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', path(name), '--cases', file,
    ...(baseline ? ['--with-pack', path('baseline')] : [])],
  {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
}

test('AWS MCP additions reproduce and validate against the schema', () => {
  const document = JSON.parse(readFileSync(path('aws', 'cases.json')));
  assert.deepEqual(document, {schema_version: 1, cases: reviewedCases('aws')});
  const validate = schemaValidator(schema);
  assert.equal(validate(document), true, JSON.stringify(validate.errors));
});
test('AWS MCP review retains reviewed connector profile and region boundaries', {skip: !process.env.SHIELD_BINARY}, t => {
  evaluate(t, 'aws', reviewedCases('aws').filter(row => row.mcp), false);
});
for (const [name, labels] of Object.entries(selected)) {
  test(`${name} composed with Baseline keeps legitimate work reviewable and boundaries enforced`, {skip: !process.env.SHIELD_BINARY}, t => {
    const cases = reviewedCases(name).filter(row => labels.includes(row.name.replace(/-(?:loose|recommended|strict)$/, '')));
    assert.equal(cases.length, labels.length * 3);
    evaluate(t, name, cases, true);
  });
}
