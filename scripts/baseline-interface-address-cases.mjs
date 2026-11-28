export function interfaceAddressCases() {
  const cases = [
    ['interface-address', ['ipconfig', 'getifaddr', 'en0'], 'allow'],
    ['interface-address-system-path', ['/usr/sbin/ipconfig', 'getifaddr', 'utun2'], 'allow'],
    ['interface-address-missing', ['ipconfig', 'getifaddr'], 'ask'],
    ['interface-address-empty', ['ipconfig', 'getifaddr', ''], 'ask'],
    ['interface-address-extra', ['ipconfig', 'getifaddr', 'en0', 'en1'], 'ask'],
    ['interface-address-option', ['ipconfig', 'getifaddr', '-en0'], 'ask'],
    ['interface-address-path', ['ipconfig', 'getifaddr', './en0'], 'ask'],
    ['interface-address-overlong', ['ipconfig', 'getifaddr', 'interface1234567'], 'ask'],
    ['interface-address-custom-binary', ['./ipconfig', 'getifaddr', 'en0'], 'ask'],
    ['interface-address-set', ['ipconfig', 'set', 'en0', 'DHCP'], 'ask'],
    ['interface-address-getpacket', ['/usr/sbin/ipconfig', 'getpacket', 'en0'], 'ask'],
    ['interface-address-windows-renew', ['ipconfig', '/renew'], 'ask'],
  ];
  return ['loose', 'recommended', 'strict'].flatMap(profile => [
    ...cases.map(([name, argv, expected]) => ({name: `${name}-${profile}`, profile, argv, expected})),
    {name: `interface-address-shell-${profile}`, profile, expected: 'allow', input: {
      kind: 'shell', dialect: 'posix', dialect_version: null, source: 'ipconfig getifaddr en0', original_input: {},
    }},
  ]);
}
