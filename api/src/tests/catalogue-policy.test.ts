import test from "node:test";
import assert from "node:assert/strict";
import { catalogueCreationDisabled } from "../../../src/lib/catalogue-policy";

test("read-only catalogues prohibit creation even when hideCreate is false", () => {
  assert.equal(catalogueCreationDisabled({ readOnly: true, hideCreate: false }), true);
});

test("existing QMS catalogues retain creation until read-only cutover", () => {
  assert.equal(catalogueCreationDisabled({ readOnly: false, hideCreate: false }), false);
});

test("an existing hideCreate restriction cannot be overridden", () => {
  assert.equal(catalogueCreationDisabled({ readOnly: false, hideCreate: true }), true);
});