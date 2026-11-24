// Independent expected behavior. Do not import policy inventories/classifiers.
const allow = ['allow', 'allow', 'allow'];
const routine = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'deny'];
const destroy = ['ask', 'deny', 'deny'];
const ask = ['ask', 'ask', 'ask'];
const rows = [];
const operations = {
  xcodebuild: ['build -scheme Acme', 'build-for-testing -scheme Acme', 'test -scheme Acme',
    'test-without-building -xctestrun build/Acme.xctestrun', 'analyze -scheme Acme', 'archive -archivePath build/Acme.xcarchive',
    'install', 'installsrc', 'clean', '-list -project Acme.xcodeproj', '-showBuildSettings -scheme Acme',
    '-showBuildSettingsForIndex -scheme Acme', '-showdestinations -scheme Acme', '-showTestPlans -scheme Acme',
    '-resolvePackageDependencies', '-exportArchive -archivePath build/Acme.xcarchive -exportPath dist -exportOptionsPlist Export.plist',
    '-exportNotarizedApp -archivePath build/Acme.xcarchive -exportPath dist', '-exportLocalizations -localizationPath localizations',
    '-importLocalizations -localizationPath localizations', '-create-xcframework -framework build/Acme.framework -output dist/Acme.xcframework',
    '-downloadPlatform iOS', '-downloadAllPlatforms', '-importPlatform runtime.dmg',
    '-downloadComponent MetalToolchain', '-importComponent MetalToolchain -importPath fixtures/toolchain',
    '-deleteComponent MetalToolchain', '-showComponent MetalToolchain', '-prepareDeviceSupport', '-runFirstLaunch', '-license accept'],
  'xcode-select': ['--switch /outside/Xcode.app', '--reset', '--install'],
  simctl: ['addmedia booted fixtures/photo.png', 'appinfo booted com.example.acme', 'boot ExampleDevice',
    'clone ExampleDevice AcmeClone', 'create AcmeTest com.apple.CoreSimulator.SimDeviceType.iPhone-17', 'diagnose',
    'get_app_container booted com.example.acme data', 'getenv booted EXAMPLE_TOKEN', 'icloud_sync booted',
    'install booted build/Acme.app', 'io booted screenshot captures/screen.png', 'keychain booted reset',
    'launch booted com.example.acme', 'listapps booted', 'location booted set 0,0', 'logverbose booted enable',
    'openurl booted https://example.com', 'pair WatchDevice PhoneDevice', 'pair_activate ExamplePair',
    'pbcopy booted', 'pbpaste booted', 'pbsync booted', 'personalization help', 'privacy booted grant all com.example.acme',
    'push booted com.example.acme fixtures/push.json', 'rename ExampleDevice AcmeTest', 'runtime add runtime.dmg',
    'runtime verify ExampleRuntime', 'runtime scan-and-mount', 'runtime match set iphoneos26.3 ExampleRuntime',
    'runtime dyld_shared_cache update ExampleRuntime', 'shutdown all', 'spawn booted sh -c true',
    'status_bar booted clear', 'terminate booted com.example.acme', 'ui booted appearance dark', 'unpair ExamplePair',
    'upgrade ExampleDevice ExampleRuntime'],
  devicectl: ['diagnose --archive-destination reports/diagnostic.zip', 'device copy to --device ExampleDevice --source fixtures/data --destination data',
    'device copy from --device ExampleDevice --source data --destination captures/data',
    ...['appIcon', 'apps', 'authListing', 'ddiServices', 'details', 'displays', 'files', 'lockState', 'processes']
      .map(name => `device info ${name} --device ExampleDevice`),
    'device install app --device ExampleDevice build/Acme.app',
    ...['launch', 'resume', 'sendMemoryWarning', 'signal', 'suspend', 'terminate'].map(name => `device process ${name} --device ExampleDevice`),
    'device notification post --device ExampleDevice com.example.acme.changed',
    'device notification observe --device ExampleDevice com.example.acme.changed',
    ...['get', 'rotate', 'set'].map(name => `device orientation ${name} --device ExampleDevice`),
    'device reboot --device ExampleDevice', 'device sysdiagnose --device ExampleDevice',
    'manage ddis update', 'manage loggingProfile register', 'manage pair --device ExampleDevice'],
  xctrace: ['record --template TimeProfiler --output traces/acme.trace --launch -- build/Acme',
    'import --input captures/data --output traces/acme.trace', 'export --input traces/acme.trace --output reports/trace.xml',
    'remodel --input traces/acme.trace', 'symbolicate --input traces/acme.trace --dsym build/Acme.dSYM', 'list devices'],
  swift: ['build', 'test', 'run Acme', 'repl',
    'package add-dependency https://example.com/acme.git', 'package add-product Acme', 'package add-target Acme',
    'package add-target-dependency Library Acme', 'package add-setting Acme', 'package experimental-audit-binary-artifact libAcme.a',
    'package clean', 'package purge-cache', 'package reset', 'package update', 'package describe', 'package init',
    'package migrate', 'package experimental-install', 'package experimental-uninstall Acme',
    'package diagnose-api-breaking-changes', 'package dump-symbol-graph', 'package dump-package', 'package edit Library',
    'package unedit Library', 'package config set-mirror --original-url https://example.com/acme.git --mirror-url https://example.com/mirror.git',
    'package resolve', 'package show-dependencies', 'package show-executables', 'package tools-version --set 6.2',
    'package compute-checksum dist/Acme.zip', 'package archive-source', 'package completion-tool generate-bash-script',
    'package plugin --list', 'package-registry publish acme.Library 1.0.0', 'sdk install https://example.com/sdk.artifactbundle.tar.gz'],
  swiftc: ['main.swift -o build/Acme', '-typecheck main.swift', '-load-plugin-library /outside/plugin.dylib main.swift', '@arguments.rsp'],
  swiftlint: ['lint Sources', 'analyze --compiler-log-path build.log', 'baseline', 'docs', 'generate-docs',
    'reporters', 'rules', 'autocorrect Sources'],
  pod: ['init', 'install --deployment', 'update', 'outdated', 'deintegrate', 'env', 'list', 'search Acme', 'setup', 'try Acme',
    'cache list', 'cache clean --all', 'ipc list', 'ipc podfile Podfile', 'ipc podfile-json Podfile', 'ipc spec Acme.podspec',
    'ipc repl', 'lib create Acme', 'lib lint Acme.podspec', 'repo add acme https://example.com/specs.git',
    'repo add-cdn acme https://example.com/specs', 'repo lint acme', 'repo list', 'repo push acme Acme.podspec',
    'repo remove acme', 'repo update', 'spec cat Acme', 'spec create Acme', 'spec edit Acme', 'spec lint Acme.podspec',
    'spec which Acme', 'spec yank Acme 1.0.0', 'trunk add-owner Acme maintainer@example.com', 'trunk delete Acme 1.0.0',
    'trunk deprecate Acme', 'trunk info Acme', 'trunk me', 'trunk push Acme.podspec', 'trunk register maintainer@example.com',
    'trunk remove-owner Acme maintainer@example.com', 'plugins create acme', 'plugins installed', 'plugins list', 'plugins search acme'],
  codesign: ['--sign - --force build/Acme.app', '--verify --deep build/Acme.app', '--display --entitlements - build/Acme.app',
    '--remove-signature build/Acme.app'],
  security: ['list-keychains', 'default-keychain', 'login-keychain', 'create-keychain build/acme.keychain',
    'lock-keychain', 'unlock-keychain build/acme.keychain', 'set-keychain-settings', 'set-keychain-password',
    'show-keychain-info', 'find-identity -v -p codesigning', 'find-certificate -a', 'find-generic-password -w -s acme',
    'find-internet-password -g -s example.com', 'add-generic-password -s acme -w example-placeholder',
    'add-internet-password -s example.com -w example-placeholder', 'import fixtures/key.p12', 'export -o dist/keys.p12',
    'set-key-partition-list', 'add-trusted-cert fixtures/cert.pem', 'verify-cert -c fixtures/cert.pem',
    'cms -D -i fixtures/profile.mobileprovision', 'authorizationdb read system.example', 'authorize system.example',
    'execute-with-privileges /usr/bin/true'],
  notarytool: ['store-credentials acme-profile', 'submit dist/Acme.zip --keychain-profile acme-profile',
    'info ExampleSubmission', 'wait ExampleSubmission', 'history', 'log ExampleSubmission reports/notary.json'],
  altool: ['--validate-app --file dist/Acme.ipa', '--upload-app --file dist/Acme.ipa', '--upload-package dist/Acme.ipa',
    '--list-providers', '--list-apps', '--generate-api-key', '--store-password-in-keychain-item acme',
    '--notarize-app --file dist/Acme.zip', '--notarization-info ExampleSubmission', '--notarization-history 0'],
  stapler: ['staple dist/Acme.app', 'validate dist/Acme.app'],
  pkgbuild: ['--root build/root --scripts installer-scripts dist/Acme.pkg'],
  productbuild: ['--distribution Distribution.xml --package-path packages dist/Acme.pkg'],
  productsign: ['--sign ExampleIdentity dist/Unsigned.pkg dist/Signed.pkg'],
  pkgutil: ['--check-signature dist/Acme.pkg', '--expand dist/Acme.pkg expanded', '--forget com.example.acme'],
  xcresulttool: ['get test-results summary --path build/Acme.xcresult', 'export attachments --path build/Acme.xcresult --output-path reports',
    'graph --path build/Acme.xcresult', 'metadata get --path build/Acme.xcresult', 'formatDescription get',
    'merge build/A.xcresult build/B.xcresult --output-path build/Merged.xcresult', 'compare build/A.xcresult --baseline-path build/B.xcresult'],
  xccov: ['view --report build/Acme.xcresult', 'diff build/A.xccovreport build/B.xccovreport', 'merge build/A.xccovreport build/B.xccovreport'],
  dsymutil: ['build/Acme -o build/Acme.dSYM'], dwarfdump: ['--uuid build/Acme.dSYM'],
  atos: ['-o build/Acme -l 0x100000000 0x100000100'], symbols: ['build/Acme'],
  agvtool: ['what-version', 'what-marketing-version', 'next-version -all', 'new-version -all 42', 'new-marketing-version 1.2.0'],
  ibtool: ['--compile build/Main.nib Main.xib'], actool: ['Assets.xcassets --compile build/assets'],
};
for (const [name, invocations] of Object.entries(operations))
  for (const invocation of invocations) rows.push([[name, ...invocation.split(' ')], review]);

