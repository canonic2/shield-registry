# Testrun permissions 0.2.4

Requires Shield `>=0.20.0, <1.0.0`.

Published artifacts remain immutable. Installing or updating this pack requires
review in each consuming project.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Project initialization wizard or unattended creation | Ask | Ask | Ask |
| Initialization dry run inside approved read roots | Allow | Allow | Allow |
| MCP project discovery and explicit initialization preview inside approved read roots | Allow | Allow | Allow |
| MCP project initialization creation or unspecified preview mode | Ask | Ask | Ask |
| Project readiness inside approved read roots, with a selected profile | Allow | Allow | Allow |
| Named project list/show and static status inside approved read roots | Allow | Allow | Allow |
| Named builds using `--app`/`--root` or structured `root` | Ask | Ask | Ask |
| Bounded private operation-log reads with a valid operation ID | Allow | Allow | Allow |
| Project task execution, including preparation, checks and persistent servers | Ask | Ask | Ask |
| Builds explicitly selecting preparation | Ask | Ask | Ask |
| Missing profile, malformed log reference or outside project selection | Ask | Ask | Ask |
| Diagnostic metadata creation, stop and close | Allow | Allow | Ask |
| Diagnostic status with a valid investigation ID | Allow | Allow | Allow |
| Diagnostic source collection and explicit private-content reads | Ask | Ask | Ask |
| Closed diagnostic investigation/evidence removal | Ask | Ask | Deny |
| Diagnostic analysis status | Allow | Allow | Allow |
| Diagnostic parser cancellation | Allow | Allow | Ask |
| Diagnostic parsing, structured queries and comparison | Ask | Ask | Ask |
| Static diagnostic effects and dependency discovery | Allow | Allow | Allow |
| Bundled-parser verification only | Allow | Allow | Ask |
| Scoped numeric projections and explicit report exports | Ask | Ask | Ask |

Project status performs configured HTTP inspection and optional native app
inventory. It does not execute the project's preflight or preparation commands.
Version-2 named status performs static configuration/capability inspection.
MCP `project_discover` inspects project markers. `project_init` previews by
default; explicit `dryRun: true` previews can proceed inside approved read roots.
Creation (`dryRun: false`) retains review and requires the digest of the selected
configuration plan. The digest binds plan data; it does not grant permission.
New requests distinguish the absolute configuration `root` from a symbolic
`project`. Read-only root selectors retain approved-read-root restrictions;
missing or malformed selectors and outside roots retain review. Legacy path
selectors remain covered separately.
Project start executes project code and can modify files, start a server, build
and install an app. Declaring a command in YAML does not grant execution
permission. Operation logs are private evidence and may contain project secrets.

Diagnostic collection can read an arbitrary explicitly selected host file,
an existing private build/project log or a bound Android package/user source.
The `react_native` source performs explicit loopback Metro discovery and optional
inspector attachment. Network/debugger domains, fixed app-probe execution,
runtime-global Hermes CPU/allocation profiler control and legacy debugger
replacement can perturb execution. Profiling and legacy replacement require
explicit Testrun flags; the pack keeps every mode Ask across all profiles.
Independent CLI/MCP cases also keep malformed, remote-endpoint and arbitrary-CDP
requests under review. A permission decision does not validate their schema.
The `dart` source reads an explicitly selected private VM Service credential
file, attaches to its loopback endpoint and subscribes to socket-owned events.
Typed CPU/timeline, heap/class, live instance/retaining-path and Flutter inspector
reads can perturb the app or retain inspector handles. Heap/class/object reads
can cover sibling isolates in the selected VM isolateGroup. Explicit VM-wide output,
timeline and process-memory selections can include other isolates. All modes,
CLI/desktop selections, unauthenticated opt-ins and malformed/arbitrary-RPC
requests remain Ask across profiles. Global profiler/logging changes, forced GC,
arbitrary code evaluation and reload/resume are not granted by this source.
Android starts owned read-only ADB clients (and may start the host ADB server),
reads installed/process/service/log/exit metadata and optionally observed report
paths. System logs are filtered; package/service/report reads may include related
users/processes. Source collection stays Ask in every profile, including follow,
system context, private reports, malformed selectors and unknown source kinds.
The `android_state` source additionally samples selected process/memory,
scheduling, power/thermal, frames and connectivity groups. System dumps can
read multiple users before host filtering. Connectivity reuses readback only;
no network switch plan, forced GC, frame reset, helper preparation or media/audio
capture runs automatically. Existing media/audio tools keep their own authority.
All state-source CLI/MCP forms, invalid groups and missing scope retain Ask across
profiles. Before/after observed comparisons remain private content under the
existing comparison boundary; partial samples never establish retained ownership.
The `ios` source selects a booted simulator or trusted physical UDID and explicit
USB/network transport. It can read the selected simulator log store, connect to
the phone's preinstalled log service and inspect an explicit exported-report
directory. It does not substitute host logs for a phone, move/delete phone reports,
enable developer support, unlock/pair a device or generate sysdiagnose archives.
Explicit analysis `metadata.symbolicate: true` materializes retained Mach-O/DWARF
bytes privately, verifies UUID/architecture with dwarfdump and invokes bounded
atos. Collection, report access, analysis and symbolication stay Ask in all
profiles, including malformed/mutating/unknown arguments. No permission exception
or additional authority is granted by these diagnostic sources.
It does not start an app/profiler, clear buffers or stop the source command.
The `browser_operation` source copies one settled browser result after verifying
its exact connection, operation and original typed request fingerprint. It does
not replay the request, attach a debugger, subscribe, cancel original work or
read/pin browser-owned files/models. Results may contain private text, bodies,
paths and analysis output. CLI/MCP collection retains Ask across profiles,
including malformed/unknown requests; existing browser capture and query rules
continue to govern native operations. Diagnostic capability discovery reuses
engine-specific contracts without starting a browser or preparing dependencies.
Captured bytes remain private and explicit reads retain
review. Stop/close affect only owned readers. Removal deletes owned retained
evidence after closure and settlement; original imported files are preserved.
Unknown diagnostic operations and malformed MCP status references retain review.
Analysis status requires valid investigation and analysis references. Parsing uses
a bounded owned child process; structured queries and comparisons can expose
private application content and retain review in every profile. Parser
cancellation preserves the raw evidence. The private parser-worker entry point
is not a general allowed CLI command.
Diagnostic dependency discovery starts no helper and reads no project/source.
Preparation permission is limited to `builtin-parser`; unknown or missing
components retain review. It runs a bounded same-executable check without
installation, downloads or app/device changes. Projections omit free text and
filter declared app scope, but numeric/timing evidence can remain sensitive.
Exports write an explicitly selected host file and retain review in all profiles,
including outside-project paths. Published bytes and prior policy boundaries
remain unchanged.

