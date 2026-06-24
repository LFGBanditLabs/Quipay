import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  isStellarAddress,
  parseAddressBookCSV,
  validateAddressBookImportFile,
} from "../useAddressBook";

const VALID_STELLAR_ADDRESS =
  "GAXCJAOR7REQBAMMZHS2RP6WNS2CLDRRLK3OYH25PX72OZWPL37JGZEE";

describe("address book CSV import", () => {
  it("keeps valid Stellar contacts and skips malformed addresses", () => {
    const csv = [
      "Name,Address,Notes,IsFavorite",
      `"Alice",${VALID_STELLAR_ADDRESS},"Payroll, primary",true`,
      "Mallory,not a real address at all,,false",
    ].join("\n");

    const result = parseAddressBookCSV(csv);

    expect(result.contacts).toEqual([
      {
        name: "Alice",
        address: VALID_STELLAR_ADDRESS,
        notes: "Payroll, primary",
        isFavorite: true,
      },
    ]);
    expect(result.skipped).toBe(1);
  });

  it("validates Stellar public keys instead of checking only length", () => {
    expect(isStellarAddress(VALID_STELLAR_ADDRESS)).toBe(true);
    expect(isStellarAddress("G".repeat(56))).toBe(false);
    expect(isStellarAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(
      false,
    );
  });

  it("skips rows past the import row limit", () => {
    const rows = Array.from(
      { length: MAX_IMPORT_ROWS + 1 },
      (_, index) => `Name ${index},${VALID_STELLAR_ADDRESS},,false`,
    );

    const result = parseAddressBookCSV(
      ["Name,Address,Notes,IsFavorite", ...rows].join("\n"),
    );

    expect(result.contacts).toHaveLength(MAX_IMPORT_ROWS);
    expect(result.skipped).toBe(1);
  });

  it("rejects oversized CSV files before reading them", () => {
    expect(() =>
      validateAddressBookImportFile({ size: MAX_IMPORT_BYTES + 1 }),
    ).toThrow("CSV file is too large");
  });
});
