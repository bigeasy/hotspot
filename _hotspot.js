var stack = [], push = [].push, token = {}

function Cadence (self, steps, callback, vargs) {
    this.self = self
    this.finalizers = new Array
    this.steps = steps
    this.callback = callback
    this.index = 0
    this.vargs = vargs
    this.results = new Array
    this.errors = new Array
    this.called = 0
    this.sync = true
    this.waiting = false
}

Cadence.prototype.done = function (vargs) {
    if (this.finalizers.length == 0) {
        this.callback.apply(null, vargs)
    } else {
        finalize(this, [], this.callback, vargs)
    }
}

Cadence.prototype.resolveCallback = function (result, vargs) {
    var error = vargs.shift()
    if (error == null) {
        result.vargs = vargs
    } else {
        this.errors.push(error)
    }
    if (++this.called === this.results.length) {
        if (this.waiting) {
            invoke(this)
        } else {
            this.sync = true
        }
    }
}

Cadence.prototype.createCallback = function () {
    var self = this
    var result = { vargs: [] }

    self.results.push(result)
    self.sync = false

    return callback

    function callback () { // benchmark using bind(this).
        var I = arguments.length
        var vargs = new Array
        for (var i = 0; i < I; i++) {
            vargs[i] = arguments[i]
        }
        self.resolveCallback(result, vargs)

        return

        /* istanbul ignore next */
        try {} catch (e) {}
    }
}

function async () {
    return stack[stack.length - 1].createCallback()
}

async.continue = { token: token, repeat: true }
async.break = { token: token, repeat: false }

function call (fn, self, vargs) {
    try {
        var ret = fn.apply(self, vargs)
    } catch (e) {
        return [ ret, e ]
    }
    return [ ret ]
}

function rescue (cadence) {
    if (cadence.errors.length === 0) {
        invoke(cadence)
    } else {
        var error = cadence.errors.shift()

        execute(cadence.self, [
            cadence.catcher,
            function () {
                var I = arguments.length
                var vargs = []
                for (var i = 0; i < I; i++) {
                    vargs[i] = arguments[i]
                }
                // kind of loosey-goosey, this test to see if the user
                // specified arguments or not, what if the dear user wants
                // to return the error as the first non-error result?
                if (vargs[1] !== error) {
                    cadence.vargs = vargs.slice(1)
                    cadence.results.length = 0
                }
            }
        ], [ error, done ])

        function done (error) {
            if (error) {
                cadence.done([ error ])
            } else {
                rescue(cadence)
            }
        }
    }
}

function finalize (cadence, errors, callback, vargs) {
    if (cadence.finalizers.length == 0) {
        if (errors.length === 0) {
            callback.apply(null, vargs)
        } else {
            callback.apply(null, [ errors[0] ])
        }
    } else {
        var finalizer = cadence.finalizers.pop()
        execute(cadence.self, finalizer.steps, finalizer.vargs.concat(done))
    }
    function done (error) {
        if (error) {
            errors.push(error)
        }
        finalize(cadence, errors, callback, vargs)
    }
}

function invoke (cadence) {
    var vargs, steps = cadence.steps
    for (;;) {
        if (cadence.errors.length) {
            if (cadence.catcher) {
                rescue(cadence)
            } else {
                cadence.done([ cadence.errors[0] ])
            }
            break
        }

        if (cadence.results.length == 0) {
            vargs = cadence.vargs
            if (vargs[0] && vargs[0].token === token) {
                cadence.index = vargs.shift().repeat ? 0 : cadence.steps.length
            }
        } else {
            vargs = []
            for (var i = 0, I = cadence.results.length; i < I; i++) {
                var vargs_ = cadence.results[i].vargs
                for (var j = 0, J = vargs_.length; j < J; j++) {
                    vargs.push(vargs_[j])
                }
            }
            cadence.vargs = vargs
        }

        if (cadence.index === steps.length) {
            if (vargs.length !== 0) {
                vargs.unshift(null)
            }
            cadence.done(vargs)
            break
        }

        var fn = steps[cadence.index++]

        cadence.called = 0
        cadence.results = new Array
        cadence.errors = new Array

        if (Array.isArray(fn)) {
            if (fn.length === 1) {
                cadence.finalizers.push({ steps: fn, vargs: vargs })
                continue
            } else if (fn.length === 2) {
                cadence.catcher = fn[1]
                fn = fn[0]
            } else if (fn.length === 3) {
                var filter = fn
                cadence.catcher = function (async, error) {
                    if (filter[1].test(error.code || error.message)) {
                        return filter[2](async, error)
                    } else {
                        throw error
                    }
                }
                fn = fn[0]
            } else {
                cadence.vargs = [ vargs ]
                continue
            }
        }

        vargs.unshift(async)

        stack.push(cadence)

        var ret = call(fn, cadence.self, vargs)
               // ^^^^

        stack.pop()

        if (ret.length === 2) {
            cadence.errors.push(ret[1])
            cadence.vargs = vargs
            cadence.sync = true
        } else if (ret[0] !== void(0)) {
            cadence.vargs = [].concat(ret[0])
        }

        if (!cadence.sync) {
            cadence.waiting = true
            break
        }
    }
}

