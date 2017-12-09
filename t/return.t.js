require('proof')(2, prove)

function prove (assert) {
    var hotspot = require('..')
    hotspot(function () {
        return [ 1 ]
    })(function (error, result) {
        if (error) throw error
        assert(result, 1, 'returned')
    })

    hotspot(function () {
        return [ [ 1 ] ]
    })(function (error, result) {
        if (error) throw error
        assert(result, [ 1 ], 'returned array')
    })
}
