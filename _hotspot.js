! function (definition) {
    /* istanbul ignore next */
    if (typeof module === 'object') module.exports = definition()
    else if (typeof window !== 'undefined') window.cadence = definition()
    else if (typeof define === 'function') define(definition)
} (function () {
    var stack = [], push = [].push, token = {}

    function Cadence (cadence, steps, callback) {
        this.finalizers = cadence.finalizers
        this.self = cadence.self
        this.steps = steps
        this.callback = callback
    }

    Cadence.prototype.done = function (vargs) {
        if (this.finalizers.length == 0) {
            this.callback.apply(null, vargs)
        } else {
            finalize(this, [], this.callback, vargs)
        }
    }

    function Step (cadence, index, vargs) {
        this.cadence = cadence
        this.index = index
        this.vargs = vargs
        this.results = new Array
        this.errors = new Array
        this.called = 0
        this.sync = true
        this.next = null
    }

    Step.prototype.callback = function (result, vargs) {
        var error = vargs.shift()
        if (error == null) {
            result.vargs = vargs
        } else {
            this.errors.push(error)
        }
        if (++this.called === this.results.length) {
            if (this.next == null) {
                this.sync = true
            } else {
                invoke(this.next)
            }
        }
    }

    Step.prototype.createCallback = function () {
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
            self.callback(result, vargs)
        }
    }

    function async (loop) {
        return stack[stack.length - 1].createCallback()
    }

    async.repeat = function () {
        return { token: token, repeat: true }
    }

    async.done = function () {
        return { token: token, repeat: false }
    }

    function call (fn, self, vargs) {
        try {
            var ret = fn.apply(self, vargs)
        } catch (e) {
            return [ ret, e ]
        }
        return [ ret ]
    }

    function rescue (step) {
        if (step.errors.length === 0) {
            invoke(step)
        } else {
            var error = step.errors.shift()

            execute(step.cadence.self, [
                step.catcher,
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
                        step.vargs = vargs.slice(1)
                        step.results.length = 0
                    }
                }
            ], [ error, done ])

            function done (error) {
                if (error) {
                    step.cadence.done([ error ])
                } else {
                    rescue(step)
                }
            }
        }
    }

    function invoke (step) {
        while (step = _invoke(step)) { }
    }

    function _invoke (step) {
        var vargs, cadence = step.cadence, steps = cadence.steps

        if (step.errors.length) {
            if (step.catcher) {
                rescue(step)
            } else {
                cadence.done([ step.errors[0] ])
            }
            return null
        }

        if (step.results.length == 0) {
            vargs = step.vargs
            if (vargs[0] && vargs[0].token === token) {
                step.index = vargs.shift().repeat ? -1 : cadence.steps.length - 1
            }
        } else {
            vargs = []
            for (var i = 0, I = step.results.length; i < I; i++) {
                var vargs_ = step.results[i].vargs
                for (var j = 0, J = vargs_.length; j < J; j++) {
                    vargs.push(vargs_[j])
                }
            }
        }

        step = new Step(step.cadence, step.index + 1, vargs)

        if (step.index == steps.length) {
            cadence.done(vargs.length === 0 ? [] : [ null ].concat(vargs))
            return null
        }

        var fn = steps[step.index]

        if (Array.isArray(fn)) {
            if (fn.length === 1) {
                cadence.finalizers.push({ steps: fn, vargs: vargs })
                return step
            } else if (fn.length === 2) {
                step.catcher = fn[1]
                fn = fn[0]
            } else if (fn.length === 3) {
                var filter = fn
                step.catcher = function (async, error) {
                    if (filter[1].test(error.code || error.message)) {
                        return filter[2](async, error)
                    } else {
                        throw error
                    }
                }
                fn = fn[0]
            } else {
                step.vargs = [ step.vargs ]
                return step
            }
        }

        vargs.unshift(async)

        stack.push(step)

        var ret = call(fn, cadence.self, vargs)
               // ^^^^

        stack.pop()

        if (ret.length === 2) {
            step.errors.push(ret[1])
            step.vargs = vargs
            step.sync = true
        } else {
            step.vargs = [].concat(ret[0] === void(0) ? vargs.slice(1) : ret[0])
        }

        if (step.sync) {
            return step
        }

        step.next = step
        return null
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

    function execute (self, steps, vargs) {
        var cadence = new Cadence({ finalizers: [], self: self }, steps, vargs.pop())
        var step = new Step(cadence, -1, vargs)
        invoke(step)
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

    return hotspot
})