function execute (self, steps, vargs) {
    var cadence = new Cadence(self, steps, vargs.pop(), vargs)
    invoke(cadence)
}

function hotspot () {
    var I = arguments.length
    var vargs = []
    for (var i = 0; i < I; i++) {
        vargs[i] = arguments[i]
    }
    return _hotspot(vargs)
}

function _hotspot (steps) {
    var f

    switch (steps[0].length) {
    case 0:
        f = function () {
            var I = arguments.length
            var vargs = []
            for (var i = 0; i < I; i++) {
                vargs[i] = arguments[i]
            }
            execute(this, steps, vargs)
        }
        break
    case 1:
        f = function (one) {
            var I = arguments.length
            var vargs = []
            for (var i = 0; i < I; i++) {
                vargs[i] = arguments[i]
            }
            execute(this, steps, vargs)
        }
        break
    case 2:
        f = function (one, two) {
            var I = arguments.length
            var vargs = []
            for (var i = 0; i < I; i++) {
                vargs[i] = arguments[i]
            }
            execute(this, steps, vargs)
        }
        break
    case 3:
        f = function (one, two, three) {
            var I = arguments.length
            var vargs = []
            for (var i = 0; i < I; i++) {
                vargs[i] = arguments[i]
            }
            execute(this, steps, vargs)
        }
        break
    case 4:
        f = function (one, two, three, four) {
            var I = arguments.length
            var vargs = []
            for (var i = 0; i < I; i++) {
                vargs[i] = arguments[i]
            }
            execute(this, steps, vargs)
        }
        break
    default:
        // Avert your eyes if you're squeamish.
        var args = []
        for (var i = 0, I = steps[0].length; i < I; i++) {
            args[i] = '_' + i
        }
        var f = (new Function('execute', 'steps', 'async', '                \n\
            return function (' + args.join(',') + ') {                      \n\
                var I = arguments.length                                    \n\
                var vargs = []                                              \n\
                for (var i = 0; i < I; i++) {                               \n\
                    vargs[i] = arguments[i]                                 \n\
                }                                                           \n\
                execute(this, steps, vargs)                                 \n\
            }                                                               \n\
       '))(execute, steps, async)
    }

    f.toString = function () { return steps[0].toString() }

    f.isCadence = true

    return f
}

module.exports = hotspot

