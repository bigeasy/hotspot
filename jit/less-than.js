function lessThan (a, b) {
    return a < b
}

function main () {
    for (var i = 0; i < 10000; i++) {
        lessThan(1, 0x7fffffff)
    }

    for (var i = 0; i < 10000; i++) {
        lessThan(1, Infinity)
    }

    for (var i = 0; i < 10000; i++) {
        lessThan(1, 0x7fffffff)
    }
}

main()
