import {copyFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {applePack, appleInventory, tools} from './apple-policy.mjs';
import {appleCases} from './apple-cases.mjs';
import {splitCaseFiles} from './fixture-files.mjs';

export const directory = new URL('../packs/canonic/apple/0.1.0/', import.meta.url);
export const guide = `# Apple development permissions 0.1.0

One Apple ecosystem pack, including Xcode, Swift/SwiftPM, SwiftLint,
swift-format and CocoaPods. Requires Shield >=0.53.0, <1.0.0.
Reviewed on 2026-11-24 with installed
Xcode 26.3 (17C529), Apple Swift 6.2.4 and current official upstream references.
Installing the pack installs permissions only.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact listed installed-tool help/version and default SDK/developer-directory metadata | Allow | Allow | Allow |
| simctl device/runtime listings and devicectl device/DDI listings with checked output paths | Allow | Allow | Allow |
| swift-format format/lint, including swift format, with checked source/configuration paths | Allow | Allow | Ask |
| Explicit paths outside approved roots or protected state on those bounded operations | Ask | Ask | Ask |
| Builds, tests, manifests, scripts, compiler plugins/macros and CocoaPods | Ask | Ask | Deny |
| Device execution/lifecycle, data access, diagnostics, tracing, transfers and privacy/keychain changes | Ask | Ask | Deny |
| Signing, keychain access, notarization, installer packages and publication | Ask | Ask | Deny |
| Explicit simulator deletion/erasure/uninstall, replacement app data, runtime deletion and shared-cache removal | Ask | Deny | Deny |
| Physical-device app uninstall, DDI cleanup and unpair | Ask | Deny | Deny |
| Explicit keychain/password/certificate deletion or removal of trusted certificates | Ask | Deny | Deny |
| Unknown syntax for a recognized executable, unsupported xcrun selection/children | Ask | Ask | Deny |
| MCP requests, unrelated names and unrecognized executable locations | Ask | Ask | Ask |

## Builds, Swift and CocoaPods

Xcode project inspection and build settings remain reviewed. Package resolution,
schemes, scripts, provisioning and exports can execute code or access accounts.
Build settings such as CODE_SIGNING_ALLOWED=NO, a dry run or a lockfile option do
not establish a complete execution boundary. The same applies to Swift package
inspection: Package.swift is executable, plugins/macros can run during builds,
and resolution can acquire dependencies. Compiler inputs, response files,
custom SDKs, output paths and registry operations retain review.

CocoaPods loads Ruby Podfiles, podspecs, hooks and installed CLAide plugins.
Its installed-plugin startup keeps even help/version under review. Sources cover
core and common bundled plugin commands. Arbitrary plugin names retain the whole
invocation review. SwiftLint configuration can use remote/inherited inputs,
SourceKit and environment-provided file lists. Linting, analysis, corrections,
baselines and generated documentation therefore retain review. Native compilation
helpers, symbols, result bundles and coverage tools retain explicit file/content
review instead of assuming that a display command contains no private data.

## Devices and output paths

simctl list, runtime list and runtime match list use read-root checks for explicit
--set and --profiles paths. Every --json-output is checked against write roots,
including repeated and equals forms. Explicit --json-fd requires review because
the target descriptor's ownership is not established.

devicectl list devices and list preferredDDI check both JSON and logging outputs,
including -j/-l attached values and short clusters. --filter retains review for
predicate evaluation. Other display options need no individual allowance.
Installed help, not a live device connection, supplied the command inventory.
Listings can reveal device names and identifiers. Device-specific content,
diagnostics, logs, screenshots, pasteboards, app files, environment variables,
privacy permissions, pairing, launch/spawn and notifications remain reviewed.
No device, account, signing team or destination is implicitly authorized.

Destructive command classification remains restrictive with known global options
before or between command words. A dry-run-looking option does not relax the
destructive family. Other device operations still require review even when no
explicit target is supplied, since some tools choose a default or all devices.

## Swift formatting

swift-format and swift format share format/lint rules. Explicit source trees
use writable roots, including lint, because formatting modes can rewrite files.
--configuration uses read roots and --assume-filename uses write roots. All
occurrences are checked. Trees overlapping protected state require review.
Other style/display switches are accepted without per-option permissions.
--follow-symlinks requires review. Inline JSON configuration receives the same
conservative argument-path check; the pack does not interpret JSON fields as
permission for additional resources. No-file formatting transforms stdin
to stdout; an explicit '-' operand retains unresolved-input review.

Implicit ancestor configuration and environment selection remain host concerns.
These rules check submitted arguments and do not provide OS-level filesystem
confinement. Only use the automatic formatting profile with trusted project
configuration and a trusted installed formatter.

## Signing and submission

codesign, security, notarytool, altool, stapler, pkgbuild, productbuild,
productsign and pkgutil retain review for keys, identity, input contents,
installer scripts, destinations and account access. Stapler validation also
contacts Apple's ticket service. No signing, upload or account operation was
performed to validate this pack. Legacy altool notarization forms are reviewed
compatibility syntax; Apple's service no longer accepts that workflow. Use
notarytool for current notarization. Their presence is not a service guarantee.

## Launchers and executable identity

Direct names, /usr/bin, /usr/local/bin, /opt/homebrew/bin and the standard
Xcode.app developer/default-toolchain bin directories are recognized. Other
Xcode locations, custom toolchains and version-specific installation paths use
host fallback. Matching a path or basename does not authenticate executable bytes.

xcrun TOOL and its --run/-r forms reuse the Apple child rules and all their path
requirements. swift format is an alias of swift-format. This is an explicit
inventory of child tools, not permission to run an arbitrary xcrun child.
Explicit SDK/toolchain selection and cache changes retain review; the supported
destructive child forms remain denied in Recommended/Strict behind these selectors.
Ambiguous launcher/child option arities use whole-invocation review. For example,
xcrun's short -l means logging while devicectl's -l consumes an output file.
An outer short -l before devicectl retains Ask/Ask/Deny; the unambiguous outer
--log and child -l FILE retain the child's destructive classification.
Environment overrides such as DEVELOPER_DIR, TOOLCHAINS and SDKROOT, Ruby startup,
SwiftLint environment paths and configured tool discovery require host review.
There is no new general-purpose launcher parser or MCP integration in this pack.

Other installed packs retain their own authority. Baseline 0.17.0 explicitly
denies several direct security secret-read/export forms across every profile.
Those denials remain effective when composed. xcrun rules describe this pack's
Apple child policy; they do not copy another pack's or custom policy's rules.

## Inventory and sources

The complete executable/rule mapping is in commands.json. Each named operation
has independent fixtures across profiles. Whole-invocation rules classify tools
whose interfaces are flags or whose startup/effects retain review.

| Tool | Reviewed operations |
| --- | --- |
${Object.entries(tools).map(([name, tool]) => `| ${name} | ${tool.operations.length ? tool.operations.map(operation => '\u0060' + operation + '\u0060').join(', ') : 'Whole invocation'} |`).join('\n')}

Official sources include the
[Apple command-line reference](https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference),
installed Xcode man pages for xcrun, xcodebuild, xctrace, xcresulttool, xccov,
notarytool, stapler and agvtool, and installed simctl/devicectl help.
Swift coverage uses installed compiler/package/format help and the
[SwiftPM sources](https://github.com/swiftlang/swift-package-manager/tree/main/Sources/Commands).
[swift-format](https://github.com/swiftlang/swift-format),
[SwiftLint CLI sources](https://github.com/realm/SwiftLint/tree/main/Source/swiftlint/Commands),
[CocoaPods commands](https://guides.cocoapods.org/terminal/commands.html),
[CocoaPods startup](https://github.com/CocoaPods/CocoaPods/blob/master/lib/cocoapods/command.rb)
and [Apple notarization guidance](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)
provide upstream evidence. System signing/packaging and symbol tools follow
their installed macOS/Xcode manuals and retain reviewed whole-invocation effects.

No previously shipped permission or interface is retired by this initial pack.
Current help retains deprecated xcresulttool graph/formatDescription names, and
SwiftLint autocorrect and altool notarization spellings remain conservative
compatibility coverage. This does not assert that every installed version accepts
every listed form. Future retirement follows the registry maintenance window.

## Reproduction and validation

Canonical policy is scripts/apple-policy.mjs. Independent expectations are in
scripts/apple-cases.mjs. Regenerate with node scripts/build-apple-pack.mjs.
Validate with npm test -- --shield /absolute/path/to/shield scripts/apple-pack.test.mjs.
The suite checks schema/source admission, reproducibility, inventory coverage,
all profiles, malformed/outside/protected inputs, aliases/launchers and composition
with Baseline/Node. It evaluates policy without executing the fixture commands.
Real builds, connected devices, keychain access, signing, publication and native
agent-hook acceptance remain unverified and require separate scope.
`;

export async function buildApplePack() {
  const pack = applePack();
  await mkdir(directory, {recursive: true});
  for (const [name, data] of [['pack.yml', pack], ...splitCaseFiles(appleCases()), ['commands.json', appleInventory(pack)]])
    await writeFile(new URL(name, directory), JSON.stringify(data, null, 2) + '\n');
  await writeFile(new URL('README.md', directory), guide);
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildApplePack();
