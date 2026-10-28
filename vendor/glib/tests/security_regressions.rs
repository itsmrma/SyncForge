// Regression coverage for the CodeQL triage in docs/security/glib-codeql.md.
use glib::prelude::*;

#[test]
fn ptr_slice_truncation_drops_objects_and_reuses_storage() {
    let first = glib::Object::new::<glib::Object>();
    let second = glib::Object::new::<glib::Object>();
    let first_weak = first.downgrade();
    let second_weak = second.downgrade();
    let mut slice = glib::PtrSlice::from(vec![first, second]);

    // Exercises drop_in_place followed by writing the NULL terminator.
    slice.truncate(1);
    assert_eq!(slice.len(), 1);
    assert!(first_weak.upgrade().is_some());
    assert!(second_weak.upgrade().is_none());

    let replacement = glib::Object::new::<glib::Object>();
    let replacement_weak = replacement.downgrade();
    slice.push(replacement);
    assert_eq!(slice.len(), 2);
    assert!(replacement_weak.upgrade().is_some());

    slice.truncate(0);
    slice.truncate(0);
    assert!(slice.is_empty());
    assert!(first_weak.upgrade().is_none());
    assert!(replacement_weak.upgrade().is_none());
}

#[test]
fn object_values_clone_and_release_their_references() {
    let object = glib::Object::new::<glib::Object>();
    let weak = object.downgrade();
    let value = object.to_value();
    let copy = value.clone();
    drop(value);
    drop(object);

    assert!(weak.upgrade().is_some());
    let recovered = copy.get::<glib::Object>().unwrap();
    drop(copy);
    assert!(weak.upgrade().is_some());
    drop(recovered);
    assert!(weak.upgrade().is_none());
}

#[test]
fn file_errors_and_optional_hostnames_use_their_concrete_types() {
    let directory = tempfile::tempdir().unwrap();
    let missing_parent = directory.path().join("missing").join("file");
    assert!(glib::file_set_contents(&missing_parent, b"data").is_err());

    let file = directory.path().join("file");
    glib::file_set_contents(&file, b"data").unwrap();
    assert_eq!(std::fs::read(&file).unwrap(), b"data");

    // A local file URI has an absent hostname. It converts to Option<GString>,
    // not a GObject or GValue pointer as the reported CodeQL flows suggest.
    let uri = glib::filename_to_uri(&file, None).unwrap();
    let (round_trip, hostname) = glib::filename_from_uri(&uri).unwrap();
    assert_eq!(round_trip, file);
    assert!(hostname.is_none());
    assert!(glib::filename_from_uri("not a file URI").is_err());
    let (_, charset): (bool, Option<&'static glib::GStr>) = glib::charset();
    if let Some(charset) = charset {
        assert!(!charset.is_empty());
    }
}

#[test]
fn uuid_validation_returns_a_boolean() {
    let valid: bool = glib::uuid_string_is_valid("550e8400-e29b-41d4-a716-446655440000");
    let invalid: bool = glib::uuid_string_is_valid("invalid UUID");
    assert!(valid);
    assert!(!invalid);
}
