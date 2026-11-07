# Security reporting

Report suspected permission bypasses, credential disclosure, signing-key
compromise, catalog tampering or unsafe acquisition behavior privately before
sharing exploit details publicly.

## Contact maintainers

Use **Report a vulnerability** on the repository's
[Security tab](https://github.com/canonic2/shield-registry/security) if that
option is available. If it is unavailable, open an
[issue](https://github.com/canonic2/shield-registry/issues/new) titled
**Private security contact requested**, asking only for a private reporting
channel. Keep the vulnerability details out of that public issue.

Once a private channel is established, include the affected pack/version,
profile, Shield and tool versions, a minimal reproduction, expected and actual
decisions, and the potential impact. Use synthetic credentials and examples.
Never send an actual private signing key or access token.

## Scope and fixes

This repository owns permission-pack policy and registry publication. Shield's
evaluator and host integrations live in the
[client repository](https://github.com/canonic2/canonic/tree/main/packages/shield).
If the boundary is unclear, describe the observed behavior so it can be triaged.

Published pack bytes and companion assets are immutable. Policy fixes are
distributed as new versions and require reviewed updates in consuming projects.
Retaining an older release for pinned installation is not a promise of continued
security maintenance. Do not assume that a catalog publication changes an
installed project's permissions.
