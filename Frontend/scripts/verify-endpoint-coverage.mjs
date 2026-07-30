import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const routesDir = path.resolve(frontend, '../Backend/app/api/routes');
const coverage = JSON.parse(
  fs.readFileSync(path.join(frontend, 'endpoint-coverage.json'), 'utf8'),
);

const discovered = [];
for (const name of fs.readdirSync(routesDir).filter((value) => value.endsWith('.py'))) {
  const source = fs.readFileSync(path.join(routesDir, name), 'utf8');
  const prefix = source.match(/router\s*=\s*APIRouter\([\s\S]*?prefix\s*=\s*["']([^"']*)["']/)?.[1] ?? '';
  const decorators = source.matchAll(
    /@router\.(get|post|put|patch|delete)\(\s*["']([^"']*)["']/g,
  );
  for (const match of decorators) {
    discovered.push({ method: match[1].toUpperCase(), path: `${prefix}${match[2]}` });
  }
}

const key = (item) => `${item.method} ${item.path}`;
const declared = new Map(coverage.map((item) => [key(item), item]));
const actual = new Set(discovered.map(key));
const missing = discovered.filter((item) => !declared.has(key(item)));
const stale = coverage.filter((item) => !actual.has(key(item)));
const incomplete = coverage.filter((item) => !item.client || !item.surface);
const apiSource = [
  fs.readFileSync(path.join(frontend, 'src/api/platform.ts'), 'utf8'),
  fs.readFileSync(path.join(frontend, 'src/api/demand.ts'), 'utf8'),
].join('\n');
const missingClients = coverage.filter((item) => {
  const [objectName, methodName] = item.client.split('.');
  return (
    !new RegExp(`export const ${objectName}\\s*=`).test(apiSource) ||
    !new RegExp(`\\b${methodName}\\s*:`).test(apiSource)
  );
});

if (missing.length || stale.length || incomplete.length || missingClients.length) {
  if (missing.length) console.error('Backend endpoints without frontend ownership:', missing);
  if (stale.length) console.error('Stale frontend endpoint declarations:', stale);
  if (incomplete.length) console.error('Incomplete frontend ownership declarations:', incomplete);
  if (missingClients.length) console.error('Coverage entries without a client implementation:', missingClients);
  process.exit(1);
}

console.log(`Endpoint coverage verified: ${discovered.length}/${discovered.length} operations mapped.`);
