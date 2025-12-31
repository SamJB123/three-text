import { execFileSync } from 'node:child_process';

function parseHzTable(stdout) {
  const rows = new Map();
  const lines = stdout.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*·\s+(.*?)\s{2,}([\d,]+\.\d+)\s+/);
    if (!m) continue;
    const name = m[1].trim();
    const hz = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(hz)) continue;
    rows.set(name, hz);
  }
  return rows;
}

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function fmt(n) {
  return n.toFixed(2);
}

const args = process.argv.slice(2);
const runsIdx = args.indexOf('--runs');
const runs = runsIdx >= 0 ? Number(args[runsIdx + 1]) : 5;
if (!Number.isFinite(runs) || runs <= 0) {
  console.error('Usage: node bench/benchTextLayout.mjs --runs 5');
  process.exit(1);
}

const targetBenches = [
  'applyAlignment left vertices(100k)',
  'applyAlignment center vertices(100k)',
  'applyAlignment right vertices(100k)'
];

const samplesByBench = new Map(targetBenches.map((b) => [b, []]));

for (let i = 1; i <= runs; i++) {
  const out = execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vitest', 'bench', 'bench/textLayout.bench.ts', '--run'],
    { encoding: 'utf8' }
  );
  const table = parseHzTable(out);
  for (const benchName of targetBenches) {
    const hz = table.get(benchName);
    if (hz) samplesByBench.get(benchName).push(hz);
  }
  process.stdout.write(`Run ${i}/${runs} done\r`);
}
process.stdout.write('\n');

for (const benchName of targetBenches) {
  const xs = samplesByBench.get(benchName);
  if (!xs || xs.length === 0) {
    console.log(`${benchName}: (no samples parsed)`);
    continue;
  }
  const m = mean(xs);
  const sd = stdev(xs);
  const cv = m > 0 ? (sd / m) * 100 : 0;
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  console.log(
    `${benchName}: mean ${fmt(m)} hz  (sd ${fmt(sd)} / cv ${fmt(cv)}%)  min ${fmt(min)}  max ${fmt(max)}  n=${xs.length}`
  );
}





