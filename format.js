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
	put('{\n')
	if (a.type == 'BlockStatement')
		for (var b of a.body)
			rec(b, level + 1)
	else
		rec(a, level + 1)
	indent(level)
	put('}')
}

function rec(a, level) {
	switch (a.type) {
	case 'ArrayExpression':
		put('[\n')
		for (var b of a.elements) {
			indent(level + 1)
			rec(b, level + 1)
			put(',\n')
		}
		indent(level)
		put(']')
		break
	case 'AssignmentExpression':
	case 'BinaryExpression':
	case 'LogicalExpression':
		rec(a.left)
		put(' ' + a.operator + ' ')
		rec(a.right)
		break
	case 'BlockStatement':
		for (var b of a.body)
			rec(b, level + 1)
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
	case 'CallExpression':
		rec(a.callee)
		put('(')
		for (var i = 0; i < a.arguments.length; i++) {
			if (i)
				put(', ')
			rec(a.arguments[i])
		}
		put(')')
		break
	case 'ConditionalExpression':
		rec(a.test)
		put(' ? ')
		rec(a.consequent)
		put(' : ')
		rec(a.alternate)
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
		rec(a.test)
		put(');\n')
		break
	case 'EmptyStatement':
		indent(level)
		put(';\n')
		break
	case 'ExpressionStatement':
		indent(level)
		rec(a.expression)
		put(';\n')
		break
	case 'ForStatement':
		indent(level)
		put('for (')
		rec(a.init)
		put('; ')
		rec(a.test)
		put('; ')
		rec(a.update)
		put(') ')
		block(a.body, level)
		put('\n')
		break
	case 'FunctionDeclaration':
	case 'FunctionExpression':
		f.push(convert(a))
		break
	case 'Identifier':
		put(a.name)
		break
	case 'IfStatement':
		indent(level)
		put('if (')
		rec(a.test)
		put(') ')
		block(a.consequent, level)
		if (a.alternate) {
			put(' else ')
			block(a.alternate, level)
		}
		put('\n')
		break
	case 'LabeledStatement':
		rec(a.body, loop, a.label.name)
		break
	case 'Literal':
		put(a.raw)
		break
	case 'MemberExpression':
		rec(a.object)
		if (a.computed)
			rec(a.property)
		f.push(a)
		break
	case 'ObjectExpression':
		f.push(a)
		break
	case 'Program':
		for (var b of a.body)
			rec(b, level)
		break
	case 'ReturnStatement':
		indent(level)
		put('return')
		if (a.argument) {
			put(' ')
			rec(a.argument)
		}
		put(';\n')
		break
	case 'SequenceExpression':
		for (var i = 0; i < a.expressions.length; i++) {
			if (i)
				put(', ')
			rec(a.expressions[i])
		}
		break
	case 'SwitchStatement':
		indent(level)
		put('switch (')
		rec(a.discriminant)
		put(') ')
		block(a.cases)
		put('\n')
		break
	case 'UnaryExpression':
		put(a.operator)
		rec(a.argument)
		break
	case 'UpdateExpression':
		if (a.prefix) {
			put(a.operator)
			rec(a.argument)
		} else {
			rec(a.argument)
			put(a.operator)
		}
		break
	case 'VariableDeclaration':
		indent(level)
		a.declarations.forEach(function (b) {
			rec(b)
		})
		break
	case 'VariableDeclarator':
		variable(a.id.name)
		if (a.init)
			rec({
				type: 'AssignmentExpression',
				left: a.id,
				right: a.init,
			})
		break
	case 'WhileStatement':
		indent(level)
		put('while (')
		rec(a.test)
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
	rec(a, 0)
	return ss.join('')
}
exports.format = format
