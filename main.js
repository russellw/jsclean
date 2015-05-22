fs = require('fs');
util = require('util');

acorn = require('acorn');

'use strict';

format = require('./format');

function debug(a) {
	console.log(util.inspect(a, {
		colors: process.stdout.isTTY,
		depth: null,
	}));
}

function help() {
	console.log('Usage: jsclean [options] files');
	console.log();
	console.log('-help       Show help');
	console.log('-version    Show version');
	console.log();
	console.log('-no-backup  Don\'t make .bak files');
	process.exit(0);
}

var backup = true;
var files = [];

for (var i = 2; i < process.argv.length; i++) {
	var arg = process.argv[i];
	if (arg[0] !== '-') {
		files.push(arg);
		continue;
	}
	var opt = arg;
	while (opt[0] === '-')
		opt = opt.substring(1);
	switch (opt) {
	case '?':
	case 'h':
	case 'help':
		help();
	case 'V':
	case 'v':
	case 'version':
		console.log('jsclean version 0');
		process.exit(0);
	case 'no-backup':
	case 'no-backups':
		backup = false
		break
	}
	console.log(arg + ': unknown option');
	process.exit(1);
}
if (!files.length)
	help();
for (var file of files) {
	try {
		var input = fs.readFileSync(file, {
			encoding: 'utf8',
		});
	} catch (e) {
		console.log(e.message);
		process.exit(1);
	}
	try {
		var a = acorn.parse(input, {
			ecmaVersion: 6,
			preserveParens: true
		})
	} catch (e) {
		console.log(file + ': ' + e.message);
		process.exit(1);
	}
	var output = format.format(a);
	if (input == output)
		continue
	try {
		fs.unlinkSync(file + '.bak')
	} catch (e) {}
	if (backup)
		try {
			fs.renameSync(file, file + '.bak')
			fs.writeFileSync(file, output)
		} catch (e) {
			console.log(e.message);
			process.exit(1);
		}
	console.log(file)
	console.log(output)
}
