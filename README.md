## jsclean

Reduce the entropy of JavaScript code

- Format code in standard layout

- Add missing braces

- Add missing semicolons

- Add missing breaks in final cases

- Add trailing commas in initializers

- Optionally replace `==` with `===`. In principle this could change the meaning of correct code, which is why it's not enabled by default, but in practice it's almost always the right thing to do, and eliminates a common source of error and consistency.

### Options

(Some options can be abbreviated)

```
-help      Show help
-version   Show version

-eq        Replace == with ===
-no-bak    Don't make .bak files
-spaces N  Indent with N spaces
```
