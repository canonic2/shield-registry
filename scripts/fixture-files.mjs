// Shield admits at most 1024 decisions per fixture document. Keep published
// fixtures directly usable by the evaluator instead of truncating coverage.
import {readdir} from 'node:fs/promises';

export const FIXTURE_CASE_LIMIT = 1024;
const FIXTURE_BYTE_LIMIT = 1_048_576;
const MAX_FIXTURE_FILES = 64;
const fixtureName = index => index === 0 ? 'cases.json' : `cases-${index + 1}.json`;
// Bytes of one case as written by JSON.stringify(document, null, 2): an item of
// the top-level `cases` array, indented four spaces, plus its `,\n` separator.
const caseBytes = row => Buffer.byteLength(`    ${JSON.stringify(row, null, 2).replaceAll('\n', '\n    ')},\n`);

// Each file holds at most 1024 cases and fits the 1 MiB artifact limit. A
// collection whose 1024-case chunks already fit splits exactly as by count.
export function splitCaseFiles(document) {
  if (!Array.isArray(document.cases) || document.cases.length < 1
    || document.cases.length > FIXTURE_CASE_LIMIT * MAX_FIXTURE_FILES)
    throw Error('Fixture collection must contain 1–65536 cases');
  const base = Buffer.byteLength(JSON.stringify({...document, cases:[]}, null, 2) + '\n');
  const files = [];
  let offset = 0;
  while (offset < document.cases.length) {
    let end = offset, bytes = base;
    while (end < document.cases.length && end - offset < FIXTURE_CASE_LIMIT
      && (end === offset || bytes + caseBytes(document.cases[end]) <= FIXTURE_BYTE_LIMIT))
      bytes += caseBytes(document.cases[end++]);
    files.push([fixtureName(files.length), {...document, cases: document.cases.slice(offset, end)}]);
    offset = end;
  }
  if (files.length > MAX_FIXTURE_FILES) throw Error('Fixture collection needs more than 64 files');
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
