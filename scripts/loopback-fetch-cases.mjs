// Independent expected decisions for read-only fetches from this machine's
// loopback services, shared by the artifact and its focused suite.
const profiles = ['loose', 'recommended', 'strict'];

export function loopbackFetchCases() {
  // [name, shell source, decisions for loose, recommended, strict]
  const examples = [
    // Local development servers and workspace gateways are everyday reads.
    ['gateway-subdomain', 'curl -s -m 10 http://loki.acme.localhost:59967/loki/api/v1/label/service_name/values', ['allow', 'allow', 'ask']],
    ['readiness-probe', "curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:49396/__hub/ready", ['allow', 'allow', 'ask']],
    ['localhost-port', 'curl -fsS http://localhost:3000/health', ['allow', 'allow', 'ask']],
    ['https-head', 'curl -sI https://localhost:8443/', ['allow', 'allow', 'ask']],
    ['wget-stdout', 'wget --no-hsts --max-redirect=0 -q -O - http://localhost:3000/', ['allow', 'allow', 'ask']],
    ['pipeline-filter', 'curl -s http://localhost:3000/api/items | head -20', ['allow', 'allow', 'ask']],
    ['output-in-project', 'curl -s -o result.json http://localhost:3000/data', ['allow', 'allow', 'ask']],
    // A redirect can leave loopback unobserved; the fetch is no longer local.
    ['follow-redirects', 'curl -sL http://localhost:3000/', ['ask', 'ask', 'ask']],
    ['wget-follows-by-default', 'wget --no-hsts -q -O - http://localhost:3000/', ['ask', 'ask', 'ask']],
    // Lookalike and other hosts are not loopback.
    ['lookalike-suffix', 'curl -s http://localhost.example.com/', ['ask', 'ask', 'ask']],
    ['lookalike-prefix', 'curl -s http://notlocalhost/', ['ask', 'ask', 'ask']],
    ['other-loopback-address', 'curl -s http://127.0.0.2:3000/', ['ask', 'ask', 'ask']],
    // Brackets are curl URL globbing, so IPv6 literals are not a recognized fetch.
    ['ipv6-loopback', 'curl -s http://[::1]:8080/status', ['ask', 'ask', 'ask']],
    ['external-host', 'curl -s https://example.com/', ['ask', 'ask', 'ask']],
    // Forms outside the read-only subset keep their review.
    ['credentials', 'curl -s -u guest:guest http://rabbitmq.acme.localhost:59967/api/queues', ['ask', 'ask', 'ask']],
    ['post', 'curl -s -X POST http://localhost:3000/items', ['ask', 'ask', 'ask']],
    ['upload', 'curl -s -d @notes.txt http://localhost:3000/items', ['ask', 'ask', 'ask']],
    // The output write keeps its own location boundary.
    ['output-outside', 'curl -s -o ../outside http://localhost:3000/data', ['deny', 'deny', 'deny']],
    ['output-git', 'curl -s -o .git/config http://localhost:3000/data', ['deny', 'deny', 'deny']],
  ];
  return examples.flatMap(([name, source, decisions]) => profiles.map((profile, index) => ({
    name: `loopback-${name}-${profile}`,
    profile,
    input: {kind: 'shell', source, dialect: 'bash', dialect_version: null, original_input: {}},
    expected: decisions[index],
  })));
}
