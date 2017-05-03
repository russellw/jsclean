'use strict'
var _ = require('lodash')
var estraverse = require('estraverse')
var etc = require('./etc')

// Node type unknown to estraverse
var keys = {
	ParenthesizedExpression: ['expression'],
}

function blocks(a, isEnd) {
	var bs = []
	for (var i = 0; i < a.length;) {
		for (var j = i + 1; j < a.length; j++)
			if (isEnd(a[j], j))
				break
		bs.push(a.slice(i, j))
		i = j
	}
	return bs
}

function cmp(a, b) {
	if (a < b)
		return -1
	if (a > b)
		return 1
	return 0
}

function cmpCases(a, b) {
	function key(x) {
		x = x.test
		if (!x)
			return '\uffff'
		switch (x.type) {
		case 'Identifier':
			return x.name
		case 'Literal':
			return x.value
		}
	}

	return cmp(key(a), key(b))
}

function hasTerminator(c) {
	var a = c.consequent
	if (!a.length)
		return
	return isTerminator(_.last(a))
}

function hoistComments(a) {
	var comment
	for (var i = 0; i < a.length; i++) {
		if (a[i].comments) {
			comment = a[i].comments
			delete a[i].comments
		}
		a[0].comments = comment
	}
}

function isConst(a) {
	if (!a)
		return true
	switch (a.type) {
	case 'ArrayExpression':
		return !a.elements.length
	case 'Literal':
		return true
	case 'NewExpression':
		if (a.callee.type !== 'Identifier' || a.callee.name !== 'Map')
			return
		return !a.arguments.length
	case 'ObjectExpression':
		return !a.properties.length
	}
}

function isExport(a) {
	if (a.type !== 'ExpressionStatement')
		return
	a = a.expression
	if (a.type !== 'AssignmentExpression')
		return
	if (a.left.type !== 'MemberExpression')
		return
	if (a.left.object.type !== 'Identifier')
		return
	if (a.left.object.name !== 'exports')
		return
	if (a.right.type !== 'Identifier')
		return
	return true
}

function isSimpleAssign(a) {
	if (a.type !== 'ExpressionStatement')
		return
	a = a.expression
	if (a.type !== 'AssignmentExpression')
		return
	if (a.left.type !== 'Identifier')
		return
	return isConst(a.right) || a.right.type === 'Identifier'
}

function isSimpleVar(a) {
	if (a.type !== 'VariableDeclaration')
		return
	if (a.declarations.length !== 1)
		return
	a = a.declarations[0].init
	return isConst(a) || a.type === 'Identifier'
}

function isTerminator(a) {
	switch (a.type) {
	case 'BreakStatement':
	case 'ContinueStatement':
	case 'ReturnStatement':
	case 'ThrowStatement':
		return true
	}
}

function run(a) {
	// ===
	estraverse.traverse(a, {
		enter(a) {
			if (a.type !== 'BinaryExpression')
				return
			if (a.left.value !== null && a.right.value !== null)
				switch (a.operator) {
				case '!=':
					a.operator = '!=='
					break
				case '==':
					a.operator = '==='
					break
				}
		},
		keys,
	})

	// Braces
	estraverse.traverse(a, {
		enter(a) {
			switch (a.type) {
			case 'DoWhileStatement':
			case 'ForInStatement':
			case 'ForOfStatement':
			case 'ForStatement':
			case 'WhileStatement':
				a.body = unbrace(a.body)
				break
			case 'IfStatement':
				a.consequent = unbrace(a.consequent)
				a.alternate = unbrace(a.alternate)
				break
			}
		},
		keys,
	})

	// Break
	estraverse.traverse(a, {
		enter(a) {
			if (a.type !== 'SwitchStatement')
				return
			if (!a.cases.length)
				return
			var c = _.last(a.cases)
			if (hasTerminator(c))
				return
			c.consequent.push({
				loc: a.loc,
				type: 'BreakStatement',
			})
		},
		keys,
	})

	// Comments
	estraverse.traverse(a, {
		enter(a) {
			if (!a.comments)
				return
			for (var c of a.comments) {
				if (c.type !== 'Line')
					continue
				var s = c.value
				for (var i = 0; i < s.length; i++)
					if (s[i] !== ' ') {
						c.value = s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1)
						break
					}
			}
		},
		keys,
	})

	// Sort assignment
	estraverse.traverse(a, {
		enter(a) {
			if (!a.body)
				return
			a.body = sortAssigns(a.body)
		},
		keys,
	})

	// Sort cases
	estraverse.traverse(a, {
		enter(a) {
			if (a.type !== 'SwitchStatement')
				return
			a.cases = sortElements(a.cases, c => true, (c, i) => a.cases[i - 1].consequent.length, cmpCases, b => {
				var consequent = []
				for (var c of b)
					if (c.consequent.length) {
						consequent = c.consequent
						c.consequent = []
					}
				_.last(b).consequent = consequent
			})
			a.cases = sortBlocks(a.cases, (c, i) => a.cases[i - 1].consequent.length && hasTerminator(a.cases[i - 1]), cmpCases)
		},
		keys,
	})

	// Sort exports
	estraverse.traverse(a, {
		enter(a) {
			if (!a.body)
				return
			a.body = sortElements(a.body, isExport, _.negate(isExport), (a, b) => {
				function key(x) {
					return x.expression.right.name
				}

				return cmp(key(a), key(b))
			})
		},
		keys,
	})

	// Sort functions
	estraverse.traverse(a, {
		enter(a) {
			if (!a.body)
				return
			a.body = sortElements(a.body, b => b.type === 'FunctionDeclaration', b => b.type !== 'FunctionDeclaration', (a, b) => {
				function key(x) {
					return x.id.name
				}

				return cmp(key(a), key(b))
			})
		},
		keys,
	})

	// Sort methods
	estraverse.traverse(a, {
		enter(a) {
			if (!a.body)
				return
			a.body = sortElements(a.body, b => b.type === 'MethodDefinition', b => b.type !== 'MethodDefinition', (a, b) => {
				function key(x) {
					if (x.key.name === 'constructor')
						return ''
					return x.key.name
				}

				return cmp(key(a), key(b))
			})
		},
		keys,
	})

	// Sort properties
	estraverse.traverse(a, {
		enter(a) {
			if (a.type !== 'ObjectExpression')
				return
			a.properties = sortElements(a.properties, b => true, b => false, (a, b) => {
				function key(x) {
					x = x.key
					switch (x.type) {
					case 'Identifier':
						return x.name
					case 'Literal':
						return x.value
					}
				}

				return cmp(key(a), key(b))
			})
		},
		keys,
	})

	// Sort requires
	estraverse.traverse(a, {
		enter(a) {
			if (!a.body)
				return
			a.body = sortElements(a.body, etc.isRequire, _.negate(etc.isRequire), (a, b) => {
				function key(x) {
					return x.declarations[0].id.name
				}

				return cmp(key(a), key(b))
			})
		},
		keys,
	})

	// Sort vars
	estraverse.traverse(a, {
		enter(a) {
			if (!a.body)
				return
			a.body = sortVars(a.body)
		},
		keys,
	})
}

