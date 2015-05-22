fs = require('fs');
util = require('util');

esprima = require('esprima');

'use strict';

function help() {
	print('Usage: jsclean [options] files');
	print('');
	print('-h  Show help');
	print('-v  Show version');
	process.exit(0);
}

function print(a) {
	if (!arguments.length)
		a = '';
	if (typeof (a) === 'object')
		a = util.inspect(a, {
			colors: process.stdout.isTTY,
			depth: null,
		});
	console.log(a);
}

function read(file) {
	try {
		return fs.readFileSync(file, {
			encoding: 'utf8',
		});
	} catch (e) {
		print(e.message);
		process.exit(1);
	}
}

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
		print('Ayane version 0');
		process.exit(0);
	}
	print(arg + ': unknown option');
	process.exit(1);
}
if (!files.length)
	help();
for (var file of files) {
	try {
		var a = esprima.parse(read(file), {
			comment: true
		});
	} catch (e) {
		print(file + ':' + e.lineNumber + ': ' + e.description);
		process.exit(1);
	}
	print(a);
}
