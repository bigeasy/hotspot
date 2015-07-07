var hotspot = require('..')

function echo (value, callback) {
    callback(null, value)
}

function Program () {
    this.value = null
}

Program.prototype.execute = hotspot(one, two)

function one (async) {
    echo(1, async())
}

function two (async, value) {
    this.value = value
    return [ value ]
}

var program = new Program
for (var i = 0; i < 10000; i++) {
    program.execute(noop)
}

function noop() {}
