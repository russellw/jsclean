'use strict';
var ss;

function put(s) {
	ss.push(s)
}

function indent(level) {
	while (level--)
		put('\t')
}

function block(a, level) {
	switch (a.type) {
	case 'BlockStatement':
		if (a.body.length == 0 || a.body.length == 1 && a.body[0].type == 'EmptyStatement') {
			put('{}')
			break
		}
		put('{\n')
		for (var b of a.body)
			stmt(b, level + 1)
		put('}')
		break
	case 'EmptyStatement':
		put('{}')
		break
	default:
		put('{\n')
		stmt(a, level + 1)
		put('}')
	}
	indent(level)
}

function expr(a, level) {
	switch (a.type) {
	case 'ArrayExpression':
		put('[\n')
		for (var b of a.elements) {
			indent(level + 1)
			expr(b, level + 1)
			put(',\n')
		}
		indent(level)
		put(']')
		break
	case 'AssignmentExpression':
	case 'BinaryExpression':
	case 'LogicalExpression':
		expr(a.left, level)
		put(' ' + a.operator + ' ')
		expr(a.right, level)
		break
	case 'CallExpression':
		expr(a.callee, level)
		put('(')
		for (var i = 0; i < a.arguments.length; i++) {
			if (i)
				put(', ')
			expr(a.arguments[i], level)
		}
		put(')')
		break
	case 'ConditionalExpression':
		expr(a.test, level)
		put(' ? ')
		expr(a.consequent, level)
		put(' : ')
		expr(a.alternate, level)
		break
	case 'FunctionExpression':
		put('function (')
		for (var i = 0; i < a.params.length; i++) {
			if (i)
				put(', ')
			expr(a.params[i], level)
		}
		put(') ')
		block(a.body, level)
		break
	case 'Identifier':
		put(a.name)
		break
	case 'Literal':
		put(a.raw)
		break
	case 'MemberExpression':
		expr(a.object, level)
		if (a.computed) {
			put('[')
			expr(a.property, level)
			put(']')
		} else {
			put('.')
			expr(a.property, level)
		}
		break
	case 'ObjectExpression':
		put('{\n')
		for (var b of a.properties) {
			indent(level + 1)
			expr(b, level + 1)
			put(',\n')
		}
		indent(level)
		put('}')
		break
	case 'Property':
		expr(a.key, level)
		put(': ')
		expr(a.value, level)
		break
	case 'SequenceExpression':
		for (var i = 0; i < a.expressions.length; i++) {
			if (i)
				put(', ')
			expr(a.expressions[i], level)
		}
		break
	case 'UnaryExpression':
		put(a.operator)
		expr(a.argument, level)
		break
	case 'UpdateExpression':
		if (a.prefix) {
			put(a.operator)
			expr(a.argument, level)
		} else {
			expr(a.argument, level)
			put(a.operator)
		}
		break
	case 'VariableDeclaration':
		put('var ')
		for (var i = 0; i < a.declarations.length; i++) {
			if (i)
				put(', ')
			expr(a.declarations[i], level)
		}
		break
	case 'VariableDeclarator':
		put(a.id.name)
		if (a.init) {
			put(' = ')
			expr(a.init, level)
		}
		break
	default:
		console.assert(0, a)
	}
}

function stmt(a, level) {
	switch (a.type) {
	case 'BlockStatement':
		for (var b of a.body)
			stmt(b, level + 1)
		break
	case 'BreakStatement':
		indent(level)
		put('break')
		if (a.label) {
			put(' ')
			put(a.label.name)
		}
		put(';\n')
		break
	case 'ContinueStatement':
		indent(level)
		put('continue')
		if (a.label) {
			put(' ')
			put(a.label.name)
		}
		put(';\n')
		break
	case 'DoWhileStatement':
		indent(level)
		put('do ')
		block(a.body, level)
		indent(level)
		put(' while (')
		expr(a.test, level)
		put(');\n')
		break
	case 'EmptyStatement':
		indent(level)
		put(';\n')
		break
	case 'ExpressionStatement':
		indent(level)
		expr(a.expression, level)
		put(';\n')
		break
	case 'ForInStatement':
		indent(level)
		put('for (')
		expr(a.left, level)
		put(' in ')
		expr(a.right, level)
		put(') ')
		block(a.body, level)
		put('\n')
		break
	case 'ForOfStatement':
		indent(level)
		put('for (')
		expr(a.left, level)
		put(' of ')
		expr(a.right, level)
		put(') ')
		block(a.body, level)
		put('\n')
		break
	case 'ForStatement':
		indent(level)
		put('for (')
		expr(a.init, level)
		put('; ')
		expr(a.test, level)
		put('; ')
		expr(a.update, level)
		put(') ')
		block(a.body, level)
		put('\n')
		break
	case 'FunctionDeclaration':
		indent(level)
		put('function ' + a.id.name + '(')
		for (var i = 0; i < a.params.length; i++) {
			if (i)
				put(', ')
			expr(a.params[i], level)
		}
		put(') ')
		block(a.body, level)
		put('\n')
		break
	case 'IfStatement':
		indent(level)
		put('if (')
		expr(a.test, level)
		put(') ')
		block(a.consequent, level)
		if (a.alternate) {
			put(' else ')
			block(a.alternate, level)
		}
		put('\n')
		break
	case 'LabeledStatement':
		stmt(a.body, loop, a.label.name)
		break
	case 'Program':
		for (var b of a.body)
			stmt(b, level)
		break
	case 'ReturnStatement':
		indent(level)
		put('return')
		if (a.argument) {
			put(' ')
			expr(a.argument, level)
		}
		put(';\n')
		break
	case 'SwitchStatement':
		indent(level)
		put('switch (')
		expr(a.discriminant, level)
		put(') {\n')
		for (var c of a.cases) {
			indent(level)
			put('case ')
			expr(c.test, level)
			put(':\n')
			for (var b of c.consequent)
				stmt(b, level + 1)
		}
		indent(level)
		put('}\n')
		break
	case 'VariableDeclaration':
		indent(level)
		put('var ')
		for (var i = 0; i < a.declarations.length; i++) {
			if (i)
				put(', ')
			expr(a.declarations[i], level)
		}
		put(';\n')
		break
	case 'WhileStatement':
		indent(level)
		put('while (')
		expr(a.test, level)
		put(') ')
		block(a.body, level)
		put('\n')
		break
	default:
		console.assert(0, a)
	}
}

function format(a) {
	ss = []
	stmt(a, 0)
	return ss.join('')
}
exports.format = format
