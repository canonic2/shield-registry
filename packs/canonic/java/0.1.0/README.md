# Java / JVM, Maven and Gradle permissions 0.1.0

Requires Shield `>=0.53.0, <1.0.0`. Reviewed using installed OpenJDK 17.0.18 help,
[JDK 27 tool specifications](https://docs.oracle.com/en/java/javase/27/docs/specs/man/index.html),
[JDK 25 tool specifications](https://docs.oracle.com/en/java/javase/25/docs/specs/man/index.html)
for retained tools, and the
[Maven 3.10.2 launcher](https://github.com/apache/maven/blob/maven-3.10.2/apache-maven/src/bin/mvn).
Maven is absent on the validation host. Its reviewed interfaces come from the
[Maven CLI reference](https://maven.apache.org/ref/3.9.11/maven-embedder/cli.html),
[configuration guide](https://maven.apache.org/configure.html),
[lifecycle guide](https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html)
and [wrapper guide](https://maven.apache.org/tools/wrapper/).
Gradle coverage is reviewed from the
[Gradle 9.9.2 CLI reference](https://docs.gradle.org/9.9.2/userguide/command_line_interface.html),
[wrapper guide](https://docs.gradle.org/9.9.2/userguide/gradle_wrapper.html),
[init-script guide](https://docs.gradle.org/9.9.2/userguide/init_scripts.html)
and [wrapper launcher](https://github.com/gradle/gradle/blob/v9.9.2/gradlew).
Gradle is also absent on the validation host.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact listed JDK help/version forms | Allow | Allow | Allow |
| Java application, source-file and module execution; JShell and scripting | Ask | Ask | Deny |
| Compilation, annotation processors, compiler plugins and doclets | Ask | Ask | Deny |
| Archive inspection/create/update/extract, runtime images and application packaging | Ask | Ask | Deny |
| Process listings, debugger/management attachment, dumps, recordings and listeners | Ask | Ask | Deny |
| Keystores, providers, certificate operations, signing and verification | Ask | Ask | Deny |
| Maven, Maven Wrapper and Maven Daemon, including help/version | Ask | Ask | Deny |
| Gradle and Gradle Wrapper, including reports, dry runs, help/version and daemon control | Ask | Ask | Deny |
| MCP calls | Ask | Ask | Ask |

## JDK execution and files

The generated command inventory lists every modeled JDK and build executable.
Exact JDK information forms take no extra arguments. Added JVM options, agents,
argument files or operands return the call to review. For example,
`java --version` is allowed, and `java -javaagent:./agent.jar --version`
requires review. `-J` options can pass JVM arguments through JDK tools.

Review source/class/JAR/module paths, processors and plugins, output paths and
archive extraction destinations. `javac -proc:none` still writes output and
retains the compilation decision. Diagnostics can reveal process arguments,
properties and heap contents, attach to other processes, run commands, write
files or expose management/debugging services. Keystore providers can load code.
All these effects require review, including inspection and verification forms.

## Maven within the Java pack

Maven belongs to this Java ecosystem pack. It executes build lifecycle phases,
plugins and extensions through the Java toolchain. The policy covers `mvn`,
`mvnw`, `./mvnw`, nested/absolute wrapper paths, `.cmd`/`.bat` launchers
and `mvnd`. Review wrapper code and distribution downloads, project POMs,
parents, profiles, extensions, settings, toolchains, repositories and credentials.

Maven startup scripts can source mavenrc files and use project JVM options
before the Java CLI handles help or version queries. A project wrapper is
executable project code. Every Maven invocation therefore keeps its review
decision, including `--help`, `--version`, offline mode, skipped tests and
`help:*` goals. `install` publishes to the local repository and `deploy`
can publish remotely. `clean`, dependency goals and arbitrary plugin goals
also retain review. Maven 3 and 4 command variations use the same boundary.

## Gradle within the Java pack

The Java pack covers `gradle`, `gradlew`, `./gradlew`, nested and absolute
wrapper paths, and Windows `.bat`/`.cmd` launchers. Review wrapper scripts,
distribution URLs and downloads, settings/build scripts, plugins, `buildSrc`,
included builds, init scripts, toolchains, caches and repositories.

Reports such as `tasks`, `projects`, `properties` and `dependencies` can
evaluate executable build configuration. `--dry-run`, `--offline` and
`--no-daemon` keep the operation's review decision. Init scripts can run
before settings and project scripts, including scripts discovered under
`GRADLE_USER_HOME` and `GRADLE_HOME`. Wrapper help/version calls retain
review because the wrapper launches executable code and may acquire Gradle.

Builds, tests, custom tasks, `clean`, `init`, `wrapper`, publication,
build-scan uploads, cache operations and daemon status/stop all require review.
Options before or after tasks follow the same rule. Java owns general Gradle
invocation permissions; Android workflow policy supplies SDK/device, signing
and deployment context when those tasks are used.

## Host and coverage boundaries

Executable identity, JDK selection and inherited environment remain host
responsibilities. This includes `JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS`,
`JDK_JAVAC_OPTIONS`, `_JAVA_OPTIONS`, `CLASSPATH`, `MAVEN_OPTS`,
`MAVEN_ARGS`, `GRADLE_OPTS`, `JAVA_OPTS`, `GRADLE_USER_HOME`,
`GRADLE_HOME` and build/JDK startup configuration. Standard Unix bin paths,
bare names and Windows executable names are modeled. Other JDK-home paths
and interpreter-wrapped launchers follow other installed policy or the host's
unknown-request fallback.

JVM, build and repository permissions are reviewed from the actual
inputs. The pack supplies no automatic code/path proof for those operations.
Its restrictions are regular pack rules and survive another community pack's
broad allowance. Project custom policy retains Shield's normal authority.
MCP calls follow other installed policy or unknown-request fallback.

Validation uses independent decision fixtures. Live Maven/Gradle builds, repository
publication, signing, JVM attachment and cross-platform execution have separate
acceptance scope.

Generate with `node scripts/build-java-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/java-pack.test.mjs`.
