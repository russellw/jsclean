'use strict';
var acorn = require('acorn');
var estraverse = require('estraverse');

function debug(a) {
	console.log(require('util').inspect(a, {
		colors: process.stdout.isTTY,
		depth: null,
	}));
}

function format(code, options) {
	var ast = parse(code);
	transform(ast, options);
	return gen(ast, options);
}

exports.format = format;

function defaults() {
	return {
		exactEquals: true,
		indent: '\t',
		sortProperties: true,
		trailingBreak: true,
	};
}

exports.defaults = defaults;

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

	// parse
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

exports.parse = parse;

function transform(ast, options) {
	options = options || defaults();
	if (options.exactEquals) {
		estraverse.traverse(ast, {
			enter: function (ast, parent) {

				function isNull(a) {
					return a.type === 'Literal' && a.value === null;
				}

				switch (ast.type) {
				case 'BinaryExpression':
					if (!isNull(ast.left) && !isNull(ast.right)) {
						switch (ast.operator) {
						case '==':
							ast.operator = '===';
							break;
						case '!=':
							ast.operator = '!==';
							break;
						}
					}
					break;
				}
			},
		});
	}
	if (options.sortProperties) {
		estraverse.traverse(ast, {
			enter: function (ast, parent) {
				switch (ast.type) {
				case 'ObjectExpression':
					ast.properties.sort(function (a, b) {

						function key(x) {
							x = x.key;
							switch (x.type) {
							case 'Identifier':
								return x.name;
							case 'Literal':
								return x.value;
							default:
								return x.type;
							}
						}

						a = key(a);
						b = key(b);
						if (a < b) {
							return -1;
						}
						if (a > b) {
							return 1;
						}
						return 0;
					});
					break;
				}
			},
		});
	}
	if (options.trailingBreak) {
		estraverse.traverse(ast, {
			enter: function (ast, parent) {
				switch (ast.type) {
				case 'SwitchStatement':
					if (ast.cases.length) {
						var c = ast.cases[ast.cases.length - 1];
						if (c.consequent.length) {
							var a = c.consequent[c.consequent.length - 1];
							switch (a.type) {
							case 'BreakStatement':
							case 'ContinueStatement':
							case 'ReturnStatement':
							case 'ThrowStatement':
								break;
							default:
								c.consequent.push({
									loc: a.loc,
									type: 'BreakStatement',
								});
								break;
							}
						}
					}
					break;
				}
			},
		});
	}
}

exports.transform = transform;

