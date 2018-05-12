var Benchmark = require('benchmark')
var slice = [].slice

var suite = new Benchmark.Suite

function f () {}

var assert = require('assert')

function thrower () {
    throw 1
}

function returner () {
    return 1
}

suite.add({
    name: 'throw',
    fn: function () {
        try {
            thrower()
        } catch (e) {
            assert(e == 1)
        }
    }
})
suite.add({ name: 'return', fn: function () {
    assert(returner() == 1)
} })

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
})

suite.run()
