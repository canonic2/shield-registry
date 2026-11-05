// Keep published versions immutable; reuse the repository-scope predicates.
import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {configurableGithubPack} from './build-github-configurable-pack.mjs';

export const destination = new URL('../packs/canonic/github/0.3.0/', import.meta.url);
const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});
const routine = new Set(['issue-pr-create', 'issue-pr-change', 'mcp-add_issue_comment',
  'mcp-create_pull_request', 'mcp-create_branch']);
const destructive = new Set(['issue-delete', 'pr-close-delete-branch', 'review-issue-delete',
  'review-repo-delete', 'review-release-delete', 'review-release-delete-asset', 'review-run-delete',
  'review-project-delete', 'review-gist-delete', 'review-codespace-delete']);

export function usableGithubPack() {
  const pack = configurableGithubPack();
  pack.version = '0.3.0';
  pack.engines.shield = '>=0.20.0, <1.0.0';
  for (const rule of pack.rules) {
    if (rule.decision.loose === 'allow') rule.decision = profiles('allow');
    else if (routine.has(rule.id)) rule.decision = profiles('allow', 'allow', 'ask');
    else if (destructive.has(rule.id)) {
      rule.decision = profiles('ask', 'ask', 'deny');
      rule.reason = 'Delete remote resources; review the target and consequences.';
    } else if (rule.decision.recommended === 'deny'
      || ['mcp-create_or_update_file', 'mcp-push_files'].includes(rule.id)) {
      rule.decision = profiles('allow', 'ask', 'ask');
      rule.reason = 'Privileged GitHub operation; review before proceeding in Recommended or Strict.';
    } else rule.decision = profiles('ask');
  }
  const command = pack.rules.find(rule => rule.id === 'pr-merge').conditions.executable;
  const leading = {flags: [], values: ['-R', '--repo'], interleaved: true};
  pack.rules.push(
    {id: 'auth-token-disclosure', conditions: {domain: 'argv', executable: command,
      arguments: {kind: 'prefix', leading, values: ['auth', 'token']}},
    decision: profiles('deny'), reason: 'Prints a credential into agent-visible output.'},
    {id: 'auth-status-token-disclosure', conditions: {domain: 'argv', executable: command,
      arguments: {kind: 'options', prefix: ['auth', 'status'], leading,
        flags: ['--show-token'], values: ['-h', '--hostname'], operands: true,
        unknown_options: 'skip', require_any: ['--show-token']}},
    decision: profiles('deny'), reason: 'Prints credentials into agent-visible output.'},
    {id: 'mcp-delete-project', conditions: {domain: 'mcp',
      server: {one_of: ['hosted', 'local', 'local-read-only']}, tool: 'projects_write',
      fields: {'/method': {exact: 'delete_project'}}}, decision: profiles('ask', 'ask', 'deny'),
    reason: 'Delete a remote GitHub project.'},
  );
  return pack;
}

export async function buildUsableGithubPack() {
  const pack = usableGithubPack();
  await mkdir(destination, {recursive: true});
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('commands.json', destination), JSON.stringify({schema_version: 1,
    commands: [{name: 'gh', rule_ids: pack.rules.filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]}, null, 2) + '\n');
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', destination));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildUsableGithubPack();
