'use strict'

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

exports.isRequire = isRequire