function sortAssigns(a) {
	if (a.constructor !== Array)
		return a
	var r = []
	loop:
		for (var i = 0; i < a.length;) {
			if (!isSimpleAssign(a[i], j)) {
				r.push(a[i++])
				continue
			}
			for (var j = i + 1; j < a.length; j++) {
				if (a[j].comments)
					break
				if (!isSimpleAssign(a[j], j))
					break
			}
			var b = a.slice(i, j)
			i = j
			for (var x of b)
				for (var y of b)
					if (x.expression.left.name === y.expression.right.name) {
						r.push(...b)
						continue loop
					}
			b = b.sort((a, b) => {
				function key(x) {
					return x.expression.left.name
				}

				return cmp(key(a), key(b))
			})
			hoistComments(b)
			r.push(...b)
		}
	return r
}

function sortBlocks(a, isEnd, cmp) {
	var bs = blocks(a, isEnd)
	bs = bs.sort((x, y) => cmp(x[0], y[0]))
	return [].concat(...bs)
}

function sortElements(a, isSortableStart, isSortableEnd, cmp, post) {
	if (a.constructor !== Array)
		return a
	var r = []
	for (var i = 0; i < a.length;) {
		if (!isSortableStart(a[i], j)) {
			r.push(a[i++])
			continue
		}
		for (var j = i + 1; j < a.length; j++) {
			if (a[j].comments)
				break
			if (isSortableEnd(a[j], j))
				break
		}
		var b = a.slice(i, j).sort(cmp)
		i = j
		hoistComments(b)
		if (post)
			post(b)
		r.push(...b)
	}
	return r
}

function sortVars(a) {
	if (a.constructor !== Array)
		return a
	var r = []
	loop:
		for (var i = 0; i < a.length;) {
			if (!isSimpleVar(a[i], j)) {
				r.push(a[i++])
				continue
			}
			for (var j = i + 1; j < a.length; j++) {
				if (a[j].comments)
					break
				if (!isSimpleVar(a[j], j))
					break
			}
			var b = a.slice(i, j)
			i = j
			for (var x of b)
				for (var y of b)
					if (y.declarations[0].init && x.declarations[0].id.name === y.declarations[0].init.name) {
						r.push(...b)
						continue loop
					}
			b = b.sort((a, b) => {
				function key(x) {
					return x.declarations[0].id.name
				}

				return cmp(key(a), key(b))
			})
			hoistComments(b)
			r.push(...b)
		}
	return r
}

function unbrace(a) {
	if (!a)
		return a
	if (a.type !== 'BlockStatement')
		return a
	switch (a.body.length) {
	case 0:
		return {
			type: 'EmptyStatement',
		}
	case 1:
		if (a.body[0].comments)
			break
		return a.body[0]
	}
	return a
}

exports.run = run
