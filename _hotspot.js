var stack = [], push = [].push, token = {}

function Callback (cadence, result) {
    var self = this
    this.cadence = cadence
    this.result = result
    this.callback = callback
    function callback () {
        var vargs = new Array
        for (var i = 0, I = arguments.length; i < I; i++) {
            vargs[i] = arguments[i]
        }
        callbacks.push(self)
        self.cadence.resolveCallback(self.result, vargs)
    }
}

var callbacks = []

function Cadence (self, steps, vargs, callback) {
    this.self = self
    this.finalizers = new Array
    this.steps = steps
    this.callback = callback
    this.index = 0
    this.vargs = vargs
    this.called = 0
    this.results = new Array
    this.errors = new Array
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
    var result = { vargs: [] }, callback

    this.results.push(result)
    this.sync = false

    if (callbacks.length === 0) {
        callback = new Callback(this, result)
    } else {
        callback = callbacks.pop()
        callback.cadence = this
        callback.result = result
    }

    return callback.callback
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
    this.called = 0
    this.results = new Array
    this.errors = new Array
    this.catcher = null
    this.waiting = true
    var steps = [ function () { return catcher(async, errors[0], errors) } ]
    var rescue = new Cadence(this.self, steps, this.vargs, this.createCallback())
    rescue.cadence = this
    rescue.waiting = true
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
 hotspot call 1 x 1,507,183 ops/sec ±1.08% (99 runs sampled)
_hotspot call 1 x 1,529,060 ops/sec ±0.94% (95 runs sampled)
 hotspot call 2 x 1,547,135 ops/sec ±0.57% (100 runs sampled)
_hotspot call 2 x 1,591,600 ops/sec ±0.68% (102 runs sampled)
 hotspot call 3 x 1,552,495 ops/sec ±0.46% (102 runs sampled)
_hotspot call 3 x 1,593,337 ops/sec ±0.47% (98 runs sampled)
 hotspot call 4 x 1,559,915 ops/sec ±0.28% (101 runs sampled)
_hotspot call 4 x 1,608,730 ops/sec ±0.34% (103 runs sampled)
Fastest is _hotspot call 4
 % node benchmark/increment/async.js
 hotspot async 1 x 1,790,695 ops/sec ±0.25% (100 runs sampled)
_hotspot async 1 x 1,797,974 ops/sec ±0.41% (102 runs sampled)
 hotspot async 2 x 1,761,529 ops/sec ±0.58% (95 runs sampled)
_hotspot async 2 x 1,792,086 ops/sec ±0.67% (101 runs sampled)
 hotspot async 3 x 1,759,860 ops/sec ±0.27% (101 runs sampled)
_hotspot async 3 x 1,779,678 ops/sec ±0.37% (101 runs sampled)
 hotspot async 4 x 1,754,780 ops/sec ±0.45% (102 runs sampled)
_hotspot async 4 x 1,809,364 ops/sec ±0.38% (97 runs sampled)
Fastest is _hotspot async 4,_hotspot async 1,_hotspot async 2
 % node benchmark/increment/loop.js
 hotspot loop 1 x 377,840 ops/sec ±0.35% (96 runs sampled)
_hotspot loop 1 x 381,679 ops/sec ±0.43% (102 runs sampled)
 hotspot loop 2 x 380,561 ops/sec ±0.39% (98 runs sampled)
_hotspot loop 2 x 378,989 ops/sec ±0.28% (102 runs sampled)
 hotspot loop 3 x 375,723 ops/sec ±0.32% (101 runs sampled)
_hotspot loop 3 x 383,051 ops/sec ±0.33% (99 runs sampled)
 hotspot loop 4 x 377,601 ops/sec ±0.35% (102 runs sampled)
_hotspot loop 4 x 380,749 ops/sec ±0.38% (102 runs sampled)
Fastest is _hotspot loop 3,_hotspot loop 1
 % node --version
v0.12.7
 % node benchmark/increment/call.js
 hotspot call 1 x 2,037,661 ops/sec ±0.49% (99 runs sampled)
_hotspot call 1 x 2,041,430 ops/sec ±0.68% (100 runs sampled)
 hotspot call 2 x 2,072,863 ops/sec ±0.33% (101 runs sampled)
_hotspot call 2 x 2,057,759 ops/sec ±0.41% (101 runs sampled)
 hotspot call 3 x 2,107,786 ops/sec ±0.13% (103 runs sampled)
_hotspot call 3 x 2,100,386 ops/sec ±0.19% (99 runs sampled)
 hotspot call 4 x 2,049,630 ops/sec ±0.46% (97 runs sampled)
_hotspot call 4 x 2,084,154 ops/sec ±0.27% (99 runs sampled)
Fastest is  hotspot call 3
 % node benchmark/increment/async.js
 hotspot async 1 x 1,982,720 ops/sec ±0.32% (102 runs sampled)
_hotspot async 1 x 1,939,019 ops/sec ±0.42% (102 runs sampled)
 hotspot async 2 x 1,915,842 ops/sec ±0.60% (101 runs sampled)
_hotspot async 2 x 1,970,413 ops/sec ±0.54% (101 runs sampled)
 hotspot async 3 x 1,888,587 ops/sec ±0.52% (100 runs sampled)
_hotspot async 3 x 1,905,924 ops/sec ±0.24% (101 runs sampled)
 hotspot async 4 x 1,918,930 ops/sec ±0.44% (98 runs sampled)
_hotspot async 4 x 1,871,868 ops/sec ±0.44% (102 runs sampled)
Fastest is  hotspot async 1
 % node benchmark/increment/loop.js
 hotspot loop 1 x 444,273 ops/sec ±0.37% (102 runs sampled)
_hotspot loop 1 x 440,542 ops/sec ±0.27% (101 runs sampled)
 hotspot loop 2 x 439,204 ops/sec ±0.40% (102 runs sampled)
_hotspot loop 2 x 439,680 ops/sec ±0.21% (103 runs sampled)
 hotspot loop 3 x 437,947 ops/sec ±0.31% (100 runs sampled)
_hotspot loop 3 x 434,172 ops/sec ±0.17% (102 runs sampled)
 hotspot loop 4 x 434,589 ops/sec ±0.34% (101 runs sampled)
_hotspot loop 4 x 428,444 ops/sec ±0.41% (100 runs sampled)
Fastest is  hotspot loop 1

*/