for (const invocation of ['delete all', 'erase all', 'uninstall booted com.example.acme',
  'install_app_data booted fixtures/Acme.xcappdata', 'runtime delete all', 'runtime dyld_shared_cache remove --all'])
  rows.push([['simctl', ...invocation.split(' ')], destroy]);
for (const invocation of ['device uninstall app --device ExampleDevice com.example.acme', 'manage ddis clean', 'manage unpair --device ExampleDevice'])
  rows.push([['devicectl', ...invocation.split(' ')], destroy]);
for (const invocation of ['delete-keychain build/acme.keychain', 'delete-generic-password -s acme',
  'delete-internet-password -s example.com', 'delete-certificate -Z EXAMPLE', 'remove-trusted-cert fixtures/cert.pem'])
  rows.push([['security', ...invocation.split(' ')], destroy]);

const information = {
  xcodebuild: ['-version', '-help', '-usage', '-showsdks', '-checkFirstLaunchStatus'],
  'xcode-select': ['--version', '--help', '-h', '--print-path', '-p'],
  simctl: ['help', 'help erase'], devicectl: ['--version', '--help', '-h', 'help', 'help device uninstall app'],
  xctrace: ['help', 'help record', 'version'],
  swift: ['--version', '-version', '--help', '-help', 'package --help', 'package --version', 'build --help', 'test --help', 'run --help'],
  swiftc: ['--version', '-version', '--help', '-help'],
  'swift-format': ['--version', '-v', '--help', '-h', 'dump-configuration'],
  swiftlint: ['version', '--version', '--help', '-h'],
  notarytool: ['--version', '--help', '-h', 'help', 'help submit'],
  xcresulttool: ['--version', '--help', '-h', 'help', 'help export'],
  dsymutil: ['--version', '--help'], dwarfdump: ['--version', '--help'],
};
for (const [name, invocations] of Object.entries(information))
  for (const invocation of invocations) rows.push([[name, ...invocation.split(' ')], allow]);

