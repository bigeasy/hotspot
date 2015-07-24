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
        for (;;) {
            var vargs, cadence = step.cadence, steps = cadence.steps

            if (step.errors.length) {
                if (step.catcher) {
                    rescue(step)
                } else {
                    cadence.done([ step.errors[0] ])
                }
                break
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
                break
            }

            var fn = steps[step.index]

            if (Array.isArray(fn)) {
                if (fn.length === 1) {
                    cadence.finalizers.push({ steps: fn, vargs: vargs })
                    continue
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
                    continue
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

            if (!step.sync) {
                step.next = step
                break
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
v0.12.7
 % node benchmark/incremental/call.js
 hotspot call 0 x 903,983 ops/sec ±0.41% (103 runs sampled)
_hotspot call 0 x 840,646 ops/sec ±0.49% (98 runs sampled)
 hotspot call 1 x 893,468 ops/sec ±0.53% (98 runs sampled)
_hotspot call 1 x 844,865 ops/sec ±0.32% (98 runs sampled)
 hotspot call 2 x 895,736 ops/sec ±0.29% (102 runs sampled)
_hotspot call 2 x 828,522 ops/sec ±0.23% (102 runs sampled)
 hotspot call 3 x 883,757 ops/sec ±0.38% (103 runs sampled)
_hotspot call 3 x 819,561 ops/sec ±0.39% (101 runs sampled)
Fastest is  hotspot call 0
 % node benchmark/incremental/async.js
 hotspot async 0 x 1,134,216 ops/sec ±0.38% (97 runs sampled)
_hotspot async 0 x 993,242 ops/sec ±0.40% (100 runs sampled)
 hotspot async 1 x 1,092,399 ops/sec ±0.35% (99 runs sampled)
_hotspot async 1 x 976,941 ops/sec ±0.47% (99 runs sampled)
 hotspot async 2 x 1,142,367 ops/sec ±0.24% (101 runs sampled)
_hotspot async 2 x 975,970 ops/sec ±0.51% (100 runs sampled)
 hotspot async 3 x 1,122,023 ops/sec ±0.37% (101 runs sampled)
_hotspot async 3 x 972,220 ops/sec ±0.56% (102 runs sampled)
Fastest is  hotspot async 2
 % node --version
v0.10.40
 % node benchmark/incremental/call.js
 hotspot call 0 x 721,206 ops/sec ±1.01% (93 runs sampled)
_hotspot call 0 x 712,664 ops/sec ±0.68% (101 runs sampled)
 hotspot call 1 x 703,523 ops/sec ±0.45% (101 runs sampled)
_hotspot call 1 x 708,495 ops/sec ±0.69% (93 runs sampled)
 hotspot call 2 x 728,241 ops/sec ±0.42% (101 runs sampled)
_hotspot call 2 x 721,323 ops/sec ±0.50% (97 runs sampled)
 hotspot call 3 x 728,755 ops/sec ±0.16% (103 runs sampled)
_hotspot call 3 x 720,685 ops/sec ±0.40% (97 runs sampled)
Fastest is  hotspot call 3, hotspot call 0
 % node benchmark/incremental/async.js
 hotspot async 0 x 1,308,753 ops/sec ±0.46% (99 runs sampled)
_hotspot async 0 x 1,241,593 ops/sec ±0.24% (95 runs sampled)
 hotspot async 1 x 1,289,632 ops/sec ±0.62% (99 runs sampled)
_hotspot async 1 x 1,248,664 ops/sec ±0.18% (102 runs sampled)
 hotspot async 2 x 1,322,624 ops/sec ±0.36% (98 runs sampled)
_hotspot async 2 x 1,245,365 ops/sec ±0.22% (102 runs sampled)
 hotspot async 3 x 1,309,451 ops/sec ±0.48% (97 runs sampled)
_hotspot async 3 x 1,237,686 ops/sec ±0.33% (102 runs sampled)
Fastest is  hotspot async 2

*/
