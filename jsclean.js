#!/usr/bin/env node

'use strict';
var acorn = require('acorn');
var commandFiles = require('command-files');
var commander = require('commander');
var estraverse = require('estraverse');
var fs = require('fs');
var emit = require('./emit');
var transform = require('./transform');

// Options
commander.usage('<files>');
commander.version(require('./package.json').version);
commander.parse(process.argv);

function parse(text) {
	// #!
	var hashbang = '';
	if (text.slice(0, 2) === '#!') {
		var i = text.indexOf('\n');
		if (i < 0) {
			hashbang = text;
			text = '';
		} else {
			hashbang = text.slice(0, i);
			text = text.slice(i);
		}
	}

	// Parse
	var comments = [];
	var tokens = [];
	var ast = acorn.parse(text, {
		allowImportExportEverywhere: true,
		allowReturnOutsideFunction: true,
		ecmaVersion: 6,
		locations: true,
		onComment: comments,
		onToken: tokens,
		preserveParens: true,
		ranges: true,
	});
	estraverse.attachComments(ast, comments, tokens);

	// #!
	ast.hashbang = hashbang;
	return ast;
}

// Files
var files = commandFiles.expand(commander.args);
for (var file of files) {
	var input = fs.readFileSync(file, {
		encoding: 'utf8',
	});
	var ast = parse(input);
	transform.run(ast);
	var output = emit.run(ast);
	if (input === output) {
		continue;
	}
	console.log(file);
	try {
		fs.renameSync(file, file + '.bak');
	} catch (e) {
	}
	fs.writeFileSync(file, output);
}
