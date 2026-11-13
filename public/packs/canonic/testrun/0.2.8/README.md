# Testrun 0.2.8 permission coverage

Requires Shield `>=0.20.0, <1.0.0`. Publication and project activation are separate.

Retains every Testrun 0.2.7 CLI/MCP decision and adds browser interception
coverage for the next Testrun build. No tool names are added, renamed or retired.

Route callback replies remain isolated-browser actions: `route_abort` with an
`errorCode` and `route_fulfill` with `status`, `body`, `json`, `contentType` or
`headers` keep the existing `browser_send` isolated decision (Loose and
Recommended Allow, Strict Ask).

`route_fulfill` with a `path` makes the Testrun manager read a host file of up to
1 MiB and serve it to the page. Relative paths resolve against the caller's
working directory. Like other host-file transfer through `browser_send`, it
leaves the isolated allowance: Loose Allow, Recommended and Strict Ask. Batches
containing such a reply keep the tool's own decision.

`network_route` clearing with `behavior: "default"` or `"ignoreErrors"`, which
continues paused requests to the network, keeps the existing `browser_send`
decision for routing changes. `recordHar.omitContent` and relative
`recordHar.path` binding change no decision; context creation and connection
retain their existing review.

Independent MCP cases cover abort codes, JSON fulfill, absolute, relative and
batched file fulfill, and non-waiting clear across every profile.
