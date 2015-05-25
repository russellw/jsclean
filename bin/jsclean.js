#!/usr/bin/env node

'use strict';
var commander = require('commander');
var fs = require('fs');
var index = require('../index');
var stdin = require('get-stdin');

// options
commander.usage('[options] [files]');
commander.version(require('../package.json').version);
commander.option('    --no-exact-equals', 'don\'t replace == with ===');
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

// inputs
if (commander.args.length) {

	// files
	for (var file of commander.args) {
		try {
			var input = fs.readFileSync(file, {
				encoding: 'utf8',
			});
		} catch (e) {
			console.log(e.message);
			process.exit(1);
		}
		try {
			var output = index.format(input, options);
		} catch (e) {
			console.log(file + ': ' + e.message);
			process.exit(1);
		}
		if (input === output) {
			continue;
		}
		if (commander.backup) {
			try {
				fs.unlinkSync(file + '.bak');
				fs.renameSync(file, file + '.bak');
			} catch (e) {
			}
		}
		try {
			fs.writeFileSync(file, output);
		} catch (e) {
			console.log(e.message);
			process.exit(1);
		}
		console.log(file);
	}
} else {

	// stdin
	stdin(function (input) {
		try {
			var output = index.format(input, options);
			console.log(output);
		} catch (e) {
			console.log(e.message);
			process.exit(1);
		}
	});
}
