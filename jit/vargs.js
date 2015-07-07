// I created this file to watch the JIT optimizations of these functions and
// assert that they do not compile so I can compare performance of different
// varadic argument creation when they're not complied.

var slice = [].slice

function foo () {
}

function varged (vargs) {
    foo.apply(null, vargs)
}

function arged (args) {
    var vargs = []
    for (var i = 0, I = args.length; i < I; i++) {
        vargs[i] = args[i]
    }
    foo.apply(null, vargs)
}

function sliced () {
    varged(slice.call(arguments))

    return

    try { } catch (e) { }
}

function arrayed () {
    var vargs = []
    for (var i = 0, I = arguments.length; i < I; i++) {
        vargs[i] = arguments[i]
    }
    varged(vargs)

    return

    try { } catch (e) { }
}

function proxied () {
    arged(arguments)

    return

    try { } catch (e) { }
}

for (var i = 0; i < 10000; i++) {
    proxied(1, 2, 3, 4, 5, 6, 7)
}

for (var i = 0; i < 10000; i++) {
    arrayed(1, 2, 3, 4, 5, 6, 7)
}

for (var i = 0; i < 10000; i++) {
    sliced(1, 2, 3, 4, 5, 6, 7)
}
