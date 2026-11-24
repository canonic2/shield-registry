export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
export const commands = ['ansible', 'ansible-playbook', 'ansible-inventory', 'ansible-galaxy',
  'ansible-vault', 'ansible-config', 'ansible-doc', 'ansible-console', 'ansible-pull'];

export function ansiblePack() {
  const reasons = {
    ansible: 'Review inventory and hosts, module or shell execution, connection plugins, credentials, privilege escalation and local or remote changes.',
    'ansible-playbook': 'Review playbooks, inventory scripts, lookups, plugins, password helpers and host authority. Check, syntax and listing modes do not prove execution is harmless.',
    'ansible-inventory': 'Inventory inspection may execute scripts and plugins, contact external sources, read secrets, flush caches or write exports.',
    'ansible-galaxy': 'Review roles and collections, dependency sources, download/install destinations, local builds, signing helpers, authentication and publication.',
    'ansible-vault': 'Review secret inputs, plaintext output, password files or executable helpers, editor execution, encryption and in-place rekey/decrypt changes.',
    'ansible-config': 'Review configuration and plugin loading, exposed values and startup writes under configured Ansible home and temporary paths.',
    'ansible-doc': 'Review plugin and collection paths, documentation loading, pager execution and configured Ansible startup paths.',
    'ansible-console': 'An interactive console executes tasks against its selected inventory and can change hosts and privilege escalation during the session.',
    'ansible-pull': 'Review repository identity, checkout destination, downloaded playbook execution, connection credentials, cleanup and privilege escalation.',
  };
  return {schema_version: 1, kind: 'pack', id: 'canonic/ansible', version,
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    description: 'Ansible automation permissions covering core CLIs, inventories, playbooks, Galaxy, Vault, configuration, documentation, consoles and pull execution with reviewed host, plugin, credential and file authority.',
    capabilities: ['argument-rules-v1', 'regex-v1', 'structured-rules-v1'],
    rules: commands.map(name => ({id: `${name}-operation`,
      conditions: {domain: 'argv', executable: {regex: `^(?:[^\\r\\n]*[/\\\\])?${name}(?:\\.exe|\\.cmd|\\.bat)?$`},
        arguments: {kind: 'any'}},
      decision: {loose: 'ask', recommended: 'ask', strict: 'deny'}, reason: reasons[name]}))};
}

export function ansibleInventory(pack = ansiblePack()) {
  return {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: [pack.rules.find(row => row.id === `${name}-operation`).id]}))};
}
