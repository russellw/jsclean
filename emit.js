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

function block(a, level) {
	if (a.type === 'BlockStatement') {
		ss.push(' ');
		emit(a, level);
	} else {
		ss.push('\n');
		indent(level + 1);
		emit(a, level + 1);
	}
}

function blockEnd(a, level) {
	if (a.type === 'BlockStatement')
		ss.push(' ');
	else {
		ss.push('\n');
		indent(level);
	}
}

function comment(a, level) {
	if (!a.leadingComments)
		return;
	ss.push('\n');
	for (var c of a.leadingComments) {
		indent(level);
		if (c.type === 'Line') {
			ss.push('//');
			if (c.value[0] !== ' ')
				ss.push(' ');
			ss.push(c.value);
		} else
			ss.push('/*' + c.value + '*/');
		ss.push('\n');
	}
}

function emit(a, level) {
	switch (a.type) {
	case 'ArrayExpression':
		if (!a.elements.length) {
			ss.push('[]');
			break
		}
		ss.push('[\n');
		for (var b of a.elements) {
			comment(b, level + 1);
			indent(level + 1);
			emit(b, level + 1);
			ss.push(',\n');
		}
		indent(level);
		ss.push(']');
		break
	case 'ArrowFunctionExpression':
		if (a.params.length === 1)
			emit(a.params[0], level);
		else
			params(a.params, level);
		ss.push(' => ');
		if (a.body.type === 'BlockStatement')
			block(a.body, level);
		else
			emit(a.body, level);
		break
	case 'AssignmentExpression':
	case 'BinaryExpression':
	case 'LogicalExpression':
		emit(a.left, level);
		ss.push(' ' + a.operator + ' ');
		emit(a.right, level);
		break
	case 'BlockStatement':
		ss.push('{\n');
		for (var b of a.body)
			stmt(b, level + 1);
		indent(level);
		ss.push('}');
		break
	case 'BreakStatement':
		ss.push('break');
		if (a.label)
			ss.push(' ' + a.label.name);
		break
	case 'CallExpression':
		emit(a.callee, level);
		params(a.arguments, level);
		break
	case 'ConditionalExpression':
		emit(a.test, level);
		ss.push(' ? ');
		emit(a.consequent, level);
		ss.push(' : ');
		emit(a.alternate, level);
		break
	case 'ContinueStatement':
		ss.push('continue');
		if (a.label)
			ss.push(' ' + a.label.name);
		break
	case 'DoWhileStatement':
		ss.push('do');
		block(a.body, level);
		blockEnd(a.body, level);
		ss.push('while (');
		emit(a.test, level);
		ss.push(')');
		ss.push(';');
		break
	case 'EmptyStatement':
		ss.push(';');
		break
	case 'ExpressionStatement':
		emit(a.expression, level);
		ss.push(';');
		break
	case 'ForInStatement':
		ss.push('for (');
		forInit(a.left, level);
		ss.push(' in ');
		emit(a.right, level);
		ss.push(')');
		block(a.body, level);
		break
	case 'ForOfStatement':
		ss.push('for (');
		forInit(a.left, level);
		ss.push(' of ');
		emit(a.right, level);
		ss.push(')');
		block(a.body, level);
		break
	case 'ForStatement':
		ss.push('for (');
		if (a.init)
			forInit(a.init, level);
		ss.push('; ');
		if (a.test)
			emit(a.test, level);
		ss.push('; ');
		if (a.update)
			emit(a.update, level);
		ss.push(')');
		block(a.body, level);
		break
	case 'FunctionDeclaration':
		ss.push('function ' + a.id.name);
		params(a.params, level);
		block(a.body, level);
		break
	case 'FunctionExpression':
		ss.push('function ');
		if (a.id)
			ss.push(a.id.name);
		params(a.params, level);
		block(a.body, level);
		break
	case 'Identifier':
		ss.push(a.name);
		break
	case 'IfStatement':
		ss.push('if (');
		emit(a.test, level);
		ss.push(')');
		block(a.consequent, level);
		if (a.alternate) {
			blockEnd(a.consequent, level);
			ss.push('else');
			block(a.alternate, level);
		}
		break
	case 'LabeledStatement':
		ss.push(a.label.name + ': ');
		emit(a.body, level);
		break
	case 'Literal':
		if (typeof (a.value) === 'string') {
			var q = "'";
			if (a.value.indexOf(q) >= 0)
				q = '"';
			ss.push(q);
			for (var c of a.value)
				switch (c) {
				case '\b':
					ss.push('\\b');
					break
				case '\t':
					ss.push('\\t');
					break
				case '\n':
					ss.push('\\n');
					break
				case '\v':
					ss.push('\\v');
					break
				case '\f':
					ss.push('\\f');
					break
				case '\r':
					ss.push('\\r');
					break
				case '\\':
					ss.push('\\\\');
					break
				case q:
					ss.push('\\');
					ss.push(q);
					break
				default:
					var n = c.charCodeAt(0);
					if (32 <= n && n <= 126) {
						ss.push(c);
						break
					}
					if (n < 0x100) {
						ss.push('\\x');
						ss.push(hex(n, 2));
						break
					}
					ss.push('\\u');
					ss.push(hex(n, 4));
					break
				}
			ss.push(q);
			break
		}
		ss.push(a.raw);
		break
	case 'MemberExpression':
		emit(a.object, level);
		if (a.computed) {
			ss.push('[');
			emit(a.property, level);
			ss.push(']');
		} else {
			ss.push('.');
			emit(a.property, level);
		}
		break
	case 'NewExpression':
		ss.push('new ');
		emit(a.callee, level);
		params(a.arguments, level);
		break
	case 'ObjectExpression':
		if (!a.properties.length) {
			ss.push('{}');
			break
		}
		ss.push('{\n');
		for (var b of a.properties) {
			comment(b, level + 1);
			indent(level + 1);
			emit(b, level + 1);
			ss.push(',\n');
		}
		indent(level);
		ss.push('}');
		break
	case 'ParenthesizedExpression':
		ss.push('(');
		emit(a.expression, level);
		ss.push(')');
		break
	case 'Program':
		for (var b of a.body)
			stmt(b, 0);
		break
	case 'Property':
		emit(a.key, level);
		if (separate(a.value)) {
			ss.push(':\n');
			level++;
			indent(level);
			emit(a.value, level);
			break
		}
		ss.push(': ');
		emit(a.value, level);
		break
	case 'ReturnStatement':
		ss.push('return');
		if (a.argument) {
			ss.push(' ');
			emit(a.argument, level);
		}
		ss.push(';');
		break
	case 'SequenceExpression':
		for (var i = 0; i < a.expressions.length; i++) {
			if (i)
				ss.push(', ');
			emit(a.expressions[i], level);
		}
		break
	case 'SwitchStatement':
		ss.push('switch (');
		emit(a.discriminant, level);
		ss.push(') {\n');
		for (var c of a.cases) {
			comment(c, level);
			indent(level);
			if (c.test) {
				ss.push('case ');
				emit(c.test, level);
			} else
				ss.push('default');
			ss.push(':\n');
			for (var b of c.consequent) {
				comment(b, level + 1);
				indent(level + 1);
				emit(b, level + 1);
				ss.push('\n');
			}
		}
		indent(level);
		ss.push('}');
		break
	case 'ThisExpression':
		ss.push('this');
		break
	case 'ThrowStatement':
		ss.push('throw ');
		emit(a.argument, level);
		ss.push(';');
		break
	case 'TryStatement':
		ss.push('try');
		block(a.block, level);
		if (a.handler) {
			ss.push(' catch (');
			emit(a.handler.param, level);
			ss.push(')');
			block(a.handler.body, level);
		}
		if (a.finalizer) {
			ss.push(' finally ');
			block(a.finalizer, level);
		}
		break
	case 'UnaryExpression':
		ss.push(a.operator);
		if (a.operator.search(/[a-z]/) >= 0)
			ss.push(' ');
		emit(a.argument, level);
		break
	case 'UpdateExpression':
		if (a.prefix) {
			ss.push(a.operator);
			emit(a.argument, level);
		} else {
			emit(a.argument, level);
			ss.push(a.operator);
		}
		break
	case 'VariableDeclaration':
		variableDeclaration(a, level);
		ss.push(';');
		break
	case 'VariableDeclarator':
		ss.push(a.id.name);
		if (a.init) {
			ss.push(' = ');
			emit(a.init, level);
		}
		break
	case 'WhileStatement':
		ss.push('while (');
		emit(a.test, level);
		ss.push(')');
		block(a.body, level);
		break
	default:
		console.assert(false, a);
		break
	}
}

