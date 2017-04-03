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
		ss.push('\n');
	}
}

function block(ast, level) {
	if (ast.type === 'BlockStatement') {
		ss.push(' ');
		emit(ast, level);
	} else {
		ss.push('\n');
		indent(level + 1);
		emit(ast, level + 1);
	}
}

function blockEnd(ast, level) {
	if (ast.type === 'BlockStatement') {
		ss.push(' ');
	} else {
		ss.push('\n');
		indent(level);
	}
}

function comment(ast, level) {
	if (!ast.leadingComments) {
		return;
	}
	ss.push('\n');
	for (var c of ast.leadingComments) {
		indent(level);
		if (c.type === 'Line') {
			ss.push('//');
			if (c.value[0] !== ' ') {
				ss.push(' ');
			}
			ss.push(c.value);
		} else {
			ss.push('/*' + c.value + '*/');
		}
		ss.push('\n');
	}
}

function emit(ast, level) {
	switch (ast.type) {
	case 'ArrayExpression':
		if (!ast.elements.length) {
			ss.push('[]');
			break;
		}
		ss.push('[\n');
		for (var a of ast.elements) {
			comment(a, level + 1);
			indent(level + 1);
			emit(a, level + 1);
			ss.push(',\n');
		}
		indent(level);
		ss.push(']');
		break;
	case 'ArrowFunctionExpression':
		if (ast.params.length === 1) {
			emit(ast.params[0], level);
		} else {
			params(ast.params, level);
		}
		ss.push(' => ');
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
		ss.push(' ' + ast.operator + ' ');
		emit(ast.right, level);
		break;
	case 'BlockStatement':
		ss.push('{\n');
		for (var a of ast.body) {
			stmt(a, level + 1);
		}
		indent(level);
		ss.push('}');
		break;
	case 'BreakStatement':
		ss.push('break');
		if (ast.label) {
			ss.push(' ' + ast.label.name);
		}
		ss.push(';');
		break;
	case 'CallExpression':
		emit(ast.callee, level);
		params(ast.arguments, level);
		break;
	case 'ConditionalExpression':
		emit(ast.test, level);
		ss.push(' ? ');
		emit(ast.consequent, level);
		ss.push(' : ');
		emit(ast.alternate, level);
		break;
	case 'ContinueStatement':
		ss.push('continue');
		if (ast.label) {
			ss.push(' ' + ast.label.name);
		}
		ss.push(';');
		break;
	case 'DoWhileStatement':
		ss.push('do');
		block(ast.body, level);
		blockEnd(ast.body, level);
		ss.push('while (');
		emit(ast.test, level);
		ss.push(')');
		ss.push(';');
		break;
	case 'EmptyStatement':
		ss.push(';');
		break;
	case 'ExpressionStatement':
		emit(ast.expression, level);
		ss.push(';');
		break;
	case 'ForInStatement':
		ss.push('for (');
		forInit(ast.left, level);
		ss.push(' in ');
		emit(ast.right, level);
		ss.push(')');
		block(ast.body, level);
		break;
	case 'ForOfStatement':
		ss.push('for (');
		forInit(ast.left, level);
		ss.push(' of ');
		emit(ast.right, level);
		ss.push(')');
		block(ast.body, level);
		break;
	case 'ForStatement':
		ss.push('for (');
		if (ast.init) {
			forInit(ast.init, level);
		}
		ss.push('; ');
		if (ast.test) {
			emit(ast.test, level);
		}
		ss.push('; ');
		if (ast.update) {
			emit(ast.update, level);
		}
		ss.push(')');
		block(ast.body, level);
		break;
	case 'FunctionDeclaration':
		ss.push('function ' + ast.id.name);
		params(ast.params, level);
		block(ast.body, level);
		break;
	case 'FunctionExpression':
		ss.push('function ');
		if (ast.id) {
			ss.push(ast.id.name);
		}
		params(ast.params, level);
		block(ast.body, level);
		break;
	case 'Identifier':
		ss.push(ast.name);
		break;
	case 'IfStatement':
		ss.push('if (');
		emit(ast.test, level);
		ss.push(')');
		block(ast.consequent, level);
		if (ast.alternate) {
			blockEnd(ast.consequent, level);
			ss.push('else');
			block(ast.alternate, level);
		}
		break;
	case 'LabeledStatement':
		ss.push(ast.label.name + ': ');
		emit(ast.body, level);
		break;
	case 'Literal':
		if (typeof (ast.value) === 'string') {
			var q = "'";
			if (ast.value.indexOf(q) >= 0) {
				q = '"';
			}
			ss.push(q);
			for (var c of ast.value) {
				switch (c) {
				case '\b':
					ss.push('\\b');
					break;
				case '\t':
					ss.push('\\t');
					break;
				case '\n':
					ss.push('\\n');
					break;
				case '\v':
					ss.push('\\v');
					break;
				case '\f':
					ss.push('\\f');
					break;
				case '\r':
					ss.push('\\r');
					break;
				case '\\':
					ss.push('\\\\');
					break;
				case q:
					ss.push('\\');
					ss.push(q);
					break;
				default:
					var n = c.charCodeAt(0);
					if (32 <= n && n <= 126) {
						ss.push(c);
						break;
					}
					if (n < 0x100) {
						ss.push('\\x');
						ss.push(hex(n, 2));
						break;
					}
					ss.push('\\u');
					ss.push(hex(n, 4));
					break;
				}
			}
			ss.push(q);
			break;
		}
		ss.push(ast.raw);
		break;
	case 'MemberExpression':
		emit(ast.object, level);
		if (ast.computed) {
			ss.push('[');
			emit(ast.property, level);
			ss.push(']');
		} else {
			ss.push('.');
			emit(ast.property, level);
		}
		break;
	case 'NewExpression':
		ss.push('new ');
		emit(ast.callee, level);
		params(ast.arguments, level);
		break;
	case 'ObjectExpression':
		if (!ast.properties.length) {
			ss.push('{}');
			break;
		}
		ss.push('{\n');
		for (var a of ast.properties) {
			comment(a, level + 1);
			indent(level + 1);
			emit(a, level + 1);
			ss.push(',\n');
		}
		indent(level);
		ss.push('}');
		break;
	case 'ParenthesizedExpression':
		ss.push('(');
		emit(ast.expression, level);
		ss.push(')');
		break;
	case 'Program':
		for (var a of ast.body) {
			stmt(a, 0);
		}
		break;
	case 'Property':
		emit(ast.key, level);
		ss.push(': ');
		emit(ast.value, level);
		break;
	case 'ReturnStatement':
		ss.push('return');
		if (ast.argument) {
			ss.push(' ');
			emit(ast.argument, level);
		}
		ss.push(';');
		break;
	case 'SequenceExpression':
		for (var i = 0; i < ast.expressions.length; i++) {
			if (i) {
				ss.push(', ');
			}
			emit(ast.expressions[i], level);
		}
		break;
	case 'SwitchStatement':
		ss.push('switch (');
		emit(ast.discriminant, level);
		ss.push(') {\n');
		for (var c of ast.cases) {
			comment(c, level);
			indent(level);
			if (c.test) {
				ss.push('case ');
				emit(c.test, level);
			} else {
				ss.push('default');
			}
			ss.push(':\n');
			for (var a of c.consequent) {
				comment(a, level + 1);
				indent(level + 1);
				emit(a, level + 1);
				ss.push('\n');
			}
		}
		indent(level);
		ss.push('}');
		break;
	case 'ThisExpression':
		ss.push('this');
		break;
	case 'ThrowStatement':
		ss.push('throw ');
		emit(ast.argument, level);
		ss.push(';');
		break;
	case 'TryStatement':
		ss.push('try');
		block(ast.block, level);
		if (ast.handler) {
			ss.push(' catch (');
			emit(ast.handler.param, level);
			ss.push(')');
			block(ast.handler.body, level);
		}
		if (ast.finalizer) {
			ss.push(' finally ');
			block(ast.finalizer, level);
		}
		break;
	case 'UnaryExpression':
		ss.push(ast.operator);
		if (ast.operator.search(/[a-z]/) >= 0) {
			ss.push(' ');
		}
		emit(ast.argument, level);
		break;
	case 'UpdateExpression':
		if (ast.prefix) {
			ss.push(ast.operator);
			emit(ast.argument, level);
		} else {
			emit(ast.argument, level);
			ss.push(ast.operator);
		}
		break;
	case 'VariableDeclaration':
		variableDeclaration(ast, level);
		ss.push(';');
		break;
	case 'VariableDeclarator':
		ss.push(ast.id.name);
		if (ast.init) {
			ss.push(' = ');
			emit(ast.init, level);
		}
		break;
	case 'WhileStatement':
		ss.push('while (');
		emit(ast.test, level);
		ss.push(')');
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
		ss.push('\t');
	}
}

function params(a, level) {
	ss.push('(');
	for (var i = 0; i < a.length; i++) {
		if (i) {
			ss.push(', ');
		}
		emit(a[i], level);
	}
	ss.push(')');
}

function stmt(ast, level) {
	comment(ast, level);
	blankLine(ast);
	indent(level);
	emit(ast, level);
	ss.push('\n');
	blankLine(ast);
}

function variableDeclaration(ast, level) {
	ss.push('var ');
	for (var i = 0; i < ast.declarations.length; i++) {
		if (i) {
			ss.push(', ');
		}
		emit(ast.declarations[i], level);
	}
}

// Exports

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

	// Emit
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

exports.run = run;