rows.push(
  [['simctl', 'list'], allow], [['simctl', 'list', '-j', 'devices', 'available'], allow],
  [['simctl', 'list', '--future-display', '--json-output', 'reports/devices.json'], allow],
  [['simctl', '--set', 'simulators', 'list', '--json-output=reports/devices.json'], allow],
  [['simctl', 'runtime', 'list', '-j'], allow], [['simctl', 'runtime', 'match', 'list', '--json-output', 'reports/runtimes.json'], allow],
  [['simctl', 'list', '--json-output=/outside/devices.json'], ask],
  [['simctl', 'list', '--json-output', 'reports/a.json', '--json-output', '.shield/b.json'], ask],
  [['simctl', '--set', '/outside/simulators', 'list'], ask],
  [['simctl', '--profiles=.ssh/profiles', 'list'], ask],
  [['simctl', 'list', '--json-output'], review], [['simctl', 'runtime', 'list', '--json-fd=3'], review],
  [['simctl', '--set', 'simulators', 'delete', 'all'], destroy],
  [['simctl', 'runtime', '--set', 'simulators', 'delete', 'all'], destroy],
  [['simctl', 'runtime', 'delete', 'all', '--dry-run'], destroy],
  [['devicectl', 'list', 'devices'], allow], [['devicectl', 'list', 'preferredDDI'], allow],
  [['devicectl', '--timeout', '10', 'list', '--json-output', 'reports/device.json', 'devices', '--hide-headers'], allow],
  [['devicectl', 'list', 'devices', '-jreports/devices.json', '-lreports/device.log'], allow],
  [['devicectl', 'list', 'devices', '--future-display', '--sort-by', 'name'], allow],
  [['devicectl', 'list', 'devices', '--json-output=/outside/devices.json'], ask],
  [['devicectl', 'list', 'devices', '-j/outside/devices.json'], ask],
  [['devicectl', 'list', 'devices', '-qj/outside/devices.json'], ask],
  [['devicectl', 'list', 'devices', '--log-output', '.git/device.log'], ask],
  [['devicectl', 'list', 'devices', '--filter', 'name BEGINSWITH "Acme"'], review],
  [['devicectl', 'list', 'devices', '--json-output'], review],
  [['devicectl', '-q', 'device', '--timeout', '5', 'uninstall', 'app', '--device', 'ExampleDevice', 'com.example.acme'], destroy],
  [['security', '-v', 'delete-keychain', 'build/acme.keychain'], destroy],
  [['xcodebuild', '-scheme', 'Acme', 'build', '-allowProvisioningUpdates', '-authenticationKeyPath', '/outside/key.p8'], review],
  [['xcodebuild', '-version', 'build'], review], [['swift', '--version', 'main.swift'], review],
  [['swift', '-e', 'print(1)'], review], [['swift', '--package-path', '/outside', 'package', 'describe'], review],
  [['swift', 'package', '--disable-sandbox', 'plugin', '--allow-writing-to-package-directory', 'AcmePlugin'], review],
  [['swiftlint', 'lint', '--fix', '--config', 'https://example.com/swiftlint.yml', 'Sources'], review],
  [['pod', '--help'], review], [['pod', '--version'], review], [['pod', 'install', '--help'], review],
  [['pod', 'install', '--project-directory=/outside', '--ignore-modules-dependencies'], review],
  [['notarytool', 'submit'], review], [['simctl', 'erase'], destroy],
  [['devicectl', 'device', 'uninstall', 'app'], destroy],
);
for (const args of [[], ['format', '-i', 'Sources/Main.swift'], ['lint', '--strict', 'Sources/Main.swift'],
  ['--recursive', 'Sources'], ['format', '--configuration', '.swift-format', '--offsets', '0:10', 'Sources/Main.swift'],
  ['format', '--future-display', 'Sources/Main.swift'], ['format', '-ir', 'Sources'],
  ['format', '--enable-experimental-feature', 'ExampleFeature', 'Sources/Main.swift']])
  rows.push([['swift-format', ...args], routine]);
