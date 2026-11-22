# Baseline permissions 0.17.0

Supports Shield `>=0.49.0, <1.0.0`.

Read-only fetches from development servers on this machine are allowed in
Loose and Recommended, and ask in Strict. They cover `localhost` and every
`*.localhost` name, such as `http://api.acme.localhost:8080/`, plus
`127.0.0.1`, over HTTP or HTTPS on any port. The fetch must be
a GET or HEAD request from a recognized curl or wget command that does not
follow redirects, for example `curl -fsS http://localhost:3000/health` or
`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/ready`.

Other forms keep their review. `curl -L`, and wget without
`--max-redirect=0`, can follow a redirect off this machine, so they ask. Other
loopback addresses such as `127.0.0.2` and IPv6 URLs such as
`http://[::1]:8080/`, whose brackets curl treats as globbing, lookalike names such as
`localhost.example.com`, uploads, other methods and credential options
(`-u`, `-n`) also ask. An output file named with `-o` or `-O` keeps the
existing write boundary: paths outside the approved locations and protected
files are refused. This rule applies to shell fetches only; an agent's own fetch
tool keeps its existing decision.

Other rules, profiles and cases match [0.16.0](../0.16.0/README.md).

Generate with `node scripts/build-baseline-loopback.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/baseline-loopback.test.mjs`.
Published previous releases retain their original bytes. This source candidate
does not activate policy in existing projects.

Licensed under MIT.
