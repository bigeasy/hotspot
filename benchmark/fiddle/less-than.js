var Benchmark = require('benchmark')
var slice = [].slice

var suite = new Benchmark.Suite

function lessThan(a, b) {
    return a < b
}

suite.add({ name: 'integers', fn: function () { lessThan(1, 2) } })
suite.add({ name: 'infinity', fn: function () { lessThan(1, Infinity) } })
suite.add({ name: 'int-max', fn: function () { lessThan(1, 0x7fffffff) } })

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
})

suite.run()
