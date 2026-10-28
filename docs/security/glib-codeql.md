# GLib CodeQL alert triage

Reviewed on 2026-10-28 against commit
`59eca355e0d9479de774ea265e54a33b4e1e5837`, CodeQL 2.27.3, Rust analysis
`2043603327`. The seven alerts appeared after GLib 0.18.5 was vendored for the
RUSTSEC-2024-0429 backport. This review uses the analysis's SARIF code flows,
not just the alert titles. Locations below refer to that commit.

The original CLI CodeQL alert #1 and Dependabot alert #6 are fixed. The GLib
iterator backport remains in place. None of the seven new alerts describes that
iterator defect.

## Findings

| Alert | Rule and location | Evidence | Disposition |
| --- | --- | --- | --- |
| #2 | `rust/access-invalid-pointer`, `object.rs:470` | Charset `*const c_char` and error `*mut GError` flows are routed through generic conversion helpers into `ObjectRef::from_glib_none(*mut GObject)`. These pointer types do not select that trait implementation. | False positive |
| #3 | Same rule, `object.rs:493` | Error `*mut GError` and hostname `*mut c_char` flows are routed into `ObjectRef::from_glib_full(*mut GObject)`. Error conversion occurs only after a non-null check; a missing hostname converts to `Option<GString>`. | False positive |
| #4 | Same rule, `subclass/boxed.rs:76` | The same charset/error flows are routed into the derived conversion for `MyBoxed(String)`, a type inside `#[cfg(test)]`. The actual call sites return strings or errors, not `MyBoxed`. | False positive |
| #5 | Same rule, `value.rs:462` | Charset/error flows cross the generic helper into `Value`'s conversion and `copy_into_value(*mut GValue, *const GValue)`. No reported source has a `GValue` pointer type. | False positive |
| #6 | Same rule, `value.rs:470` | Error/hostname flows are routed into `Value`'s generated destructor and `clear_value(*mut GValue)`. The concrete conversions return `Error` or `Option<GString>`, not `Value`. | False positive |
| #7 | Same rule, `collections/ptr_slice.rs:900` | `truncate` drops an element with `drop_in_place::<T>(p as *mut T)`, then writes the null terminator into that slot with `ptr::write`. The slice allocation stays alive; the removed element is not read or dropped again. | False positive |
| #8 | `rust/cleartext-logging`, `log.rs:85` | `uuid_string_is_valid` returns `bool`, but the flow enters `FromGlib<u32> for LogLevel` and its unknown-level panic. The concrete conversion is `FromGlib<gboolean> for bool`. Even the incorrectly propagated value is a validation flag, not the UUID string. | False positive |

## Trace checks

For alerts #2-#6, inspect `auto/functions.rs:197-208`, `224-237`,
`276-282`, `344-347`, and `manual_functions.rs:217-220`. The pointers start
as null, are passed as mutable C out-parameters, and are converted according to
the enclosing function's concrete return type. The error branches check for
null before conversion; nullable hostname/charset results use `Option`.
`translate.rs:1621-1631` dispatches through the `FromGlibPtrNone<P>` and
`FromGlibPtrFull<P>` traits, so the reported cross-type paths are not runtime
call chains. Optional conversions check for null in `translate.rs` as well.

For #7, Rust explicitly permits overwriting a dropped value using `ptr::write`:
https://doc.rust-lang.org/std/ptr/fn.drop_in_place.html#safety.
Dropping the pointee's resources does not free the containing pointer-slot
allocation owned by `PtrSlice`. `truncate` decrements its length before dropping
each element, and the allocation is freed by `PtrSlice::drop`.

For #8, compare `auto/functions.rs:855-857`, `translate.rs:1413-1414`, and
the distinct `FromGlib` implementations for `bool` and `LogLevel`.

## Validation and scope

`vendor/glib/tests/security_regressions.rs` exercises slot reuse and object
lifetimes during truncation, object `Value` cloning/destruction, failing and
successful file writes, absent URI hostnames, optional charsets, and boolean UUID
validation. Linux CI runs these tests with optimizations, alongside the upstream
string-iterator regression tests and boxed-type conversion tests.

The seven alert instances are dismissed individually as false positives with
their reasoning linked here. CodeQL default setup, all queries, and scanning of
`vendor/glib` remain enabled. No path exclusion or blanket rule suppression is
introduced. This disposition is specific to these reported flows; new findings
must be reviewed separately.

These changes add tests and review documentation only. The existing 3.5.3
executables do not need rebuilding.
