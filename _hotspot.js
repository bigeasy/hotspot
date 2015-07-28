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
        } else {
            cadence.vargs = [].concat(ret[0] === void(0) ? vargs.slice(1) : ret[0])
        }

        if (!cadence.sync) {
            cadence.waiting = true
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
 hotspot call 1 x 777,156 ops/sec ±0.72% (98 runs sampled)
_hotspot call 1 x 743,540 ops/sec ±1.07% (97 runs sampled)
 hotspot call 2 x 778,638 ops/sec ±0.42% (102 runs sampled)
_hotspot call 2 x 779,453 ops/sec ±0.76% (99 runs sampled)
 hotspot call 3 x 758,907 ops/sec ±0.69% (102 runs sampled)
_hotspot call 3 x 708,201 ops/sec ±14.21% (46 runs sampled)
 hotspot call 4 x 697,877 ops/sec ±2.23% (95 runs sampled)
_hotspot call 4 x 747,400 ops/sec ±0.87% (95 runs sampled)
Fastest is  hotspot call 2, hotspot call 1
 % node benchmark/increment/async.js
 hotspot async 1 x 1,753,587 ops/sec ±0.32% (97 runs sampled)
_hotspot async 1 x 1,460,059 ops/sec ±0.52% (101 runs sampled)
 hotspot async 2 x 1,791,199 ops/sec ±0.50% (97 runs sampled)
_hotspot async 2 x 1,457,941 ops/sec ±0.44% (100 runs sampled)
 hotspot async 3 x 1,773,905 ops/sec ±0.45% (98 runs sampled)
_hotspot async 3 x 1,486,984 ops/sec ±0.32% (102 runs sampled)
 hotspot async 4 x 1,768,855 ops/sec ±0.21% (100 runs sampled)
_hotspot async 4 x 1,454,113 ops/sec ±0.55% (101 runs sampled)
Fastest is  hotspot async 2
 % node benchmark/increment/loop.js
 hotspot loop 1 x 288,389 ops/sec ±0.33% (99 runs sampled)
_hotspot loop 1 x 286,453 ops/sec ±0.22% (103 runs sampled)
 hotspot loop 2 x 285,925 ops/sec ±0.37% (97 runs sampled)
_hotspot loop 2 x 286,728 ops/sec ±0.21% (102 runs sampled)
 hotspot loop 3 x 286,770 ops/sec ±0.23% (101 runs sampled)
_hotspot loop 3 x 286,009 ops/sec ±0.37% (100 runs sampled)
 hotspot loop 4 x 287,010 ops/sec ±0.13% (101 runs sampled)
_hotspot loop 4 x 285,615 ops/sec ±0.33% (100 runs sampled)
Fastest is  hotspot loop 1
 % node --version
v0.12.7
 % node benchmark/increment/call.js
 hotspot call 1 x 881,317 ops/sec ±0.44% (102 runs sampled)
_hotspot call 1 x 910,605 ops/sec ±0.25% (101 runs sampled)
 hotspot call 2 x 898,430 ops/sec ±0.27% (103 runs sampled)
_hotspot call 2 x 906,344 ops/sec ±0.24% (103 runs sampled)
 hotspot call 3 x 898,737 ops/sec ±0.22% (103 runs sampled)
_hotspot call 3 x 902,974 ops/sec ±0.21% (102 runs sampled)
 hotspot call 4 x 891,708 ops/sec ±0.35% (100 runs sampled)
_hotspot call 4 x 900,215 ops/sec ±0.24% (103 runs sampled)
Fastest is _hotspot call 1
 % node benchmark/increment/async.js
 hotspot async 1 x 1,550,516 ops/sec ±0.33% (96 runs sampled)
_hotspot async 1 x 1,224,596 ops/sec ±0.56% (98 runs sampled)
 hotspot async 2 x 1,558,046 ops/sec ±0.41% (98 runs sampled)
_hotspot async 2 x 1,241,274 ops/sec ±0.52% (100 runs sampled)
 hotspot async 3 x 1,567,904 ops/sec ±0.36% (97 runs sampled)
_hotspot async 3 x 1,243,554 ops/sec ±0.53% (101 runs sampled)
 hotspot async 4 x 1,586,765 ops/sec ±0.21% (99 runs sampled)
_hotspot async 4 x 1,238,293 ops/sec ±0.57% (97 runs sampled)
Fastest is  hotspot async 4
 % node benchmark/increment/loop.js
 hotspot loop 1 x 253,629 ops/sec ±0.60% (101 runs sampled)
_hotspot loop 1 x 255,110 ops/sec ±0.23% (102 runs sampled)
 hotspot loop 2 x 254,572 ops/sec ±0.34% (101 runs sampled)
_hotspot loop 2 x 256,850 ops/sec ±0.25% (102 runs sampled)
 hotspot loop 3 x 255,805 ops/sec ±0.09% (103 runs sampled)
_hotspot loop 3 x 255,269 ops/sec ±0.19% (103 runs sampled)
 hotspot loop 4 x 253,777 ops/sec ±0.07% (101 runs sampled)
_hotspot loop 4 x 251,211 ops/sec ±0.37% (102 runs sampled)
Fastest is _hotspot loop 2

*/
