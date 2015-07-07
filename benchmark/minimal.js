var hotspot = require('..')
var cadence = require('cadence')
var Benchmark = require('benchmark')

var suite = new Benchmark.Suite('async', { /*minSamples: 100*/ })

function Program () {
}

Program.prototype.hotspot = hotspot(function (async) {
    inc(1, async())
}, function (async, value) {
    return [ value ]
})

Program.prototype.cadence = cadence(function (async) {
    async(function () {
        inc(1, async())
    }, function (value) {
        return [ value ]
    })
})

var program = new Program

for (var i = 0; i < 4; i++)  {
    suite.add({
        name: 'hotspot call ' + i,
        fn: function () {
            program.hotspot(noop)
        }
    })

    suite.add({
        name: 'cadence call ' + i,
        fn: function () {
            program.cadence(noop)
        }
    })
}

function noop () {}

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})

suite.run()
