var ok = require('assert').ok
var hotspot = require('../../hotspot')
var hotspot_ = require('../../_hotspot')
var Benchmark = require('benchmark')

var suite = new Benchmark.Suite('call', { /*minSamples: 100*/ })

function body () { return 1 }

var m = hotspot(body)

function fn () {
    m(function (error, result) {
        ok(result == 1, 'callback')
    })
}

var m_ = hotspot_(body)

function fn_ () {
    m_(function (error, result) {
        ok(result == 1, 'callback')
    })
}

for (var i = 0; i < 4; i++)  {
    suite.add({
        name: ' hotspot call ' + i,
        fn: fn
    })

    suite.add({
        name: '_hotspot call ' + i,
        fn: fn_
    })
}

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})

suite.run()
