require('proof/redux')(9, prove)

function prove (assert) {
    var hotspot = require('..')
    var abend = require('abend')

    var object = {}
    hotspot([function () {
        throw new Error('thrown')
    }, function (async, error) {
        assert(this === object, 'this')
        assert(error.message, 'thrown', 'catch thrown')
    }]).call(object, abend)

    hotspot([function () {
        throw new Error('thrown')
    }, function (async, error) {
        return [ 1 ]
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

    hotspot([function (async) {
        async()(new Error('catch'))
    }, /^catch$/, function (async, error) {
        assert(error.message, 'catch', 'catch specified')
    }])(abend)

    hotspot([function (async) {
        async()(new Error('uncaught'))
    }, /^catch$/, function (async, error) {
        throw new Error
    }])(function (error) {
        assert(error.message, 'uncaught', 'do not catch unspecified')
    })

    hotspot([function (async) {
        throw new Error('breaker')
    }, function (async, error) {
        return [ async.break, 1 ]
    }], function () {
        return [ 2 ]
    })(function (error, result) {
        assert(result, 1, 'break from within catch')
    })
}