for (const args of [['format', '/outside/Main.swift'], ['lint', '../Main.swift'], ['format', '.shield/Main.swift'],
  ['format', 'Sources/Main.swift', '/outside/Main.swift'], ['format', '--configuration=/outside/format.json', 'Sources'],
  ['format', '--configuration', '.swift-format', '--configuration', '.ssh/config', 'Sources'],
  ['format', '--assume-filename=/outside/Main.swift', 'Sources'], ['format', '-'],
  ['format', '--', '/outside/Main.swift']]) rows.push([['swift-format', ...args], ask]);
for (const args of [['format', '--follow-symlinks', 'Sources'], ['format', '--configuration']])
  rows.push([['swift-format', ...args], review]);

// The Swift alias and launcher must retain every formatter decision.
for (const [argv, expected] of [...rows].filter(([argv]) => argv[0] === 'swift-format'))
  rows.push([['swift', 'format', ...argv.slice(1)], expected]);
for (const name of Object.keys(operations).concat('swift-format')) {
  rows.push([[name], name === 'swift-format' ? routine : review]);
  if (name !== 'swift-format') rows.push([[name, 'future-operation'], review]);
  for (const path of [`${name}-unrelated`, `/outside/bin/${name}`])
    rows.push([[path, '--help'], ask]);
}
for (const [argv, expected] of [...rows].filter(([argv]) => !argv[0].includes('/') && !argv[0].endsWith('-unrelated')))
  rows.push([['xcrun', ...argv], expected]);
