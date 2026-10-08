import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registryPage } from './registry-page.mjs';

test('Public discovery selects the latest semantic version, independent of catalog ordering', () => {
  const entry = version => ({ id: 'canonic/git', version, path: `packs/canonic/git/${version}/pack.yml` });
  const html = registryPage([entry('0.10.0'), entry('0.2.0'), entry('0.1.0')]);
  assert.ok(html.includes('packs/canonic/git/0.10.0/README.md'));
  assert.ok(!html.includes('packs/canonic/git/0.1.0/README.md'));
  assert.ok(html.includes('<html lang="en">'));
});
