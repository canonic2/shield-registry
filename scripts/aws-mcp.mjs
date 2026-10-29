// AWS's documented hosted-server tool inventory, reviewed 2026-10-28:
// https://docs.aws.amazon.com/agent-toolkit/latest/userguide/understanding-mcp-server-tools.html
// https://github.com/aws/mcp-proxy-for-aws
// No script inspection or implicit transfer of CLI permissions.
const server = {one_of: ['hosted', 'hosted-profile']};
const knowledge = ['aws___retrieve_skill', 'aws___search_documentation', 'aws___read_documentation',
  'aws___list_regions', 'aws___get_regional_availability'];
const conditions = tool => ({domain: 'mcp', server, tool});

export const integrations = {hosted: {transport: 'stdio', fields: {
  '/command': {text: {one_of: ['uvx', '/usr/local/bin/uvx', '/opt/homebrew/bin/uvx']}},
  '/args/0': {exact: 'mcp-proxy-for-aws-cli@1.7.0'},
  '/args/1': {exact: 'https://aws-mcp.us-east-1.api.aws/mcp'},
}, effective_fields: {profile: {argument: '/aws_profile', default: '/env/AWS_MCP_PROXY_PROFILES'}},
defaults: {type: 'stdio', command: 'uvx', args: ['mcp-proxy-for-aws-cli@1.7.0', 'https://aws-mcp.us-east-1.api.aws/mcp'], env: {}}}};
integrations['hosted-profile'] = {...integrations.hosted, defaults: {...integrations.hosted.defaults, env: {AWS_MCP_PROXY_PROFILES: {var: 'profile'}}}};

export function rules(decisions) {
  return [
    {id: 'mcp-knowledge', decision: 'allow', conditions: conditions({one_of: knowledge}), reason: 'Retrieve AWS public documentation, skills and regional availability.'},
    {id: 'mcp-script', decision: decisions.execute, conditions: conditions('aws___run_script'), reason: 'Execute Python with AWS API access; CLI inspection permissions do not classify the script.'},
    {id: 'mcp-presigned-url', decision: decisions.access, conditions: conditions('aws___get_presigned_url'), reason: 'Create a bearer URL granting upload or download access.'},
    {id: 'mcp-task-results', decision: decisions.data, conditions: conditions('aws___get_tasks'), reason: 'Read results of a prior AWS script, potentially including customer data or credentials.'},
    {id: 'mcp-unlisted', fallback: true, decision: decisions.unlisted, conditions: conditions({not: {one_of: [...knowledge, 'aws___run_script', 'aws___get_presigned_url', 'aws___get_tasks']}}), reason: 'Unknown hosted AWS MCP tools require review.'},
  ];
}

export function gates() {
  // New or legacy tools must not bypass mandatory gates before classification.
  const scoped = conditions({not: {one_of: knowledge}});
  return [
    {id: 'mcp-required-profile', when: [{var: 'profile', set: true}], conditions: scoped,
      requires_any: [{connection: {'/effective/profile': {text: {var: 'profile'}}, '/transport/env/AWS_MCP_PROXY_PROFILES': {text: {var: 'profile'}}}}],
      on_unmet: {decision: 'deny', message: 'AWS MCP API calls require the approved effective profile and the same single reviewed connector profile.'}},
    {id: 'mcp-single-profile', when: [{var: 'blocked_profiles', set: true}], conditions: scoped,
      requires_any: [{connection: {'/transport/env/AWS_MCP_PROXY_PROFILES': {text: {regex: '[A-Za-z0-9][A-Za-z0-9_.@+-]*'}}}}],
      on_unmet: {decision: 'deny', message: 'A blocked-profile restriction requires one explicit reviewed connector profile; ambient or multi-profile connections are unsupported.'}},
    {id: 'mcp-blocked-profiles', when: [{var: 'blocked_profiles', set: true}], conditions: scoped,
      requires_any: [{connection: {'/effective/profile': {text: {not: {var: 'blocked_profiles'}}}, '/transport/env/AWS_MCP_PROXY_PROFILES': {text: {not: {var: 'blocked_profiles'}}}}}],
      on_unmet: {decision: 'deny', message: 'AWS MCP API calls must explicitly name a profile outside the blocked list.'}},
    {id: 'mcp-operation-region', when: [{var: 'regions', set: true}], conditions: scoped,
      requires_any: [{connection: {'/verified/operation_region': {text: {var: 'regions'}}}}],
      on_unmet: {decision: 'deny', message: 'AWS MCP API calls are blocked: launch region metadata cannot establish the regions used by Python scripts or task results.'}},
  ];
}
