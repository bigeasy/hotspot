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

            return

            /* istanbul ignore next */
            try {} catch (e) {}
        }
    }

    function async (loop) {
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
                if (vargs.length !== 0) {
                    vargs.unshift(null)
                }
                cadence.done(vargs)
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
v0.10.40
 % node benchmark/increment/call.js
 hotspot call 1 x 727,306 ops/sec ±0.72% (97 runs sampled)
_hotspot call 1 x 723,164 ops/sec ±0.69% (100 runs sampled)
 hotspot call 2 x 728,691 ops/sec ±0.45% (103 runs sampled)
_hotspot call 2 x 728,772 ops/sec ±0.47% (100 runs sampled)
 hotspot call 3 x 725,694 ops/sec ±0.42% (101 runs sampled)
_hotspot call 3 x 724,653 ops/sec ±0.46% (99 runs sampled)
 hotspot call 4 x 727,071 ops/sec ±0.32% (103 runs sampled)
_hotspot call 4 x 729,223 ops/sec ±0.15% (103 runs sampled)
Fastest is _hotspot call 4
 % node benchmark/increment/async.js
 hotspot async 1 x 1,323,117 ops/sec ±0.28% (97 runs sampled)
_hotspot async 1 x 1,331,710 ops/sec ±0.23% (99 runs sampled)
 hotspot async 2 x 1,320,365 ops/sec ±0.37% (103 runs sampled)
_hotspot async 2 x 1,325,840 ops/sec ±0.19% (100 runs sampled)
 hotspot async 3 x 1,332,853 ops/sec ±0.33% (97 runs sampled)
_hotspot async 3 x 1,336,903 ops/sec ±0.15% (102 runs sampled)
 hotspot async 4 x 1,345,309 ops/sec ±0.32% (93 runs sampled)
_hotspot async 4 x 1,331,861 ops/sec ±0.29% (98 runs sampled)
Fastest is  hotspot async 4
 % node benchmark/increment/loop.js
 hotspot loop 1 x 264,169 ops/sec ±0.23% (95 runs sampled)
_hotspot loop 1 x 266,938 ops/sec ±0.22% (103 runs sampled)
 hotspot loop 2 x 263,326 ops/sec ±0.35% (102 runs sampled)
_hotspot loop 2 x 267,907 ops/sec ±0.18% (104 runs sampled)
 hotspot loop 3 x 263,668 ops/sec ±0.27% (101 runs sampled)
_hotspot loop 3 x 267,560 ops/sec ±0.18% (103 runs sampled)
 hotspot loop 4 x 265,065 ops/sec ±0.32% (97 runs sampled)
_hotspot loop 4 x 266,141 ops/sec ±0.28% (103 runs sampled)
Fastest is _hotspot loop 2

 % node --version
v0.12.7
 % node benchmark/increment/call.js
 hotspot call 1 x 909,472 ops/sec ±0.44% (100 runs sampled)
_hotspot call 1 x 892,450 ops/sec ±0.28% (103 runs sampled)
 hotspot call 2 x 894,750 ops/sec ±0.36% (100 runs sampled)
_hotspot call 2 x 903,661 ops/sec ±0.31% (103 runs sampled)
 hotspot call 3 x 893,640 ops/sec ±0.13% (103 runs sampled)
_hotspot call 3 x 894,307 ops/sec ±0.20% (102 runs sampled)
 hotspot call 4 x 884,929 ops/sec ±0.17% (97 runs sampled)
_hotspot call 4 x 884,544 ops/sec ±0.28% (102 runs sampled)
Fastest is  hotspot call 1
 % node benchmark/increment/async.js
 hotspot async 1 x 1,114,775 ops/sec ±0.39% (99 runs sampled)
_hotspot async 1 x 1,153,546 ops/sec ±0.34% (100 runs sampled)
 hotspot async 2 x 1,189,998 ops/sec ±0.58% (100 runs sampled)
_hotspot async 2 x 1,178,585 ops/sec ±0.36% (93 runs sampled)
 hotspot async 3 x 1,209,319 ops/sec ±0.78% (102 runs sampled)
_hotspot async 3 x 1,141,534 ops/sec ±0.54% (99 runs sampled)
 hotspot async 4 x 1,216,040 ops/sec ±0.32% (99 runs sampled)
_hotspot async 4 x 1,165,183 ops/sec ±0.16% (101 runs sampled)
Fastest is  hotspot async 4
 % node benchmark/increment/loop.js
 hotspot loop 1 x 245,797 ops/sec ±0.22% (100 runs sampled)
_hotspot loop 1 x 229,244 ops/sec ±0.56% (96 runs sampled)
 hotspot loop 2 x 241,838 ops/sec ±0.33% (100 runs sampled)
_hotspot loop 2 x 227,952 ops/sec ±0.32% (98 runs sampled)
 hotspot loop 3 x 242,017 ops/sec ±0.16% (102 runs sampled)
_hotspot loop 3 x 223,034 ops/sec ±0.16% (103 runs sampled)
 hotspot loop 4 x 238,939 ops/sec ±0.32% (103 runs sampled)
_hotspot loop 4 x 220,656 ops/sec ±0.28% (103 runs sampled)
Fastest is  hotspot loop 1

*/
