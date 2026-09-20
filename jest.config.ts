import {Config} from 'jest';
const config: Config = {
	roots: ['./'],
	coverageDirectory: './coverage',
	coverageProvider: 'v8',
	coveragePathIgnorePatterns: [
		'tests/',
		'node_modules/',
		'.node/',
		'jest/',
		'gulpfile.ts',
		'coverage/',
		'.github',
		'docs'
	],
	moduleDirectories: ['node_modules'],
	moduleFileExtensions: ['ts', 'js', 'json'],
	moduleNameMapper: {'^src/(.*)': '<rootDir>/src/$1'},
	testEnvironment: 'jest-environment-jsdom',
	testPathIgnorePatterns: ['node_modules'],
	testRegex: '(/__tests__/.*|(\\.|/)(spec))\\.ts$',
	testResultsProcessor: 'jest-sonar-reporter',
	transform: {'^.+\\.(t|j)sx?$': '@swc/jest'},
	transformIgnorePatterns: ['node_modules/(?!@ngrx|(?!core-js/)|(?!deck.gl)|ng-dynamic)']
};

export default config;