The browser, mobile action, launch environment, explicit project, setup and
unknown-operation boundaries in [0.2.3](../0.2.3/README.md) remain. Server matching
requires exactly `mcp serve`. Published versions remain unchanged.

Browser-associated storage export can collect cookies, local storage and selected
IndexedDB/OPFS data through a private native Chrome collection page, then write
private evidence. It retains the existing opaque CLI/browser_send decisions
(Allow/Ask/Ask); shared act remains Ask in all profiles. Individual IndexedDB and
OPFS flags have independent profile fixtures. This adds no permission exception.

Native credential edits can settle already-owned private automatic replies
before applying defaults. Manual callbacks and uncertain replies retain their
refusal boundary. These are existing browser_send/act operations and retain the
same profile decisions; no new permission or version change is required.

SDK caller evaluation can run while ordinary input is paused, using normal
operation capacity and existing caller authority. Thirty independent profile
cases cover page/frame, retained-handle and selector evaluation plus ordered
shared batches. CLI remains Allow/Ask/Ask, isolated MCP evaluate remains
Allow/Allow/Ask, selector evaluation retains opaque review and shared act remains
Ask in all profiles. No permission exception is introduced.

Native caller execution shares ordinary admission while input awaits readiness;
handle reads use that budget and disposal retains reserved response capacity.
Eighteen additional independent profile cases preserve the same CLI decisions,
MCP handle read/disposal Allow/Allow/Ask and shared-act Ask in all profiles.

