require('proof')(1, prove)

function prove (assert) {
    var hotspot = require('..')

    hotspot(function (async, count) {
        if (count < 1) return [ async.continue, count + 1 ]
        else return [ async.break, count ]
    })(0, function (error, result) {
        if (error) throw error
        assert(result, 1, 'loop')
    })
}
