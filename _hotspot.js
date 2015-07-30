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
        ], [ error ], done)

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
        execute(cadence.self, finalizer.steps, finalizer.vargs, done)
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

function execute (self, steps, vargs, callback) {
    var cadence = new Cadence(self, steps, callback, vargs)
    invoke(cadence)
}

function hotspot () {
    var I = arguments.length
    var steps = new Array
    for (var i = 0; i < I; i++) {
        steps.push(arguments[i])
    }
    return function () {
        var I = arguments.length
        var vargs = new Array
        for (var i = 0; i < I - 1; i++) {
            vargs.push(arguments[i])
        }
        execute(this, steps, vargs, arguments[i])
    }
}

module.exports = hotspot

/*

 % node --version
v0.10.40
 % node benchmark/increment/call.js
 hotspot call 1 x 766,191 ops/sec ±0.86% (94 runs sampled)
_hotspot call 1 x 751,197 ops/sec ±0.69% (99 runs sampled)
 hotspot call 2 x 770,080 ops/sec ±0.42% (100 runs sampled)
_hotspot call 2 x 770,823 ops/sec ±0.50% (97 runs sampled)
 hotspot call 3 x 756,506 ops/sec ±0.59% (100 runs sampled)
_hotspot call 3 x 757,941 ops/sec ±0.41% (94 runs sampled)
 hotspot call 4 x 762,084 ops/sec ±0.41% (101 runs sampled)
_hotspot call 4 x 770,170 ops/sec ±0.31% (97 runs sampled)
Fastest is _hotspot call 4, hotspot call 2
 % node benchmark/increment/async.js
 hotspot async 1 x 1,749,741 ops/sec ±0.46% (100 runs sampled)
_hotspot async 1 x 1,673,520 ops/sec ±0.73% (95 runs sampled)
 hotspot async 2 x 1,745,253 ops/sec ±0.57% (95 runs sampled)
_hotspot async 2 x 1,716,540 ops/sec ±0.45% (97 runs sampled)
 hotspot async 3 x 1,733,249 ops/sec ±0.42% (98 runs sampled)
_hotspot async 3 x 1,738,016 ops/sec ±0.14% (101 runs sampled)
 hotspot async 4 x 1,756,771 ops/sec ±0.52% (99 runs sampled)
_hotspot async 4 x 1,690,281 ops/sec ±0.65% (99 runs sampled)
Fastest is  hotspot async 4, hotspot async 2
 % node benchmark/increment/loop.js
 hotspot loop 1 x 287,513 ops/sec ±0.25% (95 runs sampled)
_hotspot loop 1 x 285,823 ops/sec ±0.27% (102 runs sampled)
 hotspot loop 2 x 284,705 ops/sec ±0.41% (95 runs sampled)
_hotspot loop 2 x 286,420 ops/sec ±0.25% (103 runs sampled)
 hotspot loop 3 x 284,764 ops/sec ±0.36% (102 runs sampled)
_hotspot loop 3 x 285,373 ops/sec ±0.24% (103 runs sampled)
 hotspot loop 4 x 285,418 ops/sec ±0.22% (101 runs sampled)
_hotspot loop 4 x 285,642 ops/sec ±0.43% (103 runs sampled)
Fastest is  hotspot loop 1
 % node --version
v0.12.7
 % node benchmark/increment/call.js
 hotspot call 1 x 942,120 ops/sec ±0.33% (97 runs sampled)
_hotspot call 1 x 918,384 ops/sec ±0.51% (98 runs sampled)
 hotspot call 2 x 912,109 ops/sec ±0.52% (101 runs sampled)
_hotspot call 2 x 921,939 ops/sec ±0.72% (92 runs sampled)
 hotspot call 3 x 934,205 ops/sec ±0.16% (103 runs sampled)
_hotspot call 3 x 910,299 ops/sec ±0.23% (98 runs sampled)
 hotspot call 4 x 930,512 ops/sec ±0.12% (100 runs sampled)
_hotspot call 4 x 913,101 ops/sec ±0.30% (101 runs sampled)
Fastest is  hotspot call 1
 % node benchmark/increment/async.js
 hotspot async 1 x 1,786,220 ops/sec ±0.24% (101 runs sampled)
_hotspot async 1 x 1,751,365 ops/sec ±0.24% (101 runs sampled)
 hotspot async 2 x 1,703,057 ops/sec ±0.32% (101 runs sampled)
_hotspot async 2 x 1,774,095 ops/sec ±0.28% (102 runs sampled)
 hotspot async 3 x 1,690,819 ops/sec ±0.25% (99 runs sampled)
_hotspot async 3 x 1,754,252 ops/sec ±0.34% (101 runs sampled)
 hotspot async 4 x 1,727,177 ops/sec ±0.20% (99 runs sampled)
_hotspot async 4 x 1,726,646 ops/sec ±0.40% (97 runs sampled)
Fastest is  hotspot async 1
 % node benchmark/increment/loop.js
 hotspot loop 1 x 254,785 ops/sec ±0.23% (101 runs sampled)
_hotspot loop 1 x 254,974 ops/sec ±0.28% (103 runs sampled)
 hotspot loop 2 x 252,233 ops/sec ±0.42% (101 runs sampled)
_hotspot loop 2 x 256,211 ops/sec ±0.25% (100 runs sampled)
 hotspot loop 3 x 252,310 ops/sec ±0.25% (101 runs sampled)
_hotspot loop 3 x 253,874 ops/sec ±0.29% (101 runs sampled)
 hotspot loop 4 x 251,998 ops/sec ±0.23% (100 runs sampled)
_hotspot loop 4 x 253,444 ops/sec ±0.18% (101 runs sampled)
Fastest is _hotspot loop 2

*/
