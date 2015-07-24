var hotspot = require('../../hotspot')
var _hotspot = require('../../_hotspot')
var Benchmark = require('benchmark')

var suite = new Benchmark.Suite('loop')

var COUNT = 10

var m = hotspot(function () { return 1 })

function inc (count, callback) {
    callback(null, count + 1)
}

function body (async, count) {
    if (count == COUNT) return [ async.done(), count ]
    else return [ async.repeat(), count + 1 ]
}

var m = hotspot(body)

function fn () {
    m(0, function () {})
}

var m_ = _hotspot(body)

function fn_ () {
    m_(0, function () {})
}

for (var i = 1; i <= 4; i++) {
    suite.add({
        name: ' hotspot loop ' + i,
        fn: fn
    })

    suite.add({
        name: '_hotspot loop ' + i,
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
