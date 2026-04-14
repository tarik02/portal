import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function isEnabled(value: string | undefined): boolean {
    return value === '1' || value === 'true';
}

function run(command: string, args: string[], cwd = process.cwd()) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            shell: false,
        });

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} exited with code ${code ?? 'null'}`));
        });
    });
}

async function main() {
    const workspaceRoot = requireEnv('RELEASE_IT_WORKSPACES_PATH_TO_WORKSPACE');
    const tag = requireEnv('RELEASE_IT_WORKSPACES_TAG');
    const access = process.env.RELEASE_IT_WORKSPACES_ACCESS || 'public';
    const otp = process.env.RELEASE_IT_WORKSPACES_OTP;
    const distDir = path.resolve(workspaceRoot, 'dist');
    const workspaceManifest = JSON.parse(await readFile(path.resolve(workspaceRoot, 'package.json'), 'utf8')) as { name: string };

    await run('yarn', ['turbo', 'run', 'build', `--filter=${workspaceManifest.name}`]);
    await run(process.execPath, ['scripts/setup-publish-package.ts', workspaceRoot]);

    const publishArgs = ['publish', distDir, '--tag', tag, '--access', access];

    if (isEnabled(process.env.RELEASE_IT_WORKSPACES_DRY_RUN)) {
        publishArgs.push('--dry-run');
    }

    if (otp) {
        publishArgs.push('--otp', otp);
    }

    if (isEnabled(process.env.PUBLISH_PROVENANCE)) {
        publishArgs.push('--provenance');
    }

    await run('npm', publishArgs);
}

await main();
