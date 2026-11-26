// Expectations describe the effects of complete invocations independently of the parser.
const routine = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];
const protectedPath = ['deny', 'deny', 'deny'];
const cargoProxy = '/acme/.cargo/bin/cargo';
const variables = {cargo_executable: cargoProxy};
const rustfmtPaths = ['/opt/rust/bin/rustfmt', '/opt/rust-dev/bin/rustfmt'];
const formatters = {rustfmt_executable: rustfmtPaths};
const profiles = ['loose', 'recommended', 'strict'];

export const rustDevelopmentCases = [
  ['rustfmt-primary-path', [rustfmtPaths[0], '--check', 'src/lib.rs'], routine, formatters],
  ['rustfmt-secondary-path', [rustfmtPaths[1], '--check', 'src/lib.rs'], routine, formatters],
  ['rustfmt-unbound-path', ['/opt/other/bin/rustfmt', '--check', 'src/lib.rs'], review, formatters],
  ['rustfmt-inline-config', [rustfmtPaths[1], '--check', '--config', 'skip_children=true', 'src/lib.rs'], review, formatters],
  ['nextest-focused-ignored', [cargoProxy, 'nextest', 'run', '--locked', '--test', 'integration', '--run-ignored', 'ignored-only', 'combined_setup_uses_scoped_reviews'], routine, variables],
  ['nextest-ignored-equals', ['cargo', 'nextest', 'run', '--run-ignored=only'], routine],
  ['nextest-leaves-selector-validation-to-tool', ['cargo', 'nextest', 'run', '--run-ignored=future-mode'], routine],
  ['nextest-libtest-filter', ['cargo', 'nextest', 'run', '--', '--ignored', '--exact', 'module::test[2]'], routine],
  ['nextest-run-options', ['cargo', 'nextest', 'run', '-j2', '--retries', '1', '--no-tests=pass', '--failure-output=final', '--no-output-indent'], routine],
  ['nextest-live-output', ['cargo', 'nextest', 'run', '--no-capture', '--cargo-quiet'], routine],
  ['nextest-list-options', ['cargo', 'nextest', 'list', '--test', 'integration', '--filterset', 'test(smoke)', '--run-ignored=all', '--list-type=binaries-only'], routine],
  ['nextest-toolchain', [cargoProxy, '+stable', 'nextest', 'run', '--run-ignored=only', '--test-threads=-2'], routine, variables],
  ['nextest-rustup-run', ['rustup', 'run', 'stable', 'cargo', 'nextest', 'run', '--run-ignored=only'], routine],
  ['nextest-coverage', ['cargo', 'llvm-cov', 'nextest', '--run-ignored=ignored-only'], routine],
  ['cargo-build-job-offset', ['cargo', 'build', '--locked', '--jobs=-1'], routine],
  ['cargo-test-default-jobs', ['cargo', 'test', '-j', 'default', '--', '--nocapture'], routine],
  ['nextest-config-override', ['cargo', 'nextest', 'run', '--run-ignored=only', '--config=build.rustc-wrapper="custom-wrapper"'], review],
  ['nextest-external-config', ['cargo', 'nextest', 'run', '--user-config-file', '/outside/nextest.toml', '--run-ignored=only'], review],
  ['nextest-debugger', ['cargo', 'nextest', 'run', '--debugger=custom-debugger', '--run-ignored=only'], review],
  ['nextest-tracer', ['cargo', 'nextest', 'run', '--tracer', 'custom-tracer', '--run-ignored=only'], review],
  ['nextest-reuse-archive', ['cargo', 'nextest', 'run', '--archive-file', '/outside/tests.tar.zst', '--run-ignored=only'], review],
  ['nextest-reuse-build', ['cargo', 'nextest', 'list', '--binaries-metadata', '/outside/binaries.json'], review],
  ['nextest-unbound-proxy', ['/acme/bin/cargo', 'nextest', 'run', '--run-ignored=only'], review, variables],
  ['nextest-protected-target-directory', [cargoProxy, 'nextest', 'run', '--run-ignored=only', '--target-dir=.shield'], protectedPath, variables],
  ['nextest-outside-manifest', ['cargo', 'nextest', 'list', '--run-ignored=only', '--manifest-path=/outside/Cargo.toml'], protectedPath],
  ['nextest-outside-target-spec', ['cargo', '+stable', 'nextest', 'run', '--target=/outside/custom.json', '--run-ignored=only'], protectedPath],
  ['nextest-outside-coverage-output', ['cargo', 'llvm-cov', 'nextest', '--run-ignored=only', '--output-path=/outside/report.json'], protectedPath],
].flatMap(([name, argv, outcomes, bindings]) => profiles.map((profile, index) => ({
  name: `${name}-${profile}`, profile, argv, expected: outcomes[index], ...(bindings ? {variables: bindings} : {}),
})));
