var stack = [], token = [], callbacks = []

function Cadence (self, steps, vargs, callback) {
    this.self = self
    this.steps = steps
    this.callback = callback
    this.index = 0
    this.vargs = vargs
    this.called = 0
    this.finalizers = new Array
    this.results = new Array
    this.errors = new Array
    this.sync = true
    this.waiting = false
    this.cadence = this
}

function resolveCallback (cadence, result, error, vargs) {
    if (error) {
        cadence.errors.push(error)
    } else {
        result.vargs = vargs
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
            callback: function (error) {
                var vargs = new Array
                for (var i = 1, I = arguments.length; i < I; i++) {
                    vargs[i - 1] = arguments[i]
                }
                callbacks.push(callback)
                resolveCallback(callback.cadence, callback.result, error, vargs)
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

function rescue (cadence) {
    var copy = new Cadence(cadence.self, cadence.steps, cadence.vargs, cadence.callback)
    copy.index = cadence.index
    copy.waiting = true
    var rescue = new Cadence(cadence.self, [ wrap(
        function () { return cadence.catcher.call(this, async, cadence.errors[0], cadence.errors) }
    ) ], cadence.vargs, createCallback(copy))
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

var _finalize = hotspot([function (async) {
    if (this.finalizers.length) {
        var finalizer = this.finalizers.pop()
        finalizer.call(this.self, finalizer.vargs.concat(async()))
    }
}, function (async, error) {
    this.errors.push(error)
}])

function finalize (cadence) {
    _finalize.call(cadence, async())
}

// this would be the first step, reset would not be done in each loop, but in
// each wrapper, and in Cadence the operator would be selected above.

function begin (cadence) {
    var done = false
    if (cadence.finalizers.length) {
        var finalizer = cadence.finalizers.pop()
        // todo: make finalizer a hotspot.
        finalizer.call(this.self, finalizer.vargs.concat(async()))
    } if (cadence.errors.length) {
        if (cadence.catcher) {
        }
        done = true
    } else if (!cadence.loop) {
        done = true
    }
    cadence.loop = false
    if (done) {
        cadence.sync = false
    }
    return []
}

function invoke (cadence) {
    var vargs, steps = cadence.steps, repeat = false
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
                if (vargs.shift().repeat) {
                    cadence.cadence.index = 0
                    step = finalize
                } else {
                    cadence.cadence.index = steps.length
                }
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
                break
            } else {
                step = finalize
            }
        } else {
            step = steps[cadence.index++]
        }

        cadence.called = 0
        cadence.results = new Array
        cadence.errors = new Array
        cadence.sync = true
        cadence.waiting = false

        vargs.unshift(async)

        stack.push(cadence)

        var ret = step(cadence)

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

function wrap (step) {
    if (Array.isArray(step)) {
        if (step.length === 1) {
            return function (cadence) {
                cadence.finalizers.push({ steps: [ wrap(step[0]) ], vargs: cadence.vargs })
                return []
            }
        } else if (step.length === 2) {
            var invocation = wrap(step[0])
            return function (cadence) {
                cadence.catcher = step[1]
                return invocation(cadence)
            }
        } else if (step.length === 3) {
            return wrap([
                step[0],
                function (async, error) {
                    if (step[1].test(error.code || error.message)) {
                        return step[2](async, error)
                    } else {
                        throw error
                    }
                }
            ])
        } else {
            return function (cadence) {
                cadence.vargs.shift()
                return [ [ cadence.vargs ] ]
            }
        }
    } else {
        return function (cadence) {
            try {
                // todo: maybe put reset here, so ...
                return [ step.apply(cadence.self, cadence.vargs) ]
            } catch (error) {
                return [ null, error ]
            }
        }
    }
}

function hotspot () {
    var I = arguments.length
    var steps = new Array
    for (var i = 0; i < I; i++) {
        steps[i] = wrap(arguments[i])
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