function gen(ast, options) {
	options = options || defaults();
	var ss = [];

	function put(s) {
		ss.push(s);
	}

	function blankLine(ast) {
		if (ast.type === 'FunctionDeclaration') {
			put('\n');
		}
	}

	function block(ast, level) {
		if (ast.type === 'BlockStatement') {
			put(' ');
			stmt(ast, level);
		} else {
			put('\n');
			indent(level + 1);
			stmt(ast, level + 1);
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
				put('//' + c.value);
			} else {
				put('/*' + c.value + '*/');
			}
			put('\n');
		}
	}

	function indent(level) {
		while (level--) {
			put(options.indent);
		}
	}

	function semicolon() {
		put(';');
	}

	function expr(ast, level) {
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
				expr(a, level + 1);
				put(',\n');
			}
			indent(level);
			put(']');
			break;
		case 'ArrowFunctionExpression':
			if (ast.params.length === 1) {
				expr(ast.params[0], level);
			} else {
				put('(');
				for (var i = 0; i < ast.params.length; i++) {
					if (i) {
						put(', ');
					}
					expr(ast.params[i], level);
				}
				put(')');
			}
			put(' => ');
			if (ast.body.type === 'BlockStatement') {
				block(ast.body, level);
			} else {
				expr(ast.body, level);
			}
			break;
		case 'AssignmentExpression':
		case 'BinaryExpression':
		case 'LogicalExpression':
			expr(ast.left, level);
			put(' ' + ast.operator + ' ');
			expr(ast.right, level);
			break;
		case 'CallExpression':
			expr(ast.callee, level);
			put('(');
			for (var i = 0; i < ast.arguments.length; i++) {
				if (i) {
					put(', ');
				}
				expr(ast.arguments[i], level);
			}
			put(')');
			break;
		case 'ConditionalExpression':
			expr(ast.test, level);
			put(' ? ');
			expr(ast.consequent, level);
			put(' : ');
			expr(ast.alternate, level);
			break;
		case 'FunctionExpression':
			put('function ');
			if (ast.id) {
				put(ast.id.name);
			}
			put('(');
			for (var i = 0; i < ast.params.length; i++) {
				if (i) {
					put(', ');
				}
				expr(ast.params[i], level);
			}
			put(')');
			block(ast.body, level);
			break;
		case 'Identifier':
			put(ast.name);
			break;
		case 'Literal':
			put(ast.raw);
			break;
		case 'MemberExpression':
			expr(ast.object, level);
			if (ast.computed) {
				put('[');
				expr(ast.property, level);
				put(']');
			} else {
				put('.');
				expr(ast.property, level);
			}
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
				expr(a, level + 1);
				put(',\n');
			}
			indent(level);
			put('}');
			break;
		case 'ParenthesizedExpression':
			put('(');
			expr(ast.expression, level);
			put(')');
			break;
		case 'Property':
			expr(ast.key, level);
			put(': ');
			expr(ast.value, level);
			break;
		case 'SequenceExpression':
			for (var i = 0; i < ast.expressions.length; i++) {
				if (i) {
					put(', ');
				}
				expr(ast.expressions[i], level);
			}
			break;
		case 'UnaryExpression':
			put(ast.operator);
			expr(ast.argument, level);
			break;
		case 'UpdateExpression':
			if (ast.prefix) {
				put(ast.operator);
				expr(ast.argument, level);
			} else {
				expr(ast.argument, level);
				put(ast.operator);
			}
			break;
		case 'VariableDeclaration':
			put('var ');
			for (var i = 0; i < ast.declarations.length; i++) {
				if (i) {
					put(', ');
				}
				expr(ast.declarations[i], level);
			}
			break;
		case 'VariableDeclarator':
			put(ast.id.name);
			if (ast.init) {
				put(' = ');
				expr(ast.init, level);
			}
			break;
		default:
			console.assert(false, ast);
			break;
		}
	}

	function stmt(ast, level) {
		switch (ast.type) {
		case 'BlockStatement':
			put('{\n');
			for (var a of ast.body) {
				blankLine(a);
				comment(a, level + 1);
				indent(level + 1);
				stmt(a, level + 1);
				put('\n');
				blankLine(a);
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
			expr(ast.test, level);
			put(')');
			semicolon();
			break;
		case 'EmptyStatement':
			put(';');
			break;
		case 'ExpressionStatement':
			expr(ast.expression, level);
			semicolon();
			break;
		case 'ForInStatement':
			put('for (');
			expr(ast.left, level);
			put(' in ');
			expr(ast.right, level);
			put(')');
			block(ast.body, level);
			break;
		case 'ForOfStatement':
			put('for (');
			expr(ast.left, level);
			put(' of ');
			expr(ast.right, level);
			put(')');
			block(ast.body, level);
			break;
		case 'ForStatement':
			put('for (');
			if (ast.init) {
				expr(ast.init, level);
			}
			put('; ');
			if (ast.test) {
				expr(ast.test, level);
			}
			put('; ');
			if (ast.update) {
				expr(ast.update, level);
			}
			put(')');
			block(ast.body, level);
			break;
		case 'FunctionDeclaration':
			put('function ' + ast.id.name + '(');
			for (var i = 0; i < ast.params.length; i++) {
				if (i) {
					put(', ');
				}
				expr(ast.params[i], level);
			}
			put(')');
			block(ast.body, level);
			break;
		case 'IfStatement':
			put('if (');
			expr(ast.test, level);
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
			stmt(ast.body, level);
			break;
		case 'Program':
			for (var a of ast.body) {
				blankLine(a);
				comment(a, 0);
				stmt(a, 0);
				put('\n');
				blankLine(a);
			}
			break;
		case 'ReturnStatement':
			put('return');
			if (ast.argument) {
				put(' ');
				expr(ast.argument, level);
			}
			semicolon();
			break;
		case 'SwitchStatement':
			put('switch (');
			expr(ast.discriminant, level);
			put(') {\n');
			for (var c of ast.cases) {
				indent(level);
				if (c.test) {
					put('case ');
					expr(c.test, level);
				} else {
					put('default');
				}
				put(':\n');
				for (var a of c.consequent) {
					indent(level + 1);
					stmt(a, level + 1);
					put('\n');
				}
			}
			indent(level);
			put('}');
			break;
		case 'ThrowStatement':
			put('throw ');
			expr(ast.argument, level);
			semicolon();
			break;
		case 'TryStatement':
			put('try');
			block(ast.block, level);
			if (ast.handler) {
				put(' catch (');
				expr(ast.handler.param, level);
				put(')');
				block(ast.handler.body, level);
			}
			if (ast.finalizer) {
				put(' finally ');
				block(ast.finalizer, level);
			}
			break;
		case 'VariableDeclaration':
			put('var ');
			for (var i = 0; i < ast.declarations.length; i++) {
				if (i) {
					put(', ');
				}
				expr(ast.declarations[i], level);
			}
			semicolon();
			break;
		case 'WhileStatement':
			put('while (');
			expr(ast.test, level);
			put(')');
			block(ast.body, level);
			break;
		default:
			console.assert(false, ast);
			break;
		}
	}

	stmt(ast, 0);
	var code = ss.join('');

	// #!
	code = ast.hashbang + '\n\n' + code;

	// don't start with blank line
	code = code.replace(/^\n+/, '');

	// only one consecutive blank line
	code = code.replace(/\n\n+/g, '\n\n');

	// end with exactly one newline
	code = code.replace(/\n*$/, '\n');
	return code;
}

exports.gen = gen;
