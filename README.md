## jsclean

Reduces the entropy of JavaScript code:

- Formats code in standard layout, fixing readability of ill-formatted code and allowing a consistent style to be automatically enforced throughout a project.

- Applies minor syntactic changes (adds missing semicolons and optional braces, insures array and object literals always have trailing commas and the final case of a switch statement always has a trailing break when no other terminator statement is present) that don't change the meaning of code but make it easier to make changes without introducing errors.

- Optionally replaces `==` with `===`. In principle this could change the meaning of correct code, which is why it's not enabled by default, but in practice it's almost always the right thing to do, and eliminates a common source of error and inconsistency.

### Options

(Options can be abbreviated to one letter.)

```
-help      Show help
-version   Show version

-equals    Replace == with ===
-no-bak    Don't make .bak files
-spaces N  Indent with N spaces
```
