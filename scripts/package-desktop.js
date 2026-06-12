import { access, copyFile, cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import extract from 'extract-zip';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist');
const unpackedRoot = resolvePackageDir(process.env.SERVERLENS_PACKAGE_DIR);
const appRoot = path.join(unpackedRoot, 'resources', 'app');
const electronCache = path.join(os.homedir(), 'AppData', 'Local', 'electron', 'Cache');

await rm(unpackedRoot, { recursive: true, force: true });
await mkdir(unpackedRoot, { recursive: true });

const electronZip = await findElectronZip();
await extract(electronZip, { dir: unpackedRoot });

const electronExe = path.join(unpackedRoot, 'electron.exe');
await access(electronExe);
await rename(electronExe, path.join(unpackedRoot, 'ServerLens.exe'));

await mkdir(appRoot, { recursive: true });
for (const entry of ['public', 'src', 'package.json', 'README.md', 'PRODUCT.md', 'DESIGN.md']) {
  await cp(path.join(projectRoot, entry), path.join(appRoot, entry), {
    recursive: true,
    force: true
  });
}

await copyRuntimeDependencies();
await writeDesktopPackage();

const signingResult = await maybeSignExecutable(path.join(unpackedRoot, 'ServerLens.exe'));

console.log(`Packaged desktop app: ${path.join(unpackedRoot, 'ServerLens.exe')}`);
console.log(`SERVERLENS_PACKAGE_SIGNING ${JSON.stringify(signingResult)}`);

// Optional Windows Authenticode signing (planned extension, default OFF).
// Signing runs only when an operator supplies a certificate via environment
// variables. When they are absent (the default), packaging silently falls back
// to the unsigned `dir` target so demo/handoff builds keep working with zero
// signing infrastructure. A signing attempt never aborts packaging.
async function maybeSignExecutable(exePath) {
  const certPath = (process.env.SERVERLENS_SIGN_CERT ?? '').trim();
  const certPassword = process.env.SERVERLENS_SIGN_PASSWORD ?? '';
  const timestampUrl = (process.env.SERVERLENS_SIGN_TIMESTAMP_URL ?? 'http://timestamp.digicert.com').trim();
  if (!certPath) {
    return { signed: false, mode: 'unsigned-dir-fallback', reason: 'No SERVERLENS_SIGN_CERT configured.' };
  }
  try {
    await access(certPath);
  } catch {
    return { signed: false, mode: 'unsigned-dir-fallback', reason: `Signing certificate not found at ${certPath}.` };
  }
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    const args = [
      'sign',
      '/f', certPath,
      ...(certPassword ? ['/p', certPassword] : []),
      '/fd', 'sha256',
      '/tr', timestampUrl,
      '/td', 'sha256',
      exePath
    ];
    await execFileAsync('signtool', args, { timeout: 60000 });
    return { signed: true, mode: 'authenticode', timestampUrl };
  } catch (error) {
    return { signed: false, mode: 'unsigned-dir-fallback', reason: `signtool unavailable or failed: ${error.message}` };
  }
}

function resolvePackageDir(input = path.join('dist', 'win-unpacked')) {
  const candidate = path.resolve(projectRoot, input);
  if (!candidate.startsWith(`${distRoot}${path.sep}`)) {
    throw new Error('SERVERLENS_PACKAGE_DIR must resolve inside the project dist directory.');
  }
  return candidate;
}

async function findElectronZip() {
  const files = await readdir(electronCache);
  const candidates = files
    .filter((file) => /^electron-v.+-win32-x64\.zip$/.test(file))
    .sort()
    .reverse();
  if (candidates.length === 0) {
    throw new Error(`No Electron win32 x64 cache zip found in ${electronCache}. Run npm install or electron-builder once with network access.`);
  }
  return path.join(electronCache, candidates[0]);
}

async function copyRuntimeDependencies() {
  const source = path.join(projectRoot, 'node_modules');
  const target = path.join(appRoot, 'node_modules');
  await mkdir(target, { recursive: true });

  for (const packageName of ['extract-zip']) {
    const packagePath = path.join(source, packageName);
    try {
      await access(packagePath);
      await cp(packagePath, path.join(target, packageName), { recursive: true, force: true });
    } catch {
      // The desktop app itself does not need extract-zip at runtime; keep this copy best-effort.
    }
  }
}

async function writeDesktopPackage() {
  const pkg = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const desktopPkg = {
    name: pkg.name,
    version: pkg.version,
    type: pkg.type,
    main: pkg.main,
    description: pkg.description,
    author: pkg.author
  };
  await writeFile(path.join(appRoot, 'package.json'), `${JSON.stringify(desktopPkg, null, 2)}\n`);
}
