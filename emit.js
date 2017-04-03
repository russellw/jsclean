'use strict';
var estraverse = require('estraverse');

// Node type unknown to estraverse
var keys = {
	ParenthesizedExpression: [
		'expression',
	],
};

function hex(n, size) {
	var s = n.toString(16);
	while (s.length < size) {
		s = '0' + s;
	}
	return s;
}

function run(ast) {

	// Bubble comments up to statements
	estraverse.traverse(ast, {
		keys: keys,
		leave: function (ast, parent) {
			if (!ast.leadingComments) {
				return;
			}
			if (!parent) {
				return;
			}
			if (ast.type.indexOf('Statement') >= 0) {
				return;
			}
			switch (ast.type) {
			case 'FunctionDeclaration':
			case 'SwitchCase':
				return;
			case 'VariableDeclaration':
				if (parent.type.indexOf('For') < 0) {
					return;
				}
				break;
			}
			switch (parent.type) {
			case 'ArrayExpression':
			case 'ObjectExpression':
				return;
			}
			parent.leadingComments = (parent.leadingComments || []).concat(ast.leadingComments);
			ast.leadingComments = null;
		},
	});

	// Gathered strings
	var ss = [];

	function put(s) {
		ss.push(s);
	}

	// Syntax elements

	function blankLine(ast) {
		if (ast.type === 'FunctionDeclaration') {
			put('\n');
		}
	}

	function block(ast, level) {
		if (ast.type === 'BlockStatement') {
			put(' ');
			rec(ast, level);
		} else {
			put('\n');
			indent(level + 1);
			rec(ast, level + 1);
		}
	}

	function blockEnd(ast, level) {
		if (ast.type === 'BlockStatement') {
			put(' ');
		} else {
			put('\n');
			indent(level);
		}
	}

	function comment(ast, level) {
		if (!ast.leadingComments) {
			return;
		}
		put('\n');
		for (var c of ast.leadingComments) {
			indent(level);
			if (c.type === 'Line') {
				put('//');
				if (c.value[0] !== ' ') {
					put(' ');
				}
				put(c.value);
			} else {
				put('/*' + c.value + '*/');
			}
			put('\n');
		}
	}

	function forInit(ast, level) {
		if (ast.type === 'VariableDeclaration') {
			variableDeclaration(ast, level);
		} else {
			rec(ast, level);
		}
	}

	function indent(level) {
		while (level--) {
			put('\t');
		}
	}

	function params(a, level) {
		put('(');
		for (var i = 0; i < a.length; i++) {
			if (i) {
				put(', ');
			}
			rec(a[i], level);
		}
		put(')');
	}

	function stmt(ast, level) {
		comment(ast, level);
		blankLine(ast);
		indent(level);
		rec(ast, level);
		put('\n');
		blankLine(ast);
	}

	function variableDeclaration(ast, level) {
		put('var ');
		for (var i = 0; i < ast.declarations.length; i++) {
			if (i) {
				put(', ');
			}
			rec(ast.declarations[i], level);
		}
	}

	// Recursive descent

	function rec(ast, level) {
		switch (ast.type) {
		case 'ArrayExpression':
			if (!ast.elements.length) {
				put('[]');
				break;
			}
			put('[\n');
			for (var a of ast.elements) {
				comment(a, level + 1);
				indent(level + 1);
				rec(a, level + 1);
				put(',\n');
			}
			indent(level);
			put(']');
			break;
		case 'ArrowFunctionExpression':
			if (ast.params.length === 1) {
				rec(ast.params[0], level);
			} else {
				params(ast.params, level);
			}
			put(' => ');
			if (ast.body.type === 'BlockStatement') {
				block(ast.body, level);
			} else {
				rec(ast.body, level);
			}
			break;
		case 'AssignmentExpression':
		case 'BinaryExpression':
		case 'LogicalExpression':
			rec(ast.left, level);
			put(' ' + ast.operator + ' ');
			rec(ast.right, level);
			break;
		case 'BlockStatement':
			put('{\n');
			for (var a of ast.body) {
				stmt(a, level + 1);
			}
			indent(level);
			put('}');
			break;
		case 'BreakStatement':
			put('break');
			if (ast.label) {
				put(' ' + ast.label.name);
			}
			put(';');
			break;
		case 'CallExpression':
			rec(ast.callee, level);
			params(ast.arguments, level);
			break;
		case 'ConditionalExpression':
			rec(ast.test, level);
			put(' ? ');
			rec(ast.consequent, level);
			put(' : ');
			rec(ast.alternate, level);
			break;
		case 'ContinueStatement':
			put('continue');
			if (ast.label) {
				put(' ' + ast.label.name);
			}
			put(';');
			break;
		case 'DoWhileStatement':
			put('do');
			block(ast.body, level);
			blockEnd(ast.body, level);
			put('while (');
			rec(ast.test, level);
			put(')');
			put(';');
			break;
		case 'EmptyStatement':
			put(';');
			break;
		case 'ExpressionStatement':
			rec(ast.expression, level);
			put(';');
			break;
		case 'ForInStatement':
			put('for (');
			forInit(ast.left, level);
			put(' in ');
			rec(ast.right, level);
			put(')');
			block(ast.body, level);
			break;
		case 'ForOfStatement':
			put('for (');
			forInit(ast.left, level);
			put(' of ');
			rec(ast.right, level);
			put(')');
			block(ast.body, level);
			break;
		case 'ForStatement':
			put('for (');
			if (ast.init) {
				forInit(ast.init, level);
			}
			put('; ');
			if (ast.test) {
				rec(ast.test, level);
			}
			put('; ');
			if (ast.update) {
				rec(ast.update, level);
			}
			put(')');
			block(ast.body, level);
			break;
		case 'FunctionDeclaration':
			put('function ' + ast.id.name);
			params(ast.params, level);
			block(ast.body, level);
			break;
		case 'FunctionExpression':
			put('function ');
			if (ast.id) {
				put(ast.id.name);
			}
			params(ast.params, level);
			block(ast.body, level);
			break;
		case 'Identifier':
			put(ast.name);
			break;
		case 'IfStatement':
			put('if (');
			rec(ast.test, level);
			put(')');
			block(ast.consequent, level);
			if (ast.alternate) {
				blockEnd(ast.consequent, level);
				put('else');
				block(ast.alternate, level);
			}
			break;
		case 'LabeledStatement':
			put(ast.label.name + ': ');
			rec(ast.body, level);
			break;
		case 'Literal':
			if (typeof (ast.value) === 'string') {
				var q = "'";
				if (ast.value.indexOf(q) >= 0) {
					q = '"';
				}
				put(q);
				for (var c of ast.value) {
					switch (c) {
					case '\b':
						put('\\b');
						break;
					case '\t':
						put('\\t');
						break;
					case '\n':
						put('\\n');
						break;
					case '\v':
						put('\\v');
						break;
					case '\f':
						put('\\f');
						break;
					case '\r':
						put('\\r');
						break;
					case '\\':
						put('\\\\');
						break;
					case q:
						put('\\');
						put(q);
						break;
					default:
						var n = c.charCodeAt(0);
						if (32 <= n && n <= 126) {
							put(c);
							break;
						}
						if (n < 0x100) {
							put('\\x');
							put(hex(n, 2));
							break;
						}
						put('\\u');
						put(hex(n, 4));
						break;
					}
				}
				put(q);
				break;
			}
			put(ast.raw);
			break;
		case 'MemberExpression':
			rec(ast.object, level);
			if (ast.computed) {
				put('[');
				rec(ast.property, level);
				put(']');
			} else {
				put('.');
				rec(ast.property, level);
			}
			break;
		case 'NewExpression':
			put('new ');
			rec(ast.callee, level);
			params(ast.arguments, level);
			break;
		case 'ObjectExpression':
			if (!ast.properties.length) {
				put('{}');
				break;
			}
			put('{\n');
			for (var a of ast.properties) {
				comment(a, level + 1);
				indent(level + 1);
				rec(a, level + 1);
				put(',\n');
			}
			indent(level);
			put('}');
			break;
		case 'ParenthesizedExpression':
			put('(');
			rec(ast.expression, level);
			put(')');
			break;
		case 'Program':
			for (var a of ast.body) {
				stmt(a, 0);
			}
			break;
		case 'Property':
			rec(ast.key, level);
			put(': ');
			rec(ast.value, level);
			break;
		case 'ReturnStatement':
			put('return');
			if (ast.argument) {
				put(' ');
				rec(ast.argument, level);
			}
			put(';');
			break;
		case 'SequenceExpression':
			for (var i = 0; i < ast.expressions.length; i++) {
				if (i) {
					put(', ');
				}
				rec(ast.expressions[i], level);
			}
			break;
		case 'SwitchStatement':
			put('switch (');
			rec(ast.discriminant, level);
			put(') {\n');
			for (var c of ast.cases) {
				comment(c, level);
				indent(level);
				if (c.test) {
					put('case ');
					rec(c.test, level);
				} else {
					put('default');
				}
				put(':\n');
				for (var a of c.consequent) {
					comment(a, level + 1);
					indent(level + 1);
					rec(a, level + 1);
					put('\n');
				}
			}
			indent(level);
			put('}');
			break;
		case 'ThisExpression':
			put('this');
			break;
		case 'ThrowStatement':
			put('throw ');
			rec(ast.argument, level);
			put(';');
			break;
		case 'TryStatement':
			put('try');
			block(ast.block, level);
			if (ast.handler) {
				put(' catch (');
				rec(ast.handler.param, level);
				put(')');
				block(ast.handler.body, level);
			}
			if (ast.finalizer) {
				put(' finally ');
				block(ast.finalizer, level);
			}
			break;
		case 'UnaryExpression':
			put(ast.operator);
			if (ast.operator.search(/[a-z]/) >= 0) {
				put(' ');
			}
			rec(ast.argument, level);
			break;
		case 'UpdateExpression':
			if (ast.prefix) {
				put(ast.operator);
				rec(ast.argument, level);
			} else {
				rec(ast.argument, level);
				put(ast.operator);
			}
			break;
		case 'VariableDeclaration':
			variableDeclaration(ast, level);
			put(';');
			break;
		case 'VariableDeclarator':
			put(ast.id.name);
			if (ast.init) {
				put(' = ');
				rec(ast.init, level);
			}
			break;
		case 'WhileStatement':
			put('while (');
			rec(ast.test, level);
			put(')');
			block(ast.body, level);
			break;
		default:
			console.assert(false, ast);
			break;
		}
	}

	rec(ast, 0);
	var text = ss.join('');

	// #!
	text = ast.hashbang + '\n\n' + text;

	// Don't start with blank line
	text = text.replace(/^\n+/, '');

	// Only one consecutive blank line
	text = text.replace(/\n\n+/g, '\n\n');

	// End with exactly one newline
	return text.replace(/\n*$/, '\n');
}

exports.run = run;
