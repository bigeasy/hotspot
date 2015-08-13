var stack = [], token = {}, callbacks = []

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

function resolveCallback (cadence, result, vargs) {
    var error = vargs.shift()
    if (error == null) {
        result.vargs = vargs
    } else {
        cadence.errors.push(error)
    }
    if (++cadence.called === cadence.results.length) {
        if (cadence.waiting) {
            invoke(cadence)
        } else {
            cadence.sync = true
        }
    }
}

function createCallback (cadence) {
    var result = { vargs: [] }, callback

    cadence.results.push(result)
    cadence.sync = false

    if (callbacks.length === 0) {
        callback = {
            cadence: cadence,
            result: result,
            callback: function () {
                var vargs = new Array
                for (var i = 0, I = arguments.length; i < I; i++) {
                    vargs[i] = arguments[i]
                }
                callbacks.push(callback)
                resolveCallback(callback.cadence, callback.result, vargs)
            }
        }
    } else {
        callback = callbacks.pop()
        callback.cadence = cadence
        callback.result = result
    }

    return callback.callback
}

function async () {
    return createCallback(stack[stack.length - 1])
}

async.continue = { token: token, repeat: true }
async.break = { token: token, repeat: false }

function call (fn, self, vargs) {
    try {
        return [ fn.apply(self, vargs) ]
    } catch (e) {
        return [ null, e ]
    }
}

function rescue (cadence) {
    var copy = new Cadence(cadence.self, cadence.steps, cadence.vargs, cadence.callback)
    copy.index = cadence.index
    copy.waiting = true
    var rescue = new Cadence(cadence.self, [
        function () { return cadence.catcher.call(this, async, cadence.errors[0], cadence.errors) }
    ], cadence.vargs, createCallback(copy))
    rescue.cadence = copy
    rescue.waiting = true
    invoke(rescue)
}

function finalize (cadence, vargs) {
    if (cadence.finalizers.length == 0) {
        (cadence.callback).apply(null, vargs)
    } else {
        var finalizer = cadence.finalizers.pop()
        invoke(new Cadence(cadence.self, finalizer.steps, finalizer.vargs, function (error) {
            if (error) {
                cadence.errors.push(error)
                vargs = [ cadence.errors[0] ]
            }
            finalize(cadence, vargs)
        }))
    }
}

function invoke (cadence) {
    var vargs, steps = cadence.steps
    for (;;) {
        if (cadence.errors.length) {
            if (cadence.catcher) {
                rescue(cadence)
            } else {
                finalize(cadence, [ cadence.errors[0] ])
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
                finalize(cadence, vargs)
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

function hotspot () {
    var I = arguments.length
    var steps = new Array
    for (var i = 0; i < I; i++) {
        steps[i] = arguments[i]
    }
    return function () {
        var I = arguments.length
        var vargs = new Array
        for (var i = 0; i < I - 1; i++) {
            vargs[i] = arguments[i]
        }
        invoke(new Cadence(this, steps, vargs, arguments[i]))
    }
}

module.exports = hotspot
