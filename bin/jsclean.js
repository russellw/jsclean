#!/usr/bin/env node

'use strict';
var commander = require('commander');
var fs = require('fs');
var glob = require('glob');
var index = require('../index');
var os = require('os');
var stdin = require('get-stdin');

// Options
commander.usage('[options] [files]');
commander.version(require('../package.json').version);
commander.option('    --no-cap-comments', 'don\'t capitalize comments');
commander.option('    --no-exact-equals', 'don\'t replace == with ===');
commander.option('    --no-extra-braces', 'don\'t add optional braces');
commander.option('    --no-semicolons', 'omit semicolons');
commander.option('    --no-separate-vars', 'don\'t separate variable declarations');
commander.option('    --no-sort-cases', 'don\'t sort cases');
commander.option('    --no-sort-properties', 'don\'t sort object properties');
commander.option('    --no-trailing-break', 'don\'t add trailing break to final case');
commander.option('-n, --no-backup', 'don\'t make .bak files');
commander.option('-s, --spaces <n>', 'indent with spaces', parseInt);
commander.parse(process.argv);
var options = index.defaults();
for (var p in commander) {
	if (Object.prototype.hasOwnProperty.call(commander, p)) {
		options[p] = commander[p];
	}
}
if (commander.spaces) {
	options.indent = '';
	for (var i = commander.spaces; i-- > 0; ) {
		options.indent += ' ';
	}
}

// Inputs
if (commander.args.length) {
	for (var pattern of commander.args) {
		var files = [
			pattern,
		];
		if (os.platform() === 'win32') {
			files = glob.sync(pattern, {
				nonull: true,
				nosort: true,
			});
		}
		for (var file of files) {
			console.log(file);
			var input = fs.readFileSync(file, {
				encoding: 'utf8',
			});
			var output = index.format(input, options);
			if (input === output) {
				continue;
			}
			if (commander.backup) {
				try {
					fs.unlinkSync(file + '.bak');
				} catch (e) {
				}
				try {
					fs.renameSync(file, file + '.bak');
				} catch (e) {
				}
			}
			fs.writeFileSync(file, output);
		}
	}
} else {
	stdin(function (input) {
		var output = index.format(input, options);
		output = output.replace(/\n*$/, '');
		console.log(output);
	});
}
