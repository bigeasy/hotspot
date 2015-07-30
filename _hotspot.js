var stack = [], push = [].push, token = {}

function Cadence (self, steps, vargs, callback) {
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
    this.cadence = this
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

Cadence.prototype.rescue = function () {
    var errors = this.errors, catcher = this.catcher
    this.errors = new Array
    this.results = new Array
    this.catcher = null
    this.called = 0
    this.waiting = true
    var callback = this.createCallback()
    var steps = [ function () { return catcher(async, errors[0], errors) } ]
    var rescue = new Cadence(this.self, steps, this.vargs, callback)
    rescue.waiting = true
    rescue.cadence = this
    invoke(rescue)
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
                cadence.rescue()
            } else {
                cadence.finalize([ cadence.errors[0] ])
            }
            break
        }

        if (cadence.results.length == 0) {
            vargs = cadence.vargs
            if (vargs[0] && vargs[0].token === token) {
                cadence.cadence.index = vargs.shift().repeat ? 0 : cadence.cadence.steps.length
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
            cadence.vargs = Array.isArray(ret[0]) ? ret[0] : [ ret[0] ]
        }

        if (!cadence.sync) {
            cadence.waiting = true
            break
        }
    }
}

function execute (self, steps, vargs, callback) {
    var cadence = new Cadence(self, steps, vargs, callback)
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
 hotspot call 1 x 1,549,705 ops/sec ±1.09% (95 runs sampled)
_hotspot call 1 x 1,514,823 ops/sec ±0.97% (95 runs sampled)
 hotspot call 2 x 1,582,020 ops/sec ±0.69% (100 runs sampled)
_hotspot call 2 x 1,574,727 ops/sec ±0.67% (101 runs sampled)
 hotspot call 3 x 1,581,228 ops/sec ±0.55% (101 runs sampled)
_hotspot call 3 x 1,574,346 ops/sec ±0.61% (100 runs sampled)
 hotspot call 4 x 1,589,828 ops/sec ±0.50% (102 runs sampled)
_hotspot call 4 x 1,585,091 ops/sec ±0.40% (98 runs sampled)
Fastest is  hotspot call 4,_hotspot call 4, hotspot call 2
 % node benchmark/increment/async.js
 hotspot async 1 x 1,811,909 ops/sec ±0.33% (100 runs sampled)
_hotspot async 1 x 1,682,017 ops/sec ±0.37% (99 runs sampled)
 hotspot async 2 x 1,790,298 ops/sec ±0.54% (102 runs sampled)
_hotspot async 2 x 1,754,861 ops/sec ±0.36% (102 runs sampled)
 hotspot async 3 x 1,814,631 ops/sec ±0.47% (95 runs sampled)
_hotspot async 3 x 1,751,290 ops/sec ±0.39% (103 runs sampled)
 hotspot async 4 x 1,803,978 ops/sec ±0.37% (102 runs sampled)
_hotspot async 4 x 1,725,051 ops/sec ±0.52% (97 runs sampled)
Fastest is  hotspot async 3, hotspot async 1
 % node benchmark/increment/loop.js
 hotspot loop 1 x 377,259 ops/sec ±0.32% (97 runs sampled)
_hotspot loop 1 x 383,929 ops/sec ±0.50% (99 runs sampled)
 hotspot loop 2 x 377,737 ops/sec ±0.53% (99 runs sampled)
_hotspot loop 2 x 382,410 ops/sec ±0.40% (100 runs sampled)
 hotspot loop 3 x 376,151 ops/sec ±0.54% (101 runs sampled)
_hotspot loop 3 x 386,458 ops/sec ±0.42% (99 runs sampled)
 hotspot loop 4 x 378,292 ops/sec ±0.43% (100 runs sampled)
_hotspot loop 4 x 385,004 ops/sec ±0.39% (100 runs sampled)
Fastest is _hotspot loop 3
 % node --version
v0.12.7
 % node benchmark/increment/call.js
 hotspot call 1 x 1,917,627 ops/sec ±0.47% (102 runs sampled)
_hotspot call 1 x 2,038,960 ops/sec ±1.09% (94 runs sampled)
 hotspot call 2 x 2,036,501 ops/sec ±0.38% (100 runs sampled)
_hotspot call 2 x 2,063,463 ops/sec ±0.41% (99 runs sampled)
 hotspot call 3 x 2,060,888 ops/sec ±0.44% (101 runs sampled)
_hotspot call 3 x 2,023,157 ops/sec ±0.46% (98 runs sampled)
 hotspot call 4 x 2,040,165 ops/sec ±0.47% (99 runs sampled)
_hotspot call 4 x 1,999,119 ops/sec ±0.45% (102 runs sampled)
Fastest is _hotspot call 2, hotspot call 3,_hotspot call 1
 % node benchmark/increment/async.js
 hotspot async 1 x 1,949,655 ops/sec ±0.47% (94 runs sampled)
_hotspot async 1 x 1,773,505 ops/sec ±0.34% (101 runs sampled)
 hotspot async 2 x 1,895,151 ops/sec ±1.02% (100 runs sampled)
_hotspot async 2 x 1,762,498 ops/sec ±0.56% (99 runs sampled)
 hotspot async 3 x 1,905,617 ops/sec ±0.52% (101 runs sampled)
_hotspot async 3 x 1,750,617 ops/sec ±0.41% (100 runs sampled)
 hotspot async 4 x 1,936,477 ops/sec ±0.22% (101 runs sampled)
_hotspot async 4 x 1,737,631 ops/sec ±0.46% (97 runs sampled)
Fastest is  hotspot async 1
 % node benchmark/increment/loop.js
 hotspot loop 1 x 446,972 ops/sec ±0.47% (101 runs sampled)
_hotspot loop 1 x 446,618 ops/sec ±0.54% (98 runs sampled)
 hotspot loop 2 x 442,753 ops/sec ±0.44% (101 runs sampled)
_hotspot loop 2 x 443,990 ops/sec ±0.50% (98 runs sampled)
 hotspot loop 3 x 440,590 ops/sec ±0.49% (101 runs sampled)
_hotspot loop 3 x 444,123 ops/sec ±0.27% (102 runs sampled)
 hotspot loop 4 x 439,643 ops/sec ±0.44% (101 runs sampled)
_hotspot loop 4 x 435,806 ops/sec ±0.38% (100 runs sampled)
Fastest is  hotspot loop 1,_hotspot loop 1

*/
