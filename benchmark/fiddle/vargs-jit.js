var Benchmark = require('benchmark')
var slice = [].slice

var suite = new Benchmark.Suite

function foo (vargs) {
    for (var i = 0, I = vargs.length; i < I; i++) {
        vargs[i]++
    }
}

function varged (vargs) {
    foo.apply(null, vargs)
}

function arged (args) {
    var vargs = []
    for (var i = 0, I = args.length; i < I; i++) {
        vargs[i] = args[i]
    }
    foo.apply(null, vargs)
}

function sliced () {
    varged(slice.call(arguments))
}

function arrayed () {
    var vargs = []
    for (var i = 0, I = arguments.length; i < I; i++) {
        vargs[i] = arguments[i]
    }
    varged(vargs)
}

function proxied () {
    varged(arguments)
}

var concat = [].concat
function concated () {
    varged(concat.apply([], arguments))
}

suite.add({ name: 'slice', fn: function () { sliced(1, 2, 3, 4, 5, 6, 7) } })
suite.add({ name: 'arrayed', fn: function () { arrayed(1, 2, 3, 4, 5, 6, 7) } })
suite.add({ name: 'proxied', fn: function () { proxied(1, 2, 3, 4, 5, 6, 7) } })
suite.add({ name: 'concated', fn: function () { concated(1, 2, 3, 4, 5, 6, 7) } })

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
})

suite.run()
