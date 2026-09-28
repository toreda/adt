import {Levels, Log} from '@toreda/log';
import {series, src} from 'gulp';

import {Build} from '@toreda/build-tools';
import {EventEmitter} from 'events';
import {execFileSync} from 'child_process';
import {writeFileSync} from 'fs';

const log = new Log({
	globalLevel: Levels.ALL,
	consoleEnabled: true
});

const build: Build = new Build({
	events: new EventEmitter()
});


async function runLint(): Promise<NodeJS.ReadWriteStream> {
	const summary = await build.linter.execute({
		formatterId: 'stylish',
		srcPatterns: ['./src/**.ts', './src/**/**.ts']
	});

	return src(['*'], {
		read: false
	});
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
	execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', tsconfig], {
		stdio: 'inherit'
	});
	writeFileSync(`${outDir}/package.json`, JSON.stringify({type}, null, '\t') + '\n');
}

async function buildCjs(): Promise<void> {
	compile('tsconfig.cjs.json', './dist/cjs', 'commonjs');
}

async function buildEsm(): Promise<void> {
	compile('tsconfig.esm.json', './dist/esm', 'module');
}

exports.default = series(createDist, cleanDist, runLint, buildCjs, buildEsm);
