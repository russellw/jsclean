#!/usr/bin/env node

'use strict';
var acorn = require('acorn');
var fs = require('fs');
var util = require('util');

function debug(a) {
	console.log(util.inspect(a, {
		colors: process.stdout.isTTY,
		depth: null,
	}));
}

var commenti;
var comments;
var options = defaults();
var ss;

function put(s) {
	ss.push(s);
}

function indent(level) {
	while (level--) {
		put(options.indent);
	}
}

function comment(a, level) {
	function more() {
		if (commenti === comments.length) {
			return false;
		}
		var c = comments[commenti];
		return c.loc.start.line <= a.loc.start.line;
	}

	if (more()) {
		put('\n');
	}
	while (more()) {
		var c = comments[commenti++];
		indent(level);
		if (c.type === 'Line') {
			put('//' + c.value);
		} else {
			put('/*' + c.value + '*/');
		}
		put('\n');
	}
}

function block(a, level) {
	put('{\n');
	if (a.type === 'BlockStatement') {
		for (var b of a.body) {
			comment(b, level + 1);
			stmt(b, level + 1);
		}
	} else {
		stmt(a, level + 1);
	}
	indent(level);
	put('}');
}

function expr(a, level) {
	switch (a.type) {
	case 'ArrayExpression':
		if (!a.elements.length) {
			put('[]');
			break;
		}
		put('[\n');
		for (var b of a.elements) {
			indent(level + 1);
			expr(b, level + 1);
			put(',\n');
		}
		indent(level);
		put(']');
		break;
	case 'ArrowFunctionExpression':
		if (a.params.length === 1) {
			expr(a.params[0], level);
		} else {
			put('(');
			for (var i = 0; i < a.params.length; i++) {
				if (i) {
					put(', ');
				}
				expr(a.params[i], level);
			}
			put(')');
		}
		put(' => ');
		if (a.body.type === 'BlockStatement') {
			block(a.body, level);
		} else {
			expr(a.body, level);
		}
		break;
	case 'AssignmentExpression':
	case 'BinaryExpression':
	case 'LogicalExpression':
		if (options.equals) {
			switch (a.operator) {
			case '==':
				a.operator = '===';
				break;
			case '!=':
				a.operator = '!==';
				break;
			}
		}
		expr(a.left, level);
		put(' ' + a.operator + ' ');
		expr(a.right, level);
		break;
	case 'CallExpression':
		expr(a.callee, level);
		put('(');
		for (var i = 0; i < a.arguments.length; i++) {
			if (i) {
				put(', ');
			}
			expr(a.arguments[i], level);
		}
		put(')');
		break;
	case 'ConditionalExpression':
		expr(a.test, level);
		put(' ? ');
		expr(a.consequent, level);
		put(' : ');
		expr(a.alternate, level);
		break;
	case 'FunctionExpression':
		put('function ');
		if (a.id) {
			put(a.id.name);
		}
		put('(');
		for (var i = 0; i < a.params.length; i++) {
			if (i) {
				put(', ');
			}
			expr(a.params[i], level);
		}
		put(') ');
		block(a.body, level);
		break;
	case 'Identifier':
		put(a.name);
		break;
	case 'Literal':
		put(a.raw);
		break;
	case 'MemberExpression':
		expr(a.object, level);
		if (a.computed) {
			put('[');
			expr(a.property, level);
			put(']');
		} else {
			put('.');
			expr(a.property, level);
		}
		break;
	case 'ObjectExpression':
		if (!a.properties.length) {
			put('{}');
			break;
		}
		a.properties.sort(function (a, b) {
			function key(x) {
				x = x.key;
				switch (x.type) {
				case 'Identifier':
					return x.name;
				case 'Literal':
					return x.value;
				default:
					return x.type;
				}
			}

			a = key(a);
			b = key(b);
			if (a < b) {
				return -1;
			}
			if (a > b) {
				return 1;
			}
			return 0;
		});
		put('{\n');
		for (var b of a.properties) {
			indent(level + 1);
			expr(b, level + 1);
			put(',\n');
		}
		indent(level);
		put('}');
		break;
	case 'ParenthesizedExpression':
		put('(');
		expr(a.expression, level);
		put(')');
		break;
	case 'Property':
		expr(a.key, level);
		put(': ');
		expr(a.value, level);
		break;
	case 'SequenceExpression':
		for (var i = 0; i < a.expressions.length; i++) {
			if (i) {
				put(', ');
			}
			expr(a.expressions[i], level);
		}
		break;
	case 'UnaryExpression':
		put(a.operator);
		expr(a.argument, level);
		break;
	case 'UpdateExpression':
		if (a.prefix) {
			put(a.operator);
			expr(a.argument, level);
		} else {
			expr(a.argument, level);
			put(a.operator);
		}
		break;
	case 'VariableDeclaration':
		put('var ');
		for (var i = 0; i < a.declarations.length; i++) {
			if (i) {
				put(', ');
			}
			expr(a.declarations[i], level);
		}
		break;
	case 'VariableDeclarator':
		put(a.id.name);
		if (a.init) {
			put(' = ');
			expr(a.init, level);
		}
		break;
	default:
		console.assert(false, a);
		break;
	}
}

