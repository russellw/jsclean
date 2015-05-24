## jsclean

Reduces the entropy of JavaScript code:

- Formats code in standard layout, fixing readability of ill-formatted code and allowing a consistent style to be automatically enforced throughout a project.

- Applies minor syntactic changes (adds missing semicolons and optional braces, insures array and object literals always have trailing commas and the final case of a switch statement always has a trailing break when no other terminator statement is present) that don't change the meaning of code but make it easier to make changes without introducing errors.

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
jsclean [options] files
```

(Options can be abbreviated to one letter.)

```
-help      Show help
-version   Show version

-equals    Replace == with ===
-no-bak    Don't make .bak files
-spaces N  Indent with N spaces
```

### API

```
defaults()
```

Return options object with defaults set.

```
format(code[, options])
```

Return formatted code (per options if given).

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

- **equals**: Replace all occurrences of the loose comparison operators `==` and `!=` with the exact comparison operators `===` and `!==`. Although this is pretty much always the right thing to do in practice, it's theoretically possible that it could change the meaning of correct code, so it defaults to `false`.

- **indent**: String to use for indentation; should be set to a tab or one or more spaces. Default is `'\t'`.
