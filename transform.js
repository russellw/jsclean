'use strict';
var estraverse = require('estraverse');

// Node type unknown to estraverse
var keys = {
	ParenthesizedExpression: [
		'expression',
	],
};

function brace(ast) {
	if (!ast) {
		return ast;
	}
	switch (ast.type) {
	case 'BlockStatement':
		return ast;
	case 'EmptyStatement':
		ast.body = [];
		ast.type = 'BlockStatement';
		return ast;
	default:
		return {
			body: [
				ast,
			],
			type: 'BlockStatement',
		};
	}
}

function cmp(a, b) {
	if (a < b) {
		return -1;
	}
	if (a > b) {
		return 1;
	}
	return 0;
}

function hasTerminator(c) {
	var a = c.consequent;
	if (!a.length) {
		return false;
	}
	return isTerminator(last(a));
}

function isTerminator(ast) {
	switch (ast.type) {
	case 'BreakStatement':
	case 'ContinueStatement':
	case 'ReturnStatement':
	case 'ThrowStatement':
		return true;
	}
}

function last(a) {
	return a[a.length - 1];
}

function sortSlice(a, i, j, cmp) {
	var sorted = a.slice(i, j).sort(cmp);
	return a.slice(0, i).concat(sorted).concat(a.slice(j));
}

function sortSlices(a, isSortableStart, isSortablePart, cmp, post) {
	for (var i = 0; i < a.length; ) {
		if (!isSortableStart(a[i])) {
			i++;
			continue;
		}
		for (var j = i + 1; j < a.length; j++) {
			if (!isSortablePart(a[j])) {
				break;
			}
		}
		var sorted = a.slice(i, j).sort(cmp);
		post(sorted);
		a.splice.apply([
			i,
			j - i,
		].concat(sorted));
		return a.slice(0, i).concat(sorted).concat(a.slice(j));
		i = j;
	}
}

// Exports

function run(ast) {
	// ===
	estraverse.traverse(ast, {
		enter: function (ast, parent) {
			if (ast.type !== 'BinaryExpression') {
				return;
			}
			if (ast.left.value !== null && ast.right.value !== null) {
				switch (ast.operator) {
				case '!=':
					ast.operator = '!==';
					break;
				case '==':
					ast.operator = '===';
					break;
				}
			}
		},
		keys: keys,
	});

	// Braces
	estraverse.traverse(ast, {
		enter: function (ast, parent) {
			switch (ast.type) {
			case 'DoWhileStatement':
			case 'ForInStatement':
			case 'ForOfStatement':
			case 'ForStatement':
			case 'WhileStatement':
				ast.body = brace(ast.body);
				break;
			case 'IfStatement':
				ast.consequent = brace(ast.consequent);
				ast.alternate = brace(ast.alternate);
				break;
			}
		},
		keys: keys,
	});

	// Break
	estraverse.traverse(ast, {
		enter: function (ast, parent) {
			if (ast.type !== 'SwitchStatement') {
				return;
			}
			if (!ast.cases.length) {
				return;
			}
			var c = last(ast.cases);
			if (hasTerminator(c)) {
				return;
			}
			c.consequent.push({
				loc: ast.loc,
				type: 'BreakStatement',
			});
		},
		keys: keys,
	});

	// Comments
	estraverse.traverse(ast, {
		enter: function (ast, parent) {
			if (!ast.leadingComments) {
				return;
			}
			for (var c of ast.leadingComments) {
				if (c.type !== 'Line') {
					continue;
				}
				var s = c.value;
				for (var i = 0; i < s.length; i++) {
					if (s[i] !== ' ') {
						c.value = s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1);
						break;
					}
				}
			}
		},
		keys: keys,
	});

	// Vars
	estraverse.traverse(ast, {
		enter: function (ast, parent) {
			if (ast.type !== 'VariableDeclaration') {
				return;
			}
			switch (parent.type) {
			case 'BlockStatement':
			case 'Program':
				var body = parent.body;
				break;
			case 'SwitchCase':
				body = parent.consequent;
				break;
			default:
				return;
			}
			var vars = ast.declarations;
			if (ast.leadingComments) {
				vars[0].leadingComments = (vars[0].leadingComments || []).concat(ast.leadingComments);
			}
			for (var i = 0; i < vars.length; i++) {
				vars[i] = {
					declarations: [
						vars[i],
					],
					type: ast.type,
				};
			}
			body.splice.apply(body, [
				body.indexOf(ast),
				1,
			].concat(vars));
		},
		keys: keys,
	});

	// Sort cases
	estraverse.traverse(ast, {
		enter: function (ast, parent) {
			if (ast.type !== 'SwitchStatement') {
				return;
			}

			// Get blocks of cases
			var block = [];
			var blocks = [];
			for (var c of ast.cases) {
				block.push(c);
				if (hasTerminator(c)) {
					blocks.push(block);
					block = [];
				}
			}
			if (block.length) {
				blocks.push(block);
			}

			// Sort cases within block
			blocks: for (var block of blocks) {
				for (var i = 0; i < block.length - 1; i++) {
					if (block[i].consequent.length) {
						continue blocks;
					}
				}
				var consequent = last(block).consequent;
				last(block).consequent = [];
				block.sort(function (a, b) {
					function key(x) {
						x = x.test;
						if (!x) {
							return '\uffff';
						}
						switch (x.type) {
						case 'Identifier':
							return x.name;
						case 'Literal':
							return x.value;
						}
					}

					return cmp(key(a), key(b));
				});
				last(block).consequent = consequent;
			}

			// Sort blocks
			blocks.sort(function (a, b) {
				function key(block) {
					var x = block[0].test;
					if (!x) {
						return '\uffff';
					}
					switch (x.type) {
					case 'Identifier':
						return x.name;
					case 'Literal':
						return x.value;
					}
				}

				return cmp(key(a), key(b));
			});

			// Put blocks of cases
			ast.cases = [];
			for (var block of blocks) {
				for (var c of block) {
					ast.cases.push(c);
				}
			}
		},
		keys: keys,
	});

	// Sort functions
	estraverse.traverse(ast, {
		enter: function (ast, parent) {
			if (ast.type !== 'Program') {
				return;
			}
			sortSlices(ast.body, function (a) {
				return a.type === 'FunctionDeclaration' && a.id;
			}, function (a) {
				return a.type === 'FunctionDeclaration' && a.id && !a.leadingComments;
			}, function (a, b) {
				function key(x) {
					return x.id.name;
				}

				return cmp(key(a), key(b));
			}, function (a) {
				var comment;
				for (var i = 0; i < a.length; i++) {
					if (a[i].leadingComments) {
						comment = a[i].leadingComments;
						delete a[i].leadingComments;
					}
					a[0].leadingComments = comment;
				}
			});
		},
		keys: keys,
	});

	// Sort properties
	estraverse.traverse(ast, {
		enter: function (ast, parent) {
			if (ast.type !== 'ObjectExpression') {
				return;
			}
			ast.properties.sort(function (a, b) {
				function key(x) {
					x = x.key;
					switch (x.type) {
					case 'Identifier':
						return x.name;
					case 'Literal':
						return x.value;
					}
				}

				return cmp(key(a), key(b));
			});
		},
		keys: keys,
	});
}

exports.run = run;
