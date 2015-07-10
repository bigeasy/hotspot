var Benchmark = require('benchmark')
var slice = [].slice

var suite = new Benchmark.Suite

var f = function () {}
f.property = true

var o = { property: true }

function Item () {
    this.property = true
}

var i = new Item

function expando () {
    return f.property
}

function object () {
    return o.property
}

function member () {
    return i.property
}

    suite.add({ name: 'expando', fn: expando })
    suite.add({ name: 'member', fn: member })
    suite.add({ name: 'object', fn: object })

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})

suite.run()
