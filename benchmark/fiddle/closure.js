var Benchmark = require('benchmark')
var slice = [].slice

var suite = new Benchmark.Suite

function f (object) { return object.a + 1 }

var assert = require('assert')

function named (a) {
    return f({ a: a })
}

function closure (a) {
    return (function (a) { return a + 1 })(a)
}

function parameterized (a) {
    return (function (a) { return a + 1 })(a)
}

suite.add({
    name: 'named',
    fn: function () {
        assert(named(1) == 2)
    }
})
suite.add({
    name: 'closure',
    fn: function () {
        assert(closure(1) == 2)
    }
})
suite.add({
    name: 'parameterized',
    fn: function () {
        assert(parameterized(1) == 2)
    }
})

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
})

suite.run()
