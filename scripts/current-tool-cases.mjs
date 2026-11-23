// Expected outcomes are reviewed independently from the policy constructors.
import {readFile} from 'node:fs/promises';
import {applyTrustedTestrunExpectations} from './testrun-trusted-cases.mjs';

const profiles = ['loose','recommended','strict'];
const allow = ['allow','allow','allow'];
const routine = ['allow','allow','ask'];
const change = ['allow','ask','ask'];
const review = ['ask','ask','ask'];
const destroy = ['ask','ask','deny'];
const confirmedChange = ['allow','allow','deny'];

export async function currentToolCases(name) {
  const previous = new URL(`../packs/canonic/${name}/0.2.1/cases.json`,import.meta.url);
  const cases = JSON.parse(await readFile(previous));
  if (name === 'box') {
    // These names are not exposed by Box 0.29; current fixtures review them as unknown.
    for (const row of cases.cases) {
      if (['box_docs_list','box_docs_search','box_docs_read'].includes(row.input?.tool))
        row.expected = 'ask';
    }
    // A plain workspace_remove deletes resources, so Strict denies it in
    // another project as it does any other deletion.
    for (const row of cases.cases) if (row.name === 'mcp-remove-project-strict') row.expected = 'deny';
  }
  if (name === 'testrun') {
    // Explicit targets now select either mobile input or opaque browser batches.
    for (const row of cases.cases) if (row.argv?.includes('act') && row.argv.includes('--target')
      || row.argv?.includes('connect') && row.argv.includes('--engine')) row.expected = 'ask';
    // The previous generic action fixture used an obsolete pre-schema shape.
    for (const row of cases.cases) if (row.name === `mcp-device-action-${row.profile}`)
      row.input.arguments = {actions:[{action:'tap',point:{x:0.5,y:0.5}}]};
  }
  if (name === 'gate') {
    // Unlisted commands and tools are everyday use outside Strict, and Loose
    // allows amending the last commit.
    const relaxed = {'unknown-loose':'allow','unknown-recommended':'allow',
      'mcp-unknown-loose':'allow','mcp-unknown-recommended':'allow',
      'switch-project-amend-loose':'allow','routine-8-loose':'allow'};
    for (const row of cases.cases) if (row.name in relaxed) row.expected = relaxed[row.name];
  }
  const cli = [];
  const mcp = [];
  if (name === 'gate') {
    for (const [tool, args] of [
      ['diff',{repo:'acme',staged:true,paths:['src']}],
      ['check',{repo:'acme',history:'HEAD'}],
      ['explain',{paths:['src']}],
      ['doctor',{}],
      ['remote_show',{repo:'acme',name:'origin'}],
      ['branch_list',{all_repos:true}],
      ['session_status',{repo:'acme'}],
      ['worktree_list',{}],
      ['worktree_status',{}],
      ['session_start',{repo:'acme'}],
      ['session_stop',{repo:'acme'}],
      ['session_resume',{session:'acme'}],
      ['session_promote',{session:'acme',branch:'feature'}],
    ]) {
      mcp.push([`catalog-${tool}`,tool,args,allow]);
      mcp.push([`catalog-${tool}-malformed`,tool,{repo:42,session:null,paths:'invalid'},allow]);
    }
    for (const [verb, operands] of [
      ['set-url',['origin','https://example.com/acme-new.git']],
      ['rename',['origin','upstream']],
      ['remove',['origin']],
      ['rm',['origin']],
    ]) {
      const command = ['gate','remote',verb,'-r','acme',...operands];
      cli.push(
        [`remote-${verb}-review`,command,allow],
        [`remote-${verb}-dry-run`,[...command,'--dry-run'],allow],
        [`remote-${verb}-confirm`,[...command,'--confirm','digest'],destroy],
        [`remote-${verb}-confirm-equals`,['gate','remote','--json',verb,'--confirm=digest','--repo=acme',...operands],destroy],
        [`remote-${verb}-confirm-with-config`,[...command,'--config','acme.yml','--confirm=digest'],destroy],
        [`remote-${verb}-dry-run-outside`,[...command,'--dry-run','--project','/outside/other'],review],
        [`remote-${verb}-confirm-outside`,[...command,'--confirm=digest','--project=/outside/other'],destroy],
        [`remote-${verb}-confirm-looks-like-preview`,[...command,'--confirm=--dry-run'],destroy],
      );
    }
    for (const [tool, args] of [
      ['remote_set_url',{repo:'acme',name:'origin',url:'https://example.com/acme-new.git'}],
      ['remote_rename',{repo:'acme',name:'origin',new_name:'upstream'}],
      ['remote_remove',{repo:'acme',name:'origin'}],
    ]) {
      mcp.push(
        [tool,tool,args,confirmedChange],
        [`${tool}-invalid`,tool,{repo:42,name:null,dry_run:true},confirmedChange],
        [`${tool}-outside`,tool,{...args,project:'/outside/other'},destroy],
        [`${tool}-preview`,`${tool}_preview`,args,allow],
        [`${tool}-preview-invalid`,`${tool}_preview`,{name:42,confirm:'untrusted'},allow],
        [`${tool}-preview-outside`,`${tool}_preview`,{...args,project:'/outside/other'},review],
      );
    }
    // A local destination is a config value here. Transport is a separate operation.
    const localUrl = '/outside/acme/remote.git';
    const localSetUrl = ['gate','remote','set-url','-r','acme','origin',localUrl];
    const localRemote = {repo:'acme',name:'origin',url:localUrl};
    mcp.push(
      ['remote-set-url-local','remote_set_url',localRemote,confirmedChange],
      ['remote-set-url-local-preview','remote_set_url_preview',localRemote,allow],
    );
    cli.push(
      ['remote-set-url-local-review',localSetUrl,allow],
      ['remote-set-url-local-confirm',[...localSetUrl,'--confirm=digest'],destroy],
      ['worktree-status-runtime',['gate','--json','worktree','status','--runtime'],allow],
      ['worktree-status-runtime-outside',['gate','worktree','status','--runtime','--project=/outside/other'],review],
      ['docs-list',['gate','docs','list','--cursor','opaque','--limit','2','--json'],allow],
      ['docs-search',['gate','docs','search','worktrees','--path','native-worktrees.md','--cursor','opaque','--limit','2'],allow],
      ['docs-read',['gate','docs','read','native-worktrees.md','--cursor','opaque','--limit','2'],allow],
      ['docs-invalid-limit',['gate','docs','list','--limit','0'],allow],
      ['docs-missing-path',['gate','docs','read'],allow],
      ['docs-host-path',['gate','docs','read','/outside/private.txt'],allow],
      ['portable-status',['gate','status','-r','acme'],allow],
      ['workspace-base-entries',['gate','status','--all-repos','--entries-only'],allow],
      ['portable-stage',['gate','add','-r','acme','packages/acme'],allow],
      ['portable-status-outside',['gate','--project','/outside/other','status'],review],
      ['rename-preview',['gate','rename','-r','acme','private'],allow],
      ['rename-confirm',['gate','rename','-r','acme','private','--confirm','digest'],change],
      ['discard-preview',['gate','discard','-r','acme','--all','--dry-run'],allow],
      ['discard',['gate','discard','-r','acme','--all'],destroy],
      ['discard-confirm-dry-token',['gate','discard','-r','acme','--all','--confirm','--dry-run'],destroy],
      ['discard-repo-dry-token',['gate','discard','--repo','--dry-run','--all','--confirm','digest'],destroy],
      ['worktree-discard',['gate','worktree','remove','.gate/worktrees/feature','--discard-changes','--confirm','digest'],destroy],
      // Gate's in-project worktree location; .gate/tasks and .gate/workspaces
      // remain for older installed versions.
      ['worktree-add',['gate','worktree','add','-b','feature','.gate/worktrees/feature'],allow],
      ['worktree-add-name',['gate','worktree','--json','add','.gate/worktrees/feature','--branch=feature','--name','fix'],allow],
      ['worktree-add-escape',['gate','worktree','add','-b','feature','.gate/worktrees/../../../feature'],review],
      ['worktree-add-protected',['gate','worktree','add','-b','feature','.git/worktrees/feature'],review],
      ['worktree-remove-plan',['gate','worktree','remove','.gate/worktrees/feature'],allow],
      ['retained-tasks-worktree-add',['gate','worktree','add','-b','feature','.gate/tasks/feature'],allow],
      ['retained-workspaces-worktree-add',['gate','worktree','add','-b','feature','.gate/workspaces/feature'],allow],
      // Unlisted commands and options inside the project are everyday use;
      // Strict still reviews them.
      ['unknown',['gate','unknown-operation'],routine],
      ['unknown-option',['gate','status','--future-option'],allow],
      ['unknown-command-option',['gate','future-command','--future-option','value'],routine],
      ['unknown-worktree-option',['gate','worktree','add','--future-option','.gate/worktrees/feature'],allow],
      ['unknown-worktree-option-outside',['gate','worktree','add','--future-option','/outside/feature'],review],
      ['unknown-project-outside',['gate','--project','/outside/other','future-command'],review],
      ['unknown-project-protected',['gate','future-command','--project','.ssh'],review],
      ['amend',['gate','commit','-r','acme','--amend','-m','fix'],change],
      ['worktree-remove-confirm',['gate','worktree','remove','.gate/worktrees/feature','--confirm','digest'],routine],
      // Harmful forms keep their review.
      ['stage-ignored',['gate','add','-r','acme','--force','build'],change],
      ['push',['gate','push','-r','acme','origin','main'],change],
      ['force-push',['gate','push','-r','acme','origin','main','--force-with-lease','0123abcd'],destroy],
      // Destination branch selection changes no permission effect. Gate owns
      // literal branch validation and remote-ref lease enforcement.
      ['push-destination',['gate','push','-r','acme','origin','review','--destination','main'],change],
      ['push-destination-equals',['gate','push','--destination=main','origin','review'],change],
      ['push-destination-missing',['gate','push','origin','review','--destination'],change],
      ['push-destination-outside',['gate','--project','/outside/other','push','origin','review','--destination','main'],review],
      ['push-destination-lease',['gate','push','origin','review','--destination','main','--force-with-lease','0123456789abcdef0123456789abcdef01234567'],destroy],
      ['push-destination-lease-equals',['gate','push','--force-with-lease=0123456789abcdef0123456789abcdef01234567','--destination=main','origin','review'],destroy],
      ['push-destination-lease-outside',['gate','--project','/outside/other','push','origin','review','--destination','main','--force-with-lease=0123456789abcdef0123456789abcdef01234567'],destroy],
      ['branch-force',['gate','branch','remove','-r','acme','old','--force'],destroy],
      ['remote-add',['gate','remote','add','-r','acme','origin','https://example.com/acme.git'],change],
      ['sync-apply',['gate','sync'],change],
      // --config names the policy file Gate reads, before or after the command.
      // Gate refuses a file it has not accepted until `gate sync` accepts it.
      ['config-status',['gate','--config','acme.yml','status'],allow],
      ['config-status-after',['gate','status','--config=acme.yml'],allow],
      ['config-stage',['gate','--config','acme.yml','add','-r','acme','packages/acme'],allow],
      ['config-sync-preview',['gate','--config','acme.yml','sync','--dry-run'],allow],
      ['config-worktree-add',['gate','worktree','add','--config','acme.yml','-b','feature','.gate/worktrees/feature'],allow],
      ['config-status-outside',['gate','status','--config','/outside/gate.yml'],allow],
      ['config-leading-outside',['gate','--config','/outside/gate.yml','status'],allow],
      ['config-status-escape',['gate','status','--config','../outside/gate.yml'],allow],
      ['config-missing-value',['gate','status','--config'],review],
      ['config-sync-outside',['gate','--config','/outside/gate.yml','sync'],change],
      ['config-discard',['gate','--config','acme.yml','discard','-r','acme','--all'],destroy],
      ['config-discard-outside',['gate','discard','-r','acme','--all','--config','/outside/gate.yml'],destroy],
      ['config-discard-preview-outside',['gate','discard','-r','acme','--all','--dry-run','--config','/outside/gate.yml'],allow],
      ['config-discard-dry-token',['gate','discard','-r','acme','--all','--config','--dry-run'],destroy],
      ['config-force-push-outside',['gate','push','origin','main','--force-with-lease','0123abcd','--config','/outside/gate.yml'],destroy],
      ['config-branch-force-outside',['gate','--config','/outside/gate.yml','branch','remove','-r','acme','old','--force'],destroy],
    );
    mcp.push(
      ['portable-status','status',{repo:'acme'},allow],
      ['portable-stage','add',{repo:'acme',paths:['packages/acme']},allow],
      ['portable-stage-outside','add',{repo:'acme',paths:['packages/acme'],project:'/outside/other'},review],
      ['docs-list','docs_list',{offset:0,limit:10},allow],
      ['docs-list-cursor','docs_list',{cursor:'opaque',limit:2},allow],
      ['docs-search-cursor','docs_search',{query:'worktrees',path:'native-worktrees.md',cursor:'opaque',limit:2},allow],
      ['docs-read-cursor','docs_read',{path:'native-worktrees.md',cursor:'opaque',limit:2},allow],
      ['retained-docs-search-offset','docs_search',{query:'worktrees',offset:1,limit:2},allow],
      ['retained-docs-read-start-line','docs_read',{path:'native-worktrees.md',start_line:2,limit:2},allow],
      ['docs-invalid-limit','docs_list',{limit:0},allow],
      ['docs-invalid-cursor','docs_read',{path:'README.md',cursor:42},allow],
      ['docs-search','docs_search',{query:'worktrees'},allow],
      ['docs-read','docs_read',{path:'native-worktrees.md'},allow],
      // Documentation is bundled, so malformed paths never acquire host-file
      // access; Gate owns schema and bundle-path rejection after admission.
      ['docs-read-missing','docs_read',{},allow],
      ['docs-read-host-path','docs_read',{path:'/outside/private.txt'},allow],
      ...['gate_docs_list','gate_docs_search','gate_docs_read'].map(tool =>
        [`retained-${tool}`,tool,{path:'native-worktrees.md',query:'worktrees'},allow]),
      ['unknown','future_tool',{},routine],
      ['unknown-field','status',{repo:'acme',future_field:true},allow],
      ['amend','commit',{repo:'acme',message:'fix',amend:true},change],
      ['stage-ignored','add',{repo:'acme',paths:['build'],force:true},change],
      ['push-destination','push',{repo:'acme',remote:'origin',branch:'review',destination_branch:'main'},allow],
      ['push-destination-malformed','push',{repo:'acme',remote:'origin',branch:'review',destination_branch:42},allow],
      ['push-destination-outside','push',{repo:'acme',remote:'origin',branch:'review',destination_branch:'main',project:'/outside/other'},review],
      ['push-destination-lease','push',{repo:'acme',remote:'origin',branch:'review',destination_branch:'main',force_with_lease:'0123456789abcdef0123456789abcdef01234567'},['allow','allow','deny']],
      ['push-destination-lease-outside','push',{repo:'acme',remote:'origin',branch:'review',destination_branch:'main',force_with_lease:'0123456789abcdef0123456789abcdef01234567',project:'/outside/other'},destroy],
      ['remote-add','remote_add',{repo:'acme',name:'origin',url:'https://example.com/acme.git'},change],
      ['rename','rename',{repo:'acme',new_id:'private'},routine],
      ['rename-project-outside','rename',{repo:'acme',new_id:'private',project:'/outside/other'},review],
      ['discard','discard',{repo:'acme',all:true},confirmedChange],
      ['discard-paths','discard',{repo:'acme',paths:['src/main.rs']},confirmedChange],
      ['discard-untracked','discard',{repo:'acme',all:true,untracked:true},confirmedChange],
      ['discard-resume','discard',{resume:'acme'},confirmedChange],
      ['discard-abandon','discard',{resume:'acme',abandon:true},confirmedChange],
      ['discard-outside','discard',{repo:'acme',all:true,project:'/outside/other'},destroy],
      ['discard-invalid-project','discard',{repo:'acme',all:true,project:42},destroy],
      ['discard-invalid-selection','discard',{repo:'acme',all:true,paths:['src']},confirmedChange],
      ['discard-preview','discard',{repo:'acme',all:true,untracked:true,dry_run:true},allow],
      ['discard-preview-outside','discard',{repo:'acme',all:true,dry_run:true,project:'/outside/other'},destroy],
      ['worktree-discard','worktree_remove',{path:'.gate/worktrees/feature',discard_changes:true},confirmedChange],
      ['worktree-discard-outside','worktree_remove',{path:'/outside/feature',discard_changes:true},destroy],
      ['worktree-discard-protected','worktree_remove',{path:'.git/worktrees/feature',discard_changes:true},destroy],
      ['worktree-discard-branch','worktree_remove',{path:'.gate/worktrees/feature',discard_changes:true,remove_branch:true},destroy],
      ['worktree-remove-branch','worktree_remove',{path:'.gate/worktrees/feature',remove_branch:true},review],
      ['worktree-remove-preview-branch','worktree_remove_preview',{path:'.gate/worktrees/feature',remove_branch:true},review],
      ['worktree-remove-preview-outside-destination','worktree_remove_preview',{path:'/outside/feature'},review],
      ['worktree-remove-preview-protected-destination','worktree_remove_preview',{path:'.git/worktrees/feature'},review],
      ['worktree-add','worktree_add',{path:'.gate/worktrees/feature',branch:'feature'},allow],
      ['worktree-add-name','worktree_add',{path:'.gate/worktrees/fix.1',branch:'feature',name:'fix.1'},allow],
      ['worktree-add-escape','worktree_add',{path:'.gate/worktrees/../../../feature',branch:'feature'},review],
      ['worktree-add-outside','worktree_add',{path:'/outside/.gate/worktrees/feature',branch:'feature'},review],
      ['worktree-add-protected','worktree_add',{path:'.shield/.gate/worktrees/feature',branch:'feature'},review],
      ['worktree-remove','worktree_remove',{path:'.gate/worktrees/feature'},allow],
      ...['tasks','workspaces'].flatMap(container => [
        [`retained-${container}-worktree-add`,'worktree_add',{path:`.gate/${container}/feature`,branch:'feature'},allow],
        [`retained-${container}-worktree-add-escape`,'worktree_add',{path:`.gate/${container}/../../../feature`,branch:'feature'},review],
      ]),
      // `config` keeps each tool's own decision; Gate refuses relative and
      // unaccepted policy files, and accepting one is sync's reviewed decision.
      ['config-relative','status',{config:'gate.yml'},allow],
      ['workspace-base-entries','status',{all_repos:true,entries_only:true},allow],
      ['config-outside','status',{config:'/outside/gate.yml'},allow],
      ['config-outside-stage','add',{repo:'acme',paths:['packages/acme'],config:'/outside/gate.yml'},allow],
      ['config-outside-worktree-add','worktree_add',{path:'.gate/worktrees/feature',branch:'feature',config:'/outside/gate.yml'},allow],
      // Gate's MCP sync confirms acceptance with the host itself.
      ['config-outside-sync','sync',{config:'/outside/gate.yml'},allow],
      ['unknown-project-outside','future_tool',{project:'/outside/other'},review],
      ['unknown-project-relative','future_tool',{project:'acme'},review],
      ['config-outside-discard','discard',{repo:'acme',all:true,config:'/outside/gate.yml'},confirmedChange],
      ['config-outside-discard-preview','discard',{repo:'acme',all:true,dry_run:true,config:'/outside/gate.yml'},allow],
      ['config-outside-retained','worktree_repair',{path:'.gate/worktrees/feature',config:'/outside/gate.yml'},allow],
      ['config-null','status',{config:null},allow],
      ['config-docs','docs_read',{path:'native-worktrees.md',config:'/outside/gate.yml'},allow],
      ['config-unknown','future_tool',{config:'/outside/gate.yml'},routine],
    );
    // Gate 0.27 publishes separate previews. Preserve the exact older
    // argument permissions rather than treating dry_run as a new allowance.
    for (const [tool, args, expected] of [
      ['discard',{repo:'acme',all:true},allow],
      ['rename',{repo:'acme',new_id:'private'},change],
      ['sync',{},allow],
      ['migrate',{repos:['acme=repos/acme/.git']},allow],
      ['branch_remove',{repo:'acme',branches:['feature']},allow],
      ['session_remove',{session:'acme'},['allow','allow','deny']],
      ['worktree_remove',{path:'.gate/worktrees/feature'},allow],
    ]) {
      mcp.push([`retained-${tool}-dry-run`,tool,{...args,dry_run:true},expected]);
      mcp.push([`${tool}-preview-missing`,`${tool}_preview`,{},allow]);
      mcp.push([`${tool}-preview-invalid`,`${tool}_preview`,{...args,dry_run:false,confirm:'untrusted'},allow]);
      mcp.push([`${tool}-readonly-preview-outside`,`${tool}_preview`,{...args,project:'/outside/other'},review]);
    }
    mcp.push(
      ['retained-branch-force-dry-run','branch_remove',{repo:'acme',branches:['feature'],force:true,dry_run:true},['allow','allow','deny']],
      ['retained-worktree-discard-dry-run','worktree_remove',{path:'.gate/worktrees/feature',discard_changes:true,dry_run:true},destroy],
      ['branch-force-readonly-preview','branch_remove_preview',{repo:'acme',branches:['feature'],force:true},allow],
      ['worktree-discard-readonly-preview','worktree_remove_preview',{path:'.gate/worktrees/feature',discard_changes:true},allow],
    );
  }
  if (name === 'box') {
    const prepare = {workspace:'acme',operation:'11111111111111111111111111111111',generation:'22222222222222222222222222222222',request_id:'33333333333333333333333333333333',repo_from:{a:'origin/review'}};
    for (const [words,tool,args] of [
      ['project list','project_list',{}],
      ['workspace runtime list','workspace_runtime_list',{workspace:'acme',section:'executions'}],
      ['manager blocker list','manager_blocker_list',{}],
      ['docs list','docs_list',{}],
      ['docs search','docs_search',{query:'workspace'}],
      ['docs read','docs_read',{path:'workspaces.md'}],
    ]) {
      cli.push([`page-${tool}`,['box',...words.split(' '),'--cursor','opaque','--limit','1'],allow]);
      mcp.push([`page-${tool}`,tool,{...args,cursor:'opaque',limit:1},allow]);
      mcp.push([`page-${tool}-malformed`,tool,{...args,cursor:7,limit:0},allow]);
      if (!tool.startsWith('docs_')) mcp.push([`page-${tool}-outside`,tool,{...args,project:'/outside/other'},review]);
      else mcp.push([`page-${tool}-project-ignored`,tool,{...args,project:'/outside/other'},allow]);
    }
    cli.push(
      ['logs-page',['box','logs','acme','--service','web','--cursor','opaque','--limit','3'],allow],
      ['logs-from-start',['box','logs','acme','--service','web','--from-start','--limit','3'],allow],
      ['logs-retired-max-bytes',['box','logs','acme','--service','web','--max-bytes','3'],allow],
      ['logs-follow-page',['box','logs','acme','--service','web','--follow','--limit','3'],review],
      ['logs-cursor-follow-token',['box','logs','acme','--service','web','--cursor','--follow'],allow],
      ['watch-page-conservative',['box','watch','--limit','1'],review],
      ['watch-follow',['box','watch','--follow'],review],
    );
    mcp.push(
      ['logs-page','logs',{workspace:'acme',service:'web',cursor:'opaque',limit:3},allow],
      ['logs-from-start','logs',{workspace:'acme',service:'web',from_start:true,limit:3},allow],
      ['logs-retired-max-bytes','logs',{workspace:'acme',operation:'node',max_bytes:3},allow],
    );
    // Optional MCP interaction modes keep the ordinary operation's effects.
    mcp.push(
      ['config-show','config_show',{},allow],
      ['config-setup','setup',{agents:['claude','codex']},change],
      ['retired-config-setup','config_setup',{agents:['codex'],dry_run:true},review],
      ['config-setup-preview','setup',{agents:['codex'],dry_run:true},allow],
      ['config-setup-repair','setup',{agents:['codex'],repair_hooks:true},change],
      ['config-setup-remove','setup',{remove:true},change],
      ['config-setup-project','setup',{agents:['codex'],project:'/outside/other'},review],
      ['config-setup-preview-project','setup',{agents:['codex'],dry_run:true,project:'/outside/other'},review],
      ['config-setup-malformed-preview','setup',{agents:[],dry_run:'true'},change],
      ['setup-missing-agents','setup',{},change],
      ['setup-empty-agents','setup',{agents:[]},change],
      ['setup-removal-agent-conflict','setup',{agents:['codex'],remove:true},change],
      ['setup-removal-repair-conflict','setup',{remove:true,repair_hooks:true},change],
      ['setup-user-repair','setup',{scope:'user',agents:['codex'],repair_hooks:true},change],
      ['setup-user-repair-preview','setup',{scope:'user',agents:['codex'],repair_hooks:true,dry_run:true},allow],
      ['setup-user-removal','setup',{scope:'user',remove:true},change],
      ['setup-malformed-repair-preview','setup',{agents:['codex'],repair_hooks:'true',dry_run:'true'},change],
      ['config-hook-repair','config_sync',{servers:['shield'],repair_hooks:true},change],
      ['config-hook-repair-preview','config_sync',{servers:['shield'],repair_hooks:true,dry_run:true},allow],
      ['config-hook-repair-project','config_sync',{servers:['shield'],repair_hooks:true,project:'/outside/other'},review],
      ['config-hook-repair-user','config_sync',{scope:'user',agents:['codex'],repair_hooks:true},change],
      ['config-hook-repair-user-preview','config_sync',{scope:'user',agents:['codex'],repair_hooks:true,dry_run:true},allow],
      ['config-hook-repair-malformed-preview','config_sync',{repair_hooks:true,dry_run:'true'},change],
      ['config-show-user','config_show',{scope:'user'},allow],
      ['config-show-project','config_show',{project:'/outside/other'},review],
      ...['', '.', '../other', 7, false, {}, []].flatMap((project,index) => [
        [`config-show-invalid-project-${index}`,'config_show',{project},review],
        [`config-preview-invalid-project-${index}`,'config_sync',{project,dry_run:true},review],
      ]),
      ['config-show-null-project','config_show',{project:null},allow],
      ['config-preview-null-project','config_sync',{project:null,dry_run:true},allow],
      ['deferred-create','workspace_create',{name:'acme',deferred:true},routine],
      ['deferred-create-path','workspace_create',{name:'acme',deferred:true,path:'/outside/acme'},review],
      ['deferred-attach','workspace_attach',{name:'acme',path:'/outside/acme',deferred:true},review],
      ['deferred-prepare','workspace_prepare',{...prepare,deferred:true},routine],
      ['deferred-prepare-missing','workspace_prepare',{workspace:'acme',deferred:true},review],
      ['deferred-prepare-invalid-request','workspace_prepare',{...prepare,deferred:true,request_id:'G'.repeat(32)},review],
      ['deferred-prepare-project','workspace_prepare',{...prepare,deferred:true,project:'/outside/other'},review],
      ['config-select','config_sync',{select:true},change],
      ['config-select-preview','config_sync',{select:true,dry_run:true},allow],
      ['config-select-preview-project','config_sync',{select:true,dry_run:true,project:'/outside/other'},review],
      ['dashboard-status','status',{workspace:'acme'},allow],
      ['dashboard-unknown','dashboard_refresh',{},review],
    );
    cli.push(['workspace-prepare',['box','workspace','prepare','acme','--operation',prepare.operation,'--generation',prepare.generation,'--request-id',prepare.request_id,'--repo-from','a=origin/review'],routine]);
    // Without a revised selection, prepare retries the blocked creation's
    // recorded selection: the same checkout effect as a revised attempt.
    const {repo_from:_selection, ...retry} = prepare;
    cli.push(['workspace-prepare-retry',['box','workspace','prepare','acme','--operation',prepare.operation,'--generation',prepare.generation,'--request-id',prepare.request_id],routine]);
    mcp.push(
      ['workspace-prepare-retry','workspace_prepare',retry,routine],
      ['workspace-prepare-retry-project','workspace_prepare',{...retry,project:'/outside/other'},review],
      ['workspace-prepare','workspace_prepare',prepare,routine],
      ['workspace-prepare-project','workspace_prepare',{...prepare,project:'/outside/other'},review],
      ['workspace-prepare-missing','workspace_prepare',{workspace:'acme',repo_from:{a:'HEAD'}},review],
      ['workspace-prepare-malformed','workspace_prepare',{...prepare,generation:'not-a-generation'},review],
    );
    cli.push(
      ['setup-hook-repair',['box','setup','--agent','codex','--repair-hooks'],change],
      ['setup-hook-repair-preview',['box','setup','--agent','codex','--repair-hooks','--dry-run'],allow],
      ['setup-user-hook-repair',['box','setup','--scope','user','--agent','codex','--repair-hooks'],change],
      ['setup-user-hook-repair-preview',['box','setup','--scope','user','--agent','codex','--repair-hooks','--dry-run'],allow],
      ['setup-remove-repair-conflict',['box','setup','--remove','--repair-hooks'],change],
      ['setup-remove-agent-conflict',['box','setup','--remove','--agent','codex'],change],
      ['sync-hook-repair',['box','config','sync','--server','shield','--repair-hooks'],change],
      ['sync-hook-repair-preview',['box','config','sync','--server','shield','--repair-hooks','--dry-run'],allow],
      ['managed-exec',['box','exec','--workspace','acme','--','node','scripts/check.mjs'],review],
      ['managed-exec-recorded',['box','--json','exec','--workspace','acme','--request-id',prepare.request_id,'--','node','scripts/check.mjs'],review],
      ['managed-shell',['box','shell','--workspace','acme'],review],
      ['managed-shell-command',['box','shell','--workspace','acme','--','codex'],review],
      ['managed-shell-shortcut',['box','--','codex'],review],
      ['managed-shell-workspace-shortcut',['box','--workspace','acme','--','codex'],review],
      // A plain removal deletes the checkout, merged created branches and data.
      ['remove-deferred-close',['box','workspace','remove','acme'],destroy],
      ['remove-immediate-close',['box','workspace','remove','acme','--allow-self-stop'],destroy],
      ['remove-keep-data',['box','workspace','remove','acme','--keep','data'],destroy],
      // Confirming a previewed digest is the deletion itself.
      ['remove-confirm',['box','workspace','remove','acme','--confirm','digest'],destroy],
      ['remove-confirm-attached',['box','--json','workspace','remove','acme','--confirm=digest'],destroy],
      ['remove-confirm-discard',['box','workspace','remove','acme','--discard-changes','--confirm','digest'],destroy],
      ['remove-confirm-detached',['box','workspace','remove','acme','--confirm','digest','--request-id','id','--no-wait'],destroy],
      ['remove-forget',['box','--json','workspace','remove','acme','--forget','--confirm','digest'],destroy],
      // CLI grammar cannot prove that all three resources are kept.
      ['remove-keep-all',['box','workspace','remove','acme','--keep','checkout','--keep','branches','--keep=data'],destroy],
      // A CLI preview keeps the registration decision of the frozen prefix rule.
      ['remove-preview',['box','workspace','remove','acme','--dry-run'],change],
      ['remove-preview-json',['box','--json','workspace','remove','--dry-run','acme'],change],
      // Box rejects every option combined with --dry-run. Discarding, forgetting
      // and ending this session keep their own decisions; other conflicts stay previews.
      ['remove-preview-discard-conflict',['box','workspace','remove','acme','--dry-run','--discard-changes'],destroy],
      ['remove-preview-forget-conflict',['box','workspace','remove','acme','--dry-run','--forget'],destroy],
      ['remove-preview-self-conflict',['box','workspace','remove','acme','--dry-run','--allow-self-stop'],review],
      ['remove-preview-confirm-conflict',['box','workspace','remove','acme','--dry-run','--confirm','digest'],change],
      ['stop-session',['box','stop','acme','--allow-self-stop'],review],
      ['cleanup-preview',['box','workspace','cleanup','acme','--dry-run'],allow],
      ['remove-discard',['box','workspace','remove','acme','--delete-checkout','--discard-changes','--confirm','digest'],destroy],
      ['remove-discard-only',['box','workspace','remove','acme','--discard-changes'],destroy],
      ['remove-discard-immediate',['box','workspace','remove','acme','--delete-checkout','--discard-changes','--allow-self-stop'],destroy],
      ['cleanup-discard',['box','workspace','cleanup','acme','--worktree','--discard-changes','--confirm','digest'],destroy],
      ['cleanup-discard-all',['box','workspace','cleanup','acme','--all','--discard-changes'],destroy],
      ['cleanup-discard-preview-conflict',['box','workspace','cleanup','acme','--dry-run','--discard-changes'],destroy],
      ['recover-workspace',['box','recover','acme'],change],
      ['recover-attempt',['box','recover','--operation',prepare.operation,'--generation',prepare.generation],change],
      // CLI admission does not validate clap's selector conflicts. Box rejects
      // these forms before recovery; the pack retains the mutation decision.
      ['recover-workspace-generation-conflict',['box','recover','acme','--generation',prepare.generation],change],
      ['recover-workspace-attempt-conflict',['box','recover','acme','--operation',prepare.operation,'--generation',prepare.generation],change],
      ['recover-settle',['box','recover','--operation',prepare.operation,'--generation',prepare.generation,'--settle-compose-creation'],destroy],
    );
    mcp.push(
      ['managed-exec','exec',{workspace:'acme',command:['node','scripts/check.mjs']},review],
      ['managed-exec-recorded','exec',{workspace:'acme',command:['node','scripts/check.mjs'],request_id:prepare.request_id},review],
      ['managed-exec-borrowed','exec',{workspace:'acme',command:['node','scripts/check.mjs'],execution:'execution'},review],
      ['managed-exec-project','exec',{workspace:'acme',command:['node','scripts/check.mjs'],project:'/outside/other'},review],
      ['remove-deferred-close','workspace_remove',{workspace:'acme'},destroy],
      ['remove-immediate-close','workspace_remove',{workspace:'acme',allow_self_stop:true},destroy],
      ['remove-keep-data','workspace_remove',{workspace:'acme',keep:['data']},destroy],
      ['remove-keep-all','workspace_remove',{workspace:'acme',keep:['checkout','branches','data']},change],
      ['remove-keep-all-self','workspace_remove',{workspace:'acme',keep:['checkout','branches','data'],allow_self_stop:true},review],
      // Another order is the same request; the pack reviews it as a deletion.
      ['remove-keep-all-reordered','workspace_remove',{workspace:'acme',keep:['data','checkout','branches']},destroy],
      ['remove-keep-all-forget','workspace_remove',{workspace:'acme',keep:['checkout','branches','data'],forget:true},destroy],
      ['remove-keep-all-discard','workspace_remove',{workspace:'acme',keep:['checkout','branches','data'],discard_changes:true},destroy],
      // Another project keeps Strict's removal denial, as cleanup does.
      ['remove-keep-all-project','workspace_remove',{workspace:'acme',keep:['checkout','branches','data'],project:'/outside/other'},destroy],
      ['remove-forget','workspace_remove',{workspace:'acme',forget:true},destroy],
      ['remove-preview','workspace_remove',{workspace:'acme',dry_run:true},allow],
      ['remove-preview-project','workspace_remove',{workspace:'acme',dry_run:true,project:'/outside/other'},destroy],
      ['remove-preview-malformed','workspace_remove',{workspace:'acme',dry_run:'true'},destroy],
      ['remove-preview-discard-conflict','workspace_remove',{workspace:'acme',dry_run:true,discard_changes:true},destroy],
      ['remove-preview-self-conflict','workspace_remove',{workspace:'acme',dry_run:true,allow_self_stop:true},destroy],
      ['remove-project','workspace_remove',{workspace:'acme',project:'/outside/other'},destroy],
      ['stop-session','stop',{workspace:'acme',allow_self_stop:true},review],
      ['cleanup-preview','workspace_cleanup',{workspace:'acme',dry_run:true},allow],
      ['cleanup-discard','workspace_cleanup',{workspace:'acme',worktree:true,discard_changes:true},destroy],
      ['cleanup-discard-all','workspace_cleanup',{workspace:'acme',all:true,discard_changes:true},destroy],
      ['cleanup-discard-preview-conflict','workspace_cleanup',{workspace:'acme',dry_run:true,discard_changes:true},destroy],
      ['remove-discard-only','workspace_remove',{workspace:'acme',discard_changes:true},destroy],
      ['remove-discard-immediate','workspace_remove',{workspace:'acme',delete_checkout:true,discard_changes:true,allow_self_stop:true},destroy],
      ['recover-workspace','recover',{workspace:'acme'},change],
      ['recover-attempt','recover',{operation:prepare.operation,generation:prepare.generation},change],
      ['recover-workspace-generation-conflict','recover',{workspace:'acme',generation:prepare.generation},review],
      ['recover-workspace-operation-conflict','recover',{workspace:'acme',operation:prepare.operation},review],
      ['recover-workspace-attempt-conflict','recover',{workspace:'acme',operation:prepare.operation,generation:prepare.generation},review],
      ['recover-conflict-project','recover',{workspace:'acme',generation:prepare.generation,project:'/outside/other'},review],
      ['recover-settle','recover',{operation:prepare.operation,generation:prepare.generation,settle_compose_creation:true},destroy],
      ['shell-unknown','shell',{workspace:'acme',command:['codex']},review],
    );
    for (const words of ['plugin list','plugin show','plugin context show','plugin prepare','plugin workflow list','plugin workflow show']) {
      cli.push([words.replaceAll(' ','-'),['box',...words.split(' '),'speckit'],allow]);
      mcp.push([words.replaceAll(' ','-'),words.replaceAll(' ','_'),{plugin:'speckit',command:['codex'],operation:'acme'},allow]);
    }
    for (const verb of ['enable','disable','reset']) {
      cli.push([`plugin-${verb}`,['box','plugin',verb,'speckit'],change]);
      mcp.push([`plugin-${verb}`,`plugin_${verb}`,{plugin:'speckit'},change]);
      cli.push([`plugin-${verb}-preview`,['box','plugin',verb,'speckit','--dry-run'],allow]);
      mcp.push([`plugin-${verb}-preview`,`plugin_${verb}`,{plugin:'speckit',dry_run:true},allow]);
    }
    for (const verb of ['run','resume']) {
      cli.push([`workflow-${verb}`,['box','plugin','workflow',verb,'acme','--request-id','11111111111111111111111111111111'],review]);
      mcp.push([`workflow-${verb}`,`plugin_workflow_${verb}`,{plugin:'speckit',workflow:'review',request_id:'11111111111111111111111111111111'},review]);
      mcp.push([`workflow-${verb}-preview`,`plugin_workflow_${verb}`,{plugin:'speckit',dry_run:true},allow]);
    }
    cli.push(['plugin-launch',['box','plugin','launch','speckit','--','codex'],review]);
    cli.push(['plugin-option-dry-token',['box','plugin','enable','speckit','--option','--dry-run'],change]);
    cli.push(['plugin-check',['box','plugin','check','speckit','verify','--request-id','11111111111111111111111111111111'],routine]);
    mcp.push(
      ['plugin-check','plugin_check',{plugin:'speckit',target:'verify',request_id:'11111111111111111111111111111111'},routine],
      ['plugin-project','plugin_list',{project:'/outside/other'},review],
      ['binding','plugin_binding_add',{plugin:'speckit',work:'specs/001-acme',if_revision:0},routine],
      ['reconcile','plugin_workflow_reconcile',{operation:'acme'},change],
      ['abandon','plugin_workflow_abandon',{operation:'acme',reason:'reviewed'},change],
      ['config-sync','config_sync',{},change],
      ['config-preview','config_sync',{dry_run:true},allow],
      ['discard','workspace_remove',{workspace:'acme',delete_checkout:true,discard_changes:true},destroy],
      ['unknown','plugin_unknown',{},review],
    );
  }
  if (name === 'testrun') {
    const tap = {action:'tap',point:{x:0.5,y:0.5}};
    for (const [tool,args] of [
      ['doctor',{targetId:'simulator:ACME'}],['control_status',{}],['media_status',{}],['observe',{}],
      ['preview_status',{previewId:'preview-acme'}],['recording_status',{recordingId:'recording-acme'}],
      ['ui_read',{element:{elementId:'acme'}}],['volume_get',{destination:{kind:'stream'}}],
      ['wait',{conditions:[{kind:'app',appId:'com.example.acme'}]}],['browser_doctor',{engine:'firefox'}],
    ]) mcp.push([`interface-${tool}`,tool,args,allow]);
    for (const [tool,args] of [
      ['app_install',{path:'app.apk'}],['audio_probe',{}],['browser_cancel',{operationId:'acme'}],
      ['browser_disconnect',{targetId:'browser:acme'}],['cancel',{targetId:'browser:acme',actionId:'acme'}],
      ['control_acquire',{}],['control_release',{}],['developer_mode_reveal',{targetId:'device:ACME'}],
      ['disconnect',{}],['media_send',{destination:{kind:'session'},command:'play'}],['network_set',{mode:'online'}],
      ['preview_start',{}],['preview_stop',{previewId:'preview-acme'}],['recording_start',{}],
      ['recording_stop',{recordingId:'recording-acme'}],['volume_set',{destination:{kind:'stream'},value:1}],
      ['connect',{targetId:'simulator:ACME'}],['build_cancel',{operationId:'build-'+'1'.repeat(32)}],
      ['config_init',{root:'.'}],
    ]) mcp.push([`interface-${tool}`,tool,args,routine]);
    for (const [tool,args] of [
      ['clipboard_read',{}],['app_uninstall',{appId:'com.example.acme'}],
      ['developer_support_install',{targetId:'device:ACME'}],
    ]) mcp.push([`interface-${tool}`,tool,args,change]);
    // Current pagination and retained offset forms have independently reviewed
    // decisions. Opaque cursors do not grant filesystem or execution authority.
    for (const [words,tool,args,expected] of [
      ['target list','target_list',{},allow],
      ['app list','app_list',{},allow],
      ['browser list','browser_list',{},allow],
      ['status','status',{},allow],
      ['browser status','browser_status',{},allow],
      ['ui snapshot','ui_snapshot',{scope:{kind:'display'}},allow],
      ['ui find','ui_find',{scope:{kind:'display'},query:{label:'Acme'}},allow],
      ['build status','build_status',{},allow],
      ['build log build-11111111111111111111111111111111','build_log',{operationId:'build-11111111111111111111111111111111'},allow],
      ['project list','project_list',{root:'.'},allow],
      ['project discover','project_discover',{root:'.'},allow],
      ['docs list','docs_list',{},allow],
      ['docs search connect','docs_search',{query:'connect'},allow],
      ['docs read cli.md','docs_read',{path:'cli.md'},allow],
    ]) {
      cli.push([`page-${tool}`,['testrun',...words.split(' '),'--cursor','opaque','--limit','1'],expected]);
      mcp.push([`page-${tool}`,tool,{...args,cursor:'opaque',limit:1},expected],
        [`page-${tool}-malformed`,tool,{...args,cursor:7,limit:0},expected]);
    }
    for (const [tool,args] of [
      ['diagnostics_query',{investigationId:'diag-'+'1'.repeat(32),analysisId:'analysis-'+'3'.repeat(32)}],
      ['diagnostics_project',{investigationId:'diag-'+'1'.repeat(32),analysisId:'analysis-'+'3'.repeat(32)}],
      ['diagnostics_read',{investigationId:'diag-'+'1'.repeat(32),collectorId:'collector-'+'2'.repeat(32)}],
    ]) mcp.push([`page-${tool}`,tool,{...args,cursor:'opaque',limit:1},review]);
    // Diagnostic reads expose private evidence, so their pages keep Ask in every
    // profile; an export page still writes the caller's file.
    {
      const investigation = 'diag-'+'1'.repeat(32), analysis = 'analysis-'+'3'.repeat(32);
      mcp.push(['page-diagnostics_export','diagnostics_export',
        {investigationId:investigation,analysisId:analysis,path:'/outside/projection.json',cursor:'opaque',limit:1},review]);
      for (const [name,words] of [
        ['read',['read',investigation,'collector-'+'2'.repeat(32)]],
        ['query',['query',investigation,analysis]],
        ['project',['project',investigation,analysis]],
        ['export',['export',investigation,analysis,'--path','/outside/projection.json']],
      ]) cli.push([`page-diagnostics-${name}`,['testrun','diagnostics',...words,'--cursor','opaque','--limit','1'],review]);
    }
    for (const [tool,args] of [
      ['docs_list',{offset:0,limit:2}],['docs_search',{query:'connect',offset:1,limit:2}],
      ['docs_read',{path:'cli.md',start_line:2,limit:2}],
      ['testrun_docs_list',{offset:0}],['testrun_docs_search',{query:'connect'}],
      ['testrun_docs_read',{path:'cli.md',start_line:1}],
    ]) mcp.push([`retained-${tool}`,tool,args,allow]);
    mcp.push(['docs-missing-path','docs_read',{},allow],['docs-missing-query','docs_search',{},allow],
      ['docs-host-path','docs_read',{path:'/outside/private.txt'},allow],
      ['future-tool','future_tool',{},review]);
    cli.push(['retained-docs-start-line',['testrun','docs','read','cli.md','--start-line','1'],allow],
      ['project-list-root-page',['testrun','project','list','--root','.','--cursor','opaque','--limit','1'],allow],
      ['project-list-root-future-option',['testrun','project','list','--root','.','--future-format'],allow],
      ['project-list-outside-page',['testrun','project','list','--root','/outside/other','--cursor','opaque','--limit','1'],review],
      ['project-discover-path',['testrun','project','discover','--root','.','--path','.'],allow],
      ['project-discover-outside',['testrun','project','discover','--root','/outside/other'],review],
      ['project-discover-path-outside',['testrun','project','discover','--root','.','--path','/outside/other'],review],
      ['project-list-config',['testrun','project','--config','testrun.yml','list','--root','.'],allow],
      ['config-show-file',['testrun','config','show','--config','testrun.yml'],allow],
      ['config-show-file-outside',['testrun','config','show','--config','/outside/testrun.yml'],review],
      ['project-list-file-outside',['testrun','project','list','--root','.','--config','/outside/testrun.yml'],review],
      ['config-before-subcommand-outside',['testrun','config','--config','/outside/testrun.yml','show'],review],
      ['config-project-outside',['testrun','config','show','--project','/outside/other'],review],
      ['config-init-file-outside',['testrun','config','init','--config','/outside/testrun.yml'],review],
      ['config-init-before-verb',['testrun','config','--config','testrun.yml','init'],routine],
      ['config-init-before-verb-outside',['testrun','config','--config','/outside/testrun.yml','init'],review]);
    for (const tool of ['config_check','config_show','config_schema','build_start','project_list','project_show','project_status','project_start','project_open']) {
      const args = {root:'.',project:'mobile',profile:'dev',task:'check',targetId:'simulator:ACME'};
      mcp.push([`config-file-outside-${tool}`,tool,{...args,config:'/outside/testrun.yml'},review]);
      if (['config_check','config_show','config_schema','project_list','project_show','project_status'].includes(tool))
        mcp.push([`config-file-inside-${tool}`,tool,{...args,config:'testrun.yml'},allow]);
    }
    mcp.push(['config-init-outside','config_init',{root:'.',config:'/outside/testrun.yml'},review]);
    for (const tool of ['project_discover','project_init_preview']) mcp.push(
      [`preview-config-inside-${tool}`,tool,{root:'.',config:'testrun.yml'},allow],
      [`preview-config-outside-${tool}`,tool,{root:'.',config:'/outside/testrun.yml'},review]);
    mcp.push(['retained-preview-config-outside','project_init',
      {root:'.',config:'/outside/testrun.yml',dryRun:true},review]);
    mcp.push(
      ['project-discover','project_discover',{root:'.'},allow],
      ['project-discover-outside','project_discover',{root:'/outside/other'},review],
      ['project-discover-missing','project_discover',{},review],
      ['project-init-preview','project_init',{root:'.',projects:[{path:'web',kind:'vue',platforms:['web']}],dryRun:true},allow],
      ['project-init-preview-outside','project_init',{root:'/outside/other',dryRun:true},review],
      ['project-init-preview-missing','project_init',{dryRun:true},review],
      ['project-init-default','project_init',{root:'.'},review],
      ['project-init-apply','project_init',{root:'.',dryRun:false,planDigest:'1'.repeat(64)},review],
      ['project-init-missing-plan','project_init',{root:'.',dryRun:false},review],
      ['project-init-dry-string','project_init',{root:'.',dryRun:'true'},review],
      // The current interface: creation with the preview's plan digest.
      ['project-init-plan','project_init',{root:'.',planDigest:'1'.repeat(64)},review],
      ['project-init-plan-projects','project_init',{root:'.',projects:[{path:'web',kind:'vue',platforms:['web']}],planDigest:'1'.repeat(64)},review],
      ['project-init-plan-outside','project_init',{root:'/outside/other',planDigest:'1'.repeat(64)},review],
      ['project-init-plan-config-outside','project_init',{root:'.',config:'/outside/testrun.yml',planDigest:'1'.repeat(64)},review],
      ['project-init-plan-malformed','project_init',{root:'.',planDigest:'short'},review],
      ['project-init-preview-plan','project_init_preview',{root:'.',planDigest:'1'.repeat(64)},allow],
    );
    cli.push(
      ['init',['testrun','init'],review],
      ['init-yes',['testrun','init','--yes'],review],
      ['init-preview',['testrun','init','--dry-run','--json'],allow],
      ['init-preview-root',['testrun','init','--root','.','--dry-run'],allow],
      ['init-preview-outside',['testrun','init','--root','/outside/other','--dry-run'],review],
      ['init-preview-path-outside',['testrun','init','--path','/outside/other','--dry-run'],review],
      ['init-kind-dry-token',['testrun','init','--path','.','--kind','--dry-run','--yes'],review],
      ['init-preview-unknown',['testrun','init','--dry-run','--unknown'],review],
      ['init-preview-config',['testrun','init','--dry-run','--config','testrun.yml'],allow],
      ['init-preview-config-outside',['testrun','init','--dry-run','--config','/outside/testrun.yml'],review],
    );
    cli.push(
      ['project-list',['testrun','project','list'],allow],
      ['project-list-root',['testrun','project','list','--root','.'],allow],
      ['project-list-outside',['testrun','project','list','--root','/outside/other'],review],
      ['project-show',['testrun','project','show','mobile','--root','.'],allow],
      ['project-show-outside',['testrun','project','show','mobile','--root','/outside/other'],review],
      ['config-root-outside',['testrun','config','check','--root','/outside/other'],review],
      ['build-named',['testrun','build','start','dev','--app','mobile','--root','.'],review],
    );
    mcp.push(
      ['project-list','project_list',{root:'.'},allow],
      ['project-list-outside','project_list',{root:'/outside/other'},review],
      ['project-list-missing','project_list',{},review],
      ['project-show','project_show',{root:'.',project:'mobile'},allow],
      ['project-show-missing','project_show',{root:'.'},review],
      ['project-show-invalid','project_show',{root:'.',project:'../mobile'},review],
      ['config-root-outside','config_check',{root:'/outside/other'},review],
      ['named-project-status','project_status',{root:'.',project:'mobile',profile:'dev'},allow],
      ['named-project-status-outside','project_status',{root:'/outside/other',project:'mobile',profile:'dev'},review],
      ['named-project-status-missing','project_status',{root:'.',project:'mobile'},review],
      ['build-named','build_start',{root:'.',project:'mobile',profile:'dev'},review],
    );
    const investigation='diag-11111111111111111111111111111111';
    const analysis='analysis-33333333333333333333333333333333';
    for(const operation of ['summary','timeline','failures','stacks','resources','frames','retention','requests']) {
      const filters={view:'investigation',investigation:{analysisIds:['analysis-44444444444444444444444444444444'],operation},limit:20};
      cli.push([`reports-compose-${operation}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify(filters)],review]);
      mcp.push([`reports-compose-${operation}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,...filters},review]);
    }
    for(const privacy of ['minimal','private']) {
      const report={privacy,facts:[{statement:'Caller observation',witnesses:[{analysisId:analysis,ordinal:0}]}],hypotheses:[{statement:'Caller hypothesis'}]};
      cli.push([`reports-view-${privacy}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'report',report})],review]);
      mcp.push([`reports-view-${privacy}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'report',report},review]);
      for(const format of ['investigation-json','investigation-markdown']) {
        cli.push([`reports-export-${format}-${privacy}`,['testrun','diagnostics','export',investigation,analysis,'--path','/outside/report','--filters',JSON.stringify({format,scope:'all',report})],review]);
        mcp.push([`reports-export-${format}-${privacy}`,'diagnostics_export',{investigationId:investigation,analysisId:analysis,path:'/outside/report',format,scope:'all',report},review]);
      }
    }
    mcp.push(['reports-malformed-execution','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'report',report:{execute:true,causalityEstablished:true}},review],['reports-unknown-upload','diagnostics_upload',{path:'/outside/report',destination:'https://example.com'},review]);
    const incident={kind:'observability_http',configFile:'/outside/private/provider.json',sourceId:'incident',scope:{account:'acme',project:'api',environment:'staging',region:'eu',resource:'api',release:'v1'},window:{from:'2026-01-01T00:00:00Z',to:'2026-01-01T00:01:00Z'}};
    for(const source of [incident,{...incident,method:'POST',endpoint:'https://example.com/delete',credentialFallback:true},...['observability-evidence-v1','otlp-json','prometheus-json','loki-json','sentry-json','jaeger-json','cloudwatch-json','crashlytics-json','play-vitals-json','deployment-evidence-v1'].map(format=>({kind:'import',path:'/outside/private/provider-export',format}))]) {
      const key=source.format??(source.method?'malformed':'configured');
      cli.push([`observability-${key}`,['testrun','diagnostics','start',investigation,'--submission-id','incident','--source',JSON.stringify(source)],review]);
      mcp.push([`observability-${key}`,'diagnostics_start',{investigationId:investigation,submissionId:'incident',source},review]);
    }
    cli.push(['observability-joins',['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'observability'})],review]);
    mcp.push(['observability-joins','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'observability'},review],['observability-unknown-mutation','observability_remediate',{environment:'production',action:'restart'},review]);
    for (const source of [
      {kind:'host_process',targetId:'process:Acme:42',serviceId:'api',hostId:'Acme',processId:42,expectedGeneration:'linux:boot:42:birth'},
      {kind:'box_logs',targetId:'service:Acme:api',serviceId:'api',project:'/outside/acme',workspace:'acme#feature',operationId:'node-1',stream:'stderr'},
    ]) {
      cli.push([`services-source-${source.kind}`,['testrun','diagnostics','start',investigation,'--submission-id','service','--source',JSON.stringify(source)],review]);
      mcp.push([`services-source-${source.kind}`,'diagnostics_start',{investigationId:investigation,submissionId:'service',source},review]);
    }
    for (const format of ['service-evidence-v1','host-process-v1','box-log-v1','js-cpu-profile','jfr-json','pprof','stackprof-json','xdebug-cachegrind','windows-minidump']) {
      cli.push([`services-import-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','service','--source',JSON.stringify({kind:'import',path:'/outside/private/service',format})],review]);
      mcp.push([`services-import-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'service',source:{kind:'import',path:'/outside/private/service',format}},review]);
    }
    mcp.push(['services-malformed-exec','diagnostics_start',{investigationId:investigation,submissionId:'service',source:{kind:'host_process',processId:42,exec:['never'],signal:9,remote:'production'}},review],['services-unknown-control','service_launch',{command:['never'],takeover:true},review]);
    for (const mode of ['discover','observe']) {
      const source={kind:'embedded_cdp',endpoint:'http://127.0.0.1:9222',targetId:'android:ACME',appId:'com.example.acme',mode,...(mode==='observe'?{pageId:'acme',expectedUrl:'https://example.com',allowDebuggerAttachment:true,network:true}: {})};
      cli.push([`framework-embedded-${mode}`,['testrun','diagnostics','start',investigation,'--submission-id','embedded','--source',JSON.stringify(source)],review]);
      mcp.push([`framework-embedded-${mode}`,'diagnostics_start',{investigationId:investigation,submissionId:'embedded',source},review]);
    }
    for (const format of ['framework-evidence-v1','runtime-samples-v1','embedded-cdp-v1','speedscope']) {
      cli.push([`framework-import-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','framework','--source',JSON.stringify({kind:'import',path:'/outside/private/framework',format})],review]);
      mcp.push([`framework-import-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'framework',source:{kind:'import',path:'/outside/private/framework',format}},review]);
    }
    mcp.push(['framework-unsafe-endpoint-enable','diagnostics_start',{investigationId:investigation,submissionId:'unsafe',source:{kind:'embedded_cdp',endpoint:'http://example.com',enableEndpoint:true,evaluate:'must-not-run()'}},review],['framework-unknown-controller','framework_connect',{engine:'unity',takeover:true},review]);
    cli.push(
      ...['test-results-v1','junit-xml'].map(format=>[`testing-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','tests','--source',JSON.stringify({kind:'import',path:'/outside/private/tests',format})],review]),
      ...['ui','api','accessibility','visual','media','performance'].map(domain=>[`testing-${domain}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'assertions',assertions:{checks:[{id:'check',domain,name:'checkout',predicate:{type:'equals',pointer:'/test/outcome',expected:'passed'}}]}})],review]),
      ['testing-metric',['testrun','diagnostics','query',investigation,analysis,'--filters','{"view":"assertions","assertions":{"checks":[{"id":"latency","domain":"performance","predicate":{"type":"metric","unit":"milliseconds","definition":"request to rendered result","max":100,"aggregation":"max"}}]}}'],review],
    );
    mcp.push(
      ...['test-results-v1','junit-xml'].map(format=>[`testing-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'tests',source:{kind:'import',path:'/outside/private/tests',format}},review]),
      ...['ui','api','accessibility','visual','media','performance'].map(domain=>[`testing-${domain}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'assertions',assertions:{checks:[{id:'check',domain,name:'checkout',predicate:{type:'equals',pointer:'/test/outcome',expected:'passed'}}]}},review]),
      ['testing-metric','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'assertions',assertions:{checks:[{id:'latency',domain:'performance',predicate:{type:'metric',unit:'milliseconds',definition:'request to rendered result',max:100,aggregation:'max'}}]}},review],
      ['testing-malformed-evaluation','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'assertions',assertions:{checks:[{id:'unsafe',domain:'ui',predicate:{type:'evaluate',expression:'must-not-run()'}}]}},review],
      ['testing-unknown-runner','diagnostics_test_run',{runner:'arbitrary',command:['never']},review],
    );
    cli.push(
      ...['crash','hang','memory_growth','slow_interaction','startup','network','background_media','soak'].map(preset=>[`reproduction-plan-${preset}`,['testrun','diagnostics','plan',preset,'--platform','android','--options','{"targetId":"android:ACME","appId":"com.example.acme","userId":0,"fault":"offline"}'],allow]),
      ['reproduction-plan-missing-platform',['testrun','diagnostics','plan','soak'],review],
      ['reproduction-marker',['testrun','diagnostics','start',investigation,'--submission-id','before','--source','{"kind":"marker","name":"before checkout","actionId":"checkout","phase":"before_action"}'],review],
      ['reproduction-import',['testrun','diagnostics','start',investigation,'--submission-id','baseline','--source','{"kind":"import","path":"/outside/run.json","format":"reproduction-v1"}'],review],
      ['reproduction-compare',['testrun','diagnostics','compare',investigation,analysis,investigation,analysis],review],
    );
    mcp.push(
      ...['android','ios','browser','import'].map(platform=>[`reproduction-plan-${platform}`,'diagnostics_plan',{preset:'network',platform,fault:'offline'},allow]),
      ['reproduction-plan-missing','diagnostics_plan',{preset:'soak'},review],
      ['reproduction-plan-unknown','diagnostics_plan',{preset:'run_shell',platform:'android'},review],
      ['reproduction-marker','diagnostics_start',{investigationId:investigation,submissionId:'marker',source:{kind:'marker',name:'before checkout',actionId:'checkout',phase:'before_action'}},review],
      ['reproduction-marker-malformed','diagnostics_start',{investigationId:investigation,submissionId:'marker',source:{kind:'marker',name:'before',actionId:'checkout',phase:'before_action',command:'never'}},review],
      ['reproduction-import','diagnostics_start',{investigationId:investigation,submissionId:'baseline',source:{kind:'import',path:'/outside/run.json',format:'reproduction-v1'}},review],
      ['reproduction-compare','diagnostics_compare',{investigationId:investigation,analysisId:analysis,otherInvestigationId:investigation,otherAnalysisId:analysis},review],
      ['reproduction-future-runner','diagnostics_run',{preset:'soak',repeat:true},review],
    );
    const debugPage={connectionId:'11111111-1111-4111-8111-111111111111',id:'22222222-2222-4222-8222-222222222222',generation:'33333333-3333-4333-8333-333333333333'};
    const debugActions=[{kind:'variables',pauseId:'11111111-1111-4111-8111-111111111111',frame:0,scope:0,offset:0,limit:20},
      {kind:'logpoint_set',url:'https://example.com/app.js',line:4,marker:'Acme'},
      {kind:'evaluate',pauseId:'11111111-1111-4111-8111-111111111111',frame:0,expression:'local'}, {kind:'disable'}];
    const nativeSource=(backend,mode)=>({kind:'native_trace',backend,mode,targetId:backend==='xctrace'?'device:ACME':backend==='stack_sample'?'host:macos':'android:ACME',appId:'com.example.acme',processId:42,...(mode==='import'?{path:'/outside/trace'}:{}),toolPath:'/outside/native-tool',allowSystemTrace:true,allowAttach:true,...(backend==='xctrace'?{template:'Time Profiler'}:{})});
    cli.push(
      ['diagnostics-open',['testrun','diagnostics','open','--submission-id','acme','--question','Investigate Acme'],routine],
      ['diagnostics-status',['testrun','diagnostics','status',investigation],allow],
      ['diagnostics-import',['testrun','diagnostics','start',investigation,'--submission-id','capture','--source','{"kind":"import","path":"/outside/private.log","format":"bytes"}'],review],
      ['diagnostics-android',['testrun','diagnostics','start',investigation,'--submission-id','android','--source','{"kind":"android","targetId":"android:ACME","appId":"com.example.acme","userId":0}'],review],
      ['diagnostics-apple-simulator',['testrun','diagnostics','start',investigation,'--submission-id','apple','--source','{"kind":"ios","targetId":"simulator:ACME","appId":"com.example.acme","reportDirectory":"/outside/private-reports"}'],review],
      ['diagnostics-apple-network',['testrun','diagnostics','start',investigation,'--submission-id','apple','--source','{"kind":"ios","targetId":"device:ACME","appId":"com.example.acme","transport":"network"}'],review],
      ['diagnostics-browser-result',['testrun','diagnostics','start',investigation,'--submission-id','browser','--source','{"kind":"browser_operation","targetId":"browser:11111111-1111-4111-8111-111111111111","operationId":"22222222-2222-4222-8222-222222222222","request":{"operation":"page_list"}}'],review],
      ...['discover','logs','cpu','heap_sampling'].map(mode=>[`diagnostics-rn-${mode}`,['testrun','diagnostics','start',investigation,'--submission-id','rn','--source',JSON.stringify({kind:'react_native',endpoint:'http://127.0.0.1:8081',targetId:'android:ACME',appId:'com.example.acme',pageId:'device-1',logicalDeviceId:'device',mode,probe:true,allowProfilerControl:true})],review]),
      ...['discover','observe','cpu','memory','inspect'].map(mode=>[`diagnostics-dart-${mode}`,['testrun','diagnostics','start',investigation,'--submission-id','dart','--source',JSON.stringify({kind:'dart',endpointFile:'/outside/private/service-uri',targetId:'android:ACME',appId:'com.example.acme',runtimeKind:'flutter_native',mode,isolateId:'isolates/1',vmStartTime:1,isolateStartTime:2,inspector:true,network:true,objectIds:['objects/1'],classIds:['classes/1']})],review]),
      ['diagnostics-android-state',['testrun','diagnostics','start',investigation,'--submission-id','state','--source','{"kind":"android_state","targetId":"android:ACME","appId":"com.example.acme","userId":0,"groups":["process","memory","power"]}'],review],
      ['diagnostics-android-state-follow',['testrun','diagnostics','start',investigation,'--submission-id','state','--source','{"kind":"android_state","targetId":"android:ACME","appId":"com.example.acme","userId":10,"groups":["scheduling","connectivity","frames"],"mode":"follow","intervalMs":500}'],review],
      ['diagnostics-android-deep',['testrun','diagnostics','start',investigation,'--submission-id','android','--source','{"kind":"android","targetId":"android:ACME","appId":"com.example.acme","userId":10,"mode":"follow","includeReports":true,"systemContext":true}'],review],
      ['diagnostics-read',['testrun','diagnostics','read',investigation,'collector-22222222222222222222222222222222'],review],
      ['diagnostics-stop',['testrun','diagnostics','stop',investigation],routine],
      ['diagnostics-close',['testrun','diagnostics','close',investigation],routine],
      ['diagnostics-remove',['testrun','diagnostics','remove',investigation],destroy],
      ['diagnostics-future',['testrun','diagnostics','future',investigation],review],
      ['diagnostics-analyze',['testrun','diagnostics','analyze',investigation,'collector-22222222222222222222222222222222','--submission-id','parse'],review],
      ['diagnostics-apple-symbolicate',['testrun','diagnostics','analyze',investigation,'collector-22222222222222222222222222222222','--submission-id','symbols','--metadata','{"symbolicate":true,"symbols":[]}'],review],
      ['diagnostics-analysis-status',['testrun','diagnostics','analysis-status',investigation,analysis],allow],
      ['diagnostics-analysis-cancel',['testrun','diagnostics','analysis-cancel',investigation,analysis],routine],
      ['diagnostics-query',['testrun','diagnostics','query',investigation,analysis,'--filters','{"kind":"failure"}'],review],
      ['diagnostics-compare',['testrun','diagnostics','compare',investigation,analysis,investigation,analysis],review],
      ['diagnostics-internal-worker',['testrun','diagnostic-parser-worker'],review],
      ['diagnostics-capabilities',['testrun','diagnostics','capabilities'],allow],
      ['diagnostics-prepare',['testrun','diagnostics','prepare','builtin-parser'],routine],
      ['diagnostics-prepare-version',['testrun','diagnostics','prepare','builtin-parser','--version','testrun-diagnostics/1'],routine],
      ['diagnostics-prepare-unknown',['testrun','diagnostics','prepare','perfetto'],review],
      ['diagnostics-prepare-missing',['testrun','diagnostics','prepare'],review],
      ['diagnostics-project',['testrun','diagnostics','project',investigation,analysis,'--filters','{"scope":"all"}'],review],
      ['diagnostics-export',['testrun','diagnostics','export',investigation,analysis,'--path','/outside/report.json'],review],
      ...['perfetto','simpleperf','xctrace','stack_sample'].flatMap(backend=>['capture','import'].map(mode=>[`native-${backend}-${mode}`,['testrun','diagnostics','start',investigation,'--submission-id','native','--source',JSON.stringify(nativeSource(backend,mode))],review])),
      ['native-export',['testrun','diagnostics','export',investigation,analysis,'--path','/outside/native.trace','--filters','{"format":"native_artifact","scope":"all"}'],review],
      ['native-thread',['testrun','diagnostics','query',investigation,analysis,'--filters','{"view":"timeline","nativeUpid":5,"nativeUtid":3}'],review],
      ...['runtime-checks-v1','sanitizer-report-text'].map(format=>[`runtime-checks-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','checks','--source',JSON.stringify({kind:'import',path:'/outside/private/checks',format})],review]),
      ['runtime-checks-query',['testrun','diagnostics','query',investigation,analysis,'--filters','{"kind":"failure","correlationId":"fault-1"}'],review],
      ...debugActions.map(action=>[`interactive-${action.kind}`,['testrun','browser','send',JSON.stringify({operation:'page_debugger',page:debugPage,action})],change]),
      ['scenario-import',['testrun','diagnostics','start',investigation,'--submission-id','scenario','--source','{"kind":"import","path":"/outside/private/scenario.json","format":"scenario-context-v1"}'],review],
      ['scenario-android-context',['testrun','diagnostics','start',investigation,'--submission-id','context','--source','{"kind":"android_state","targetId":"android:ACME","appId":"com.example.acme","userId":0,"groups":["media","device_context"]}'],review],
      ...['summary','timeline','lifecycle','media','peripherals','energy','settings','restore'].map(operation=>[`scenario-${operation}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'scenario',scenario:{operation}})],review]),
      ...['network-evidence-v1','data-snapshot-v1','pcap'].map(format=>[`network-data-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','network-data','--source',JSON.stringify({kind:'import',path:'/outside/private/evidence',format})],review]),
      ...['requests','phases','messages','spans','logs','packets','correlate','data','schema','query_plan'].map(operation=>[`network-data-${operation}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'network_data',networkData:{operation,...(operation==='correlate'?{traceId:'11111111111111111111111111111111'}:operation==='data'?{collection:'orders',equals:{field:'state',value:null}}:{})}})],review]),
      ...['ui-performance-v1','package-size-v1'].map(format=>[`performance-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','performance','--source',JSON.stringify({kind:'import',path:'/outside/private/performance.json',format})],review]),
      ...['summary','startup','frames','stages','interaction','trees','accessibility','gpu','sizes'].map(operation=>[`performance-${operation}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'performance',performance:{operation,...(operation==='accessibility'?{minTargetSize:44}:{})}})],review]),
      ...['java-hprof','memory-graph-v1','memory-series-v1'].map(format=>[`memory-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','memory','--source',JSON.stringify({kind:'import',path:'/outside/private/heap',format})],review]),
      ...['summary','classes','objects','object','edges','retainers','paths','dominators','series'].map(operation=>[`memory-${operation}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'memory',memory:{operation,...(['object','edges','retainers','paths'].includes(operation)?{objectId:'0x42'}:{})}})],review]),
      ...['Allocations','Leaks'].map(template=>[`memory-apple-${template}`,['testrun','diagnostics','start',investigation,'--submission-id','memory','--source',JSON.stringify({kind:'native_trace',backend:'xctrace',mode:'capture',targetId:'device:ACME',appId:'com.example.acme',processId:42,template,allowAttach:true,allowAllocationRecording:true,allowHeapInspection:true})],review]),
      ...['timeline','call_tree','flamegraph'].map(view=>[`native-${view}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view})],review]),
    );
    mcp.push(
      ['diagnostics-open','diagnostics_open',{submissionId:'acme',question:'Investigate Acme'},routine],
      ['diagnostics-status','diagnostics_status',{investigationId:investigation},allow],
      ['diagnostics-malformed','diagnostics_status',{investigationId:'../../private'},review],
      ['diagnostics-missing','diagnostics_status',{},review],
      ['diagnostics-import','diagnostics_start',{investigationId:investigation,submissionId:'capture',source:{kind:'import',path:'/outside/private.log',format:'bytes'}},review],
      ['diagnostics-android','diagnostics_start',{investigationId:investigation,submissionId:'android',source:{kind:'android',targetId:'android:ACME',appId:'com.example.acme',userId:0}},review],
      ['diagnostics-apple-simulator','diagnostics_start',{investigationId:investigation,submissionId:'apple',source:{kind:'ios',targetId:'simulator:ACME',appId:'com.example.acme',reportDirectory:'/outside/private-reports'}},review],
      ['diagnostics-apple-usb','diagnostics_start',{investigationId:investigation,submissionId:'apple',source:{kind:'ios',targetId:'device:ACME',appId:'com.example.acme',transport:'usb',collectLogs:true}},review],
      ['diagnostics-browser-result','diagnostics_start',{investigationId:investigation,submissionId:'browser',source:{kind:'browser_operation',targetId:'browser:11111111-1111-4111-8111-111111111111',operationId:'22222222-2222-4222-8222-222222222222',request:{operation:'page_list'}}},review],
      ['diagnostics-browser-private-query','diagnostics_start',{investigationId:investigation,submissionId:'browser',source:{kind:'browser_operation',targetId:'browser:11111111-1111-4111-8111-111111111111',operationId:'22222222-2222-4222-8222-222222222222',request:{operation:'diagnostics_read',context:{connectionId:'11111111-1111-4111-8111-111111111111',id:'33333333-3333-4333-8333-333333333333',generation:'44444444-4444-4444-8444-444444444444'},query:{includeText:true}}}},review],
      ['diagnostics-browser-mutating-fallback','diagnostics_start',{investigationId:investigation,submissionId:'browser',source:{kind:'browser_operation',targetId:'browser:11111111-1111-4111-8111-111111111111',operationId:'bad',request:{operation:'unknown_shell',command:'never'},execute:true}},review],
      ['diagnostics-apple-network','diagnostics_start',{investigationId:investigation,submissionId:'apple',source:{kind:'ios',targetId:'device:ACME',appId:'com.example.acme',transport:'network',systemContext:true}},review],
      ['diagnostics-apple-invalid','diagnostics_start',{investigationId:investigation,submissionId:'apple',source:{kind:'ios',targetId:'device:-x',appId:'com.example.acme',prepareSupport:true,removeReports:true}},review],
      ['diagnostics-android-state','diagnostics_start',{investigationId:investigation,submissionId:'state',source:{kind:'android_state',targetId:'android:ACME',appId:'com.example.acme',userId:0,groups:['process','memory','power']}},review],
      ['diagnostics-android-state-all','diagnostics_start',{investigationId:investigation,submissionId:'state',source:{kind:'android_state',targetId:'android:ACME',appId:'com.example.acme',userId:10,groups:['process','memory','scheduling','power','frames','connectivity'],mode:'follow',intervalMs:500,maxProcesses:8}},review],
      ['diagnostics-android-state-mutator','diagnostics_start',{investigationId:investigation,submissionId:'state',source:{kind:'android_state',targetId:'android:ACME',appId:'com.example.acme',userId:0,groups:['force-gc','reset'],command:'reboot'}},review],
      ['diagnostics-android-state-missing','diagnostics_start',{investigationId:investigation,submissionId:'state',source:{kind:'android_state',appId:'com.example.acme'}},review],
      ['diagnostics-android-reports','diagnostics_start',{investigationId:investigation,submissionId:'android',source:{kind:'android',targetId:'android:ACME',appId:'com.example.acme',userId:10,mode:'follow',includeReports:true,systemContext:true}},review],
      ['diagnostics-android-malformed','diagnostics_start',{investigationId:investigation,submissionId:'android',source:{kind:'android',targetId:'../private',appId:'com.example.acme;reboot'}},review],
      ...['discover','logs','cpu','heap_sampling'].map(mode=>[`diagnostics-rn-${mode}`,'diagnostics_start',{investigationId:investigation,submissionId:'rn',source:{kind:'react_native',endpoint:'http://127.0.0.1:8081',targetId:'android:ACME',appId:'com.example.acme',pageId:'device-1',logicalDeviceId:'device',mode,probe:true,allowProfilerControl:true}},review]),
      ['diagnostics-rn-takeover','diagnostics_start',{investigationId:investigation,submissionId:'rn',source:{kind:'react_native',endpoint:'http://127.0.0.1:8081',targetId:'device:ACME',appId:'host.exp.Exponent',pageId:'device-1',logicalDeviceId:'device',mode:'logs',network:true,scripts:true,allowDebuggerTakeover:true}},review],
      ['diagnostics-rn-remote','diagnostics_start',{investigationId:investigation,submissionId:'rn',source:{kind:'react_native',endpoint:'http://192.0.2.1:8081',targetId:'android:ACME',appId:'com.example.acme'}},review],
      ['diagnostics-rn-missing','diagnostics_start',{investigationId:investigation,submissionId:'rn',source:{kind:'react_native'}},review],
      ['diagnostics-rn-arbitrary-cdp','diagnostics_start',{investigationId:investigation,submissionId:'rn',source:{kind:'react_native',command:'Debugger.resume',expression:'arbitrary()'}},review],
      ...['discover','observe','cpu','memory','inspect'].map(mode=>[`diagnostics-dart-${mode}`,'diagnostics_start',{investigationId:investigation,submissionId:'dart',source:{kind:'dart',endpointFile:'/outside/private/service-uri',targetId:'android:ACME',appId:'com.example.acme',runtimeKind:'flutter_native',mode,isolateId:'isolates/1',vmStartTime:1,isolateStartTime:2,inspector:true,network:true,timeline:true,processMemory:true,objectIds:['objects/1'],classIds:['classes/1']}},review]),
      ['diagnostics-dart-cli','diagnostics_start',{investigationId:investigation,submissionId:'dart',source:{kind:'dart',endpointFile:'/outside/private/service-uri',targetId:'dart:ACME',appId:'acme',runtimeKind:'dart_cli',mode:'discover',allowUnauthenticated:true,includeVmOutput:true}},review],
      ['diagnostics-dart-desktop','diagnostics_start',{investigationId:investigation,submissionId:'dart',source:{kind:'dart',endpointFile:'/outside/private/service-uri',targetId:'desktop:ACME',appId:'com.example.acme',runtimeKind:'flutter_desktop',mode:'observe'}},review],
      ['diagnostics-dart-missing','diagnostics_start',{investigationId:investigation,submissionId:'dart',source:{kind:'dart'}},review],
      ['diagnostics-dart-arbitrary-rpc','diagnostics_start',{investigationId:investigation,submissionId:'dart',source:{kind:'dart',method:'resume',params:{isolateId:'isolates/1'},endpoint:'ws://192.0.2.1:8181/ws'}},review],
      ['diagnostics-unknown-source','diagnostics_start',{investigationId:investigation,submissionId:'future',source:{kind:'future_native'}},review],
      ['diagnostics-borrowed-output','diagnostics_start',{investigationId:investigation,submissionId:'capture',source:{kind:'build_output',operationId:'build-11111111111111111111111111111111'}},review],
      ['diagnostics-read','diagnostics_read',{investigationId:investigation,collectorId:'collector-22222222222222222222222222222222'},review],
      ['diagnostics-stop','diagnostics_stop',{investigationId:investigation},routine],
      ['diagnostics-close','diagnostics_close',{investigationId:investigation},routine],
      ['diagnostics-remove','diagnostics_remove',{investigationId:investigation},destroy],
      ['diagnostics-future','diagnostics_future',{investigationId:investigation},review],
      ['diagnostics-analyze','diagnostics_analyze',{investigationId:investigation,collectorId:'collector-22222222222222222222222222222222',submissionId:'parse'},review],
      ['diagnostics-apple-symbolicate','diagnostics_analyze',{investigationId:investigation,collectorId:'collector-22222222222222222222222222222222',submissionId:'symbols',metadata:{symbolicate:true,symbols:[{kind:'dsym',evidenceId:'collector-44444444444444444444444444444444',sha256:'a'.repeat(64),buildId:'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',architecture:'arm64'}]}},review],
      ['diagnostics-apple-symbolicate-invalid','diagnostics_analyze',{investigationId:investigation,collectorId:'collector-22222222222222222222222222222222',submissionId:'symbols',metadata:{symbolicate:true,downloadSymbols:true}},review],
      ['diagnostics-analysis-status','diagnostics_analysis_status',{investigationId:investigation,analysisId:analysis},allow],
      ['diagnostics-analysis-status-malformed','diagnostics_analysis_status',{investigationId:investigation,analysisId:'../../private'},review],
      ['diagnostics-analysis-status-missing','diagnostics_analysis_status',{investigationId:investigation},review],
      ['diagnostics-analysis-cancel','diagnostics_analysis_cancel',{investigationId:investigation,analysisId:analysis},routine],
      ['diagnostics-query','diagnostics_query',{investigationId:investigation,analysisId:analysis,kind:'failure'},review],
      ['diagnostics-compare','diagnostics_compare',{investigationId:investigation,analysisId:analysis,otherInvestigationId:investigation,otherAnalysisId:analysis},review],
      ['diagnostics-capabilities','diagnostics_capabilities',{},allow],
      ['diagnostics-prepare','diagnostics_prepare',{component:'builtin-parser'},routine],
      ['diagnostics-prepare-unknown','diagnostics_prepare',{component:'perfetto'},review],
      ['diagnostics-prepare-missing','diagnostics_prepare',{},review],
      ['diagnostics-project','diagnostics_project',{investigationId:investigation,analysisId:analysis,scope:'all'},review],
      ['diagnostics-export','diagnostics_export',{investigationId:investigation,analysisId:analysis,path:'/outside/report.json'},review],
      ...['perfetto','simpleperf','xctrace','stack_sample'].flatMap(backend=>['capture','import'].map(mode=>[`native-${backend}-${mode}`,'diagnostics_start',{investigationId:investigation,submissionId:'native',source:nativeSource(backend,mode)},review])),
      ['native-export','diagnostics_export',{investigationId:investigation,analysisId:analysis,path:'/outside/native.trace',format:'native_artifact',scope:'all'},review],
      ['native-thread','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'timeline',nativeUpid:5,nativeUtid:3},review],
      ...['runtime-checks-v1','sanitizer-report-text'].map(format=>[`runtime-checks-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'checks',source:{kind:'import',path:'/outside/private/checks',format}},review]),
      ['runtime-checks-query','diagnostics_query',{investigationId:investigation,analysisId:analysis,kind:'failure',correlationId:'fault-1'},review],
      ...debugActions.map(action=>[`interactive-${action.kind}`,'browser_send',{targetId:'browser:acme',request:{operation:'page_debugger',page:debugPage,action}},change]),
      ['interactive-logpoint-shared','act',{targetId:'browser:acme',actions:[{action:'page_debugger',page:debugPage,input:{action:'logpoint_set',url:'https://example.com/app.js',line:4,marker:'Acme'}}]},review],
      ['interactive-native-unknown','debugger_attach',{targetId:'android:Acme',processId:42,adapter:'lldb'},review],
      ['diagnostic-build-inline','build_start',{project:'.',inline:{builder:'custom',platform:'android',target_kind:'emulator',custom:{command:['make','asan']},artifact:{path:'build/acme.apk'},diagnostics:{symbols:'external',profileable:true,sanitizers:['address'],coverage:false,probes:[],timing:'instrumented'}}},review],
      ['scenario-import','diagnostics_start',{investigationId:investigation,submissionId:'scenario',source:{kind:'import',path:'/outside/private/scenario.json',format:'scenario-context-v1'}},review],
      ['scenario-android-context','diagnostics_start',{investigationId:investigation,submissionId:'context',source:{kind:'android_state',targetId:'android:ACME',appId:'com.example.acme',userId:0,groups:['media','device_context']}},review],
      ...['summary','timeline','lifecycle','media','peripherals','energy','settings','restore'].map(operation=>[`scenario-${operation}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'scenario',scenario:{operation}},review]),
      ['scenario-malformed-active-restore','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'scenario',scenario:{operation:'restore',execute:true,activateCamera:true}},review],
      ...['network-evidence-v1','data-snapshot-v1','pcap'].map(format=>[`network-data-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'network-data',source:{kind:'import',path:'/outside/private/evidence',format}},review]),
      ...['requests','phases','messages','spans','logs','packets','correlate','data','schema','query_plan'].map(operation=>[`network-data-${operation}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'network_data',networkData:{operation,...(operation==='correlate'?{traceId:'11111111111111111111111111111111'}:operation==='data'?{collection:'orders',equals:{field:'state',value:null}}:{})}},review]),
      ['network-data-scoped-request','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'network_data',networkData:{operation:'correlate',requestId:'acme-request',identityScope:'app-epoch'}},review],
      ['network-data-malformed-sql','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'network_data',networkData:{operation:'data',sql:'DELETE FROM orders',decrypt:true,flush:true}},review],
      ...['ui-performance-v1','package-size-v1'].map(format=>[`performance-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'performance',source:{kind:'import',path:'/outside/private/performance.json',format}},review]),
      ...['summary','startup','frames','stages','interaction','trees','accessibility','gpu','sizes'].map(operation=>[`performance-${operation}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'performance',performance:{operation,...(operation==='accessibility'?{minTargetSize:44}:{})}},review]),
      ['performance-malformed','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'performance',performance:{operation:'frames',captureGpu:true,evaluate:'must-not-run'}},review],
      ...['java-hprof','memory-graph-v1','memory-series-v1'].map(format=>[`memory-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'memory',source:{kind:'import',path:'/outside/private/heap',format}},review]),
      ...['summary','classes','objects','object','edges','retainers','paths','dominators','series'].map(operation=>[`memory-${operation}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'memory',memory:{operation,...(['object','edges','retainers','paths'].includes(operation)?{objectId:'0x42'}:{})}},review]),
      ...['Allocations','Leaks'].flatMap(template=>[true,false].map(optIn=>[`memory-apple-${template}-${optIn}`,'diagnostics_start',{investigationId:investigation,submissionId:'memory',source:{kind:'native_trace',backend:'xctrace',mode:'capture',targetId:'device:ACME',appId:'com.example.acme',processId:42,template,allowAttach:true,allowAllocationRecording:optIn,allowHeapInspection:optIn}},review])),
      ['memory-malformed','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'memory',memory:{operation:'paths',evaluate:'must-not-run',forceGc:true}},review],
      ['native-export-missing-scope','diagnostics_export',{investigationId:investigation,analysisId:analysis,path:'/outside/native.trace',format:'native_artifact'},review],
      ['native-arbitrary-sql','diagnostics_start',{investigationId:investigation,submissionId:'native',source:{kind:'native_trace',sql:'SELECT readfile(secret)',command:'must-not-run'}},review],
      ...['timeline','call_tree','flamegraph'].map(view=>[`native-${view}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view},review]),
    );
    cli.push(
      ['project-status',['testrun','project','status','ios-dev'],allow],
      ['project-status-outside',['testrun','project','status','ios-dev','--project','/outside/other'],review],
      ['project-start',['testrun','project','start','ios-dev','--task','server'],review],
      ['project-preflight',['testrun','project','start','ios-dev','--task','preflight'],review],
      ['project-open',['testrun','project','open','ios-dev','--target','simulator:ACME'],review],
      ['project-check',['testrun','project','start','ios-dev','--task','check','--check','pnpm'],review],
      ['build-log',['testrun','build','log','build-11111111111111111111111111111111','--offset','0','--limit','1024'],allow],
      ['build-prepare',['testrun','build','start','ios-dev','--prepare'],review],
      ['build-prepare-reordered',['testrun','--json','build','--target','device:ACME','start','--prepare','ios-dev'],review],
      ['project-unknown',['testrun','project','future'],review],
    );
    mcp.push(
      ['project-status','project_status',{project:'.',profile:'ios-dev'},allow],
      ['project-status-outside','project_status',{project:'/outside/other',profile:'ios-dev'},review],
      ['project-status-missing','project_status',{project:'.'},review],
      ['project-start','project_start',{project:'.',profile:'ios-dev',task:'server'},review],
      ['project-open','project_open',{project:'.',profile:'ios-dev',targetId:'simulator:ACME'},review],
      ['project-start-env','project_start',{project:'.',profile:'ios-dev',task:'prepare',env:{PATH:'/outside/bin'}},review],
      ['project-start-unknown','project_start',{project:'.',profile:'ios-dev',task:'future'},review],
      ['build-log','build_log',{operationId:'build-11111111111111111111111111111111'},allow],
      ['build-log-malformed','build_log',{operationId:'../../private'},review],
      ['build-prepare','build_start',{project:'.',profile:'ios-dev',prepare:true},review],
    );
    const context = {connectionId:'11111111-1111-4111-8111-111111111111',id:'22222222-2222-4222-8222-222222222222',generation:'33333333-3333-4333-8333-333333333333'};
    cli.push(
      ['mobile',['testrun','act',JSON.stringify(tap)],routine],
      ['browser-connect',['testrun','connect','--engine','firefox'],review],
      ['browser-connect-options',['testrun','connect','--engine','chrome','--mode','headless','--context','{"viewport":{"width":640,"height":480},"deviceScaleFactor":1,"extraHTTPHeaders":[{"name":"X-Acme","value":"example"}]}'],review],
      ['browser-connect-options-before-engine',['testrun','--json','connect','--context','{}','--mode','headed','--engine','webkit'],review],
      ['browser-connect-attached-options',['testrun','connect','--context={}','--mode=headless','--engine=firefox'],review],
      ['browser-connect-unknown-option',['testrun','connect','--engine','chrome','--unknown-option'],review],
      ['browser-connect-missing-context-value',['testrun','connect','--engine','chrome','--context'],review],
      ['browser-connect-missing-engine-value',['testrun','connect','--engine'],review],
      ['browser-connect-legacy',['testrun','browser','connect','--engine','firefox'],review],
      ['targeted-act',['testrun','act','--target','browser:acme',JSON.stringify({action:'http_fetch'})],review],
      ['targeted-leading-act',['testrun','--target','browser:acme','act',JSON.stringify({action:'http_fetch'})],review],
      ['performance-lifecycle',['testrun','browser','send',JSON.stringify({operation:'trace_start',context,options:{performance:{}}})],change],
      ['performance-lifecycle-act',['testrun','act','--target','browser:acme',JSON.stringify({action:'trace_start',context,options:{performance:{reload:false,autoStop:false}}})],review],
      ['trace-export-start',['testrun','browser','send',JSON.stringify({operation:'trace_start',context,options:{filePath:'/private/tmp/acme-trace/trace.json.gz'}})],change],
      ['trace-export-stop',['testrun','browser','send',JSON.stringify({operation:'trace_stop',filePath:'/private/tmp/acme-trace/trace.json'})],change],
    );
    mcp.push(
      ['mobile','act',{actions:[tap]},routine],
      ['mobile-eight','act',{actions:Array.from({length:8},()=>tap)},routine],
      ['empty','act',{actions:[]},review],
      ['missing','act',{},review],
      ['malformed','act',{actions:[{}]},review],
      ['browser','act',{targetId:'browser:acme',actions:[{action:'page_snapshot'}]},review],
      ['http','act',{targetId:'browser:acme',actions:[{action:'http_fetch',url:'https://example.com'}]},review],
      ['performance-lifecycle','browser_send',{targetId:'browser:acme',request:{operation:'trace_start',context,options:{performance:{}}}},change],
      ['performance-lifecycle-manual','browser_send',{targetId:'browser:acme',request:{operation:'trace_start',context,options:{performance:{reload:false,autoStop:false}}}},change],
      ['performance-lifecycle-act','act',{targetId:'browser:acme',actions:[{action:'trace_start',context,options:{performance:{}}}]},review],
      ['trace-export-start','browser_send',{targetId:'browser:acme',request:{operation:'trace_start',context,options:{filePath:'/private/tmp/acme-trace/trace.json.gz'}}},change],
      ['trace-export-stop','browser_send',{targetId:'browser:acme',request:{operation:'trace_stop',filePath:'/private/tmp/acme-trace/trace.json'}},change],
      ['trace-export-start-act','act',{targetId:'browser:acme',actions:[{action:'trace_start',context,options:{filePath:'/private/tmp/acme-trace/trace.json.gz'}}]},review],
      ['trace-export-stop-act','act',{targetId:'browser:acme',actions:[{action:'trace_stop',filePath:'/private/tmp/acme-trace/trace.json'}]},review],
      ['host-file','act',{actions:[{action:'heap_import',path:'/outside/secrets'}]},review],
      // Route replies stay in the isolated browser unless they serve a host file.
      ['route-abort-code','browser_send',{targetId:'browser:acme',request:{operation:'callback_resolve',callback:context,response:{kind:'route_abort',errorCode:'connectionrefused'}}},routine],
      ['route-fulfill-json','browser_send',{targetId:'browser:acme',request:{operation:'callback_resolve',callback:context,response:{kind:'route_fulfill',json:{acme:[1,true]},headers:[{name:'X-Acme',value:'one'}]}}},routine],
      ['route-fulfill-path','browser_send',{targetId:'browser:acme',request:{operation:'callback_resolve',callback:context,response:{kind:'route_fulfill',path:'/outside/secrets'}}},change],
      ['route-fulfill-relative-path','browser_send',{targetId:'browser:acme',request:{operation:'callback_resolve',callback:context,response:{kind:'route_fulfill',path:'secrets.txt',body:'Acme'}}},change],
      ['route-fulfill-path-batch','browser_send',{targetId:'browser:acme',request:{operation:'batch',requests:[{operation:'callback_resolve',callback:context,response:{kind:'route_fulfill',path:'/outside/secrets'}}]}},change],
      ['route-clear-default','browser_send',{targetId:'browser:acme',request:{operation:'network_route',scope:context,action:{kind:'clear',behavior:'default'}}},change],
      ['mixed-last','act',{actions:[...Array.from({length:7},()=>tap),{action:'storage_export'}]},review],
      ['overflow','act',{actions:Array.from({length:9},()=>tap)},review],
      ['launch-env','act',{actions:[tap,{action:'app_launch',appId:'com.example.acme',env:{DYLD_INSERT_LIBRARIES:'/outside/inject'}}]},review],
      ['browser-connect','connect',{engine:'firefox',mode:'headless'},review],
      ['browser-context','connect',{engine:'chrome',context:{permissions:['clipboard-read']}},review],
      ['browser-connect-legacy','browser_connect',{engine:'firefox',mode:'headless'},review],
      ['device-connect','connect',{targetId:'simulator:ACME'},routine],
      ['unknown','future_tool',{},review],
    );
  }
  // Expected read-only decisions are independent of policy constructors.
  const previews = {
    gate:['discard','rename','sync','migrate','branch_remove','session_remove','worktree_remove'],
    box:['setup','config_sync','workspace_remove','workspace_update','content_apply','content_import',
      'roadmap_add','roadmap_update','roadmap_remove','criterion_add','criterion_update','criterion_remove',
      'blocker_add','blocker_update','blocker_resolve','blocker_reopen','blocker_remove',
      'evidence_add','evidence_update','evidence_remove','reference_add','reference_update','reference_remove',
      'note_add','note_update','note_remove','handoff_set','handoff_clear','review_acknowledge',
      'agent_preference_set','conversation_attach','conversation_update','conversation_detach','conversation_sync','conversation_observe',
      'conversation_operation_reconcile','conversation_operation_cancel','conversation_operation_abandon',
      'plugin_enable','plugin_disable','plugin_reset','plugin_binding_add','plugin_binding_remove',
      'plugin_workflow_run','plugin_workflow_resume','plugin_check'],
    testrun:['project_init'],
  }[name];
  for (const source of previews) {
    const sample = name === 'testrun' ? {root:'.',projects:[{path:'web',kind:'vue',platforms:['web']}]} : structuredClone(mcp.find(([,tool]) => tool === source)?.[2]
      ?? cases.cases.find(row => row.input?.tool === source)?.input.arguments ?? {});
    delete sample.dry_run;
    delete sample.dryRun;
    mcp.push([`${source}-readonly-preview`,`${source}_preview`,sample,allow]);
  }
  if (name === 'gate' || name === 'box') mcp.push(['preview-other-project','workspace_remove_preview',
    {workspace:'feature',project:'/outside/other'},review]);
  if (name === 'gate') mcp[mcp.length-1][1] = 'worktree_remove_preview';
  if (name === 'testrun') mcp.push(['preview-outside-root','project_init_preview',{root:'/outside/other'},review],
    ['preview-missing-root','project_init_preview',{},review]);
  const binding = {[name]:{transport:{type:'defaults',pack:`canonic/${name}`,integration:name},
    agents:{codex:name},packs:{[`canonic/${name}`]:name}}};
  for (const [index,profile] of profiles.entries()) {
    for (const [label,argv,expected] of cli) cases.cases.push({name:`current-cli-${label}-${profile}`,profile,argv,expected:expected[index]});
    for (const [label,tool,arguments_,expected] of mcp) cases.cases.push({name:`current-mcp-${label}-${profile}`,profile,mcp:binding,
      input:{kind:'mcp',server:name,tool,arguments:arguments_,original_input:{}},expected:expected[index]});
  }
  if (name === 'testrun') applyTrustedTestrunExpectations(cases);
  return cases;
}
