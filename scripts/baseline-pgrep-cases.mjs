const profiles = ['loose', 'recommended', 'strict'];
const listingCases = new Set(profiles.map(profile => `pgrep-list-full-${profile}`));
const pattern = 'install-workbench|workbench_server|cargo build.*release|rustc|ld64';

export function updatePgrepCases(cases) {
  const retained = cases.map(entry => listingCases.has(entry.name) ? {...entry, expected: 'deny'} : entry);
  const additions = [
    ['pgrep-build-pids', ['pgrep', '-f', pattern], 'allow'],
    ['pgrep-build-listing', ['pgrep', '-fl', pattern], 'deny'],
    ['pgrep-reverse-listing', ['/usr/bin/pgrep', '-lf', pattern], 'deny'],
    ['pgrep-split-listing', ['/bin/pgrep', '-f', '-l', pattern], 'deny'],
    ['pgrep-filtered-listing', ['pgrep', '-u', 'acme', '-nfl', pattern], 'deny'],
    ['pgrep-flag-as-pattern', ['pgrep', '-f', '--', '-l'], 'allow'],
    ['pgrep-flag-as-delimiter', ['pgrep', '-f', '-d', '-l', pattern], 'allow'],
    ['pgrep-name-only-listing', ['pgrep', '-l', 'compiler'], 'ask'],
    ['pgrep-count-with-listing', ['pgrep', '-cfl', pattern], 'ask'],
    ['pgrep-listing-with-pidfile', ['pgrep', '-fl', '-F', 'server.pid', pattern], 'ask'],
    ['pgrep-listing-without-pattern', ['pgrep', '-fl'], 'ask'],
    ['other-command-with-listing-flags', ['acme-pgrep', '-fl', pattern], 'ask'],
  ];
  return [...retained, ...profiles.flatMap(profile => additions.map(([name, argv, expected]) =>
    ({name: `${name}-${profile}`, profile, argv, expected})))];
}
