## jsclean

Reduces the entropy of JavaScript code:

- Formats code in a standard layout, fixing readability of ill-formatted code and allowing a consistent style to be automatically enforced throughout a project.

- Applies syntactic changes (add missing semicolons and optional braces, replace `==` with `===`, sort object properties, ensure array and object literals always have trailing commas and the final case of a `switch` always has a trailing `break` when no other terminator statement is present) that eliminate common sources of error and inconsistency.

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
        --no-exact-equals     don't replace == with ===
        --no-sort-properties  don't sort object properties
        --no-trailing-break   don't add trailing break to final case
    -n, --no-backup           don't make .bak files
    -s, --spaces <n>          indent with spaces

```

Original files are renamed with an added extension of `.bak` unless `--no-backup` is given.

If no files are specified, jsclean filters stdin to stdout.

### API

The simplest way to use the API accepts and returns a string:

```
code = jsclean.format(code[, options])
```

This function is implemented as:

```
function format(code, options) {
  var ast = parse(code);
  transform(ast, options);
  return gen(ast, options);
}
```

An object with the default options can be obtained with:

```
options = jsclean.defaults()
```

Options are:

- **exactEquals**

	Replace all occurrences of the loose comparison operators `==` and `!=` with the exact comparison operators `===` and `!==`. Default is true.

- **sortProperties**

	Sort the properties of object literals, by key in alphabetical order. Default is true.

- **trailingBreak**

	In a `switch` where the final case does not end in a terminator statement, add a trailing `break`. This improves consistency and removes an opportunity for error if further cases are subsequently added. Default is true.

- **indent**

	String to use for indentation; should be set to a tab or one or more spaces. Default is `'\t'`.

Parsing, transformation and generation of formatted code can be accessed separately:

```
ast = jsclean.parse(code)
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
code = jsclean.gen(ast[, options])
```

Generate JavaScript code from the AST.
