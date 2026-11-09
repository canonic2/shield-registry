# Testrun 0.2.7 permission coverage

Requires Shield `>=0.20.0, <1.0.0`. Publication and project activation are separate.

Retains the existing CLI/MCP decisions and adds independent observability
cases: exact configured provider source, private provider/OTLP/deployment imports,
trace joins, malformed method/endpoint/credential fallback and unknown remediation.
Collection and evidence queries require review in Loose, Recommended and Strict.
Static capabilities remain inspection. Provider GETs read an explicit private
configuration and optional bearer file, can incur backend query cost and retain
projected private evidence. No credential refresh/fallback or mutation is implied.
Imports can contain customer data; exact trace association is not causal proof.

Investigation/report views compose up to four explicitly selected retained
analyses, preserve witnesses and read private evidence. JSON/Markdown report
exports write to an explicit caller-owned path, with minimal or explicit private
text/identity retention. Independent CLI/MCP cases cover every composed operation,
both report privacy modes and formats, malformed execution and unknown upload.
Query and export remain Ask across all profiles; capability/docs reads retain
their existing inspection decisions. No new tool names or upload authority.

Capability verification metadata is bundled passive inspection: fixture-only and
unverified live cells grant no target/account readiness or acceptance. Collection's
possible remote-transmission effect includes the already-reviewed configured
provider selectors/authorization; it does not grant automatic evidence upload.
Owned contributor fixture generation/measurement adds no product CLI/MCP tools.

The tool enforces supported providers, scope, bounds and file ownership; the pack
does not validate provider authorization, authenticate imported identity, guarantee
billing limits, or confer permission to remediate a deployed system.
