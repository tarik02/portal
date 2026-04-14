import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const PackageJsonSchema = z.looseObject({
    name: z.string(),
    version: z.string().optional(),
    exports: z.unknown().optional(),
    files: z.array(z.string()).optional(),
});

type PackageJson = z.infer<typeof PackageJsonSchema>;

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
        return `./${stem}.d.ts`;
    }
    if (kind === 'require') {
        return `./${stem}.cjs`;
    }
    return `./${stem}.js`;
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

async function main() {
    const projectRoot = process.argv[2];
    if (!projectRoot) {
        throw new Error('Usage: tsx tools/setup-publish-package.ts <projectRoot>');
    }

    const srcPath = path.resolve(projectRoot, 'package.json');
    const distDir = path.resolve(projectRoot, 'dist');
    const distPath = path.resolve(distDir, 'package.json');

    const source = PackageJsonSchema.parse(JSON.parse(await readFile(srcPath, 'utf8'))) as PackageJson;
    const rootPath = path.resolve(process.cwd(), 'package.json');
    const rootPackage = JSON.parse(await readFile(rootPath, 'utf8')) as { license?: string };

    const repository = {
        type: 'git',
        url: 'git+https://github.com/tarik02/portal.git',
    };

    const dist: PackageJson = {
        ...source,
        license: rootPackage.license,
        repository,
        files: ['*'],
        exports: mapExports(source.exports),
    };

    delete dist.private;
    delete dist.workspaces;

    await mkdir(distDir, { recursive: true });
    await writeFile(distPath, `${JSON.stringify(dist, null, 2)}\n`);
}

await main();
