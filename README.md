[![Stories in Ready](https://badge.waffle.io/bigeasy/hotspot.png?label=ready&title=Ready)](https://waffle.io/bigeasy/hotspot)
[![Build Status](https://travis-ci.org/bigeasy/hotspot.svg)](https://travis-ci.org/bigeasy/hotspot) [![Coverage Status](https://coveralls.io/repos/bigeasy/hotspot/badge.svg?branch=master&service=github)](https://coveralls.io/github/bigeasy/hotspot?branch=master)

# Hotspot

An asynchronous control-flow library that courts the V8 JIT complier.

What you're about to see is a Cadence inspired control-flow library that makes
asynchrnous steps available for JIT compilation and inlining.

What do you need for error-first callback programming? Trampoline and a
meaningful exception library. You'll find that here.

My programming style is object-oriented, building asynchronous error-first
functions and assigning them as members of an object. This library encourages
this form of programming.

The JIT comes from creating control flows that are one level deep, so that the
participants will be compiled.

## Differenes Between Hotspot and Cadence

 * Only one top-level **cadence**, no sub-**cadence**s.
 * The `async` function is passed to each **step**.
 * Only break and continue for looping.
 * Finalizers are not at the end of a loop iteration, only at the end of the
 function.
 * No airty preservation.
