# Hotspot Diary

## Objects Versus Functions with Properties

Hard to find a difference in performance. See `jit/property.js` and
`benchmark/fiddle/property.js`.

The assumption is that if the `async` helper was an object instead of a
function, then a call to `async.repeat()` would be faster, but if `async` where an
object, then `async()` would have to become `async.callback()` or some such. At
this point, property lookup performance is awfully similar.

The actual usage is for `async.repeat()` and `async.done()`. Below is the test
updated to invoke a member function; one that is created in an object
literal, one that is declared using `prototype`, and one that is assigned to a
property of a function.

```console
object 0 x 97,194,105 ops/sec ±1.27% (93 runs sampled)
class  0 x 86,045,214 ops/sec ±2.13% (84 runs sampled)
func   0 x 80,579,986 ops/sec ±1.66% (82 runs sampled)
object 1 x 80,082,537 ops/sec ±0.87% (96 runs sampled)
class  1 x 88,064,543 ops/sec ±1.79% (90 runs sampled)
func   1 x 79,167,883 ops/sec ±0.72% (98 runs sampled)
object 2 x 80,591,214 ops/sec ±0.77% (99 runs sampled)
class  2 x 81,356,897 ops/sec ±1.68% (96 runs sampled)
func   2 x 79,731,183 ops/sec ±0.63% (99 runs sampled)
object 3 x 79,362,601 ops/sec ±1.00% (98 runs sampled)
class  3 x 78,240,856 ops/sec ±0.90% (97 runs sampled)
func   3 x 84,714,883 ops/sec ±1.52% (88 runs sampled)
Fastest is object 0
```

Performance varies from one run to the next. `class` seems fastest, but which
ever is run first is always fastest.

In V8, a function is just another object, a C++ function class derived from an
object base class, so it seems that the performance of properties will be the
same for objects and functions.

Also, `async.repeat()` and `async.done()` are not going to be the hottest spots
in Hotspot. Preserving the `async()` syntax from Cadence would take precedence
when the gains are almost immeasurable.
