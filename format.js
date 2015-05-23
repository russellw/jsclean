'use strict';
var commenti;
var ss;

function put(s) {
	ss.push(s)
}

function haveBlank() {
	if (!ss.length)
		return false
	if (ss.length == 1)
		return ss[ss.length - 1] == '\n'
	return ss[ss.length - 2].substring(-1) == '\n' && ss[ss.length - 1] == '\n'
}

function haveBrace() {
	if (!ss.length)
		return false
	return ss[ss.length - 1].substring(-2) == '{\n'
}


function blank() {
	if (!haveBlank() && !haveBrace())
		put('\n')
}

function indent(level) {
	while (level--)
		put(options.indent)
}

function comment(a, level) {
	function more() {
		if (commenti == comments.length)
			return false
		var c = comments[commenti];
		return c.loc.start.line <= a.loc.start.line
	}
	if (more())
		blank()
	while (more()) {
		var c = comments[commenti++];
		indent(level)
		if (c.type == 'Line')
			put('//' + c.value)
		else
			put('/*' + c.value + '*/')
		put('\n')
	}
}

function block(a, level) {
	put('{\n')
	if (a.type == 'BlockStatement')
		for (var b of a.body) {
			comment(b, level + 1)
			stmt(b, level + 1)
		} else
			stmt(a, level + 1)
	indent(level)
	put('}')
}

function expr(a, level) {
	switch (a.type) {
	case 'ArrayExpression':
		if (!a.elements.length) {
			put('[]')
			break
		}
		put('[\n')
		for (var b of a.elements) {
			indent(level + 1)
			expr(b, level + 1)
			put(',\n')
		}
		indent(level)
		put(']')
		break
	case 'ArrowFunctionExpression':
		if (a.params.length == 1)
			expr(a.params[0], level)
		else {
			put('(')
			for (var i = 0; i < a.params.length; i++) {
				if (i)
					put(', ')
				expr(a.params[i], level)
			}
			put(')')
		}
		put(' => ')
		if (a.body.type == 'BlockStatement')
			block(a.body, level)
		else
			expr(a.body, level)
		break
	case 'AssignmentExpression':
	case 'BinaryExpression':
	case 'LogicalExpression':
		expr(a.left, level)
		if (options.eq)
			switch (a.operator) {
			case '==':
				a.operator = '==='
				break
			case '!=':
				a.operator = '!=='
				break
			}
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
		put('function ')
		if (a.id)
			put(a.id.name)
		put('(')
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
		if (!a.properties.length) {
			put('{}')
			break
		}
		put('{\n')
		for (var b of a.properties) {
			indent(level + 1)
			expr(b, level + 1)
			put(',\n')
		}
		indent(level)
		put('}')
		break
	case 'ParenthesizedExpression':
		put('(')
		expr(a.expression, level)
		put(')')
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
		blank()
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
		blank()
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
		indent(level)
		put(a.label.name)
		put(':\n')
		stmt(a.body, level)
		break
	case 'Program':
		for (var b of a.body) {
			comment(b, level)
			stmt(b, level)
		}
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
			if (c.test) {
				put('case ')
				expr(c.test, level)
			} else
				put('default')
			put(':\n')
			for (var b of c.consequent)
				stmt(b, level + 1)
		}
		indent(level)
		put('}\n')
		break
	case 'ThrowStatement':
		indent(level)
		put('throw ')
		expr(a.argument, level)
		put(';\n')
		break
	case 'TryStatement':
		indent(level)
		put('try ')
		block(a.block, level)
		if (a.handler) {
			put(' catch (')
			expr(a.handler.param, level)
			put(') ')
			block(a.handler.body, level)
		}
		if (a.finalizer) {
			put(' finally ')
			block(a.finalizer, level)
		}
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

function format(a, comments, options) {
	global.comments = comments || []
	global.options = options || {
		indent: '\t'
	}
	commenti = 0
	ss = []
	stmt(a, 0)
	if (haveBlank())
		ss.pop()
	return ss.join('')
}
exports.format = format
