require('proof')(1, require('cadence/redux')(prove))

function prove (async, assert) {
    assert(require('../..'), 'require')

    function echo (value, callback) {
        callback(null, value)
    }

    function Program (object) {
        this.object = object
    }

    Program.prototype.execute = hotspot(function (define) {
        define(function (async) {
            echo(1, async())
        }, function (async, object, value) {
            this.object.value = value
            return [ value ]
        })
    })

    async(function () {
        var object = { value: null }
        var program = new Program(object)
        program.execute(async())
    }, function (value) {
        assert(value, 1, 'minimal')
    })
}
