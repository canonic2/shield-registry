# Ansible permissions 0.1.0

Requires Shield `>=0.53.0, <1.0.0`. Reviewed on 2026-11-24 using installed Ansible
Core 2.20.4 (Ansible distribution 13.5.0), its shared CLI startup source and
the official [command inventory](https://docs.ansible.com/projects/ansible/latest/command_guide/command_line_tools.html).
The current command references cover
[ad hoc execution](https://docs.ansible.com/projects/ansible/latest/cli/ansible.html),
[playbooks](https://docs.ansible.com/projects/ansible/latest/cli/ansible-playbook.html),
[inventory](https://docs.ansible.com/projects/ansible/latest/cli/ansible-inventory.html),
[Galaxy](https://docs.ansible.com/projects/ansible/latest/cli/ansible-galaxy.html),
[Vault](https://docs.ansible.com/projects/ansible/latest/cli/ansible-vault.html),
[configuration](https://docs.ansible.com/projects/ansible/latest/cli/ansible-config.html),
[documentation](https://docs.ansible.com/projects/ansible/latest/cli/ansible-doc.html),
[console](https://docs.ansible.com/projects/ansible/latest/cli/ansible-console.html) and
[pull](https://docs.ansible.com/projects/ansible/latest/cli/ansible-pull.html).
Only the installed version query was executed. The other interfaces were
reviewed from documentation and source; no playbook, inventory or vault was run.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Ad hoc modules, playbooks, console and pull execution | Ask | Ask | Deny |
| Inventory listings, syntax/check modes, host/task/tag listings | Ask | Ask | Deny |
| Galaxy inspection, download, installation, build and publication | Ask | Ask | Deny |
| Vault view, editor, encryption, decryption and rekey | Ask | Ask | Deny |
| Configuration, plugin documentation and help/version | Ask | Ask | Deny |
| Unrecognized or malformed syntax for a modeled executable | Ask | Ask | Deny |
| Other executable names and MCP without another pack | Ask | Ask | Ask |

## Execution and inventory

Review host identities, inventory files and executable inventory sources,
connection plugins, local delegation, lookups, callbacks, modules, collections,
playbooks and privilege escalation. A host pattern, limit or localhost connection
does not establish permission to change the selected host. Remote paths do not
become authorized by falling inside the controller's approved directories.

[Inventory plugins](https://docs.ansible.com/projects/ansible/latest/plugins/inventory.html)
can run code and contact data sources even during listings.
[Check mode](https://docs.ansible.com/projects/ansible/latest/playbook_guide/playbooks_checkmode.html)
can be overridden by a task's check_mode setting. Syntax checks and task/host/tag
listings still process configuration and inventory. Diff output can disclose
secrets. None of those options supplies a general automatic execution proof.

## Files, credentials and publication

Review inventory exports, extra-vars files, SSH keys, password sources, temporary
paths and caches. Executable connection/become/vault password files can launch
helper programs. Vault view/decrypt can expose plaintext, decrypt/rekey can
overwrite input files, and edit/create can launch an editor.

Galaxy operations can fetch code, install dependencies, write collection/role
paths, build archives, invoke signing helpers or publish to a selected server.
Pull fetches a repository and executes its playbooks; clean/purge can discard
checkout data. A repository signature does not establish execution authority.

## Startup and host boundaries

The installed version query attempted to create Ansible's normal temporary
directory before argument processing. Shared CLI startup also creates its
configured home directory. The source is available in
[Core 2.20.4 CLI](https://github.com/ansible/ansible/blob/v2.20.4/lib/ansible/cli/__init__.py)
and [configuration manager](https://github.com/ansible/ansible/blob/v2.20.4/lib/ansible/config/manager.py).
Help/version retain review because the pack cannot bound these configured
startup writes from argv alone. Plugin/configuration inspection can also load
extensions or use an external pager.

[Configuration precedence](https://docs.ansible.com/projects/ansible/latest/reference_appendices/config.html)
includes ANSIBLE_CONFIG, project/user/system configuration, environment and
variables. The host must enforce executable identity, Python startup, configured
Ansible home/temp directories, plugin and collection paths, pager/editor,
credential access and remote authority. This candidate supplies no automatic
host allowlist, sandbox path proof or transport restriction.

The nine core executable names match bare, relative and absolute paths,
including virtual environments. Windows-named shims retain review; native
Windows controller support is not claimed. Interpreter-wrapped invocation
requires its interpreter's policy. Python execution policy composes separately.
Rules are regular restrictions, so another community pack's broad allowance
cannot bypass them. Project custom policy retains Shield's normal authority.
MCP integrations, Molecule, ansible-lint and ansible-navigator are outside this
candidate and follow other installed policy or unknown-request fallback.

## Validation

Independent fixtures cover all three profiles, execution and inspection forms,
credential helpers, local/remote paths, Galaxy/Vault effects, malformed syntax,
unknown fallback and composition with Python/Baseline and broad allowances.
Live remote hosts, inventory scripts, playbook execution, Galaxy downloads or
publication and Vault operations remain unverified.

Generate with `node scripts/build-ansible-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/ansible-pack.test.mjs`.
