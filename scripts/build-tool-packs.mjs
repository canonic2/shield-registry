// Gate, Box and Testrun permission packs. Reviewed command data lives in
// gate-policy.mjs, box-policy.mjs and testrun-policy.mjs; expected decisions are
// maintained independently in build-tool-cases.mjs. Guides are written by hand.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {toolPack, writePack} from './tool-pack.mjs';
import {gate} from './gate-policy.mjs';
import {box} from './box-policy.mjs';
import {testrun} from './testrun-policy.mjs';

export const tools = {gate, box, testrun};
export const packs = () => Object.values(tools).map(toolPack);

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const pack of packs()) await writePack(pack);
}
