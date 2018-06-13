#!/usr/bin/env node

'use strict'
var commandFiles = require('command-files')
var commander = require('commander')
var emit = require('./emit')
var fs = require('fs')
var parse = require('./parse')
var transform = require('./transform')
var util = require('util')

// Options
commander.usage('<files>')
commander.version(require('./package.json').version)
commander.parse(process.argv)

// Files
var files = commandFiles.expand(commander.args)
var debug = 0
if (debug && !files.length)
	files = ['/tmp/a.js']
for (var file of files) {
	var input = fs.readFileSync(file, {
		encoding: 'utf8',
	})
	var a = parse.run(input)
	if (debug)
		console.log(util.inspect(a, {
			colors: 1,
			depth: null,
		}))
	transform.run(a)
	if (debug)
		console.log(util.inspect(a, {
			colors: 1,
			depth: null,
		}))
	var output = emit.run(a)
	if (input === output)
		continue
	if (debug)
		console.log(output)
	else {
		console.log(file)
		fs.renameSync(file, file + '.bak')
		fs.writeFileSync(file, output)
	}
}
