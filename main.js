fs = require('fs');
util = require('util');
acorn = require('acorn');

'use strict';

format = require('./format');
global.debug = function (a) {
	console.log(util.inspect(a, {
		colors: process.stdout.isTTY,
		depth: null,
	}));
};

function help() {
	console.log('Usage: jsclean [options] files');
	console.log();
	console.log('-help      Show help');
	console.log('-version   Show version');
	console.log();
	console.log('-equals    Replace == with ===');
	console.log('-no-bak    Don\'t make .bak files');
	console.log('-spaces N  Indent with N spaces');
	process.exit(0);
}

var backup = true;
var eq;
var files = [];
var indent = '\t';

function arg() {
	if (i + 1 === process.argv.length) {
		console.log(process.argv[i] + ': arg expected');
		process.exit(1);
	}
	return process.argv[++i];
}

for (var i = 2; i < process.argv.length; i++) {
	var s = process.argv[i];
	if (s[0] !== '-') {
		files.push(s);
		continue;
	}
	while (s[0] === '-') {
		s = s.substring(1);
	}
	switch (s[0]) {
	case '?':
	case 'h':
		help();
	case 'V':
	case 'v':
		console.log('jsclean version 0');
		process.exit(0);
	case 'e':
		eq = true;
		break;
	case 'n':
		backup = false;
		break;
	case 's':
		indent = '';
		for (var j = +arg(); j-- > 0; ) {
			indent += ' ';
		}
		break;
	default:
		console.log(process.argv[i] + ': unknown option');
		process.exit(1);
		break;
	}
}
if (!files.length) {
	help();
}
for (var file of files) {
	try {
		var input = fs.readFileSync(file, {
			encoding: 'utf8',
		});
	} catch (e) {
		console.log(e.message);
		process.exit(1);
	}
	var comments = [];
	try {
		var a = acorn.parse(input, {
			ecmaVersion: 6,
			locations: true,
			onComment: comments,
			preserveParens: true,
		});
	} catch (e) {
		console.log(file + ': ' + e.message);
		process.exit(1);
	}
	var output = format.format(a, comments, {
		eq: eq,
		indent: indent,
	});
	if (input === output) {
		continue;
	}
	try {
		fs.unlinkSync(file + '.bak');
	} catch (e) {
	}
	if (backup) {
		try {
			fs.renameSync(file, file + '.bak');
			fs.writeFileSync(file, output);
		} catch (e) {
			console.log(e.message);
			process.exit(1);
		}
	}
	console.log(file);
}
