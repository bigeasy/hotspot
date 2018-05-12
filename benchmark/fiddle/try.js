var Benchmark = require('benchmark')
var slice = [].slice

var suite = new Benchmark.Suite

function f () {}

suite.add({
    name: 'try',
    fn: function () {
        try {
            f()
        } catch (e) {
        }
    }
})
suite.add({ name: 'direct', fn: function () { f() } })

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
})

suite.run()
