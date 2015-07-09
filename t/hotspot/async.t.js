require('proof')(1, prove)

function prove (assert) {
    var hotspot = require('../..')
    var abend = require('abend')

    hotspot(function (async) {
        var callback = async()
        async()(null, 3)
        setImmediate(function () {
            callback(null, 1, 2)
        })
    })(function (error, one, two, three) {
        assert([ one, two, three ], [ 1, 2, 3 ], 'heterogeneous')
    })
}
