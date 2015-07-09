require('proof')(2, require('cadence/redux')(prove))

function prove (async, assert) {
    var hotspot = require('../..')

    function echo (value, callback) {
        callback(null, value)
    }

    function Program () {
        this.value = null
    }

    Program.prototype.execute = hotspot(function (async) {
        echo(1, async())
    }, function (async, value) {
        this.value = value
        return [ value ]
    })

    var program = new Program
    async(function () {
        program.execute(async())
    }, function (value) {
        assert(value, 1, 'minimal')
        assert(program.value, 1, 'member')
    })
}