/*

 % node --version
v0.10.40
 % node benchmark/increment/call.js
 hotspot call 1 x 722,463 ops/sec ±0.78% (96 runs sampled)
_hotspot call 1 x 727,356 ops/sec ±0.70% (100 runs sampled)
 hotspot call 2 x 732,951 ops/sec ±0.38% (103 runs sampled)
_hotspot call 2 x 763,052 ops/sec ±0.53% (102 runs sampled)
 hotspot call 3 x 731,530 ops/sec ±0.39% (100 runs sampled)
_hotspot call 3 x 761,265 ops/sec ±0.45% (102 runs sampled)
 hotspot call 4 x 729,430 ops/sec ±0.25% (103 runs sampled)
_hotspot call 4 x 752,128 ops/sec ±0.20% (99 runs sampled)
Fastest is _hotspot call 2
 % node benchmark/increment/async.js
 hotspot async 1 x 1,763,641 ops/sec ±0.17% (94 runs sampled)
_hotspot async 1 x 1,762,141 ops/sec ±0.38% (100 runs sampled)
 hotspot async 2 x 1,775,429 ops/sec ±0.47% (99 runs sampled)
_hotspot async 2 x 1,787,120 ops/sec ±0.20% (103 runs sampled)
 hotspot async 3 x 1,788,477 ops/sec ±0.42% (98 runs sampled)
_hotspot async 3 x 1,773,600 ops/sec ±0.44% (100 runs sampled)
 hotspot async 4 x 1,788,386 ops/sec ±0.35% (97 runs sampled)
_hotspot async 4 x 1,775,913 ops/sec ±0.27% (104 runs sampled)
Fastest is _hotspot async 2
 % node benchmark/increment/loop.js
 hotspot loop 1 x 286,703 ops/sec ±0.26% (102 runs sampled)
_hotspot loop 1 x 288,493 ops/sec ±0.21% (102 runs sampled)
 hotspot loop 2 x 285,407 ops/sec ±0.34% (102 runs sampled)
_hotspot loop 2 x 288,022 ops/sec ±0.29% (102 runs sampled)
 hotspot loop 3 x 286,710 ops/sec ±0.22% (103 runs sampled)
_hotspot loop 3 x 287,855 ops/sec ±0.18% (102 runs sampled)
 hotspot loop 4 x 286,323 ops/sec ±0.26% (100 runs sampled)
_hotspot loop 4 x 287,555 ops/sec ±0.35% (103 runs sampled)
Fastest is _hotspot loop 1,_hotspot loop 2,_hotspot loop 4
 % node --version
v0.12.7
 % node benchmark/increment/call.js
 hotspot call 1 x 855,480 ops/sec ±0.35% (100 runs sampled)
_hotspot call 1 x 858,382 ops/sec ±0.18% (102 runs sampled)
 hotspot call 2 x 841,194 ops/sec ±0.75% (97 runs sampled)
_hotspot call 2 x 847,736 ops/sec ±0.31% (101 runs sampled)
 hotspot call 3 x 849,501 ops/sec ±0.41% (101 runs sampled)
_hotspot call 3 x 844,631 ops/sec ±0.29% (102 runs sampled)
 hotspot call 4 x 840,900 ops/sec ±0.38% (97 runs sampled)
_hotspot call 4 x 837,670 ops/sec ±0.36% (103 runs sampled)
Fastest is _hotspot call 1, hotspot call 1
 % node benchmark/increment/async.js
 hotspot async 1 x 1,734,596 ops/sec ±0.35% (100 runs sampled)
_hotspot async 1 x 1,662,237 ops/sec ±0.39% (99 runs sampled)
 hotspot async 2 x 1,735,306 ops/sec ±0.45% (101 runs sampled)
_hotspot async 2 x 1,673,345 ops/sec ±0.42% (98 runs sampled)
 hotspot async 3 x 1,725,410 ops/sec ±0.43% (98 runs sampled)
_hotspot async 3 x 1,660,396 ops/sec ±0.43% (97 runs sampled)
 hotspot async 4 x 1,751,648 ops/sec ±0.43% (96 runs sampled)
_hotspot async 4 x 1,651,562 ops/sec ±0.47% (98 runs sampled)
Fastest is  hotspot async 4
 % node benchmark/increment/loop.js
 hotspot loop 1 x 238,040 ops/sec ±0.30% (101 runs sampled)
_hotspot loop 1 x 251,062 ops/sec ±0.41% (102 runs sampled)
 hotspot loop 2 x 248,400 ops/sec ±0.60% (100 runs sampled)
_hotspot loop 2 x 247,779 ops/sec ±1.01% (100 runs sampled)
 hotspot loop 3 x 246,765 ops/sec ±0.60% (99 runs sampled)
_hotspot loop 3 x 252,064 ops/sec ±0.27% (102 runs sampled)
 hotspot loop 4 x 246,635 ops/sec ±0.55% (98 runs sampled)
_hotspot loop 4 x 250,091 ops/sec ±0.16% (103 runs sampled)
Fastest is _hotspot loop 3

*/