function stmt(a, level) {
	switch (a.type) {
	case 'BlockStatement':
		for (var b of a.body) {
			stmt(b, level + 1);
		}
		break;
	case 'BreakStatement':
		indent(level);
		put('break');
		if (a.label) {
			put(' ');
			put(a.label.name);
		}
		put(';\n');
		break;
	case 'ContinueStatement':
		indent(level);
		put('continue');
		if (a.label) {
			put(' ');
			put(a.label.name);
		}
		put(';\n');
		break;
	case 'DoWhileStatement':
		indent(level);
		put('do ');
		block(a.body, level);
		indent(level);
		put(' while (');
		expr(a.test, level);
		put(');\n');
		break;
	case 'EmptyStatement':
		break;
	case 'ExpressionStatement':
		indent(level);
		expr(a.expression, level);
		put(';\n');
		break;
	case 'ForInStatement':
		indent(level);
		put('for (');
		expr(a.left, level);
		put(' in ');
		expr(a.right, level);
		put(') ');
		block(a.body, level);
		put('\n');
		break;
	case 'ForOfStatement':
		indent(level);
		put('for (');
		expr(a.left, level);
		put(' of ');
		expr(a.right, level);
		put(') ');
		block(a.body, level);
		put('\n');
		break;
	case 'ForStatement':
		indent(level);
		put('for (');
		if (a.init) {
			expr(a.init, level);
		}
		put('; ');
		if (a.test) {
			expr(a.test, level);
		}
		put('; ');
		if (a.update) {
			expr(a.update, level);
		}
		put(') ');
		block(a.body, level);
		put('\n');
		break;
	case 'FunctionDeclaration':
		put('\n');
		indent(level);
		put('function ' + a.id.name + '(');
		for (var i = 0; i < a.params.length; i++) {
			if (i) {
				put(', ');
			}
			expr(a.params[i], level);
		}
		put(') ');
		block(a.body, level);
		put('\n');
		put('\n');
		break;
	case 'IfStatement':
		indent(level);
		put('if (');
		expr(a.test, level);
		put(') ');
		block(a.consequent, level);
		if (a.alternate) {
			put(' else ');
			block(a.alternate, level);
		}
		put('\n');
		break;
	case 'LabeledStatement':
		indent(level);
		put(a.label.name);
		put(':\n');
		stmt(a.body, level);
		break;
	case 'Program':
		for (var b of a.body) {
			comment(b, level);
			stmt(b, level);
		}
		break;
	case 'ReturnStatement':
		indent(level);
		put('return');
		if (a.argument) {
			put(' ');
			expr(a.argument, level);
		}
		put(';\n');
		break;
	case 'SwitchStatement':
		if (a.cases.length) {
			var c = a.cases[a.cases.length - 1];
			if (c.consequent.length) {
				var b = c.consequent[c.consequent.length - 1];
				switch (b.type) {
				case 'BreakStatement':
				case 'ContinueStatement':
				case 'ReturnStatement':
				case 'ThrowStatement':
					break;
				default:
					c.consequent.push({
						loc: b.loc,
						type: 'BreakStatement',
					});
					break;
				}
			}
		}
		indent(level);
		put('switch (');
		expr(a.discriminant, level);
		put(') {\n');
		for (var c of a.cases) {
			indent(level);
			if (c.test) {
				put('case ');
				expr(c.test, level);
			} else {
				put('default');
			}
			put(':\n');
			for (var b of c.consequent) {
				stmt(b, level + 1);
			}
		}
		indent(level);
		put('}\n');
		break;
	case 'ThrowStatement':
		indent(level);
		put('throw ');
		expr(a.argument, level);
		put(';\n');
		break;
	case 'TryStatement':
		indent(level);
		put('try ');
		block(a.block, level);
		if (a.handler) {
			put(' catch (');
			expr(a.handler.param, level);
			put(') ');
			block(a.handler.body, level);
		}
		if (a.finalizer) {
			put(' finally ');
			block(a.finalizer, level);
		}
		put('\n');
		break;
	case 'VariableDeclaration':
		indent(level);
		put('var ');
		for (var i = 0; i < a.declarations.length; i++) {
			if (i) {
				put(', ');
			}
			expr(a.declarations[i], level);
		}
		put(';\n');
		break;
	case 'WhileStatement':
		indent(level);
		put('while (');
		expr(a.test, level);
		put(') ');
		block(a.body, level);
		put('\n');
		break;
	default:
		console.assert(false, a);
		break;
	}
}

