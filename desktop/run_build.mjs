import { createWriteStream } from 'node:fs';
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from 'node:https';
import { execFileSync, spawnSync } from 'node:child_process';

const dir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(dir, '..');
const backendDir = join(rootDir, 'backend');
const sidecarDir = join(rootDir, 'frontend', 'backend-sidecar');

const PYTHON_VERSION = '3.12.12';
const RELEASE_TAG = '20260211';
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

const platform = process.platform;
const arch = process.arch;

const archMap = {
  arm64: 'aarch64',
  x64: 'x86_64',
};

const platformMap = {
  darwin: 'apple-darwin',
};

function pythonUrl() {
  const mappedArch = archMap[arch];
  const mappedPlatform = platformMap[platform];
  if (!mappedArch || !mappedPlatform) {
    throw new Error(`Unsupported platform: ${arch}/${platform}`);
  }
  const name = `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-${mappedArch}-${mappedPlatform}-install_only_stripped.tar.gz`;
  return `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_TAG}/${name}`;
}

function pythonBin() {
  return join(sidecarDir, 'python', 'bin', 'python3');
}

function resetSidecarDir() {
  if (existsSync(sidecarDir)) {
    rmSync(sidecarDir, { recursive: true, force: true });
  }
  mkdirSync(sidecarDir, { recursive: true });
}

function downloadFile(url, outputPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        downloadFile(response.headers.location, outputPath)
          .then(resolvePromise)
          .catch(rejectPromise);
        return;
      }

      if (response.statusCode !== 200) {
        rejectPromise(new Error(`Download failed (${response.statusCode}): ${url}`));
        return;
      }

      const file = createWriteStream(outputPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolvePromise();
      });
      file.on('error', rejectPromise);
    });

    request.on('error', rejectPromise);
  });
}

function extractArchive(archivePath) {
  execFileSync('tar', ['-xzf', archivePath, '-C', sidecarDir], {
    stdio: 'inherit',
  });
}

function downloadPython() {
  const archivePath = join(sidecarDir, 'python.tar.gz');
  const url = pythonUrl();
  console.log(`Downloading Python ${PYTHON_VERSION}...`);
  return downloadFile(url, archivePath)
    .then(() => {
      extractArchive(archivePath);
      rmSync(archivePath, { force: true });

      if (!existsSync(pythonBin())) {
        throw new Error(`Python binary not found at ${pythonBin()}`);
      }
    });
}

async function installPip() {
  console.log('Installing pip...');
  const getPipPath = join(sidecarDir, 'get-pip.py');
  await downloadFile(GET_PIP_URL, getPipPath);

  try {
    execFileSync(
      pythonBin(),
      [getPipPath, '--disable-pip-version-check'],
      { stdio: 'inherit' }
    );
    const result = spawnSync(pythonBin(), ['-m', 'pip', '--version'], {
      stdio: 'ignore',
    });
    if (result.status !== 0) {
      throw new Error('Failed to bootstrap pip in bundled Python');
    }
  } finally {
    rmSync(getPipPath, { force: true });
  }
}

async function installDeps() {
  await installPip();
  console.log('Installing dependencies...');
  execFileSync(
    pythonBin(),
    [
      '-m',
      'pip',
      'install',
      '-q',
      '--disable-pip-version-check',
      '--no-warn-script-location',
      '-r',
      join(dir, 'requirements.txt'),
    ],
    {
      cwd: backendDir,
      stdio: 'inherit',
    }
  );
}

function copySource() {
  console.log('Copying source...');
  cpSync(join(backendDir, 'app'), join(sidecarDir, 'app'), {
    recursive: true,
    filter: (src) => {
      const rel = src.replace(join(backendDir, 'app'), '');
      return !rel.includes('__pycache__') && !src.endsWith('.pyc');
    },
  });
  copyFileSync(join(dir, 'entry.py'), join(sidecarDir, 'entry.py'));
}

function writeLauncher() {
  const launcher = join(sidecarDir, 'claudex-backend');
  writeFileSync(
    launcher,
    '#!/bin/bash\n' +
      'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"\n' +
      'export PYTHONPATH="$SCRIPT_DIR"\n' +
      'exec "$SCRIPT_DIR/python/bin/python3" "$SCRIPT_DIR/entry.py" "$@"\n'
  );
  chmodSync(launcher, 0o755);
}

async function run() {
  if (platform !== 'darwin') {
    throw new Error(`Desktop build currently supports macOS only (received: ${platform})`);
  }
  resetSidecarDir();
  await downloadPython();
  await installDeps();
  copySource();
  writeLauncher();
  console.log('Done');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
