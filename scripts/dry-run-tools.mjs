// Reviewed read-only MCP identities. Applying tools and older dry-run arguments
// keep their existing permissions; aliases cannot apply even with extra fields.
export const previewSources = {
  gate: ['discard','rename','sync','migrate','branch_remove','session_remove','worktree_remove'],
  box: ['setup','config_sync','workspace_remove','workspace_update','content_apply','content_import',
    'roadmap_add','roadmap_update','roadmap_remove','criterion_add','criterion_update','criterion_remove',
    'blocker_add','blocker_update','blocker_resolve','blocker_reopen','blocker_remove',
    'evidence_add','evidence_update','evidence_remove','reference_add','reference_update','reference_remove',
    'note_add','note_update','note_remove','handoff_set','handoff_clear','review_acknowledge',
    'agent_preference_set','conversation_attach','conversation_update','conversation_detach','conversation_sync','conversation_observe',
    'conversation_operation_reconcile','conversation_operation_cancel','conversation_operation_abandon',
    'plugin_enable','plugin_disable','plugin_reset','plugin_binding_add','plugin_binding_remove',
    'plugin_workflow_run','plugin_workflow_resume','plugin_check'],
  hub: ['setup','workspace_remove','task_update','task_import','task_step_add','task_step_update','task_step_remove',
    'task_check_add','task_check_update','task_check_remove','task_note_add','task_note_update','task_note_remove',
    'plugin_enable','plugin_disable','plugin_reset','plugin_binding_add','plugin_binding_remove',
    'plugin_workflow_run','plugin_workflow_resume','plugin_check'],
  testrun: ['project_init'],
};

export function addPreviewTools(pack, name) {
  const aliases = previewSources[name].map(source => `${source}_preview`);
  for (const tool of aliases) {
    const rule = {id:`mcp-${tool}`, conditions:{domain:'mcp',server:name,tool},
      decision:{loose:'allow',recommended:'allow',strict:'allow'},
      reason:'Inspect the requested plan through a read-only tool that cannot apply changes.'};
    if (name === 'testrun') {
      rule.requirements = {fields:{'/root':{not:{exact:null}}},field_paths:{'/root':{relative_to:'project',path:{within:{root:'read'}}}}};
      rule.on_unmet = {decision:'ask',message:'Select an approved root for project inspection.'};
    }
    pack.rules.push(rule);
    if (name === 'box') {
      pack.preconditions.push({id:`mcp-${tool}-project`,conditions:{domain:'mcp',server:name,tool,fields:{'/project':{not:{exact:null}}}},
        requires_any:[{field_paths:{'/project':{absolute:true,path:{exact:{root:'project'}}}}}],
        on_unmet:{decision:'ask',message:'Select the enrolled checkout for preview inspection.'},
        reason:'An explicit current-checkout path preserves the preview decision.'});
    }
  }
  const fallback = pack.rules.find(rule => rule.id === 'mcp-unlisted');
  fallback.conditions.tool.not.one_of = [...new Set([...fallback.conditions.tool.not.one_of, ...aliases])];
}
