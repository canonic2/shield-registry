import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdir, mkdtemp, realpath, rm, symlink, writeFile} from 'node:fs/promises';
import net from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {promisify} from 'node:util';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {directory} from './build-supabase-pack.mjs';

const exec = promisify(execFile);
const packPath = fileURLToPath(new URL('pack.yml', directory));
const id = 'a'.repeat(64);
const networkId = 'b'.repeat(64);
const otherId = 'c'.repeat(64);
const dbName = 'supabase_db_acme';
const networkName = 'supabase_network_acme';
const allow = ['allow', 'allow', 'allow'];
const review = ['ask', 'ask', 'deny'];

function dockerReplies() {
  const endpoint = aliases => ({NetworkID: networkId, Aliases: aliases});
  return {
    '/info': {ID: 'acme-engine', OSType: 'linux'},
    [`/containers/${id}/json`]: {
      Id: id,
      Name: `/${dbName}`,
      State: {Running: true, Paused: false, Restarting: false},
      Config: {Image: 'public.ecr.aws/supabase/postgres:17', Labels: {'com.supabase.cli.project': 'acme'}},
      HostConfig: {Privileged: false, NetworkMode: networkName},
      Mounts: [{Type: 'volume', Name: dbName}],
      NetworkSettings: {
        Ports: {'5432/tcp': [{HostIp: '0.0.0.0', HostPort: '54322'}]},
        Networks: {[networkName]: endpoint(['db', dbName])},
      },
    },
    [`/networks/${networkId}`]: {
      Id: networkId, Name: networkName, Driver: 'bridge', Scope: 'local',
      Containers: {[id]: {}, [otherId]: {}},
    },
    [`/containers/${otherId}/json`]: {
      Id: otherId, Name: '/supabase_api_acme',
      NetworkSettings: {Networks: {[networkName]: endpoint(['api'])}},
    },
    [`/volumes/${dbName}`]: {Driver: 'local', Options: null},
  };
}

test('bare Supabase pgTAP tests require both reviewed Docker routes and contained tests',
  {skip: !process.env.SHIELD_BINARY || process.platform === 'win32'}, async t => {
    const checkout = await realpath(await mkdtemp(join(tmpdir(), 'pg-')));
    t.after(() => rm(checkout, {recursive: true, force: true}));
    const tests = join(checkout, 'supabase/tests');
    const config = join(checkout, 'supabase/config.toml');
    const emptyBin = join(checkout, 'bin');
    const socketPath = join(checkout, '.docker/run/docker.sock');
    const contextHash = createHash('sha256').update('desktop-linux').digest('hex');
    const contextDir = join(checkout, '.docker/contexts/meta', contextHash);
    await mkdir(contextDir, {recursive: true});
    await mkdir(join(checkout, '.docker/run'), {recursive: true});
    await writeFile(join(checkout, '.docker/config.json'), JSON.stringify({currentContext: 'desktop-linux'}));
    await writeFile(join(contextDir, 'meta.json'), JSON.stringify({Endpoints: {docker: {Host: `unix://${socketPath}`}}}));
    await mkdir(tests, {recursive: true});
    await mkdir(emptyBin);
    const toml = 'project_id = "acme"\n[db]\nport = 54322\n';
    await writeFile(config, toml);
    await writeFile(join(tests, 'example.sql'), 'select 1;\n');

    let replies = dockerReplies();
    const accesses = [];
    const server = net.createServer(socket => {
      socket.once('data', bytes => {
        const route = /^GET (\S+) HTTP\/1\.0\r\n/.exec(bytes.toString())?.[1];
        accesses.push(route);
        const value = replies[route];
        const body = Buffer.from(JSON.stringify(value ?? {}));
        socket.end(Buffer.concat([
          Buffer.from(`HTTP/1.0 ${value ? '200 OK' : '404 Not Found'}\r\nContent-Length: ${body.length}\r\n\r\n`),
          body,
        ]));
      });
    });
    server.listen(socketPath);
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));

    const check = async (scenarios, requestPath = emptyBin) => {
      const cases = ['loose', 'recommended', 'strict'].flatMap((profile, index) =>
        scenarios.map(([name, source, expected, container = id]) => ({
          name: `${name}-${profile}`, profile, expected: expected[index],
          ...(container ? {variables: {test_db_container: container}} : {}),
          input: {kind: 'shell', source, dialect: 'bash', dialect_version: null, original_input: {}},
        })));
      const path = join(checkout, 'cases.json');
      await writeFile(path, JSON.stringify({schema_version: 1, cases}));
      const args = ['__internal', 'test-pack', '--pack', packPath, '--cases', path];
      if (requestPath !== null) args.push('--request-path', requestPath);
      const result = await exec(process.env.SHIELD_BINARY, args,
        {cwd: checkout, env: {...process.env, PATH: emptyBin}}).catch(error => error);
      const report = JSON.parse(result.stdout || '{}');
      assert.equal(report.passed, true, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
      assert.equal(report.cases.length, cases.length);
    };

    const command = 'supabase test db';
    await check([['missing-request-path', command, review]], null);
    assert.deepEqual(accesses, []);
    await check([
      ['verified', command, allow],
      ['requires-review-without-registration', command, review, null],
      ['loopback-url', `${command} --db-url postgresql://postgres@127.0.0.1:54322/postgres`, review],
      ['hosted-project', `${command} --remote`, review],
      ['alternate-stack', `${command} --stack=other`, review],
      ['alternate-test-file', `${command} supabase/tests/example.sql`, review],
      ['host-override', `SUPABASE_SERVICES_HOSTNAME=example.invalid ${command}`, review],
      ['daemon-override', `DOCKER_HOST=tcp://example.invalid:2375 ${command}`, review],
    ]);
    assert.deepEqual([...new Set(accesses)].sort(), Object.keys(replies).sort());

    replies[`/containers/${id}/json`].NetworkSettings.Ports['5432/tcp'][0].HostPort = '54324';
    await check([['wrong-published-port', command, review]]);
    replies = dockerReplies();
    replies[`/containers/${otherId}/json`].NetworkSettings.Networks[networkName].Aliases.push('db');
    await check([['ambiguous-db-alias', command, review]]);
    replies = dockerReplies();
    replies[`/volumes/${dbName}`].Options = {type: 'none', o: 'bind', device: '/outside'};
    await check([['redirected-volume', command, review]]);
    replies = dockerReplies();
    await check([['changed-container', command, review, otherId]]);

    const link = join(tests, 'linked.sql');
    await symlink('/outside/sql', link);
    await check([['linked-test-file', command, review]]);
    await rm(link);
    await writeFile(config, toml + '[experimental]\nstack = true\n');
    await check([['managed-stack', command, review]]);
  });
