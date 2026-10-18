// Fold only identical argv bodies with disjoint explicit executable aliases.
// File rules and every requirement, fallback and feedback field stay intact.
export function compactBaselinePack(source) {
  const pack = structuredClone(source);
  const groups = new Map();
  const rules = [];
  const families = {};
  for (const original of source.rules) {
    const aliases = original.conditions.executable?.one_of;
    if (original.conditions.domain !== 'argv' || !Array.isArray(aliases) || aliases.some(name => typeof name !== 'string')) {
      rules.push(structuredClone(original));
      families[original.id] = [original.id];
      continue;
    }
    const body = structuredClone(original);
    delete body.id;
    delete body.conditions.executable;
    const key = JSON.stringify(body);
    let group = groups.get(key);
    if (group && aliases.some(name => group.aliases.has(name))) {
      throw Error(`Overlapping executable members in ${original.id}`);
    }
    if (!group) {
      const rule = structuredClone(original);
      group = { rule, aliases: new Set(), members: [] };
      groups.set(key, group);
      rules.push(rule);
    }
    group.members.push(original.id);
    for (const alias of aliases) group.aliases.add(alias);
  }
  for (const { rule, aliases, members } of groups.values()) {
    if (members.length > 1) rule.id = `shared-${members[0]}`;
    rule.conditions.executable = { one_of: [...aliases] };
    families[rule.id] = members;
  }
  pack.rules = rules;
  return { pack, families };
}
