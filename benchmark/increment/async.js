var hotspot = require('../../hotspot')
var hotspot_ = require('../../_hotspot')
var Benchmark = require('benchmark')

var suite = new Benchmark.Suite('async', { /*minSamples: 100*/ })

function body (async) { async()(null, 1) }

var m = hotspot(body)

function fn () {
    m(function () {})
}

var m_ = hotspot_(body)

function fn_ () {
    m_(function () {})
}

for (var i = 1; i <= 4; i++)  {
    suite.add({
        name: ' hotspot async ' + i,
        fn: fn
    })

    suite.add({
        name: '_hotspot async ' + i,
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
