// Esegue tutti i test di Sahbi (server, con OpenAI/Supabase finti). Uso: node tests/run.mjs
// Ogni test gira in un processo separato, così le variabili d'ambiente e i fetch finti non si mescolano.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [join(dir, f)], { encoding: 'utf8', timeout: 120000 });
  const ok = r.status === 0;
  if (!ok) failed++;
  const last = (ok ? r.stdout : r.stderr || r.stdout).trim().split('\n').filter(Boolean).slice(ok ? -1 : -8).join('\n  ');
  console.log(`${ok ? '✅' : '❌'} ${f}${last ? `\n  ${last}` : ''}`);
}
console.log(`\n${files.length - failed}/${files.length} test superati`);
process.exit(failed ? 1 : 0);
