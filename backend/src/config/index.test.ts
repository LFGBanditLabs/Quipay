import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  jest,
} from "@jest/globals";

const ORIGINAL_ENV = process.env;

describe("backend config audit redacted fields", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AUDIT_REDACTED_FIELDS;
    delete process.env.LOG_REDACT_FIELDS;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("uses the default audit redaction field list", () => {
    const { config, DEFAULT_AUDIT_REDACTED_FIELDS } = require("./index");

    expect(config.audit.redactedFields).toEqual(DEFAULT_AUDIT_REDACTED_FIELDS);
  });

  it("uses AUDIT_REDACTED_FIELDS env var as an override", () => {
    process.env.AUDIT_REDACTED_FIELDS = "ssn, passport_number, dob";

    const { config } = require("./index");

    expect(config.audit.redactedFields).toEqual([
      "ssn",
      "passport_number",
      "dob",
    ]);
  });

  it("warns when a configured redaction field is not in the audit schema", () => {
    process.env.AUDIT_REDACTED_FIELDS = "ssn,unknown_field";
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { config } = require("./index");

    expect(config.audit.redactedFields).toEqual(["ssn", "unknown_field"]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Redaction field "unknown_field" not found in audit schema',
      ),
    );

    warnSpy.mockRestore();
  });
});
