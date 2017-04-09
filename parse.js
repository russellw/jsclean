'use strict'
var acorn = require('acorn')
var estraverse = require('estraverse')

// Node type unknown to estraverse
var keys = {
	ParenthesizedExpression: ['expression'],
}

function comment(a) {
	a.comments = a.leadingComments
	delete a.leadingComments
}

function print(a) {
	console.log(require('util').inspect(a, {
		colors: process.stdout.isTTY,
		depth: null,
		maxArrayLength: null,
		showHidden: false,
	}))
}

function run(text) {
	// #!
	var hashbang = ''
	if (text.slice(0, 2) === '#!') {
		var i = text.indexOf('\n')
		if (i < 0) {
			hashbang = text
			text = ''
		} else {
			hashbang = text.slice(0, i)
			text = text.slice(i)
		}
	}

	// Parse
	var comments = []
	var tokens = []
	var a = acorn.parse(text, {
		allowImportExportEverywhere: true,
		allowReturnOutsideFunction: true,
		ecmaVersion: 6,
		onComment: comments,
		onToken: tokens,
		preserveParens: true,
		ranges: true,
	})

	// Comments
	estraverse.attachComments(a, comments, tokens)
	estraverse.traverse(a, {
		enter(a) {
			switch (a.type) {
			case 'ArrayExpression':
				switch (a.elements.length) {
				case 0:
				case 1:
					break
				default:
					for (var b of a.elements)
						comment(b)
					break
				}
				break
			case 'BlockStatement':
			case 'Program':
				for (var b of a.body)
					comment(b)
				break
			case 'SwitchStatement':
				for (var c of a.cases) {
					comment(c)
					for (var b of c.consequent)
						comment(b)
				}
				break
			}
		},
		keys,
	})
	estraverse.traverse(a, {
		enter(a) {
			if (a.leadingComments)
				throw new Error(a)
		},
		keys,
	})

	// #!
	a.hashbang = hashbang
	return a
}

exports.run = run
