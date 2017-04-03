## jsclean

Reduces the entropy of JavaScript code:

- Formats code in a standard layout, fixing readability of ill-formatted code and allowing a consistent style to be automatically enforced throughout a project.

- Applies syntactic changes (add missing semicolons, optional braces, trailing commas and break statements, replace `==` with `===`, sort functions, cases and object properties etc) that eliminate common sources of error and inconsistency. Each of these can be individually turned off to make jsclean match your project's coding standards.

- Provides an API that allows parsing, syntactic transformation and formatted code generation to be accessed separately or together.

### Installation

Install with npm:

```
npm install jsclean
```

Or download from github:

```
git clone https://github.com/russellw/jsclean.git
```

### Command line

```
  Usage: jsclean [options] [files]

  Options:

    -h, --help                output usage information
    -V, --version             output the version number
        --no-cap-comments     don't capitalize comments
        --no-exact-equals     don't replace == with ===
        --no-extra-braces     don't add optional braces
        --no-semicolons       omit semicolons
        --no-separate-vars    don't separate variable declarations
        --no-sort-cases       don't sort cases
        --no-sort-functions   don't sort functions
        --no-sort-properties  don't sort object properties
    -n, --no-backup           don't make .bak files
    -s, --spaces <n>          indent with spaces
```

Original files are renamed with an added extension of `.bak` unless `--no-backup` is given.

If no files are specified, jsclean filters stdin to stdout.

### API

The simplest way to use the API accepts and returns a string:

```
text = jsclean.format(text[, options])
```

This function is implemented as:

```
function format(text, options) {
  var ast = parse(text);
  transform(ast, options);
  return gen(ast, options);
}
```

An object with the default options can be obtained with:

```
options = jsclean.defaults()
```

Options are:

- **capComments**

	Convert the first nonblank character of each line comment to uppercase. Default is true.

- **exactEquals**

	Replace all occurrences of the loose comparison operators `==` and `!=` with the exact comparison operators `===` and `!==` (except where one operand is `null`). Default is true.

- **extraBraces**

	Compound statements always use braces even if the body is a single statement. This improves consistency and removes an opportunity for error if a second statement is subsequently added. Default is true.

- **semicolons**

	Use semicolons. Default is true.

- **separateVars**

	Replace a declaration of multiple variables like `var a, b` with a separate declaration for each variable like `var a; var b`. Default is true.

- **sortCases**

	Sort cases in switch statements, by test in alphabetical order. Default is true.

- **sortFunctions**

	Sort functions in alphabetical order. Functions won't be moved past comments, so comments can delineate sections of a program. Default is true.

- **sortProperties**

	Sort properties of object literals, by key in alphabetical order. Default is true.

- **indent**

	String to use for indentation; should be set to a tab or one or more spaces. Default is `'\t'`.

Parsing, transformation and generation of formatted code can be accessed separately:

```
ast = jsclean.parse(text)
```

Use Acorn to parse source code into an abstract syntax tree. jsclean uses the following Acorn options:

```
allowImportExportEverywhere: true,
allowReturnOutsideFunction: true,
ecmaVersion: 6,
locations: true,
onComment: comments,
onToken: tokens,
preserveParens: true,
ranges: true,
```

Comments are attached to AST nodes as `leadingComment` properties using estraverse. In addition, if the code begins with `#!`, the AST is annotated with a corresponding `hashbang` property.

```
jsclean.transform(ast[, options])
```

Apply syntactic transformations to the AST.

```
text = jsclean.gen(ast[, options])
```

Generate JavaScript code from the AST.
