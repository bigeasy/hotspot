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

for (var i = 0; i < 1000000; i++) {
    expando()
    object()
    member()
}
