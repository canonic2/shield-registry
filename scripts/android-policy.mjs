export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
export const commands = ['adb', 'emulator', 'sdkmanager', 'avdmanager', 'bundletool', 'apksigner', 'zipalign'];
const review = {loose: 'ask', recommended: 'ask', strict: 'deny'};

// SDK tools commonly live under versioned SDK directories. Executable trust is
// supplied by the host. Only native adb's complete help/version forms can allow.
function identity(name) {
  return {regex: `^(?:[^\\r\\n]*[/\\\\])?${name}(?:\\.exe|\\.bat|\\.cmd)?$`};
}

export function androidPack() {
  return {schema_version: 1, kind: 'pack', id: 'canonic/android', version,
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    description: 'Android SDK, device, emulator, APK packaging and signing permissions with review for device access, host files, downloads, keys and execution.',
    capabilities: ['argument-rules-v1', 'regex-v1', 'structured-rules-v1'],
    rules: [
      ...['help', 'version'].map(word => ({id: `adb-${word}`,
        conditions: {domain: 'argv', executable: {regex: '^(?:[^\\r\\n]*[/\\\\])?adb(?:\\.exe)?$'},
          arguments: {kind: 'exact', values: [word]}},
        decision: 'allow', reason: 'Print native ADB built-in help or version without contacting the server.'})),
      ...commands.map(name => ({id: `${name}-operation`,
        conditions: {domain: 'argv', executable: identity(name), arguments: {kind: 'any'}},
        decision: review, reason: {
          adb: 'Review selected device and server, device data, remote shell execution, host files, app changes, debugging and network exposure.',
          emulator: 'Review selected AVD, disk images, snapshots, data wiping, host paths, network interfaces and QEMU or helper execution.',
          sdkmanager: 'Review SDK root, repositories, proxies, package downloads, installation, removal and license acceptance; JVM launch configuration also applies.',
          avdmanager: 'Review AVD identity, configuration paths, system images, creation, replacement, movement and deletion; JVM launch configuration also applies.',
          bundletool: 'Review bundle/APK inputs, outputs, extraction, selected device, deployment and signing keys; launcher code and JVM options also apply.',
          apksigner: 'Review APK and certificate paths, signing keys, password sources, providers, output and in-place signing; JVM launch configuration also applies.',
          zipalign: 'Review archive inputs and outputs, alignment verification, overwrites and destination paths.',
        }[name]})),
    ]};
}

export function androidInventory(pack = androidPack()) {
  return {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: pack.rules.filter(row => row.id.startsWith(`${name}-`)).map(row => row.id)}))};
}
