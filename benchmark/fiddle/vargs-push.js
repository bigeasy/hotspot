var Benchmark = require('benchmark')
var slice = [].slice

var suite = new Benchmark.Suite

function foo () {
}

function varged (vargs) {
    foo.apply(null, vargs)
}

function assigned () {
    var vargs = []
    for (var i = 0, I = arguments.length; i < I; i++) {
        vargs[i] = arguments[i]
    }
    foo.apply(null, vargs)
}

function pushed () {
    var vargs = []
    for (var i = 0, I = arguments.length; i < I; i++) {
        vargs.push(arguments[i])
    }
    foo.apply(null, vargs)
}

function constructed () {
    var vargs = new Array
    for (var i = 0, I = arguments.length; i < I; i++) {
        vargs.push(arguments[i])
    }
    foo.apply(null, vargs)
}

function allocated () {
    var vargs = new Array(arguments.length)
    for (var i = 0, I = arguments.length; i < I; i++) {
        vargs.push(arguments[i])
    }
    foo.apply(null, vargs)
}

suite.add({ name: 'assigned', fn: function () { assigned(1, 2, 3, 4, 5, 6, 7) } })
suite.add({ name: 'pushed', fn: function () { pushed(1, 2, 3, 4, 5, 6, 7) } })
suite.add({ name: 'allocated', fn: function () { allocated(1, 2, 3, 4, 5, 6, 7) } })
suite.add({ name: 'constructed', fn: function () { constructed(1, 2, 3, 4, 5, 6, 7) } })

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})

suite.run()
