var f = function () {}
f.method = function () {}

var o = { method: function () {} }

function Item () {}

Item.prototype.method = function () {}

var item = new Item

function func () {
    return f.method()
}

function object () {
    return o.method()
}

function member () {
    return item.method()
}

for (var i = 0; i < 1000000; i++) {
    func()
    object()
    member()
}
