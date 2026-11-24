const rows = [
  ['version', ['rsync', '--version'], 'allow'],
  ['help', ['rsync', '--help'], 'allow'],
  ['json-version', ['rsync', '--version', '--version'], 'allow'],
  ['help-version', ['rsync', '--help', '--version'], 'allow'],
  ['system-version', ['/usr/bin/rsync', '--version'], 'allow'],
  ['bin-version', ['/bin/rsync', '--version'], 'allow'],
  ['local-version', ['/usr/local/bin/rsync', '--version'], 'allow'],
  ['brew-version', ['/opt/homebrew/bin/rsync', '--version'], 'allow'],
  ['windows-version', ['rsync.exe', '--version'], 'allow'],
  ['empty', ['rsync'], 'ask'],
  ['local-copy', ['rsync', '-a', './source/', './destination/'], 'ask'],
  ['remote-copy', ['rsync', '-a', './source/', 'host.example:/srv/'], 'ask'],
  ['remote-list', ['rsync', '--list-only', 'host.example:/srv/'], 'ask'],
  ['daemon', ['rsync', '--daemon'], 'ask'],
  ['delete', ['rsync', '--delete', './source/', './destination/'], 'ask'],
  ['dry-run', ['rsync', '-an', '--delete', './source/', 'host.example:/srv/'], 'ask'],
  ['source-removal', ['rsync', '--remove-source-files', './source/', './destination/'], 'ask'],
  ['output-before-version', ['rsync', '--log-file=/outside/log', '--version'], 'ask'],
  ['output-after-version', ['rsync', '--version', '--log-file=/outside/log'], 'ask'],
  ['destination-with-help', ['rsync', '--help', 'host.example:/srv/'], 'ask'],
  ['shell-helper', ['rsync', '--version', '-e', './helper'], 'ask'],
  ['remote-helper', ['rsync', '--rsync-path=./helper', '--help'], 'ask'],
  ['files-from', ['rsync', '--help', '--files-from=/outside/list'], 'ask'],
  ['filter', ['rsync', '--help', '--filter=merge /outside/filter'], 'ask'],
  ['password-file', ['rsync', '--version', '--password-file=/outside/password'], 'ask'],
  ['attached-value', ['rsync', '--version=example'], 'ask'],
  ['unknown-option', ['rsync', '--version', '--future-option'], 'ask'],
  ['option-terminator', ['rsync', '--', '--version'], 'ask'],
];
export function rsyncMetadataCases() {
  return ['loose', 'recommended', 'strict'].flatMap(profile => rows.map(([name, argv, expected]) =>
    ({name: `rsync-metadata-${name}-${profile}`, profile, argv, expected})));
}
