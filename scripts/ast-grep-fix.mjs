import { spawnSync } from 'node:child_process';

const maxPasses = Number(process.env.AST_GREP_FIX_MAX_PASSES ?? '5');

if (!Number.isInteger(maxPasses) || maxPasses < 1) {
    console.error('AST_GREP_FIX_MAX_PASSES must be a positive integer');
    process.exit(1);
}

const run = (args, { allowFailure = false, stdio = 'pipe' } = {}) => {
    const result = spawnSync('yarn', ['exec', 'ast-grep', 'scan', ...args], {
        encoding: 'utf8',
        stdio,
    });

    if (result.error) {
        throw result.error;
    }

    if (!allowFailure && result.status !== 0) {
        process.exit(result.status ?? 1);
    }

    return result;
};

const countMatches = () => {
    const result = run(['--json=compact', '--color', 'never'], { allowFailure: true });
    const output = result.stdout.trim();

    if (!output) {
        return 0;
    }

    const matches = JSON.parse(output);

    if (!Array.isArray(matches)) {
        throw new Error('unexpected ast-grep json output');
    }

    return matches.length;
};

let previousCount = Number.POSITIVE_INFINITY;

for (let pass = 1; pass <= maxPasses; pass += 1) {
    console.log(`ast-grep fix pass ${pass}/${maxPasses}`);
    run(['--update-all'], { allowFailure: true, stdio: 'inherit' });

    const remainingMatches = countMatches();

    if (remainingMatches === 0) {
        process.exit(0);
    }

    if (remainingMatches >= previousCount) {
        console.error(`ast-grep fix stalled with ${remainingMatches} matches remaining`);
        process.exit(1);
    }

    previousCount = remainingMatches;
}

console.error(`ast-grep fix did not settle after ${maxPasses} passes`);
process.exit(1);
