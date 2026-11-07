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

test('Landing page size follows pack count rather than retained version count', () => {
  const entries = ['git','node'].flatMap(name => Array.from({length:200}, (_, i) => ({
    id:`canonic/${name}`, version:`0.${i}.0`, path:`packs/canonic/${name}/0.${i}.0/pack.yml`,
  }))).reverse();
  const html = registryPage(entries);
  assert.equal((html.match(/<tr><td>/g) ?? []).length, 2);
  for (const name of ['git','node']) {
    assert.ok(html.includes(`packs/canonic/${name}/0.199.0/README.md`));
    assert.ok(!html.includes(`packs/canonic/${name}/0.198.0/README.md`));
  }
});
