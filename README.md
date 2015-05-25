## jsclean

Reduces the entropy of JavaScript code:

- Formats code in standard layout, fixing readability of ill-formatted code and allowing a consistent style to be automatically enforced throughout a project.

- Applies minor syntactic changes (adds missing semicolons and optional braces, ensures array and object literals always have trailing commas and the final case of a switch statement always has a trailing break when no other terminator statement is present) that don't change the meaning of code but make it easier to make changes without introducing errors.

- Optionally replaces `==` with `===`. In principle this could change the meaning of correct code, which is why it's not enabled by default, but in practice it's almost always the right thing to do, and eliminates a common source of error and inconsistency.

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

Original files are renamed to `.bak` unless `--no-backup` is given.

If no files are specified, jsclean filters stdin to stdout.

### API

```
defaults()
```

Return options object with default values.

```
format(code[, options])
```

Accept source code as a string and return the formatted version (per options if given).

Basic example:

```
var jsclean = require('jsclean');
var output = jsclean.format(input);
```

With options:

```
var jsclean = require('jsclean');
var options = jsclean.defaults();
// indent with 3 spaces
options.indent = '   ';
var output = jsclean.format(input, options);
```

Options are:

- **exactEquals**

	Replace all occurrences of the loose comparison operators `==` and `!=` with the exact comparison operators `===` and `!==`.

- **indent**

	String to use for indentation; should be set to a tab or one or more spaces. Default is `'\t'`.
