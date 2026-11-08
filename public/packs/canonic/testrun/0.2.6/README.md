# Testrun 0.2.6 permission coverage

Requires Shield `>=0.20.0, <1.0.0`. Consuming projects review and activate
updates through Shield's ordinary pack workflow.

Decision fixtures are split across `cases.json` and `cases-2.json` to retain all
coverage within Shield's 1,024-case limit per file. Both files are evaluated
before publication and shipped with this release.

The current builder retains the CLI/MCP command inventory, strict stdio connector
identity, required fields, project-path boundaries, bundled documentation and
unknown-tool review fallback. Existing profile decisions remain intact.

Diagnostic capture, private content/query/compare and export require review in
all profiles. Native `native_trace` capture can start ADB, enable a finite
Perfetto system trace or simpleperf CPU sampler, attach xctrace/sample to a
selected process, execute trusted installed conversion tools and create/remove
owned private temporary files. Cancelling an ADB client does not prove the
remote finite recorder stopped. No global profiler stop, root, app launch or
tool download is implied.

`diagnostics_query` timeline/call-tree/flamegraph views expose private evidence.
`diagnostics_export` can write original unredacted native artifacts to an explicit
caller-owned path with `format:native_artifact` and `scope:all`; xctrace bundles
are tar archives. It never uploads or overwrites different existing bytes.

RN debugger/probe/profiler, Dart authenticated VM/inspector/object/retaining-path,
Android shared/system context and Apple explicit symbolication effects remain
covered by review. Fixtures cover native backends and modes, views, export,
missing scope and malformed arbitrary SQL/command requests across all profiles.
Policy review does not certify native tool versions or live device behavior.

Memory imports (`java-hprof`, producer memory graphs and resource series), object/
class/retainer/path/dominator queries and comparisons retain private-content
review in every profile. Apple Allocations and Leaks captures require separate
product opt-ins for allocation recording and heap inspection in addition to
attach. These can perturb execution; no forced GC, pressure/trim, automatic heap
dump or GUI memory-graph acquisition is registered by the memory workflow.
Fixtures cover the new CLI/MCP formats, memory views, missing effect opt-ins and
malformed evaluation/GC requests. Runtime model completeness, native heap size,
object identity and leak attribution are not implied by a policy decision.

Performance imports and queries retain private-content review across profiles:
startup milestones, FrameTimeline/Flutter/frame durations, interaction/media
references, distinct UI/accessibility/component trees, imported GPU observations
and package-size inventories. Perfetto's finite system trace also requests the
Android FrameTimeline data source under the existing explicit system-trace opt-in.
Fixtures cover both new formats, all performance operations, accessibility target
size options and malformed capture/evaluation requests. These do not authorize
automatic GPU capture, framework instrumentation or live acceptance, and do not
establish startup state, screen presentation or accessibility conformance.

Network/data imports and queries retain private-content review: HAR/runtime
request phases, exact scoped request/trace associations, message/service records,
classic PCAP headers and scalar snapshot/schema/read-plan queries. Both CLI and
MCP fixtures cover new formats, all operations, indexed null selection, scoped
request IDs and malformed SQL/decryption/flush requests. Existing authenticated
HTTP/proxy/storage owners retain their effects and permissions. Typed remote
exports do not establish pre-dispatch read-only/cost enforcement, authorize a
database shell, change trust/pinning, acquire live packets or repair data.

Scenario/context imports and queries remain private-content review operations:
lifecycle/media/peripheral/energy observations and setting-restoration reports.
Android state optionally reads app/user-scoped media/audio dump lines and fixed
locale/timezone/font-scale/rotation readbacks. No active audio/camera/radio probe,
setting write or automatic restore is introduced. Imported setting ownership and
receipt labels are not authority to mutate a device. Fixtures cover CLI/MCP
imports, optional Android groups, every scenario view and malformed active-restore
requests, preserving the existing explicit probe/mutation permission boundaries.

Runtime-check imports (`runtime-checks-v1`, `sanitizer-report-text`) and failure
queries retain private-content review in every profile. Chrome `page_debugger`
variable descriptors, evaluation, literal temporary logpoints and release keep
the opaque browser-send decision: Allow in Loose, Ask in Recommended/Strict.
Shared browser `act` keeps review in all profiles. Descriptor reads skip getters;
expressions, conditions and console logpoints can change execution and timing.
Diagnostic build declarations record claims; actual builder commands and
install/launch choices keep their existing permissions. Fixtures cover CLI/MCP
imports, failure correlation, debugger actions, shared logpoints, inline builds
and unknown native debugger fallback. Pack decisions do not establish native
LLDB/JDWP/DAP support, report attribution or live runtime compatibility.

`diagnostics plan` and `diagnostics_plan` expose built-in reproduction presets
without source reads, manager startup, target probes or execution. They are
Allow in every profile for supported selections; incomplete/unknown MCP preset
or platform fields retain Ask. CLI planning requires the platform option.
Planning a fault does not perform it or grant the existing controller/setter
authority. Marker collection, `reproduction-v1` imports and private comparisons
retain Ask across profiles. Independent fixtures cover every preset/platform,
missing selectors, markers, imports, malformed execution fields and an unknown
campaign-runner tool. No automated action replay, pressure injector or long
campaign runner is admitted by this pack update. Published 0.2.5 is unchanged.

Normalized runner results (`test-results-v1`), selected JUnit XML imports and
retained assertion queries remain Ask in every profile. Assertions use bounded
count, scalar equality and unit/definition-checked metric predicates over retained
data; they execute no app/host expression. Fixtures cover CLI/MCP imports, all six
assertion domains, metric thresholds, malformed evaluation and unknown runner
fallback. Existing declared project checks retain their command-execution review
and existing device/controller ownership. Artifact references and failure-buffer
claims are private producer data, not authority to read files or acquire control.
Native xcresult archives, automatic failure capture and live runner integration
are not certified by this policy update.

Embedded CDP discovery/observation and framework/runtime imports remain Ask across
profiles. Observation attaches one explicitly selected borrowed page and enables
Runtime/Page/Log/optional Network domains; it does not enable a debugging endpoint,
drive input or run expressions. Framework composition, symbols, target categories
and bridge links remain private producer claims. Independent CLI/MCP cases cover
both modes, all three formats, speedscope, malformed endpoint-enabling payloads
and unknown controller fallback. Native engine archives and live SDK compatibility
are not certified; imported links grant no file/process/device authority.

Selected `host_process` snapshots, exact `box_logs` operation tails and service/
runtime artifact imports remain Ask across all profiles. Native readers can spawn
fixed ps/PowerShell tools and read private selected-process metadata; Box remains
the lifecycle/log owner. Concrete CPU/JFR JSON/pprof/StackProf JSON/Xdebug/minidump
readers preserve native models and private data without executing imports or
acquiring remote/container/Kubernetes authority. Independent CLI/MCP cases cover
both sources, nine formats, malformed exec/signal payloads and unknown service
control fallback. Live runtime/OS ranges, remote credentials, supervisor actions
and privileged tracing are not granted or certified by this update.
