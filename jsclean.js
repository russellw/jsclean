#!/usr/bin/env node

'use strict';
var commandFiles = require('command-files');
var commander = require('commander');
var fs = require('fs');
var getStdin = require('get-stdin');
var index = require('./index');

// Options
commander.usage('[options] [files]');
commander.version(require('./package.json').version);
commander.option('    --no-cap-comments', "don't capitalize comments");
commander.option('    --no-exact-equals', "don't replace == with ===");
commander.option('    --no-extra-braces', "don't add optional braces");
commander.option('    --no-semicolons', 'omit semicolons');
commander.option('    --no-separate-vars', "don't separate variable declarations");
commander.option('    --no-sort-cases', "don't sort cases");
commander.option('    --no-sort-functions', "don't sort functions");
commander.option('    --no-sort-properties', "don't sort object properties");
commander.option('-n, --no-backup', "don't make .bak files");
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
var files = commandFiles.expand(commander.args);
if (files.length) {
	for (var file of files) {
		var input = fs.readFileSync(file, {
			encoding: 'utf8',
		});
		var output = index.format(input, options);
		if (input === output) {
			continue;
		}
		console.log(file);
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
} else {
	getStdin().then(function (text) {
		text = index.format(text, options);
		text = text.replace(/\n*$/, '');
		console.log(text);
	});
}
