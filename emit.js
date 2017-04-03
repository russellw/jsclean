'use strict';
var estraverse = require('estraverse');

// Node type unknown to estraverse
var keys = {
	ParenthesizedExpression: [
		'expression',
	],
};

// Gathered strings
var ss;

function blankLine(ast) {
	if (ast.type === 'FunctionDeclaration') {
		put('\n');
	}
}

function block(ast, level) {
	if (ast.type === 'BlockStatement') {
		put(' ');
		emit(ast, level);
	} else {
		put('\n');
		indent(level + 1);
		emit(ast, level + 1);
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

function emit(ast, level) {
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
			emit(a, level + 1);
			put(',\n');
		}
		indent(level);
		put(']');
		break;
	case 'ArrowFunctionExpression':
		if (ast.params.length === 1) {
			emit(ast.params[0], level);
		} else {
			params(ast.params, level);
		}
		put(' => ');
		if (ast.body.type === 'BlockStatement') {
			block(ast.body, level);
		} else {
			emit(ast.body, level);
		}
		break;
	case 'AssignmentExpression':
	case 'BinaryExpression':
	case 'LogicalExpression':
		emit(ast.left, level);
		put(' ' + ast.operator + ' ');
		emit(ast.right, level);
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
		emit(ast.callee, level);
		params(ast.arguments, level);
		break;
	case 'ConditionalExpression':
		emit(ast.test, level);
		put(' ? ');
		emit(ast.consequent, level);
		put(' : ');
		emit(ast.alternate, level);
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
		emit(ast.test, level);
		put(')');
		put(';');
		break;
	case 'EmptyStatement':
		put(';');
		break;
	case 'ExpressionStatement':
		emit(ast.expression, level);
		put(';');
		break;
	case 'ForInStatement':
		put('for (');
		forInit(ast.left, level);
		put(' in ');
		emit(ast.right, level);
		put(')');
		block(ast.body, level);
		break;
	case 'ForOfStatement':
		put('for (');
		forInit(ast.left, level);
		put(' of ');
		emit(ast.right, level);
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
			emit(ast.test, level);
		}
		put('; ');
		if (ast.update) {
			emit(ast.update, level);
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
		emit(ast.test, level);
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
		emit(ast.body, level);
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
		emit(ast.object, level);
		if (ast.computed) {
			put('[');
			emit(ast.property, level);
			put(']');
		} else {
			put('.');
			emit(ast.property, level);
		}
		break;
	case 'NewExpression':
		put('new ');
		emit(ast.callee, level);
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
			emit(a, level + 1);
			put(',\n');
		}
		indent(level);
		put('}');
		break;
	case 'ParenthesizedExpression':
		put('(');
		emit(ast.expression, level);
		put(')');
		break;
	case 'Program':
		for (var a of ast.body) {
			stmt(a, 0);
		}
		break;
	case 'Property':
		emit(ast.key, level);
		put(': ');
		emit(ast.value, level);
		break;
	case 'ReturnStatement':
		put('return');
		if (ast.argument) {
			put(' ');
			emit(ast.argument, level);
		}
		put(';');
		break;
	case 'SequenceExpression':
		for (var i = 0; i < ast.expressions.length; i++) {
			if (i) {
				put(', ');
			}
			emit(ast.expressions[i], level);
		}
		break;
	case 'SwitchStatement':
		put('switch (');
		emit(ast.discriminant, level);
		put(') {\n');
		for (var c of ast.cases) {
			comment(c, level);
			indent(level);
			if (c.test) {
				put('case ');
				emit(c.test, level);
			} else {
				put('default');
			}
			put(':\n');
			for (var a of c.consequent) {
				comment(a, level + 1);
				indent(level + 1);
				emit(a, level + 1);
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
		emit(ast.argument, level);
		put(';');
		break;
	case 'TryStatement':
		put('try');
		block(ast.block, level);
		if (ast.handler) {
			put(' catch (');
			emit(ast.handler.param, level);
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
		emit(ast.argument, level);
		break;
	case 'UpdateExpression':
		if (ast.prefix) {
			put(ast.operator);
			emit(ast.argument, level);
		} else {
			emit(ast.argument, level);
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
			emit(ast.init, level);
		}
		break;
	case 'WhileStatement':
		put('while (');
		emit(ast.test, level);
		put(')');
		block(ast.body, level);
		break;
	default:
		console.assert(false, ast);
		break;
	}
}

function forInit(ast, level) {
	if (ast.type === 'VariableDeclaration') {
		variableDeclaration(ast, level);
	} else {
		emit(ast, level);
	}
}

function hex(n, size) {
	var s = n.toString(16);
	while (s.length < size) {
		s = '0' + s;
	}
	return s;
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
		emit(a[i], level);
	}
	put(')');
}

function put(s) {
	ss.push(s);
}

function run(ast) {
	ss = [];

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

	// Syntax elements
	emit(ast, 0);
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

function stmt(ast, level) {
	comment(ast, level);
	blankLine(ast);
	indent(level);
	emit(ast, level);
	put('\n');
	blankLine(ast);
}

function variableDeclaration(ast, level) {
	put('var ');
	for (var i = 0; i < ast.declarations.length; i++) {
		if (i) {
			put(', ');
		}
		emit(ast.declarations[i], level);
	}
}

exports.run = run;
