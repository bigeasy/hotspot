var Benchmark = require('benchmark')
var slice = [].slice

var suite = new Benchmark.Suite

var f = function () {}
f.property = true

var o = { property: true }

function Item () {
    this.property = true
}

var item = new Item

function expando () {
    return f.property
}

function object () {
    return o.property
}

function member () {
    return item.property
}

for (var i = 0; i < 4; i++) {
    suite.add({ name: 'object  ' + i, fn: object })
    suite.add({ name: 'member  ' + i, fn: member })
    suite.add({ name: 'expando ' + i, fn: expando })
}

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})

suite.run()
