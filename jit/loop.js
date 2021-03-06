function main () {
    var hotspot = require('..')
    var abend = require('abend')

    var f = hotspot(function (async, count, stop) {
        if (count < stop) return [ async.continue, count + 1, stop ]
        else return [ async.break, count ]
    })

    for (var i = 0; i < 100000; i++) {
        f(0, 100, abend)
    }

    function noop () { }
}

main()
