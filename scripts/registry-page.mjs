// The registry's public catalog page. Client installation belongs to Shield docs.
export function registryPage(entries) {
  const latest = new Map();
  for (const entry of entries) {
    const current = latest.get(entry.id);
    const compare = (a, b) => {
      const left = a.split('.').map(Number), right = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
      return 0;
    };
    if (!current || compare(entry.version, current.version) > 0) latest.set(entry.id, entry);
  }
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="The main Shield registry: signed, versioned permission packs for developer tools.">
  <title>Shield Registry</title>
  <style>
    :root { color-scheme: light dark; font: 17px/1.65 system-ui, sans-serif; }
    body { max-width: 860px; margin: 0 auto; padding: 48px 24px; }
    h1,h2 { line-height: 1.2; } h1 { font-size: 2.5rem; }
    a { color: light-dark(#2458b7, #98bcff); } code,pre { font-family: ui-monospace, monospace; }
    pre { padding: 16px; background: light-dark(#f2f4f7, #20252d); overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; } th,td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #8886; }
    footer { margin-top: 48px; font-size: .9rem; } .lead { font-size: 1.2rem; }
  </style>
</head>
<body>
<header><h1>Shield Registry</h1><p class="lead">Signed, versioned permission packs for developer tools.</p>
<p>This is the main registry used by Shield. Each pack defines allow, ask and deny decisions across three protection profiles. Packs are reviewable policy data, with behavioral fixtures and an MIT license.</p></header>
<main>
<h2>Available packs</h2>
<table><thead><tr><th>Pack</th><th>Latest version</th><th>Coverage</th></tr></thead><tbody>
${[...latest.values()].map(entry => `<tr><td><a href="${entry.path.slice(0, entry.path.lastIndexOf('/'))}/README.md">${entry.id}</a></td><td>${entry.version}</td><td>Git inspection, staging, local changes, remote activity and destructive operations</td></tr>`).join('\n')}
</tbody></table>
<h2>Use a pack</h2>
<p>With Shield installed and a project initialized, inspect and add the Git pack:</p>
<pre><code>shield info main/git
shield add main/git --profile recommended</code></pre>
<p>Review the proposed permissions before confirming installation. To pin a release, use <code>main/git@0.2.0</code>. Installed packs retain their verified bytes for offline evaluation.</p>
<h2>Choose a profile</h2>
<ul><li><strong>Loose:</strong> allows listed inspection, staging and routine local changes; asks before remote and destructive operations.</li>
<li><strong>Recommended:</strong> allows listed inspection and staging; asks before commits, working-tree changes and remote access; denies destructive operations.</li>
<li><strong>Strict:</strong> allows listed inspection; asks before staging and routine local changes; denies remote and destructive operations.</li></ul>
<p>These summaries describe the current Git pack. Unknown commands and unlisted option combinations require review. Git configuration, hooks, environment and executable identity need host enforcement; pack installation alone does not intercept commands.</p>
<h2>Verified releases</h2>
<p>The Ed25519 signature authenticates the exact catalog bytes. Catalog entries identify each immutable release by version, path and SHA-256 digest. Shield verifies the signing root, expiry, sequence and artifact bytes before acquisition.</p>
<p><a href="catalog.json">Catalog</a> · <a href="catalog.sig">Signature</a> · <a href="catalog-key.pub">Public key</a> · <a href="schemas/policy.schema.json">Policy schema</a></p>
<h2>Contribute</h2>
<p>Propose changes with rules, all three profiles, expected decisions and coverage documentation. Rule changes receive a new pack version; published policy bytes are retained. See the <a href="https://github.com/canonic2/shield-registry#contributing">contribution guide</a> for validation and publication.</p>
</main>
<footer><a href="https://github.com/canonic2/shield-registry">Source and issues</a> · <a href="LICENSE">MIT license</a></footer>
</body></html>
`;
}
