# Fixtures

Human-browsable mirror of `frontend/src/schema/examples/*.json`, kept here
so you can diff the shared contract's valid/invalid fixtures without
switching to the `frontend/` tree.

**This is not what the test target actually reads.** SPM resources must
live inside the target's own directory, so the copies that
`DynamicUIAppTests` loads via `Bundle.module` live at
`../DynamicUIAppTests/Fixtures/` — identical content, different location
for a mechanical reason. If you update the shared fixtures in `frontend/`,
update both copies (see `../README.md` "Keeping fixtures in sync").
