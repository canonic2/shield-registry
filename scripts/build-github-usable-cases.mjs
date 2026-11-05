// Expected decisions are independent of the pack's profile conversion.
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const profiles = ['loose', 'recommended', 'strict'];
const allow = ['allow', 'allow', 'allow'];
const routine = ['allow', 'allow', 'ask'];
const privileged = ['allow', 'ask', 'ask'];
const destructive = ['ask', 'ask', 'deny'];
const review = ['ask', 'ask', 'ask'];
const deny = ['deny', 'deny', 'deny'];

export function usableGithubCases() {
  const cases = [];
  for (const scoped of [false, true]) {
    const add = (name, request, expected, admitted = true) => {
      for (const [i, profile] of profiles.entries()) cases.push({
        name: `${scoped ? 'scoped' : 'unscoped'}-${name}-${profile}`, profile,
        ...(scoped ? {variables: {repository: 'acme/web'}} : {}), ...request,
        expected: scoped && !admitted ? 'deny' : expected[i],
      });
    };
    for (const [name, argv, expected, admitted] of [
      ['version', ['gh', '--version'], allow],
      ['read', ['gh', 'pr', 'list', '-R', 'acme/web', '--json', 'number'], allow],
      ['create', ['gh', 'issue', 'create', '-R', 'acme/web', '--title', 'Bug'], routine],
      ['close', ['gh', 'pr', 'close', '12', '-R', 'acme/web'], routine],
      ['merge', ['gh', 'pr', 'merge', '12', '-R', 'acme/web', '--squash'], privileged],
      ['merge-leading', ['gh', '-Racme/web', 'pr', 'merge', '12', '--rebase'], privileged],
      ['merge-interleaved', ['gh', 'pr', '--repo=acme/web', 'merge', '12', '--merge'], privileged],
      ['merge-admin', ['gh', 'pr', 'merge', '12', '-R', 'acme/web', '--admin', '--squash'], privileged],
      ['merge-auto', ['gh', 'pr', 'merge', '12', '-R', 'acme/web', '--auto', '--squash'], privileged],
      ['merge-current', ['gh', 'pr', 'merge', '--squash'], privileged, false],
      ['merge-branch', ['gh', 'pr', 'merge', 'fix', '-R', 'acme/web', '--squash'], privileged, false],
      ['merge-future', ['gh', 'pr', 'merge', '12', '-R', 'acme/web', '--future'], privileged, false],
      ['merge-delete', ['gh', 'pr', 'merge', '12', '-R', 'acme/web', '--squash', '--delete-branch'], privileged],
      ['merge-delete-short', ['gh', 'pr', '-Racme/web', 'merge', '12', '-d', '--squash'], privileged, false],
      ['close-delete', ['gh', 'pr', 'close', '12', '-R', 'acme/web', '-d'], destructive],
      ['issue-delete', ['gh', 'issue', 'delete', '12', '-R', 'acme/web', '--yes'], destructive],
      ['repo-delete', ['gh', 'repo', 'delete', 'acme/web', '--yes'], destructive, false],
      ['release-delete', ['gh', 'release', '--repo=acme/web', 'delete', 'v1', '--yes'], destructive, false],
      ['repo-rename', ['gh', 'repo', 'rename', 'new', '-R', 'acme/web'], privileged, false],
      ['secret-set', ['gh', 'secret', 'set', 'EXAMPLE', '--body', 'example', '-R', 'acme/web'], privileged, false],
      ['auth-status', ['gh', 'auth', 'status'], allow],
      ['auth-token', ['gh', 'auth', 'token'], deny, false],
      ['auth-token-interleaved', ['gh', 'auth', '-Racme/web', 'token', '--hostname', 'github.com'], deny, false],
      ['auth-status-token', ['gh', 'auth', 'status', '--show-token'], deny, false],
      ['auth-status-token-extra', ['gh', 'auth', 'status', '--future', '--show-token'], deny, false],
      ['unknown', ['gh', 'future', '--option'], review, false],
      ['read-unknown-option', ['gh', 'pr', 'list', '-R', 'acme/web', '--future'], review, false],
      ['api', ['gh', 'api', 'graphql', '-f', 'query={viewer{login}}'], review, false],
      ['outside-merge', ['gh', 'pr', 'merge', '12', '-R', 'outside/web', '--squash'], privileged, false],
      ['repeated-target', ['gh', '-Routside/web', 'pr', 'merge', '12', '-R', 'acme/web', '--squash'], privileged, false],
    ]) add(name, {argv}, expected, admitted);
    for (const integration of ['hosted', 'local', 'local-read-only']) {
      const mcp = {github: {transport: {type: 'defaults', pack: 'canonic/github', integration},
        agents: {codex: 'github'}, packs: {'canonic/github': integration}}};
      for (const [name, tool, arguments_, expected, admitted] of [
        ['read', 'get_file_contents', {owner: 'acme', repo: 'web', path: 'README.md'}, allow],
        ['comment', 'add_issue_comment', {owner: 'acme', repo: 'web', issue_number: 12, body: 'Reviewed'}, routine],
        ['merge', 'merge_pull_request', {owner: 'acme', repo: 'web', pullNumber: 12}, privileged],
        ['push', 'push_files', {owner: 'acme', repo: 'web', branch: 'main', files: []}, privileged],
        ['delete', 'delete_file', {owner: 'acme', repo: 'web', path: 'old.txt'}, privileged],
        ['project-delete', 'projects_write', {owner: 'acme', project_number: 7, method: 'delete_project'}, destructive, false],
        ['project-change', 'projects_write', {owner: 'acme', project_number: 7, method: 'create_project'}, privileged, false],
        ['unknown', 'future_tool', {owner: 'acme', repo: 'web'}, review, false],
        ['outside-merge', 'merge_pull_request', {owner: 'outside', repo: 'web', pullNumber: 12}, privileged, false],
      ]) add(`mcp-${integration}-${name}`, {mcp, input: {kind: 'mcp', server: 'github', tool,
        arguments: arguments_, original_input: {}}}, expected, admitted);
    }
  }
  return cases;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await writeFile(new URL('../packs/canonic/github/0.3.0/cases.json', import.meta.url),
    JSON.stringify({schema_version: 1, cases: usableGithubCases()}, null, 2) + '\n');
