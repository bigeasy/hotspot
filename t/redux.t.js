require('proof')(2, require('cadence')(prove))

function prove (async, okay) {
    var hotspot = require('../redux')

    function echo (value, callback) {
        callback(null, value)
    }

    function Program () {
        this.value = null
    }

    Program.prototype.execute = hotspot(function () {
        echo(1, this.async())
    }, function () {
        return [ this.self.value = this.vargs[0] ]
    })

    var program = new Program
    async(function () {
        program.execute(async())
    }, function (value) {
        okay(value, 1, 'minimal')
        okay(program.value, 1, 'member')
    })
}
