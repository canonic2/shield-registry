import {executableForms} from './tool-pack.mjs';

export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
export const jdkCommands = ['java', 'javaw', 'javac', 'jar', 'javadoc', 'javap', 'jdeps', 'jdeprscan', 'jnativescan',
  'jlink', 'jpackage', 'jmod', 'jimage', 'jshell', 'jrunscript', 'jcmd', 'jconsole', 'jdb', 'jfr', 'jhsdb',
  'jinfo', 'jmap', 'jps', 'jstack', 'jstat', 'jstatd', 'jwebserver', 'keytool', 'jarsigner', 'serialver', 'rmiregistry'];
export const mavenCommands = ['mvn', 'mvnw', 'mvnd'];
export const gradleCommands = ['gradle', 'gradlew'];
const buildCommands = [...mavenCommands, ...gradleCommands];
export const commands = [...jdkCommands, ...buildCommands];
export const discoveryCommands = ['java', 'javac', 'jar', 'javadoc', 'jlink', 'jpackage',
  'jshell', 'jcmd', 'jfr', 'keytool', 'jarsigner', 'mvn', 'mvnw', 'mvnd', 'gradle', 'gradlew'];
const review = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const information = {
  java: ['-version', '--version', '-help', '--help', '-?'],
  javac: ['-version', '--version', '-help', '--help', '-?'],
  jar: ['--version', '--help', '--help-extra'],
  javadoc: ['--version', '-help', '--help'],
  javap: ['-version', '--version', '-help', '--help'],
  jdeps: ['--version', '-version', '--help', '-help'],
  jlink: ['--version', '--help'],
  jpackage: ['--version', '--help'],
  jshell: ['--version', '--help'],
  jcmd: ['-h'],
  keytool: ['-help'],
};

function identity(name) {
  if (name === 'mvnw' || name === 'gradlew') return {regex: `^(?:[^\\r\\n]*[/\\\\])?${name}(?:\\.cmd|\\.bat)?$`};
  return {one_of: [...executableForms(name), `${name}.exe`,
    ...(buildCommands.includes(name) ? [`${name}.cmd`, `${name}.bat`] : [])]};
}

export function javaPack() {
  return {schema_version: 1, kind: 'pack', id: 'canonic/java', version,
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    description: 'Java/JVM, Maven and Gradle permissions with exact JDK help/version queries and review for execution, compilation, build plugins, archives, diagnostics, signing and publication.',
    capabilities: ['argument-rules-v1', 'regex-v1', 'structured-rules-v1'],
    rules: commands.flatMap(name => [
      ...(information[name] || []).map((flag, index) => ({id: `${name}-info-${index}`,
        conditions: {domain: 'argv', executable: identity(name), arguments: {kind: 'exact', values: [flag]}},
        decision: 'allow', reason: 'Print built-in JDK help or installed version from the trusted toolchain.'})),
      {id: `${name}-operation`, conditions: {domain: 'argv', executable: identity(name), arguments: {kind: 'any'}},
        decision: review, reason: buildCommands.includes(name)
          ? 'Review launcher scripts, wrapper downloads, build configuration, init scripts, extensions, plugins, daemons, repositories, credentials and project changes.'
          : 'Review JVM execution, processors, agents, files, outputs, archive extraction, diagnostics, listeners and signing.'},
    ])};
}

export function javaInventory(pack = javaPack()) {
  return {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: pack.rules.filter(row => row.id.startsWith(`${name}-`)).map(row => row.id)}))};
}
