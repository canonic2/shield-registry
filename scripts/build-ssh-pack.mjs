import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {version, engine, sshPack, sshInventory} from './ssh-policy.mjs';
import {sshCases} from './ssh-cases.mjs';
import {splitCaseFiles} from './fixture-files.mjs';

export const directory = new URL(`../packs/canonic/ssh/${version}/`, import.meta.url);
export function guide() {
  return `# SSH and remote transfer permissions ${version}

Requires Shield \`${engine}\`. Reviewed on 2026-11-24 using installed
OpenSSH 9.9p2 version metadata, current upstream
[SSH](https://man.openbsd.org/ssh.1),
[configuration](https://man.openbsd.org/ssh_config.5),
[SCP](https://man.openbsd.org/scp.1),
[SFTP](https://man.openbsd.org/sftp.1),
[key generation](https://man.openbsd.org/ssh-keygen.1),
[agent keys](https://man.openbsd.org/ssh-add.1) and
[rsync](https://rsync.samba.org/ftp/rsync/rsync.1) manuals, and the
[OpenSSH argument parser](https://github.com/openssh/openssh-portable/blob/master/ssh.c).
The local rsync version query was refused by workspace command policy;
rsync interfaces are documentation-reviewed. No remote connection was made.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exactly ssh -V, or ssh -Q followed by one algorithm-query name | Allow | Allow | Allow |
| Exactly rsync --help or --version | Allow | Allow | Allow |
| SSH login, remote command, config dump, proxy/helper or forwarding | Ask | Ask | Deny |
| SCP/SFTP transfers, interactive/batch sessions and local copies | Ask | Ask | Deny |
| rsync listing, local/remote transfer, dry run, deletion or daemon | Ask | Ask | Deny |
| SSH key inspection, generation, signing, providers and known-host edits | Ask | Ask | Deny |
| Agent listing, loading/removal, signing tests and lock/unlock | Ask | Ask | Deny |
| Unrecognized/malformed arguments for a modeled executable | Ask | Ask | Deny |
| MCP and other executable names without another pack | Ask | Ask | Ask |

## Connections and execution

SSH host aliases and configuration can change the effective hostname, user,
port, jump path and credentials. Match exec, ProxyCommand, KnownHostsCommand
and LocalCommand can execute controller-side commands. Even ssh -G evaluates
configuration, including Match exec. Control commands can affect an existing
connection. Forwarding can expose local or remote TCP/Unix sockets, agent keys,
X11 or network interfaces. These effects require review.

The metadata allowances cover complete argument shapes only. Added logging,
configuration or destination arguments return the call to review. Algorithm
query names are data, not an allowlist of algorithms; unsupported query names
can fail harmlessly. Executable identity and inherited loader configuration
remain host responsibilities.

## Transfers and files

Review transfer direction, source and destination authority, local/remote paths,
symlinks, recursion and overwrite behavior. Remote paths are outside the
controller's filesystem sandbox. SCP supports SFTP and retained legacy SCP
transports; helper/server options execute programs. SFTP may automatically
download a file named in its destination, and batch or stdin sessions can
delete/rename files or invoke local shell escapes.

Rsync has local, SSH and daemon transports. Listing and dry-run forms can still
contact hosts, execute transport helpers and read files. Delete, remove-source,
in-place, symlink, filter, files-from, backup, partial and logging options need
review against actual inputs. This candidate supplies no automatic local-path
proof, effective-host allowlist or remote filesystem authorization.

## Keys and scope

Key generation, export, fingerprints, certificate/signature operations, providers,
resident hardware keys and known-host changes all require review. Agent commands
can expose identity metadata, load/remove keys, sign test challenges, invoke
providers or lock/unlock the selected agent. The no-argument forms of ssh-keygen
and ssh-add are operations, not help.

The host owns SSH_AUTH_SOCK, SSH_ASKPASS, RSYNC_RSH, RSYNC_PROXY, password sources,
configuration, executable trust and provider loading. Bare names, POSIX paths,
Windows paths and .exe names match. Interpreter/shell wrappers require their
own policy. ssh-agent, ssh-keyscan, ssh-copy-id, server management and third-party
MCP integrations are outside this six-tool candidate.

Restrictions are regular rules and survive another community pack's broad allow.
Project custom policy retains Shield's normal authority. No pack settings are
claimed for hosts or paths. Live transfers, SSH configuration/helper execution,
forwarding, keys, agents, rsync daemons and native Windows behavior are unverified.
Installing this pack requires the usual policy review.

Generate with \`node scripts/build-ssh-pack.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/ssh-pack.test.mjs\`.
`;
}

export async function buildSshPack() {
  await mkdir(directory, {recursive: true});
  const pack = sshPack();
  for (const [file, document] of [['pack.yml', pack], ['commands.json', sshInventory(pack)], ...splitCaseFiles(sshCases())])
    await writeFile(new URL(file, directory), JSON.stringify(document, null, 2) + '\n');
  await writeFile(new URL('README.md', directory), guide());
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildSshPack();
