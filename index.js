fs = require('fs');
util = require('util');
acorn = require('acorn');

'use strict';


function debug(a) {
	console.log(util.inspect(a, {
		colors: process.stdout.isTTY,
		depth: null,
	}));
}

var commenti;
var ss;

function put(s) {
	ss.push(s);
}

function haveBlank() {
	if (!ss.length) {
		return false;
	}
	if (ss.length === 1) {
		return ss[ss.length - 1] === '\n';
	}
	return ss[ss.length - 2].substring(-1) === '\n' && ss[ss.length - 1] === '\n';
}

function haveBrace() {
	if (!ss.length) {
		return false;
	}
	return ss[ss.length - 1].substring(-2) === '{\n';
}

function blank() {
	if (ss.length && !haveBlank() && !haveBrace()) {
		put('\n');
	}
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
		blank();
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
		if (options.eq) {
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
		console.assert(0, a);
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
		if (a.expression.type === 'Literal') {
			blank();
		}
		indent(level);
		expr(a.expression, level);
		put(';\n');
		if (a.expression.type === 'Literal') {
			blank();
		}
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
		blank();
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
		blank();
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
		console.assert(0, a);
		break;
	}
}

function format(a, comments, options) {
	global.comments = comments || [];
	global.options = options || {
		indent: '\t',
	};
	commenti = 0;
	ss = [];
	stmt(a, 0);
	if (haveBlank()) {
		ss.pop();
	}
	return ss.join('');
}

exports.format = format;
if (module === require.main) {
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
	var dent = '\t';

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
			dent = '';
			for (var j = +arg(); j-- > 0; ) {
				dent += ' ';
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
		var output = format(a, comments, {
			eq: eq,
			indent: dent,
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
}