Generate with `node scripts/build-current-tool-packs.mjs testrun`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs`.
Publication does not activate the pack in consuming projects.

Context proxy creation, associated HTTP inheritance and explicit proxy overrides
retain opaque CLI/browser_send Allow/Ask/Ask and shared-act Ask in every profile.
Thirty-six additional independent profile cases include native/SDK initial
connect, which retains Ask in every profile. No policy or version change is needed.
Native credential refusal details expose bounded state/failure-code counts only;
they add no callback authority or request content and retain these same decisions.

Browser launch proxy defaults, complete initial-context overrides and both CLI
launch forms retain Ask in every profile. Twenty-seven additional independent
cases cover separate/attached/before-engine proxy arguments, malformed/missing
values and both MCP aliases. Existing launch review covers these options without
a policy or version change.

HTTP CONNECT refusals can return bounded response evidence through existing
http_fetch operations, including explicit status/redirect policy and private
POST bodies. Twenty-seven additional independent profile cases preserve opaque
CLI/browser_send Allow/Ask/Ask and shared-act Ask in every profile. Response
preservation adds no permission exception, policy change or version change.

SOCKS HTTP client settings, URI credentials, explicit associated-client overrides
and destination TLS policy retain opaque CLI/browser_send Allow/Ask/Ask and
shared-act Ask across all profiles. Forty-five additional independent profile
cases cover these values. Browser creation uses its own authentication validation;
no policy or version change is required for the HTTP follow-up.

Browser SOCKS4/5 launch and context settings, creation-authentication refusals
and associated HTTP overrides add ninety independent profile cases. Browser
launch stays Ask for CLI and both MCP forms in every profile. Opaque context/
HTTP mutations keep Allow/Ask/Ask; shared act stays Ask. The fixed SDK's WebKit
SOCKS4 page failure and SOCKS5 local-address bypass do not grant new permission.
Policy, version and published artifacts remain unchanged for this follow-up.

SDK WebSocket route defaults, caller-owned handler replacement/removal and
independent endpoint close requests add eighty-one independent profile cases.
Opaque CLI/browser_send mutations retain Allow/Ask/Ask, and shared act remains
Ask in every profile. Callback identity and endpoint completion checks belong
to Testrun; this pack adds no permission exception or version change.

Direct-close omitted/empty/reason-only options and independent close-handler
removal add eighty-one further profile cases, including explicit empty reasons. Opaque CLI/browser_send requests
retain Allow/Ask/Ask, and shared act remains Ask in every profile. These cases
classify permissions; they do not accept SDK reason-only close parity. Policy,
version and published artifacts remain unchanged for this browser follow-up.

Context-owned service-worker manual routes, held callback replies, worker
evaluation/inventory and context closure add eighty-one independent profile
cases. Opaque CLI requests retain Allow/Ask/Ask; MCP route-policy edits retain
Allow/Ask/Ask, while existing isolated callback/evaluation/inventory/close calls
retain Allow/Allow/Ask. Shared act stays Ask in every profile. Worker authority,
live attachment checks and callback retirement belong to Testrun. No permission
exception, policy/version change, publication or activation is introduced.

Native closed-call capacity retirement uses the same owned context-close,
worker evaluation and status shapes. Exact late-reply accounting adds no raw
CDP forwarding tool or permission exception. Existing isolated MCP and shared
act decisions remain unchanged; this review does not accept full SDK close
options, caller outcomes or attachment-lifetime parity.

Context service-worker HAR replay and ordered HAR/manual fallback add thirty-six
independent profile cases for context HAR setup/removal, ordered HAR insertion
and worker callback fallback. Existing opaque CLI and policy edits remain
Allow/Ask/Ask, isolated MCP callback replies remain Allow/Allow/Ask and shared
act remains Ask in every profile. Worker/context authority stays in Testrun;
no policy/version change or published artifact update is needed.

Service-worker context header/credential inheritance adds fifty-four independent
profile cases for initial defaults, header/credential updates and removal,
explicit authentication routing and callback cancellation. Existing opaque CLI
and context edits retain Allow/Ask/Ask, isolated MCP callback replies retain
Allow/Allow/Ask, and shared act stays Ask in every profile. Native attachment,
credential-origin and cached-authentication semantics remain Testrun contracts;
this review adds no permission exception or policy/version change.

Service-worker capture provenance and replay/default coexistence add thirty-six
independent profile cases for full/minimal/page-selected capture start and
capture stop. Existing opaque CLI/MCP capture decisions remain Allow/Ask/Ask;
shared act remains Ask in every profile. Worker references in retained HAR
evidence grant no new host or browser authority. This review introduces no new
permission rule, publication or activation.

Framework registry cleanup ownership adds eighteen independent profile cases
for public handle disposal and owned framework release through CLI, browser_send
and shared act. Opaque CLI stays Allow/Ask/Ask; isolated MCP handle disposal stays
Allow/Allow/Ask, framework release stays Allow/Ask/Ask, and shared act stays Ask
in every profile. The runtime owner guard grants no new permission rule.

Typed binding success and thrown values add fifty-four independent profile
cases for undefined, BigInt and cyclic values through callback_resolve. Opaque
CLI stays Allow/Ask/Ask, isolated MCP callback replies stay Allow/Allow/Ask, and
shared act stays Ask in every profile. Live handles remain refused by Testrun;
typed values grant no host-file or native-function authority. Policy and version
remain unchanged by these typed binding cases.

Nine additional independent profile cases cover ordered debugger status/Next
batches through opaque CLI/browser_send and flattened shared act. Existing
Allow/Ask/Ask opaque decisions and Ask shared-act decisions remain unchanged.
Independent dispatch retains ordinary capacity and existing controller checks.

Acknowledged page-close capacity and sibling/context-worker preservation add
eighteen independent profile cases for page creation and closure through CLI,
browser_send and shared act. Existing opaque CLI decisions remain Allow/Ask/Ask;
isolated MCP requests remain Allow/Allow/Ask and shared act stays Ask in every
profile. Exact late-reply retirement grants no new authority or permission rule.

Empty regular languages and unambiguous legacy escapes add fifty-four profile
cases across HTTP routing, HAR capture filters and WebSocket matchers. Opaque
CLI/browser_send remains Allow/Ask/Ask; shared act remains Ask in every profile.
The matcher remains bounded and grants no additional authority or policy rule.

Collected debugger Pause/Next caller ordering adds fifty-four profile cases for
enable, pause, next, resume, private calls and status through CLI/browser_send/
shared act. Existing opaque CLI/MCP control decisions remain Allow/Ask/Ask;
shared act remains Ask in every profile. Caller-first dispatch adds no new
permission rule, publication or activation.
