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

Hotspot.prototype.resolveCallback = function (callback, error, vargs) {
    var cadence = callback.cadence
    var result = callback.result
    callback.cadence = null
    callback.result = null
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

function Hotspot () {
    this._stack = []
    this._callbacks = []
    this.vargs = null
    this.self = null
    this.scope = []
}

Hotspot.prototype.async = function () {
    var result = { vargs: [] }, callback

    var cadence = this._stack[this._stack.length - 1]

    cadence.results.push(result)
    cadence.sync = false

    var hotspot = this

    if (this._callbacks.length === 0) {
        callback = {
            cadence: cadence,
            result: result,
            callback: function (error) {
                var vargs = new Array
                for (var i = 1, I = arguments.length; i < I; i++) {
                    vargs[i - 1] = arguments[i]
                }
                hotspot.resolveCallback(callback, error, vargs)
            }
        }
    } else {
        callback = this._callbacks.pop()
        callback.cadence = cadence
        callback.result = result
    }

    return callback.callback
}

Hotspot.prototype.continue = { token: token, repeat: true }
Hotspot.prototype.break = { token: token, repeat: false }

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

Hotspot.prototype.invoke = function (cadence) {
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

        var step = steps[cadence.index++]

        cadence.called = 0
        cadence.results = new Array
        cadence.errors = new Array
        cadence.sync = true
        cadence.waiting = false

        this._stack.push(cadence)

        this.vargs = vargs
        this.self = cadence.self

        var ret = step(this)

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
        return function (hotspot) {
            try {
                return [ step.apply(hotspot) ]
            } catch (error) {
                return [ null, error ]
            }
        }
    }
}

var hotspot = new Hotspot

module.exports = function () {
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
        hotspot.invoke(new Cadence(this, steps, vargs, arguments[i]))
    }
}
