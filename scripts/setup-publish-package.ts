import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { z } from 'zod';

const PackageJsonSchema = z.looseObject({
    name: z.string(),
    version: z.string().optional(),
    exports: z.unknown().optional(),
    files: z.array(z.string()).optional(),
    license: z.string().optional(),
    repository: z.unknown().optional(),
});

type PackageJson = z.infer<typeof PackageJsonSchema>;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const backupFileName = '.package.publish.backup.json';

function toPosix(value: string): string {
    return value.replaceAll(path.sep, '/');
}

function stripSourceExt(value: string): string {
    return value.replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, '');
}

function mapLeaf(target: string, kind: 'types' | 'default' | 'import' | 'require' = 'default'): string {
    const p = toPosix(target);

    if (!p.startsWith('./')) {
        return target;
    }

    const rel = p.startsWith('./src/') ? p.slice(6) : p.slice(2);
    const stem = stripSourceExt(rel);

    if (kind === 'types') {
        return `./dist/${stem}.d.ts`;
    }
    if (kind === 'require') {
        return `./dist/${stem}.cjs`;
    }
    return `./dist/${stem}.js`;
}

const resolveExportKind = (key: string): 'types' | 'default' | 'import' | 'require' => {
    if (key === 'types') {
        return 'types';
    }
    if (key === 'require') {
        return 'require';
    }
    if (key === 'import') {
        return 'import';
    }
    return 'default';
};

function mapExports(value: unknown): unknown {
    if (typeof value === 'string') {
        return {
            types: mapLeaf(value, 'types'),
            default: mapLeaf(value, 'default'),
        };
    }

    if (Array.isArray(value)) {
        return value.map((leaf) => mapExports(leaf));
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    const out: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
        if (typeof child === 'string') {
            const kind = resolveExportKind(key);
            out[key] = mapLeaf(child, kind);
        } else {
            out[key] = mapExports(child);
        }
    }

    return out;
}

function run(command: string, args: string[], cwd = repoRoot) {
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

async function restoreManifest(workspaceRoot: string) {
    const packageJsonPath = path.resolve(workspaceRoot, 'package.json');
    const backupPath = path.resolve(workspaceRoot, backupFileName);

    await copyFile(backupPath, packageJsonPath);
    await rm(backupPath, { force: true });
}

async function prepareManifest(workspaceRoot: string) {
    const packageJsonPath = path.resolve(workspaceRoot, 'package.json');
    const backupPath = path.resolve(workspaceRoot, backupFileName);
    const distPackageJsonPath = path.resolve(workspaceRoot, 'dist', 'package.json');
    const source = PackageJsonSchema.parse(JSON.parse(await readFile(packageJsonPath, 'utf8'))) as PackageJson;
    const rootPackage = JSON.parse(await readFile(path.resolve(repoRoot, 'package.json'), 'utf8')) as {
        license?: string;
        repository?: unknown;
    };

    await copyFile(packageJsonPath, backupPath);
    await run('yarn', ['turbo', 'run', 'build', `--filter=${source.name}`]);
    await mkdir(path.resolve(workspaceRoot, 'dist'), { recursive: true });
    await rm(distPackageJsonPath, { force: true });

    const publishManifest: PackageJson = {
        ...source,
        exports: mapExports(source.exports),
        license: source.license ?? rootPackage.license,
        repository: source.repository ?? rootPackage.repository,
    };

    delete publishManifest.private;
    delete publishManifest.workspaces;

    await writeFile(packageJsonPath, `${JSON.stringify(publishManifest, null, 2)}\n`);
}

async function main() {
    const workspaceRoot = process.cwd();
    const shouldRestore = process.argv.includes('--restore');

    if (shouldRestore) {
        await restoreManifest(workspaceRoot);
        return;
    }

    await prepareManifest(workspaceRoot);
}

await main();
