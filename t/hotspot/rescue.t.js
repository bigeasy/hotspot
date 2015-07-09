require('proof')(5, prove)

function prove (assert) {
    var hotspot = require('../..')
    var abend = require('abend')

    hotspot([function () {
        throw new Error('thrown')
    }, function (async, error) {
        assert(error.message, 'thrown', 'catch thrown')
    }])(abend)

    hotspot([function () {
        throw new Error('thrown')
    }, function (async, error) {
        return 1
    }])(function (error, result) {
        assert(!error, 'no error')
        assert(result, 1, 'caught and replaced')
    })

    hotspot([function () {
        throw new Error('thrown')
    }, function (async, error) {
        throw error
    }])(function (error, result) {
        assert(error.message, 'thrown', 'propagated')
    })

    hotspot([function (async) {
        async()(new Error('given'))
    }, function (async, error) {
        assert(error.message, 'given', 'catch given')
    }])(abend)
}