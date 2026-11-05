// Reviewed Gate CLI and MCP command data, from `gate --help` for every
// subcommand and the published MCP tool schemas of gate 0.x.
export const gate = {
  name: 'gate', title: 'Gate', version: '0.1.0', engine: '>=0.18.0, <1.0.0',
  description: 'Gate repository inspection, staging, commits and worktrees, with separate decisions for remotes, history rewrites, branch deletion and workspace policy acceptance.',
  leading: {flags: ['--json'], values: ['--project']},
  // `make install-local` and per-user installs put gate in ~/.local/bin, and
  // user-scope `gate mcp setup` registers that absolute path.
  homeInstall: '.local/bin',
  extraCapabilities: ['regex-v1', 'argument-paths-v1', 'requirements-v1'],
  shortOptions: {flags: ['-A', '-f', '-S'], values: ['-r', '-m', '-c', '-C', '-b']},
  commands: [
    [['status'], 'inspect', 'Show each repository\'s changes and unassigned files.'],
    [['diff'], 'inspect', 'Show a repository\'s working or staged diff.'],
    [['explain'], 'inspect', 'Show which repository owns, excludes or ignores paths.'],
    [['check'], 'inspect', 'Validate an index or new commits without changing them.'],
    [['doctor'], 'inspect', 'Report workspace, repository, hook and remote problems.'],
    [['branch', 'list'], 'inspect', 'List local branches and where they are checked out.'],
    [['remote', 'show'], 'inspect', 'Show a remote binding.'],
    [['session', 'status'], 'inspect', 'Show an isolated session and its policy drift.'],
    [['worktree', 'list'], 'inspect', 'List combined worktrees.'],
    [['worktree', 'status'], 'inspect', 'Inspect a worktree\'s binding and preparation.'],
    [['add'], 'routine', 'Stage owned files in a repository\'s index.', [
      {id: 'force', any: ['--force', '-f'], category: 'change', reason: 'Stage files the repository\'s ignore rules skip, which can include local secrets and build output.'}]],
    [['apply'], 'routine', 'Stage a patch\'s changes in a repository\'s index; working files are not written.'],
    [['commit'], 'routine', 'Commit staged changes after Gate validates them.', [
      {id: 'amend', any: ['--amend'], category: 'rewrite', reason: 'Replace the branch\'s last commit.'}]],
    [['switch'], 'change', 'Switch a repository\'s branch after checking other repositories\' files.', [
      {id: 'force-create', any: ['--force-create', '-C'], values: ['--force-create', '-C'], category: 'change', reason: 'Create or move an existing branch to another revision.'}]],
    // The new folder may be anywhere, and Gate fills it with repository files.
    // The path check ranks with the command rule, so inside the approved
    // project the routine decision stands and elsewhere its unmet Ask wins.
    [['worktree', 'add'], 'routine', 'Create a combined checkout of every repository in another folder.', [
      {id: 'folder', category: 'routine', reason: 'Create a combined checkout in a folder inside the project.',
        operandPaths: 'write', unmet: 'folder', grammar: {flags: [], values: ['-b', '--branch', '--name', '--repo-from']}}]],
    [['session', 'start'], 'routine', 'Activate an independent committed checkout; shared files are untouched.'],
    [['session', 'stop'], 'routine', 'Retain a session and restore the original entry.'],
    [['session', 'resume'], 'routine', 'Reactivate a retained session checkout.'],
    [['fetch'], 'remote', 'Fetch branches from a bound remote.'],
    [['push'], 'remote', 'Publish a branch to a bound remote.', [
      {id: 'force-with-lease', any: ['--force-with-lease'], values: ['--force-with-lease'], category: 'destroy', reason: 'Replace remote history with rewritten commits.'}]],
    [['remote', 'add'], 'remote', 'Bind the destination that fetches and pushes use.'],
    [['attach'], 'change', 'Attach a fetched commit as the repository\'s checked-out history.'],
    [['branch', 'remove'], 'change', 'Delete local branches whose commits other refs keep.', [
      {id: 'force', any: ['--force', '-f'], category: 'destroy', reason: 'Delete branches whose commits nothing else keeps.'}]],
    [['session', 'promote'], 'change', 'Adopt a session\'s validated history into its branch.'],
    [['session', 'remove'], 'inspect', 'Plan deleting a stopped session and list work found only there.', [
      {id: 'confirm', any: ['--confirm'], values: ['--confirm'], category: 'destroy', reason: 'Delete a stopped session, including work found only there.'}]],
    [['worktree', 'remove'], 'inspect', 'Plan removing a clean worktree.', [
      {id: 'confirm', any: ['--confirm'], values: ['--confirm'], category: 'change', reason: 'Remove a clean worktree folder; its branches and source remain.'}]],
    [['worktree', 'repair'], 'inspect', 'Review refreshed directory identities for a worktree.', [
      {id: 'confirm', any: ['--confirm'], values: ['--confirm'], category: 'change', reason: 'Rewrite a worktree\'s recorded directory identities.'}]],
    [['relocate'], 'inspect', 'Review rebinding a moved workspace or worktree.', [
      {id: 'confirm', any: ['--confirm'], values: ['--confirm'], category: 'change', reason: 'Rebind a moved workspace and its worktrees.'}]],
    [['recover'], 'change', 'Resolve an interrupted staging, commit, attachment or acceptance.'],
    [['init'], 'change', 'Create repositories from an existing gate.yml and sync them.'],
    [['sync'], 'inspect', 'Report what applying gate.yml would change.', [
      {id: 'apply', forbid: ['--dry-run'], category: 'integration', reason: 'Accept a changed gate.yml and apply its repository, hook and exclude changes.'}]],
    [['migrate'], 'inspect', 'Plan adoption of ordinary .git directories.', [
      {id: 'apply', any: ['--apply', '--recover'], category: 'integration', reason: 'Adopt or restore repository metadata.'}]],
    [['mcp', 'serve'], 'stream', 'Serve MCP over standard input until it closes.'],
    [['mcp', 'setup'], 'inspect', 'Inspect agent MCP registrations.', [
      {id: 'apply', forbid: ['--dry-run'], category: 'integration', reason: 'Change agent MCP registrations after a terminal review.'}]],
  ],
  workspaceSelector: {option: '--project', field: '/project'},
  exacts: [[['mcp', 'serve', '--check'], 'inspect', 'Print the MCP server identity and tool names without serving.']],
  mcpTools: {
    status: ['inspect', 'Show repository changes.'],
    diff: ['inspect', 'Show a diff.'],
    explain: ['inspect', 'Show path ownership.'],
    check: ['inspect', 'Validate an index or commits.'],
    doctor: ['inspect', 'Report problems.'],
    branch_list: ['inspect', 'List local branches.'],
    remote_show: ['inspect', 'Show a remote binding.'],
    session_status: ['inspect', 'Show an isolated session.'],
    worktree_list: ['inspect', 'List worktrees.'],
    worktree_status: ['inspect', 'Inspect a worktree.'],
    gate_docs_list: ['inspect', 'List bundled documentation.'],
    gate_docs_read: ['inspect', 'Read bundled documentation.'],
    gate_docs_search: ['inspect', 'Search bundled documentation.'],
    add: ['routine', 'Stage owned files.', [
      {id: 'force', fields: {'/force': {exact: true}}, category: 'change', reason: 'Stage files the ignore rules skip.'}]],
    apply: ['routine', 'Stage a patch in the index.'],
    commit: ['routine', 'Commit staged changes.', [
      {id: 'amend', fields: {'/amend': {exact: true}}, category: 'rewrite', reason: 'Replace the branch\'s last commit.'}]],
    switch: ['change', 'Switch a branch.', [
      {id: 'force-create', fields: {'/force_create': {text: {not: {exact: ''}}}}, category: 'change', reason: 'Create or move an existing branch.'}]],
    // MCP rules cannot observe the filesystem, so only the in-project task
    // folder form is routine; any other path asks.
    worktree_add: ['folder', 'Create a combined worktree in another folder.', [
      {id: 'task-folder', fields: {'/path': {text: {regex: '\\.gate/tasks/[A-Za-z0-9_][A-Za-z0-9_.-]*'}}}, category: 'routine', reason: 'Create a combined worktree under .gate/tasks.'}]],
    session_start: ['routine', 'Start an isolated session.'],
    session_stop: ['routine', 'Stop an isolated session, retaining it.'],
    session_resume: ['routine', 'Resume a retained session.'],
    fetch: ['remote', 'Fetch from a bound remote.'],
    push: ['remote', 'Publish a branch.', [
      {id: 'force-with-lease', fields: {'/force_with_lease': {text: {not: {exact: ''}}}}, category: 'destroy', reason: 'Replace remote history.'}]],
    remote_add: ['remote', 'Bind a remote destination.'],
    attach: ['change', 'Attach a fetched commit.'],
    branch_remove: ['change', 'Delete branches whose commits other refs keep.', [
      {id: 'force', fields: {'/force': {exact: true}}, category: 'destroy', reason: 'Delete branches whose commits nothing else keeps.'}]],
    session_promote: ['change', 'Adopt a session\'s history.'],
    session_remove: ['destroy', 'Delete a stopped session, including work found only there.'],
    worktree_remove: ['change', 'Remove a clean worktree.'],
    worktree_repair: ['change', 'Rewrite worktree directory identities.'],
    recover: ['change', 'Resolve an interrupted operation.'],
    init: ['change', 'Create repositories from gate.yml.'],
    sync: ['integration', 'Accept and apply gate.yml.', [
      {id: 'dry-run', fields: {'/dry_run': {exact: true}}, category: 'inspect', reason: 'Report what applying gate.yml would change.'}]],
    migrate: ['inspect', 'Plan adoption of .git directories.', [
      {id: 'apply', fields: {'/apply': {exact: true}}, category: 'integration', reason: 'Adopt repository metadata.'},
      {id: 'recover', fields: {'/recover': {exact: true}}, category: 'integration', reason: 'Restore repository metadata.'}]],
  },
};
