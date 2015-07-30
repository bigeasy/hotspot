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
                cadence.errors = [ error ]
                cadence.finalize([ cadence.errors[0] ])
            } else {
                rescue(cadence)
            }
        }
    }
}

Cadence.prototype.finalize = function (vargs) {
    if (this.finalizers.length == 0) {
        (this.callback).apply(null, vargs)
    } else {
        var finalizer = this.finalizers.pop()
        execute(this.self, finalizer.steps, finalizer.vargs, function (error) {
            if (error) {
                this.errors.push(error)
                vargs = [ this.errors[0] ]
            }
            this.finalize(vargs)
        }.bind(this))
    }
}

function invoke (cadence) {
    var vargs, steps = cadence.steps
    for (;;) {
        if (cadence.errors.length) {
            if (cadence.catcher) {
                rescue(cadence)
            } else {
                cadence.finalize([ cadence.errors[0] ])
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
            if (cadence.finalizers.length === 0) {
                (cadence.callback).apply(null, vargs)
            } else {
                cadence.finalize(vargs)
            }
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
 hotspot call 1 x 1,563,802 ops/sec ±1.04% (97 runs sampled)
_hotspot call 1 x 762,782 ops/sec ±0.73% (96 runs sampled)
 hotspot call 2 x 1,589,432 ops/sec ±0.57% (98 runs sampled)
_hotspot call 2 x 775,095 ops/sec ±0.55% (98 runs sampled)
 hotspot call 3 x 1,596,848 ops/sec ±0.43% (102 runs sampled)
_hotspot call 3 x 783,170 ops/sec ±0.52% (96 runs sampled)
 hotspot call 4 x 1,571,311 ops/sec ±0.32% (101 runs sampled)
_hotspot call 4 x 779,016 ops/sec ±0.49% (94 runs sampled)
Fastest is  hotspot call 3, hotspot call 2
 % node benchmark/increment/async.js
 hotspot async 1 x 1,767,073 ops/sec ±0.23% (98 runs sampled)
_hotspot async 1 x 1,773,479 ops/sec ±0.35% (96 runs sampled)
 hotspot async 2 x 1,777,444 ops/sec ±0.51% (96 runs sampled)
_hotspot async 2 x 1,788,729 ops/sec ±0.44% (101 runs sampled)
 hotspot async 3 x 1,798,178 ops/sec ±0.42% (99 runs sampled)
_hotspot async 3 x 1,798,422 ops/sec ±0.25% (101 runs sampled)
 hotspot async 4 x 1,801,482 ops/sec ±0.40% (100 runs sampled)
_hotspot async 4 x 1,745,822 ops/sec ±0.30% (101 runs sampled)
Fastest is  hotspot async 4, hotspot async 3
 % node benchmark/increment/loop.js
 hotspot loop 1 x 382,954 ops/sec ±0.30% (98 runs sampled)
_hotspot loop 1 x 287,879 ops/sec ±0.17% (102 runs sampled)
 hotspot loop 2 x 384,461 ops/sec ±0.38% (103 runs sampled)
_hotspot loop 2 x 288,020 ops/sec ±0.28% (102 runs sampled)
 hotspot loop 3 x 381,264 ops/sec ±0.37% (102 runs sampled)
_hotspot loop 3 x 287,536 ops/sec ±0.19% (103 runs sampled)
 hotspot loop 4 x 380,121 ops/sec ±0.35% (99 runs sampled)
_hotspot loop 4 x 286,170 ops/sec ±0.42% (101 runs sampled)
Fastest is  hotspot loop 2
 % node --version
v0.12.7
 % node benchmark/increment/call.js
 hotspot call 1 x 1,925,404 ops/sec ±0.20% (102 runs sampled)
_hotspot call 1 x 929,676 ops/sec ±0.42% (101 runs sampled)
 hotspot call 2 x 1,844,858 ops/sec ±0.41% (99 runs sampled)
_hotspot call 2 x 925,975 ops/sec ±0.28% (98 runs sampled)
 hotspot call 3 x 2,041,703 ops/sec ±0.41% (100 runs sampled)
_hotspot call 3 x 908,589 ops/sec ±0.29% (102 runs sampled)
 hotspot call 4 x 2,023,581 ops/sec ±0.43% (101 runs sampled)
_hotspot call 4 x 908,174 ops/sec ±0.29% (102 runs sampled)
Fastest is  hotspot call 3
 % node benchmark/increment/async.js
 hotspot async 1 x 1,710,808 ops/sec ±0.25% (101 runs sampled)
_hotspot async 1 x 1,731,288 ops/sec ±0.32% (102 runs sampled)
 hotspot async 2 x 1,696,016 ops/sec ±0.39% (97 runs sampled)
_hotspot async 2 x 1,708,534 ops/sec ±0.65% (102 runs sampled)
 hotspot async 3 x 1,727,533 ops/sec ±0.15% (102 runs sampled)
_hotspot async 3 x 1,721,008 ops/sec ±0.19% (103 runs sampled)
 hotspot async 4 x 1,707,307 ops/sec ±0.24% (102 runs sampled)
_hotspot async 4 x 1,703,485 ops/sec ±0.17% (103 runs sampled)
Fastest is _hotspot async 1,_hotspot async 2
 % node benchmark/increment/loop.js
 hotspot loop 1 x 447,743 ops/sec ±0.26% (101 runs sampled)
_hotspot loop 1 x 238,337 ops/sec ±0.31% (97 runs sampled)
 hotspot loop 2 x 436,949 ops/sec ±0.36% (101 runs sampled)
_hotspot loop 2 x 236,490 ops/sec ±0.26% (100 runs sampled)
 hotspot loop 3 x 439,200 ops/sec ±0.35% (101 runs sampled)
_hotspot loop 3 x 236,033 ops/sec ±0.24% (102 runs sampled)
 hotspot loop 4 x 434,493 ops/sec ±0.24% (101 runs sampled)
_hotspot loop 4 x 233,657 ops/sec ±0.35% (100 runs sampled)
Fastest is  hotspot loop 1

*/