for (const [argv, expected] of [
  [['simctl', 'list', '--json-output', '/outside/list.json'], ask],
  [['simctl', 'erase', 'all'], destroy], [['swift', '--version'], allow],
  [['swift-format', 'format', '-i', 'Sources/Main.swift'], routine],
  [['swift', 'format', '--version'], allow], [['notarytool', 'submit', 'dist/Acme.zip'], review],
]) for (const flag of ['-r', '--run']) rows.push([['xcrun', flag, ...argv], expected]);
for (const argv of [['xcrun', '--sdk', '/outside/sdk', 'swift', '--version'],
  ['xcrun', '--toolchain', '/outside/toolchain', 'simctl', 'list'],
  ['xcrun', '/outside/runner', '--help'], ['xcrun', 'sh', '-c', 'true'],
  ['xcrun', '--kill-cache'], ['xcrun'], ['xcrun', '--sdk']]) rows.push([argv, review]);
rows.push([['xcrun', '--sdk', 'iphonesimulator', 'simctl', 'erase', 'all'], destroy],
  [['xcrun', '-k', '--toolchain', 'ExampleToolchain', 'simctl', '--set', 'simulators', 'delete', 'all'], destroy],
  [['xcrun', '-l', 'devicectl', 'device', 'uninstall', 'app', '--device', 'ExampleDevice', 'com.example.acme'], review],
  [['xcrun', '--log', 'devicectl', 'device', 'uninstall', 'app', '--device', 'ExampleDevice', 'com.example.acme'], destroy],
  [['xcrun', 'devicectl', '-l', 'reports/device.log', 'device', 'uninstall', 'app', '--device', 'ExampleDevice', 'com.example.acme'], destroy]);
for (const flag of ['--help', '-h', '--version', '--show-sdk-path', '--show-sdk-version', '--show-sdk-build-version',
  '--show-sdk-platform-path', '--show-sdk-platform-version', '--show-toolchain-path']) rows.push([['xcrun', flag], allow]);
for (const flag of ['--find', '-f']) rows.push([['xcrun', flag, 'swift'], allow]);
for (const name of ['xcodebuild', 'simctl', 'devicectl', 'swift', 'swift-format', 'pod', 'codesign', 'security', 'xcrun'])
  for (const prefix of ['/usr/bin/', '/usr/local/bin/', '/opt/homebrew/bin/',
    '/Applications/Xcode.app/Contents/Developer/usr/bin/',
    '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/'])
    rows.push([[prefix + name, ...(name === 'swift-format' ? ['format', 'Sources/Main.swift'] : name === 'xcrun' ? ['swift', 'build'] : [])],
      name === 'swift-format' ? routine : review]);

export function appleCases() {
  return {schema_version: 1, cases: ['loose', 'recommended', 'strict'].flatMap((profile, index) =>
    rows.map(([argv, expected], row) => ({name: `apple-${row}-${profile}`, profile, argv, expected: expected[index]})))
    .concat(['loose', 'recommended', 'strict'].map(profile => ({name: `apple-mcp-unmatched-${profile}`, profile,
      input: {kind: 'mcp', server: 'apple', tool: 'device_erase', arguments: {}, original_input: {}}, expected: 'ask'})))};
}
