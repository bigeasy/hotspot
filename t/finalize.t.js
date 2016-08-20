require('proof/redux')(3, prove)

function prove (assert) {
    var hotspot = require('..')
    var abend = require('abend')
    var after = false
    var object = {}

    hotspot([function () {
        assert(object === this, 'this')
        assert(after, 'finalizing')
    }], function () {
        after = true
    }).call(object, abend)

    hotspot([function () {
        throw new Error('thrown')
    }])(function (error) {
        assert(error.message, 'thrown', 'error in finalizer')
    })
}
