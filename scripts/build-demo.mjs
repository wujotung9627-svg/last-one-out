// Builds a static replay of one recorded walk into docs/, ready for GitHub Pages.
// The replay makes no model calls and has no server: judges can play it for free.
//
//   node scripts/build-demo.mjs <run id>      (run ids are the folders in runs/)
import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const id = process.argv[2] ?? '';
if (!/^[a-f0-9]{12}$/.test(id)) {
  console.error('usage: node scripts/build-demo.mjs <run id from runs/>');
  process.exit(1);
}

const run = join(ROOT, 'runs', id);
await access(join(run, 'run.json')).catch(() => {
  console.error(`runs/${id}/run.json not found`);
  process.exit(1);
});

const docs = join(ROOT, 'docs');
await rm(docs, { recursive: true, force: true });
await mkdir(docs, { recursive: true });
await cp(join(ROOT, 'public'), docs, { recursive: true });
await cp(join(run, 'photos'), join(docs, 'photos'), { recursive: true });
await cp(join(run, 'run.json'), join(docs, 'run.json'));

const index = join(docs, 'index.html');
const html = await readFile(index, 'utf8');
await writeFile(index, html.replace('<title>', '<meta name="last-one-out-replay" content="run.json">\n  <title>'));
await writeFile(join(docs, '.nojekyll'), '');
console.log(`docs/ now replays runs/${id}`);