function forInit(a, level) {
	if (a.type === 'VariableDeclaration')
		variableDeclaration(a, level);
	else
		emit(a, level);
}

function hex(n, size) {
	var s = n.toString(16);
	while (s.length < size)
		s = '0' + s;
	return s;
}

function indent(level) {
	while (level--)
		ss.push('\t');
}

function params(a, level) {
	if (a.some(separate)) {
		ss.push('(\n');
		level++;
		for (var i = 0; i < a.length; i++) {
			if (i)
				ss.push(',\n');
			indent(level);
			emit(a[i], level);
		}
		ss.push(')');
		return;
	}
	ss.push('(');
	for (var i = 0; i < a.length; i++) {
		if (i)
			ss.push(', ');
		emit(a[i], level);
	}
	ss.push(')');
}

function separate(a) {
	return a.type === 'FunctionExpression';
}

function stmt(a, level) {
	comment(a, level);
	if (a.type === 'FunctionDeclaration')
		ss.push('\n');
	indent(level);
	emit(a, level);
	ss.push('\n');
	if (a.type === 'FunctionDeclaration')
		ss.push('\n');
}

function variableDeclaration(a, level) {
	ss.push('var ');
	for (var i = 0; i < a.declarations.length; i++) {
		if (i)
			ss.push(', ');
		emit(a.declarations[i], level);
	}
}

// Exports

function run(a) {
	ss = [];

	// Bubble comments up to statements
	estraverse.traverse(a, {
		keys: keys,
		leave:
			function (a, parent) {
				if (!a.leadingComments)
					return;
				if (!parent)
					return;
				if (a.type.indexOf('Statement') >= 0)
					return;
				switch (a.type) {
				case 'FunctionDeclaration':
				case 'SwitchCase':
					return;
				case 'VariableDeclaration':
					if (parent.type.indexOf('For') < 0)
						return;
					break
				}
				switch (parent.type) {
				case 'ArrayExpression':
				case 'ObjectExpression':
					return;
				}
				parent.leadingComments = (parent.leadingComments || []).concat(a.leadingComments);
				a.leadingComments = null;
			},
	});

	// Emit
	emit(a, 0);
	var text = ss.join('');

	// #!
	text = a.hashbang + '\n\n' + text;

	// Only one consecutive blank line
	text = text.replace(/\n\n+/g, '\n\n');

	// Don't start with blank line
	text = text.replace(/^\n+/, '');
	text = text.replace(/{\n\n/g, '{\n');

	// End with exactly one newline
	return text.replace(/\n*$/, '\n');
}

exports.run = run;
