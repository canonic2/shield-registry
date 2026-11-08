// Shield admits at most 1024 decisions per fixture document. Keep published
// fixtures directly usable by the evaluator instead of truncating coverage.
import {readdir} from 'node:fs/promises';

export const FIXTURE_CASE_LIMIT = 1024;
const MAX_FIXTURE_FILES = 64;
const fixtureName = index => index === 0 ? 'cases.json' : `cases-${index + 1}.json`;

export function splitCaseFiles(document) {
  if (!Array.isArray(document.cases) || document.cases.length < 1
    || document.cases.length > FIXTURE_CASE_LIMIT * MAX_FIXTURE_FILES)
    throw Error('Fixture collection must contain 1–65536 cases');
  const files = [];
  for (let offset = 0; offset < document.cases.length; offset += FIXTURE_CASE_LIMIT) {
    files.push([fixtureName(files.length), {
      ...document, cases: document.cases.slice(offset, offset + FIXTURE_CASE_LIMIT),
    }]);
  }
  return files;
}

export async function caseFileNames(directory) {
  const names = (await readdir(directory))
    .filter(name => name === 'cases.json' || name.startsWith('cases-') && name.endsWith('.json'));
  if (names.length < 1 || names.length > MAX_FIXTURE_FILES)
    throw Error('Release requires 1–64 fixture files');
  const expected = Array.from({length:names.length}, (_, index) => fixtureName(index));
  if (names.some(name => !expected.includes(name)))
    throw Error('Fixture files must be consecutive: cases.json, cases-2.json, ...');
  return expected;
}
