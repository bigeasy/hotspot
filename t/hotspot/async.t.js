require('proof')(2, prove)

function prove (assert, callback) {
    var hotspot = require('../../hotspot')
    hotspot(function (async) {
        var callback = async()
        async()(null, 3)
        setImmediate(function () {
            callback(null, 1, 2)
        })
    }, function (async, one, two, three) {
        assert([ one, two, three ], [ 1, 2, 3 ], 'heterogeneous')
        async()(null, 1)
    }, function (async, one) {
        assert(one, 1, 'sync reset')
    })(function (error) {
        if (error) throw error
        callback()
    })
}
