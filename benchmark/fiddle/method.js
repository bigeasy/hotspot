var Benchmark = require('benchmark')
var slice = [].slice

var suite = new Benchmark.Suite

var f = function () {}
f.method = function () {}

var o = { method: function () {} }

function Item () {}

Item.prototype.method = function () {}

var item = new Item

function func () {
    return f.property
}

function object () {
    return o.property
}

function member () {
    return item.property
}

for (var i = 0; i < 4; i++) {
    suite.add({ name: 'object ' + i, fn: object })
    suite.add({ name: 'class  ' + i, fn: member })
    suite.add({ name: 'func   ' + i, fn: func })
}

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})

suite.run()
