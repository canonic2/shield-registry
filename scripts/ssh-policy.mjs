export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
export const commands = ['ssh', 'scp', 'sftp', 'rsync', 'ssh-keygen', 'ssh-add'];
const review = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const identity = name => ({regex: `^(?:[^\\r\\n]*[/\\\\])?${name}(?:\\.exe)?$`});

export function sshPack() {
  const info = (id, name, args) => ({id, conditions: {domain: 'argv', executable: identity(name), arguments: args},
    decision: 'allow', reason: 'Print built-in metadata without a connection, transfer, key operation or user configuration evaluation.'});
  const reasons = {
    ssh: 'Review effective host identity, configuration execution, local/remote commands, proxies, forwarding, control sockets, credentials and output files.',
    scp: 'Review source and destination authority, local/remote paths, recursive or overwrite effects, symlinks, SSH configuration and transport/helper execution.',
    sftp: 'Review connection identity, SSH configuration, batch/stdin commands, local shell escapes, file transfers, deletion and output destinations.',
    rsync: 'Review paths, symlinks, deletion, overwrites, daemon or remote-shell connections, helpers, filters and output files. Dry runs can execute helpers and contact hosts.',
    'ssh-keygen': 'Review keys, passphrases, providers, certificate/signature authority, output paths and known-host changes; inspection can read protected credentials.',
    'ssh-add': 'Review authentication agent identity, keys, providers, signing tests, destination constraints, lock/unlock and identity removal.',
  };
  return {schema_version: 1, kind: 'pack', id: 'canonic/ssh', version,
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    description: 'SSH, SCP, SFTP, rsync and SSH key tools with bounded metadata allowances and reviewed remote authority, transfers, execution, forwarding, credentials and file changes.',
    capabilities: ['argument-rules-v1', 'regex-v1', 'structured-rules-v1'],
    rules: [
      info('ssh-version', 'ssh', {kind: 'exact', values: ['-V']}),
      info('ssh-query', 'ssh', {kind: 'options', prefix: ['-Q'], flags: [], values: [],
        operands: {match: {regex: '^[A-Za-z][A-Za-z0-9-]*$'}, min: 1, max: 1}}),
      ...['--version', '--help'].map((flag, index) => info(`rsync-info-${index}`, 'rsync', {kind: 'exact', values: [flag]})),
      ...commands.map(name => ({id: `${name}-operation`, conditions: {domain: 'argv', executable: identity(name),
        arguments: {kind: 'any'}}, decision: review, reason: reasons[name]})),
    ]};
}

export function sshInventory(pack = sshPack()) {
  return {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: pack.rules.filter(row => row.conditions.executable.regex === identity(name).regex).map(row => row.id)}))};
}
