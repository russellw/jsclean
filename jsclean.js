#!/usr/bin/env node

'use strict';
var commandFiles = require('command-files');
var commander = require('commander');
var fs = require('fs');
var index = require('./index');

// Options
commander.usage('[options] [files]');
commander.version(require('./package.json').version);
commander.parse(process.argv);

// Inputs
var files = commandFiles.expand(commander.args);
for (var file of files) {
	var input = fs.readFileSync(file, {
		encoding: 'utf8',
	});
	var output = index.format(input);
	if (input === output) {
		continue;
	}
	console.log(file);
	try {
		fs.unlinkSync(file + '.bak');
	} catch (e) {
	}
	try {
		fs.renameSync(file, file + '.bak');
	} catch (e) {
	}
	fs.writeFileSync(file, output);
}
