'use strict';
var acorn = require('acorn');
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

function debug(a) {
	console.log(require('util').inspect(a, {
		colors: process.stdout.isTTY,
		depth: null,
	}));
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

// API

function format(code, options) {
	var ast = parse(code);
	transform(ast, options);
	return gen(ast, options);
}

function defaults() {
	return {
		capComments: true,
		exactEquals: true,
		extraBraces: true,
		indent: '\t',
		semicolons: true,
		separateVars: true,
		sortCases: true,
		sortFunctions: true,
		sortProperties: true,
		trailingBreak: true,
	};
}

function parse(code) {

	// #!
	var hashbang = '';
	if (code.substring(0, 2) === '#!') {
		var i = code.indexOf('\n');
		if (i < 0) {
			hashbang = code;
			code = '';
		} else {
			hashbang = code.substring(0, i);
			code = code.substring(i);
		}
	}

	// Parse
	var comments = [];
	var tokens = [];
	var ast = acorn.parse(code, {
		allowImportExportEverywhere: true,
		allowReturnOutsideFunction: true,
		ecmaVersion: 6,
		locations: true,
		onComment: comments,
		onToken: tokens,
		preserveParens: true,
		ranges: true,
	});
	estraverse.attachComments(ast, comments, tokens);

	// #!
	ast.hashbang = hashbang;
	return ast;
}

function transform(ast, options) {
	options = options || defaults();
	if (options.capComments) {
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
							c.value = s.substring(0, i) + s[i].toUpperCase() + s.substring(i + 1);
							break;
						}
					}
				}
			},
			keys: keys,
		});
	}
	if (options.exactEquals) {
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
	}
	if (options.extraBraces) {
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
	}
	if (options.separateVars) {
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
	}
	if (options.sortProperties) {
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
	if (options.trailingBreak) {
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
		if (options.sortCases) {
			estraverse.traverse(ast, {
				enter: function (ast, parent) {
					if (ast.type !== 'SwitchStatement') {
						return;
					}
					if (!ast.cases.length) {
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
		}
		if (options.sortFunctions) {
		}
	}
}

function gen(ast, options) {
	options = options || defaults();

	// Bubble comments up to statements
	estraverse.traverse(ast, {
		keys: keys,
		leave: function (ast, parent) {
			if (!ast.leadingComments) {
				return;
			}
			if (!parent) {
				return;
			}
			if (ast.type.indexOf('Statement') >= 0) {
				return;
			}
			switch (ast.type) {
			case 'FunctionDeclaration':
			case 'SwitchCase':
				return;
			case 'VariableDeclaration':
				if (parent.type.indexOf('For') < 0) {
					return;
				}
				break;
			}
			switch (parent.type) {
			case 'ArrayExpression':
			case 'ObjectExpression':
				return;
			}
			parent.leadingComments = (parent.leadingComments || []).concat(ast.leadingComments);
			ast.leadingComments = null;
		},
	});

	// Gathered strings
	var ss = [];

	function put(s) {
		ss.push(s);
	}

	// Syntax elements

	function blankLine(ast) {
		if (ast.type === 'FunctionDeclaration') {
			put('\n');
		}
	}

	function block(ast, level) {
		if (ast.type === 'BlockStatement') {
			put(' ');
			rec(ast, level);
		} else {
			put('\n');
			indent(level + 1);
			rec(ast, level + 1);
		}
	}

	function blockEnd(ast, level) {
		if (ast.type === 'BlockStatement') {
			put(' ');
		} else {
			put('\n');
			indent(level);
		}
	}

	function comment(ast, level) {
		if (!ast.leadingComments) {
			return;
		}
		put('\n');
		for (var c of ast.leadingComments) {
			indent(level);
			if (c.type === 'Line') {
				put('//');
				if (c.value[0] !== ' ') {
					put(' ');
				}
				put(c.value);
			} else {
				put('/*' + c.value + '*/');
			}
			put('\n');
		}
	}

	function forInit(ast, level) {
		if (ast.type === 'VariableDeclaration') {
			variableDeclaration(ast, level);
		} else {
			rec(ast, level);
		}
	}

	function indent(level) {
		while (level--) {
			put(options.indent);
		}
	}

	function params(a, level) {
		put('(');
		for (var i = 0; i < a.length; i++) {
			if (i) {
				put(', ');
			}
			rec(a[i], level);
		}
		put(')');
	}

	function semicolon() {
		if (options.semicolons) {
			put(';');
		}
	}

	function stmt(ast, level) {
		comment(ast, level);
		blankLine(ast);
		indent(level);
		if (!options.semicolons) {
			switch (ast.type) {
			case 'ArrayExpression':
			case 'ParenthesizedExpression':
				put(';');
				break;
			case 'UnaryExpression':
				switch (ast.operator) {
				case '+':
				case '-':
					put(';');
					break;
				}
				break;
			}
		}
		rec(ast, level);
		put('\n');
		blankLine(ast);
	}

	function variableDeclaration(ast, level) {
		put('var ');
		for (var i = 0; i < ast.declarations.length; i++) {
			if (i) {
				put(', ');
			}
			rec(ast.declarations[i], level);
		}
	}

	// Recursive descent

	function rec(ast, level) {
		switch (ast.type) {
		case 'ArrayExpression':
			if (!ast.elements.length) {
				put('[]');
				break;
			}
			put('[\n');
			for (var a of ast.elements) {
				comment(a, level + 1);
				indent(level + 1);
				rec(a, level + 1);
				put(',\n');
			}
			indent(level);
			put(']');
			break;
		case 'ArrowFunctionExpression':
			if (ast.params.length === 1) {
				rec(ast.params[0], level);
			} else {
				params(ast.params, level);
			}
			put(' => ');
			if (ast.body.type === 'BlockStatement') {
				block(ast.body, level);
			} else {
				rec(ast.body, level);
			}
			break;
		case 'AssignmentExpression':
		case 'BinaryExpression':
		case 'LogicalExpression':
			rec(ast.left, level);
			put(' ' + ast.operator + ' ');
			rec(ast.right, level);
			break;
		case 'BlockStatement':
			put('{\n');
			for (var a of ast.body) {
				stmt(a, level + 1);
			}
			indent(level);
			put('}');
			break;
		case 'BreakStatement':
			put('break');
			if (ast.label) {
				put(' ' + ast.label.name);
			}
			semicolon();
			break;
		case 'CallExpression':
			rec(ast.callee, level);
			params(ast.arguments, level);
			break;
		case 'ConditionalExpression':
			rec(ast.test, level);
			put(' ? ');
			rec(ast.consequent, level);
			put(' : ');
			rec(ast.alternate, level);
			break;
		case 'ContinueStatement':
			put('continue');
			if (ast.label) {
				put(' ' + ast.label.name);
			}
			semicolon();
			break;
		case 'DoWhileStatement':
			put('do');
			block(ast.body, level);
			blockEnd(ast.body, level);
			put('while (');
			rec(ast.test, level);
			put(')');
			semicolon();
			break;
		case 'EmptyStatement':
			put(';');
			break;
		case 'ExpressionStatement':
			rec(ast.expression, level);
			semicolon();
			break;
		case 'ForInStatement':
			put('for (');
			forInit(ast.left, level);
			put(' in ');
			rec(ast.right, level);
			put(')');
			block(ast.body, level);
			break;
		case 'ForOfStatement':
			put('for (');
			forInit(ast.left, level);
			put(' of ');
			rec(ast.right, level);
			put(')');
			block(ast.body, level);
			break;
		case 'ForStatement':
			put('for (');
			if (ast.init) {
				forInit(ast.init, level);
			}
			put('; ');
			if (ast.test) {
				rec(ast.test, level);
			}
			put('; ');
			if (ast.update) {
				rec(ast.update, level);
			}
			put(')');
			block(ast.body, level);
			break;
		case 'FunctionDeclaration':
			put('function ' + ast.id.name);
			params(ast.params, level);
			block(ast.body, level);
			break;
		case 'FunctionExpression':
			put('function ');
			if (ast.id) {
				put(ast.id.name);
			}
			params(ast.params, level);
			block(ast.body, level);
			break;
		case 'Identifier':
			put(ast.name);
			break;
		case 'IfStatement':
			put('if (');
			rec(ast.test, level);
			put(')');
			block(ast.consequent, level);
			if (ast.alternate) {
				blockEnd(ast.consequent, level);
				put('else');
				block(ast.alternate, level);
			}
			break;
		case 'LabeledStatement':
			put(ast.label.name + ': ');
			rec(ast.body, level);
			break;
		case 'Literal':
			put(ast.raw);
			break;
		case 'MemberExpression':
			rec(ast.object, level);
			if (ast.computed) {
				put('[');
				rec(ast.property, level);
				put(']');
			} else {
				put('.');
				rec(ast.property, level);
			}
			break;
		case 'NewExpression':
			put('new ');
			rec(ast.callee, level);
			params(ast.arguments, level);
			break;
		case 'ObjectExpression':
			if (!ast.properties.length) {
				put('{}');
				break;
			}
			put('{\n');
			for (var a of ast.properties) {
				comment(a, level + 1);
				indent(level + 1);
				rec(a, level + 1);
				put(',\n');
			}
			indent(level);
			put('}');
			break;
		case 'ParenthesizedExpression':
			put('(');
			rec(ast.expression, level);
			put(')');
			break;
		case 'Program':
			for (var a of ast.body) {
				stmt(a, 0);
			}
			break;
		case 'Property':
			rec(ast.key, level);
			put(': ');
			rec(ast.value, level);
			break;
		case 'ReturnStatement':
			put('return');
			if (ast.argument) {
				put(' ');
				rec(ast.argument, level);
			}
			semicolon();
			break;
		case 'SequenceExpression':
			for (var i = 0; i < ast.expressions.length; i++) {
				if (i) {
					put(', ');
				}
				rec(ast.expressions[i], level);
			}
			break;
		case 'SwitchStatement':
			put('switch (');
			rec(ast.discriminant, level);
			put(') {\n');
			for (var c of ast.cases) {
				comment(c, level);
				indent(level);
				if (c.test) {
					put('case ');
					rec(c.test, level);
				} else {
					put('default');
				}
				put(':\n');
				for (var a of c.consequent) {
					comment(a, level + 1);
					indent(level + 1);
					rec(a, level + 1);
					put('\n');
				}
			}
			indent(level);
			put('}');
			break;
		case 'ThisExpression':
			put('this');
			break;
		case 'ThrowStatement':
			put('throw ');
			rec(ast.argument, level);
			semicolon();
			break;
		case 'TryStatement':
			put('try');
			block(ast.block, level);
			if (ast.handler) {
				put(' catch (');
				rec(ast.handler.param, level);
				put(')');
				block(ast.handler.body, level);
			}
			if (ast.finalizer) {
				put(' finally ');
				block(ast.finalizer, level);
			}
			break;
		case 'UnaryExpression':
			put(ast.operator);
			if (ast.operator.search(/[a-z]/) >= 0) {
				put(' ');
			}
			rec(ast.argument, level);
			break;
		case 'UpdateExpression':
			if (ast.prefix) {
				put(ast.operator);
				rec(ast.argument, level);
			} else {
				rec(ast.argument, level);
				put(ast.operator);
			}
			break;
		case 'VariableDeclaration':
			variableDeclaration(ast, level);
			semicolon();
			break;
		case 'VariableDeclarator':
			put(ast.id.name);
			if (ast.init) {
				put(' = ');
				rec(ast.init, level);
			}
			break;
		case 'WhileStatement':
			put('while (');
			rec(ast.test, level);
			put(')');
			block(ast.body, level);
			break;
		default:
			console.assert(false, ast);
			break;
		}
	}

	rec(ast, 0);
	var code = ss.join('');

	// #!
	code = ast.hashbang + '\n\n' + code;

	// Don't start with blank line
	code = code.replace(/^\n+/, '');

	// Only one consecutive blank line
	code = code.replace(/\n\n+/g, '\n\n');

	// End with exactly one newline
	code = code.replace(/\n*$/, '\n');
	return code;
}

exports.defaults = defaults;
exports.format = format;
exports.gen = gen;
exports.parse = parse;
exports.transform = transform;
