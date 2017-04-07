'use strict'
var estraverse = require('estraverse')

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
	return isTerminator(last(a))
}

function isRequire(a) {
	if (a.type !== 'VariableDeclaration')
		return
	if (a.declarations.length !== 1)
		return
	a = a.declarations[0].init
	if (!a)
		return
	if (a.type !== 'CallExpression')
		return
	if (a.callee.type !== 'Identifier')
		return
	if (a.callee.name !== 'require')
		return
	return true
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

function last(a) {
	return a[a.length - 1]
}

function negate(f) {
	return a => !f(a)
}

function print(a) {
	console.log(require('util').inspect(a, {
		colors: true,
		depth: null,
		maxArrayLength: null,
		showHidden: false,
	}))
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
			var c = last(a.cases)
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
			if (!a.leadingComments)
				return
			for (var c of a.leadingComments) {
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

	// Vars
	estraverse.traverse(a, {
		enter(a, parent) {
			if (a.type !== 'VariableDeclaration')
				return
			switch (parent.type) {
			case 'BlockStatement':
			case 'Program':
				var body = parent.body
				break
			case 'SwitchCase':
				body = parent.consequent
				break
			default:
				return
			}
			var vars = a.declarations
			if (a.leadingComments)
				vars[0].leadingComments = (vars[0].leadingComments || []).concat(a.leadingComments)
			for (var i = 0; i < vars.length; i++)
				vars[i] = {
					declarations: [vars[i]],
					type: a.type,
				}
			body.splice(body.indexOf(a), 1, ...vars)
		},
		keys,
	})

	// Sort cases
	estraverse.traverse(a, {
		enter(a) {
			if (a.type !== 'SwitchStatement')
				return
			a.cases = sortElements(
				a.cases,
				c => true,
				(c, i) => a.cases[i - 1].consequent.length,
				cmpCases,
				b =>  {
					var consequent = []
					for (var c of b)
						if (c.consequent.length) {
							consequent = c.consequent
							c.consequent = []
						}
					last(b).consequent = consequent
				})
			a.cases = sortBlocks(a.cases, (c, i) => a.cases[i - 1].consequent.length && hasTerminator(a.cases[i - 1]), cmpCases)
		},
		keys,
	})

	// Sort functions
	estraverse.traverse(a, {
		enter(a) {
			if (!a.body)
				return
			a.body = sortElements(
				a.body,
				b => b.type === 'FunctionDeclaration',
				b => b.type !== 'FunctionDeclaration' || b.leadingComments,
				(a, b) =>  {
					function key(x) {
						return x.id.name
					}

					return cmp(key(a), key(b))
				},
				a =>  {
					var comment
					for (var i = 0; i < a.length; i++) {
						if (a[i].leadingComments) {
							comment = a[i].leadingComments
							delete a[i].leadingComments
						}
						a[0].leadingComments = comment
					}
				})
		},
		keys,
	})

	// Sort properties
	estraverse.traverse(a, {
		enter(a) {
			if (a.type !== 'ObjectExpression')
				return
			a.properties.sort(
				(a, b) =>  {
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
			a.body = sortElements(
				a.body,
				isRequire,
				negate(isRequire),
				(a, b) =>  {
					function key(x) {
						return x.declarations[0].id.name
					}

					return cmp(key(a), key(b))
				})
		},
		keys,
	})
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
		for (var j = i + 1; j < a.length; j++)
			if (isSortableEnd(a[j], j))
				break
		var b = a.slice(i, j).sort(cmp)
		if (post)
			post(b)
		r.push(...b)
		i = j
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
		return a.body[0]
	}
	return a
}

exports.run = run
