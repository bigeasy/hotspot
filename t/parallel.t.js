require('proof/redux')(2, prove)

function prove (assert) {
    var hotspot = require('..')

    hotspot(function (async) {
        var first = async()
        var second = async()
        second(null, 3)
        first(null, 1, 2)
    })(function (error, one, two, three) {
        if (error) throw error
        assert([ one, two, three ], [ 1, 2, 3 ], 'parallel')
    })

    hotspot(function (async) {
        var first = async()
        var second = async()
        second(null, 3)
        first(null, 1, 2)
    }, [])(function (error, array) {
        if (error) throw error
        assert(array, [ 1, 2, 3 ], 'parallel gather')
    })
}
