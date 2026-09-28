const toredaConfig = require('@toreda/eslint-config');

module.exports = [
	{
		ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'docs/**']
	},
	...toredaConfig,
	{
		rules: {
			'prettier/prettier': 'warn'
		}
	}
];
