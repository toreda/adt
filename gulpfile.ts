import {dest, parallel, series, src} from 'gulp';

import {BuildTools} from '@toreda/build-tools';
import {EventEmitter} from 'events';

const eslint = require('gulp-eslint');

const build: BuildTools = new BuildTools(new EventEmitter());

function runLint(): any {
	return (
		src(['src/main/**'])
			// eslint() attaches the lint output to the "eslint" property
			// of the file object so it can be used by other modules.
			.pipe(eslint())
			// eslint.format() outputs the lint results to the console.
			// Alternatively use eslint.formatEach() (see Docs).
			.pipe(eslint.format())
			// To have the process exit with an error code (1) on
			// lint error, return the stream and pipe to failAfterError last.
			.pipe(eslint.failAfterError())
	);
}

function createDist(): any {
	return build.create.dir('./dist', false);
}

function cleanDist(): any {
	return build.clean.dir('./dist');
}

function buildSrc(): any {
	return build.run.typescript('./dist', 'tsconfig.json');
}

exports.default = series(createDist, cleanDist, runLint, buildSrc);
