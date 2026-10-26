import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wranglerCli = path.resolve(
  __dirname,
  '../../EstudoProject/node_modules/wrangler/wrangler-dist/cli.js'
);

const nodeArgs = [
  '--no-warnings',
  '--dns-result-order=ipv4first',
  '--no-network-family-autoselection',
  wranglerCli,
];

const env = {
  ...process.env,
  CLOUDFLARE_ACCOUNT_ID: 'cd28f93cdb854c19f37035627c0f55cf',
};

console.log('Publicando build de produção (dist/) no Cloudflare Pages (apuracao-eleicao)...');
const deploy = spawnSync(
  process.execPath,
  [
    ...nodeArgs,
    'pages',
    'deploy',
    'dist',
    '--project-name',
    'apuracao-eleicao',
    '--branch',
    'main',
    '--commit-dirty=true',
  ],
  { cwd: __dirname, stdio: 'inherit', env }
);

process.exit(deploy.status ?? 0);
