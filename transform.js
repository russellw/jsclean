'use strict';
var estraverse = require('estraverse');

// Node type unknown to estraverse
var keys = {
	ParenthesizedExpression: [
		'expression',
	],
};

function brace(a) {
	if (!a) {
		return a;
	}
	switch (a.type) {
	case 'BlockStatement':
		return a;
	case 'EmptyStatement':
		a.body = [];
		a.type = 'BlockStatement';
		return a;
	default:
		return {
			body: [
				a,
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

function isTerminator(a) {
	switch (a.type) {
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
		if (post) {
			post(sorted);
		}
		a.splice.apply(a, [
			i,
			j - i,
		].concat(sorted));
		i = j;
	}
}

// Exports

function run(a) {
	// ===
	estraverse.traverse(a, {
		enter: function (a) {
			if (a.type !== 'BinaryExpression') {
				return;
			}
			if (a.left.value !== null && a.right.value !== null) {
				switch (a.operator) {
				case '!=':
					a.operator = '!==';
					break;
				case '==':
					a.operator = '===';
					break;
				}
			}
		},
		keys: keys,
	});

	// Braces
	estraverse.traverse(a, {
		enter: function (a) {
			switch (a.type) {
			case 'DoWhileStatement':
			case 'ForInStatement':
			case 'ForOfStatement':
			case 'ForStatement':
			case 'WhileStatement':
				a.body = brace(a.body);
				break;
			case 'IfStatement':
				a.consequent = brace(a.consequent);
				a.alternate = brace(a.alternate);
				break;
			}
		},
		keys: keys,
	});

	// Break
	estraverse.traverse(a, {
		enter: function (a) {
			if (a.type !== 'SwitchStatement') {
				return;
			}
			if (!a.cases.length) {
				return;
			}
			var c = last(a.cases);
			if (hasTerminator(c)) {
				return;
			}
			c.consequent.push({
				loc: a.loc,
				type: 'BreakStatement',
			});
		},
		keys: keys,
	});

	// Comments
	estraverse.traverse(a, {
		enter: function (a) {
			if (!a.leadingComments) {
				return;
			}
			for (var c of a.leadingComments) {
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
	estraverse.traverse(a, {
		enter: function (a, parent) {
			if (a.type !== 'VariableDeclaration') {
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
			var vars = a.declarations;
			if (a.leadingComments) {
				vars[0].leadingComments = (vars[0].leadingComments || []).concat(a.leadingComments);
			}
			for (var i = 0; i < vars.length; i++) {
				vars[i] = {
					declarations: [
						vars[i],
					],
					type: a.type,
				};
			}
			body.splice.apply(body, [
				body.indexOf(a),
				1,
			].concat(vars));
		},
		keys: keys,
	});

	// Sort cases
	estraverse.traverse(a, {
		enter: function (ast) {
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
				block.sort(
					function (a, b) {
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
			blocks.sort(
				function (a, b) {
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
	estraverse.traverse(a, {
		enter: function (a) {
			if (!a.body) {
				return;
			}
			sortSlices(
				a.body,
				function (a) {
					return a.type === 'FunctionDeclaration' && a.id;
				},
				function (a) {
					return a.type === 'FunctionDeclaration' && a.id && !a.leadingComments;
				},
				function (a, b) {
					function key(x) {
						return x.id.name;
					}

					return cmp(key(a), key(b));
				},
				function (a) {
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
	estraverse.traverse(a, {
		enter: function (a) {
			if (a.type !== 'ObjectExpression') {
				return;
			}
			a.properties.sort(
				function (a, b) {
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
