import { z } from "zod";
import {
  DatabaseValidationError,
  validateRow,
  validateRows,
} from "./validation";

const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
});

describe("DatabaseValidationError (#930)", () => {
  it("validateRow returns the parsed row when it matches", () => {
    const row = validateRow("getUser", { id: 1, email: "a@b.co" }, userSchema);
    expect(row).toEqual({ id: 1, email: "a@b.co" });
  });

  it("validateRow throws DatabaseValidationError on a malformed row", () => {
    expect(() =>
      validateRow("getUser", { id: "not-a-number", email: "nope" }, userSchema),
    ).toThrow(DatabaseValidationError);
  });

  it("validateRow surfaces field-level Zod issues on the error", () => {
    let caught: DatabaseValidationError | null = null;
    try {
      validateRow("getUser", { id: 1, email: "no-at-symbol" }, userSchema);
    } catch (err) {
      caught = err as DatabaseValidationError;
    }

    expect(caught).toBeInstanceOf(DatabaseValidationError);
    expect(caught?.query).toBe("getUser");
    expect(caught?.issues.length).toBeGreaterThan(0);
    expect(caught?.message).toContain("getUser");
    expect(caught?.message).toContain("email");
  });

  it("validateRows passes through valid rows", () => {
    const rows = validateRows(
      "listUsers",
      [
        { id: 1, email: "a@b.co" },
        { id: 2, email: "c@d.co" },
      ],
      userSchema,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(1);
  });

  it("validateRows includes the offending row index in the issue path", () => {
    let caught: DatabaseValidationError | null = null;
    try {
      validateRows(
        "listUsers",
        [
          { id: 1, email: "a@b.co" },
          { id: 2, email: "broken" },
        ],
        userSchema,
      );
    } catch (err) {
      caught = err as DatabaseValidationError;
    }

    expect(caught).toBeInstanceOf(DatabaseValidationError);
    expect(caught?.issues[0]?.path[0]).toBe("row[1]");
  });

  it("DatabaseValidationError does not embed the raw row in the message", () => {
    let caught: DatabaseValidationError | null = null;
    try {
      validateRow(
        "getUser",
        { id: "s3cr3t-pii-id", email: "leak@me.com" },
        userSchema,
      );
    } catch (err) {
      caught = err as DatabaseValidationError;
    }

    expect(caught?.message ?? "").not.toContain("s3cr3t-pii-id");
    expect(caught?.message ?? "").not.toContain("leak@me.com");
  });
});
