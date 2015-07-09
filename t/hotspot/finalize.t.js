require('proof')(2, prove)

function prove (assert) {
    var hotspot = require('../..')
    var abend = require('abend')
    var after = false

    hotspot([function () {
        assert(after, 'finalizing')
    }], function () {
        after = true
    })(abend)

    hotspot([function () {
        throw new Error('thrown')
    }])(function (error) {
        assert(error.message, 'thrown', 'error in finalizer')
    })
}