/*

 % node --version
v0.10.40
 % node benchmark/incremental/call.js
 hotspot call 0 x 698,553 ops/sec ±0.74% (97 runs sampled)
_hotspot call 0 x 694,490 ops/sec ±0.45% (100 runs sampled)
 hotspot call 1 x 704,919 ops/sec ±0.57% (98 runs sampled)
_hotspot call 1 x 700,274 ops/sec ±0.37% (102 runs sampled)
 hotspot call 2 x 705,951 ops/sec ±0.37% (97 runs sampled)
_hotspot call 2 x 702,175 ops/sec ±0.31% (103 runs sampled)
 hotspot call 3 x 702,084 ops/sec ±0.34% (103 runs sampled)
_hotspot call 3 x 704,156 ops/sec ±0.44% (95 runs sampled)
Fastest is  hotspot call 2,_hotspot call 3
 % node benchmark/incremental/loop.js
 hotspot loop 1 x 255,703 ops/sec ±0.32% (95 runs sampled)
_hotspot loop 1 x 250,149 ops/sec ±0.35% (102 runs sampled)
 hotspot loop 2 x 255,625 ops/sec ±0.54% (99 runs sampled)
_hotspot loop 2 x 251,315 ops/sec ±0.20% (103 runs sampled)
 hotspot loop 3 x 254,628 ops/sec ±0.39% (101 runs sampled)
_hotspot loop 3 x 246,829 ops/sec ±0.35% (98 runs sampled)
 hotspot loop 4 x 256,170 ops/sec ±0.27% (99 runs sampled)
_hotspot loop 4 x 246,391 ops/sec ±0.26% (101 runs sampled)
Fastest is  hotspot loop 4, hotspot loop 1, hotspot loop 2
 % node benchmark/incremental/async.js
 hotspot async 0 x 1,177,067 ops/sec ±0.72% (99 runs sampled)
_hotspot async 0 x 1,226,505 ops/sec ±0.25% (100 runs sampled)
 hotspot async 1 x 1,201,621 ops/sec ±0.51% (98 runs sampled)
_hotspot async 1 x 1,224,376 ops/sec ±0.21% (102 runs sampled)
 hotspot async 2 x 1,171,864 ops/sec ±0.31% (100 runs sampled)
_hotspot async 2 x 1,220,297 ops/sec ±0.33% (103 runs sampled)
 hotspot async 3 x 1,174,146 ops/sec ±0.38% (99 runs sampled)
_hotspot async 3 x 1,176,936 ops/sec ±0.34% (101 runs sampled)
Fastest is _hotspot async 0
 % node --version
v0.12.7
 % node benchmark/incremental/call.js
 hotspot call 0 x 767,289 ops/sec ±0.49% (97 runs sampled)
_hotspot call 0 x 840,998 ops/sec ±0.26% (96 runs sampled)
 hotspot call 1 x 835,749 ops/sec ±0.42% (103 runs sampled)
_hotspot call 1 x 832,906 ops/sec ±0.43% (96 runs sampled)
 hotspot call 2 x 837,380 ops/sec ±0.21% (102 runs sampled)
_hotspot call 2 x 826,099 ops/sec ±0.35% (101 runs sampled)
 hotspot call 3 x 822,571 ops/sec ±0.36% (99 runs sampled)
_hotspot call 3 x 818,106 ops/sec ±0.29% (101 runs sampled)
Fastest is _hotspot call 0
 % node benchmark/incremental/loop.js
 hotspot loop 1 x 229,997 ops/sec ±0.58% (100 runs sampled)
_hotspot loop 1 x 180,585 ops/sec ±0.57% (97 runs sampled)
 hotspot loop 2 x 228,316 ops/sec ±0.59% (100 runs sampled)
_hotspot loop 2 x 175,734 ops/sec ±0.61% (99 runs sampled)
 hotspot loop 3 x 223,545 ops/sec ±0.63% (100 runs sampled)
_hotspot loop 3 x 180,649 ops/sec ±0.30% (102 runs sampled)
 hotspot loop 4 x 223,510 ops/sec ±0.22% (101 runs sampled)
_hotspot loop 4 x 178,586 ops/sec ±0.36% (99 runs sampled)
Fastest is  hotspot loop 1
 % node benchmark/incremental/async.js
 hotspot async 0 x 1,010,535 ops/sec ±0.37% (98 runs sampled)
_hotspot async 0 x 971,497 ops/sec ±0.57% (102 runs sampled)
 hotspot async 1 x 990,476 ops/sec ±0.28% (101 runs sampled)
_hotspot async 1 x 971,696 ops/sec ±0.41% (100 runs sampled)
 hotspot async 2 x 1,005,854 ops/sec ±0.28% (100 runs sampled)
_hotspot async 2 x 974,753 ops/sec ±0.46% (100 runs sampled)
 hotspot async 3 x 960,522 ops/sec ±0.29% (100 runs sampled)
_hotspot async 3 x 967,539 ops/sec ±0.58% (100 runs sampled)
Fastest is  hotspot async 0

*/
