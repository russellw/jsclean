#!/usr/bin/env node

'use strict'
var commandFiles = require('command-files')
var commander = require('commander')
var emit = require('./emit')
var fs = require('fs')
var parse = require('./parse')
var transform = require('./transform')

// Options
commander.usage('<files>')
commander.version(require('./package.json').version)
commander.parse(process.argv)

// Files
var files = commandFiles.expand(commander.args)
for (var file of files) {
	var input = fs.readFileSync(file, {
		encoding: 'utf8',
	})
	var a = parse.run(input)
	transform.run(a)
	var output = emit.run(a)
	if (input === output)
		continue
	console.log(file)
	fs.renameSync(file, file + '.bak')
	fs.writeFileSync(file, output)
}