function defaults() {
	return {
		equals: false,
		indent: '\t',
	};
}

exports.defaults = defaults;

function format(s, options1) {
	// #!
	var hashbang = '';
	if (s.substring(0, 2) === '#!') {
		var i = s.indexOf('\n');
		if (i < 0) {
			hashbang = s;
			s = '';
		} else {
			hashbang = s.substring(0, i);
			s = s.substring(i);
		}
	}

	// parse
	var comments1 = [];
	var a = acorn.parse(s, {
		allowImportExportEverywhere: true,
		allowReturnOutsideFunction: true,
		ecmaVersion: 6,
		locations: true,
		onComment: comments1,
		preserveParens: true,
	});

	// format
	comments = comments1;
	options = options1 || defaults();
	commenti = 0;
	ss = [];
	stmt(a, 0);
	var s = ss.join('');

	// #!
	s = hashbang + '\n\n' + s;

	// don't start with a blank line
	s = s.replace(/^\n+/, '');

	// only one consecutive blank line
	s = s.replace(/\n\n+/g, '\n\n');

	// no blank line after bracket
	s = s.replace(/{\n+/g, '{\n');

	// end with exactly one newline
	s = s.replace(/\n*$/, '\n');
	return s;
}

exports.format = format;

function arg() {
	if (i + 1 === process.argv.length) {
		console.log(process.argv[i] + ': arg expected');
		process.exit(1);
	}
	return process.argv[++i];
}

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

if (module === require.main) {
	var backup = true;
	var files = [];
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
			console.log(require('./package.json').version);
			process.exit(0);
		case 'e':
			options.equals = true;
			break;
		case 'n':
			backup = false;
			break;
		case 's':
			s = arg();
			var j = +s;
			if (isNaN(j)) {
				console.log(s + ': expected number');
				process.exit(1);
			}
			options.indent = '';
			while (j-- > 0) {
				options.indent += ' ';
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
		try {
			var output = format(input, options);
		} catch (e) {
			console.log(file + ': ' + e.message);
			process.exit(1);
		}
		if (input === output) {
			continue;
		}
		if (backup) {
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
}
