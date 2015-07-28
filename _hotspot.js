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
    var vargs, cadence = step.cadence, steps = cadence.steps
    for (;;) {
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

module.exports = hotspot

/*

 % node --version
v0.10.40
 % node benchmark/increment/call.js
 hotspot call 1 x 733,389 ops/sec ±0.81% (94 runs sampled)
_hotspot call 1 x 723,847 ops/sec ±0.77% (95 runs sampled)
 hotspot call 2 x 730,974 ops/sec ±0.47% (103 runs sampled)
_hotspot call 2 x 735,048 ops/sec ±0.45% (98 runs sampled)
 hotspot call 3 x 734,939 ops/sec ±0.43% (103 runs sampled)
_hotspot call 3 x 738,562 ops/sec ±0.42% (101 runs sampled)
 hotspot call 4 x 733,648 ops/sec ±0.41% (103 runs sampled)
_hotspot call 4 x 741,892 ops/sec ±0.10% (103 runs sampled)
Fastest is _hotspot call 4, hotspot call 1
 % node benchmark/increment/async.js
 hotspot async 1 x 1,435,002 ops/sec ±0.32% (95 runs sampled)
_hotspot async 1 x 1,192,303 ops/sec ±0.31% (99 runs sampled)
 hotspot async 2 x 1,432,641 ops/sec ±0.56% (100 runs sampled)
_hotspot async 2 x 1,289,436 ops/sec ±0.58% (102 runs sampled)
 hotspot async 3 x 1,424,752 ops/sec ±0.22% (101 runs sampled)
_hotspot async 3 x 1,284,568 ops/sec ±0.35% (102 runs sampled)
 hotspot async 4 x 1,466,156 ops/sec ±0.30% (102 runs sampled)
_hotspot async 4 x 1,298,616 ops/sec ±0.33% (96 runs sampled)
Fastest is  hotspot async 4
 % node benchmark/increment/loop.js
 hotspot loop 1 x 288,126 ops/sec ±0.43% (96 runs sampled)
_hotspot loop 1 x 263,011 ops/sec ±0.26% (101 runs sampled)
 hotspot loop 2 x 287,596 ops/sec ±0.32% (102 runs sampled)
_hotspot loop 2 x 266,159 ops/sec ±0.27% (102 runs sampled)
 hotspot loop 3 x 290,624 ops/sec ±0.19% (97 runs sampled)
_hotspot loop 3 x 262,298 ops/sec ±0.24% (97 runs sampled)
 hotspot loop 4 x 288,604 ops/sec ±0.40% (100 runs sampled)
_hotspot loop 4 x 263,704 ops/sec ±0.20% (99 runs sampled)
Fastest is  hotspot loop 3
 % node --version
v0.12.7
 % node benchmark/increment/call.js
 hotspot call 1 x 917,724 ops/sec ±0.17% (103 runs sampled)
_hotspot call 1 x 881,799 ops/sec ±0.75% (103 runs sampled)
 hotspot call 2 x 910,360 ops/sec ±0.38% (102 runs sampled)
_hotspot call 2 x 883,811 ops/sec ±0.48% (100 runs sampled)
 hotspot call 3 x 892,168 ops/sec ±0.44% (102 runs sampled)
_hotspot call 3 x 870,763 ops/sec ±0.19% (101 runs sampled)
 hotspot call 4 x 890,065 ops/sec ±0.21% (100 runs sampled)
_hotspot call 4 x 863,181 ops/sec ±0.31% (102 runs sampled)
Fastest is  hotspot call 1
 % node benchmark/increment/async.js
 hotspot async 1 x 1,208,543 ops/sec ±0.38% (101 runs sampled)
_hotspot async 1 x 1,173,519 ops/sec ±0.33% (101 runs sampled)
 hotspot async 2 x 1,171,100 ops/sec ±0.44% (99 runs sampled)
_hotspot async 2 x 1,161,970 ops/sec ±0.67% (95 runs sampled)
 hotspot async 3 x 1,165,545 ops/sec ±0.37% (100 runs sampled)
_hotspot async 3 x 1,136,005 ops/sec ±0.22% (101 runs sampled)
 hotspot async 4 x 1,123,573 ops/sec ±0.28% (102 runs sampled)
_hotspot async 4 x 1,155,244 ops/sec ±0.55% (100 runs sampled)
Fastest is  hotspot async 1
 % node benchmark/increment/loop.js
 hotspot loop 1 x 251,509 ops/sec ±0.27% (101 runs sampled)
_hotspot loop 1 x 241,462 ops/sec ±0.28% (103 runs sampled)
 hotspot loop 2 x 246,957 ops/sec ±0.33% (98 runs sampled)
_hotspot loop 2 x 240,158 ops/sec ±0.28% (100 runs sampled)
 hotspot loop 3 x 248,724 ops/sec ±0.06% (102 runs sampled)
_hotspot loop 3 x 237,146 ops/sec ±0.26% (102 runs sampled)
 hotspot loop 4 x 245,096 ops/sec ±0.15% (101 runs sampled)
_hotspot loop 4 x 234,415 ops/sec ±0.27% (100 runs sampled)
Fastest is  hotspot loop 1

*/
