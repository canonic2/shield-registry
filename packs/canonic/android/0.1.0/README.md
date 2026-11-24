# Android development permissions 0.1.0

Requires Shield `>=0.53.0, <1.0.0`. Reviewed on 2026-11-24 against Google's
[SDK tool inventory](https://developer.android.com/tools),
[ADB](https://developer.android.com/tools/adb),
[SDK Manager](https://developer.android.com/tools/sdkmanager),
[AVD Manager](https://developer.android.com/tools/avdmanager),
[emulator](https://developer.android.com/studio/run/emulator-commandline),
[bundletool](https://developer.android.com/tools/bundletool),
[apksigner](https://developer.android.com/tools/apksigner) and
[zipalign](https://developer.android.com/tools/zipalign) references.
Installed evidence includes ADB 35.0.2 help, emulator 35.5.10 help,
zipalign 37.0.0 usage, command-line tools 19.0 and build-tools 37.0.0 package metadata.
Documentation defines the remaining interfaces; no device or emulator was used.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Native ADB with exactly help or version | Allow | Allow | Allow |
| ADB device/server listings, device access, logs, shell and application changes | Ask | Ask | Deny |
| ADB file transfer, forwarding, pairing, root, reboot and sideload | Ask | Ask | Deny |
| Emulator information, launch, disk images, snapshots and data wiping | Ask | Ask | Deny |
| SDK/AVD listings, creation, install/update/removal and license acceptance | Ask | Ask | Deny |
| Bundle/APK inspection, generation, extraction, alignment, signing and deployment | Ask | Ask | Deny |
| Unknown modeled executable syntax, including missing arguments | Ask | Ask | Deny |
| MCP and unmodeled executables without another pack | Ask | Ask | Ask |

## Device and server authority

ADB device discovery can start its server. A serial, transport ID or USB/emulator
selector identifies a target but does not establish permission to access it.
Review selected devices, ADB server hosts/sockets, pairing, port forwarding,
logs and reports, shell/exec-out payloads, installation, package data clearing,
reboots and root or recovery operations. Dry-run transfers still read host files.
The pack does not automatically authorize a physical device or a disposable AVD.
It cannot prove device ownership, remote shell effects or device filesystem
boundaries. These require review rather than an automatic permission.

## SDK, emulator and artifacts

Review SDK roots, package repositories, proxies, downloaded code, license
acceptance and AVD paths. Emulator invocations can write disks and snapshots,
wipe data, expose networking, load images or launch QEMU/helpers. APK tools can
read archives and credentials, overwrite outputs, extract files or install onto
a device. Verification and listings retain review in this first candidate;
automatic path checks for archive inspection are not implemented.
SDK Java launchers and bundletool wrappers can execute code before help/version,
so they retain review for those forms too. Only native ADB's complete help and
version argument lists are automatically allowed; extra arguments return to review.

## Composition and host boundaries

Install the Java pack for JVM, Maven and general Gradle/gradlew invocation rules.
This pack does not duplicate or override Gradle. Android Gradle tasks retain the
Java pack's execution review, including SDK/device effects and signing.
The usual `java -jar bundletool.jar` launch is covered by Java execution review;
this pack models direct `bundletool` launchers. Interpreter-wrapped SDK scripts
also need their interpreter policy. Fastboot, aapt2, lint and apkanalyzer are not
modeled in this candidate and follow other installed policy or unknown fallback.

Bare names, POSIX SDK paths, Windows paths and .exe/.bat/.cmd launchers match.
Executable identity and inherited configuration remain host responsibilities,
including ANDROID_SERIAL, ADB server variables, ADB_VENDOR_KEYS, ANDROID_HOME,
ANDROID_USER_HOME, ANDROID_AVD_HOME, JAVA_TOOL_OPTIONS and JAVA_OPTS.
All restrictions are regular rules that survive a community pack's broad allow;
project custom policy retains Shield's normal authority. No MCP integration is
claimed. No device restrictions or path-sandbox proof are supplied by this pack.

## Validation

Independent fixtures exercise all three profiles, SDK/Windows launchers,
malformed syntax, unknown fallback and Java/Baseline composition. Live device
access, emulator lifecycle, downloads, builds, signing, deployment and native
Windows execution remain unverified.

Generate with `node scripts/build-android-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/android-pack.test.mjs`.
