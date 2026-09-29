import {series} from 'gulp';

import {Build} from '@toreda/build-tools';
import {ESLint} from 'eslint';
import {EventEmitter} from 'events';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';

const build: Build = new Build({
	events: new EventEmitter()
});

/**
 * Fail the build on lint errors. Warnings are reported but don't fail it.
 */
async function runLint(): Promise<void> {
	const eslint = new ESLint();
	const results = await eslint.lintFiles(['./src/**.ts', './src/**/**.ts']);
	const formatter = await eslint.loadFormatter('stylish');
	const output = await formatter.format(results);

	if (output) {
		console.log(output);
	}

	if (results.some((r) => r.errorCount > 0)) {
		throw new Error('ESLint reported errors.');
	}
}

function createDist(): any {
	return build.create.dir('./dist', true);
}

function cleanDist(): any {
	return build.clean.dir('./dist', true);
}

/**
 * Compile with tsc, then mark the output folder's module format so Node
 * loads its .js files as CommonJS or ESM regardless of the root package type.
 */
function compile(tsconfig: string, outDir: string, type: 'commonjs' | 'module'): void {
	execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', tsconfig], {
		stdio: 'inherit'
	});
	writeFileSync(`${outDir}/package.json`, JSON.stringify({type}, null, '\t') + '\n');
}

/**
 * Node's ESM resolver requires full specifiers. tsc emits relative imports
 * exactly as written in source (extensionless), so append `.js` or
 * `/index.js` to each one in the ESM output, including .d.ts files so
 * TypeScript resolves the types under `node16`/`nodenext`.
 */
function addEsmExtensions(outDir: string): void {
	const specifier = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*)\2/g;

	for (const entry of readdirSync(outDir, {recursive: true, encoding: 'utf8'})) {
		const file = join(outDir, entry);
		if (!file.endsWith('.js') && !file.endsWith('.d.ts')) {
			continue;
		}

		const dir = dirname(file);
		const src = readFileSync(file, 'utf8');
		const out = src.replace(specifier, (match, prefix: string, quote: string, spec: string) => {
			if (/\.(m|c)?js$/.test(spec)) {
				return match;
			}

			const target = resolve(dir, spec);
			if (existsSync(`${target}.js`)) {
				return `${prefix}${quote}${spec}.js${quote}`;
			}

			if (existsSync(join(target, 'index.js'))) {
				return `${prefix}${quote}${spec}/index.js${quote}`;
			}

			throw new Error(`Cannot resolve '${spec}' imported from ${file}.`);
		});

		if (out !== src) {
			writeFileSync(file, out);
		}
	}
}

async function buildCjs(): Promise<void> {
	compile('tsconfig.cjs.json', './dist/cjs', 'commonjs');
}

async function buildEsm(): Promise<void> {
	compile('tsconfig.esm.json', './dist/esm', 'module');
	addEsmExtensions('./dist/esm');
}

export default series(createDist, cleanDist, runLint, buildCjs, buildEsm);
