require('proof')(1, prove)

function prove (assert) {
    var hotspot = require('../..')
    var f = hotspot(function () { return 1 })
    assert(f.toString(), 'function () { return 1 }', 'to string')
}
