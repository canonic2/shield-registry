// Reviewed from the generated tool names and schemas in the OpenAPI document
// bundled in @dopplerhq/mcp-server@1.0.5. Account capabilities, --read-only,
// and the server's project/config filters can expose a subset.
export const mcpMetadata = {
  projects_list: [],
  projects_get: ['project'],
  environments_list: ['project'],
  environments_get: ['project', 'environment'],
  configs_list: ['project'],
  configs_get: ['project', 'config'],
  secrets_names: ['project', 'config'],
};

export const mcpProtected = [
  // Secret and token reads.
  'secrets_list', 'secrets_get', 'secrets_download', 'service_tokens_list',
  'service_account_tokens_list', 'service_account_tokens_get',
  // Remote mutations, including lease and authentication operations.
  'workplace_update', 'users_update', 'workplace_roles_create', 'workplace_roles_update',
  'workplace_roles_delete', 'projects_create', 'projects_update', 'projects_delete',
  'project_roles_create', 'project_roles_update', 'project_roles_delete', 'project_members_add',
  'project_members_update', 'project_members_delete', 'environments_create', 'environments_delete',
  'environments_rename', 'configs_create', 'configs_update', 'configs_delete', 'configs_clone',
  'configs_lock', 'configs_unlock', 'configs_inheritable', 'configs_inherits', 'config_logs_rollback',
  'configs_add_trusted_ip', 'configs_delete_trusted_ip', 'secrets_update', 'secrets_delete',
  'secrets_update_note', 'integrations_create', 'integrations_update', 'integrations_delete',
  'syncs_create', 'syncs_delete', 'dynamic_secrets_issue_lease', 'dynamic_secrets_revoke_lease',
  'service_tokens_create', 'service_tokens_delete', 'groups_create', 'groups_update', 'groups_delete',
  'groups_add_member', 'groups_delete_member', 'service_accounts_create', 'service_accounts_update',
  'service_accounts_delete', 'service_account_tokens_create', 'service_account_tokens_delete',
  'webhooks_add', 'webhooks_update', 'webhooks_delete', 'webhooks_enable', 'webhooks_disable',
  'change_request_policies_create', 'change_request_policies_update', 'change_request_policies_delete',
  'auth_revoke', 'auth_oidc', 'workplace_service_account_identities_create',
  'workplace_service_account_identity_update', 'workplace_service_account_identity_delete',
  'workplace_change_requests_create', 'workplace_change_request_create', 'workplace_change_request_close',
  'workplace_change_request_assignees_update', 'workplace_change_requests_unit_status',
  'workplace_change_requests_unit_review', 'workplace_change_requests_unit_review_delete',
  'workplace_change_requests_unit_apply', 'integration_members_create', 'workplace_integration_members_delete',
  'integration_members_update',
];

export const mcpReview = [
  'workplace_get', 'users_list', 'users_get', 'workplace_roles_list', 'workplace_roles_get',
  'workplace_roles_list_permissions', 'activity_logs_list', 'activity_logs_retrieve', 'project_roles_list',
  'project_roles_get', 'project_roles_list_permissions', 'project_members_list', 'project_members_get',
  'config_logs_list', 'config_logs_get', 'configs_list_trusted_ips', 'integrations_list', 'integrations_get',
  'get_options', 'syncs_get', 'invites_list', 'groups_list', 'groups_get', 'retrieve_member',
  'service_accounts_list', 'service_accounts_get', 'webhooks_list', 'webhooks_get',
  'change_request_policies_list', 'change_request_policies_get', 'auth_me', 'audit_get_user',
  'workplace_service_account_identities_list', 'workplace_service_account_identity_get',
  'workplace_change_requests_list', 'workplace_change_request_get', 'workplace_change_requests_unit_get',
  'integration_members_list', 'workplace_integration_members_member_get', 'workplace_integration_members_get',
  'confirm_access',
];
