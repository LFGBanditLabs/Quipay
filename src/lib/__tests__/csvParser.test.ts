import {
  parseCsvText,
  parseDateToUnixSeconds,
  validatePayrollRow,
  parseAndValidatePayrollCsv,
  exportErrorsToCsv,
  exportSummaryToCsv,
} from "../csvParser";

describe("csvParser", () => {
  describe("parseCsvText", () => {
    it("parses standard CSV text with headers and handles quotes", () => {
      const csv = `email,qp_id,amount,token,start_date,end_date\nalice@company.com,QP100000042,5000,USDC,2026-09-01,2027-08-31\n"bob@company.com",QP100000043,3500,"USDC",2026-09-01,2027-08-31`;
      const { headers, rows } = parseCsvText(csv);

      expect(headers).toEqual([
        "email",
        "qp_id",
        "amount",
        "token",
        "start_date",
        "end_date",
      ]);
      expect(rows).toHaveLength(2);
      expect(rows[0].email).toBe("alice@company.com");
      expect(rows[0].qp_id).toBe("QP100000042");
      expect(rows[0].amount).toBe("5000");
      expect(rows[1].email).toBe("bob@company.com");
    });

    it("returns empty arrays for empty or whitespace-only CSV", () => {
      expect(parseCsvText("").rows).toEqual([]);
      expect(parseCsvText("   \n\r\n").rows).toEqual([]);
    });
  });

  describe("parseDateToUnixSeconds", () => {
    it("converts YYYY-MM-DD to unix seconds", () => {
      const { timestamp, formattedDate, isValid } =
        parseDateToUnixSeconds("2026-09-01");
      expect(isValid).toBe(true);
      expect(formattedDate).toBe("2026-09-01");
      expect(timestamp).toBeGreaterThan(0);
    });

    it("handles invalid dates gracefully", () => {
      const res = parseDateToUnixSeconds("invalid-date");
      expect(res.isValid).toBe(false);
    });
  });

  describe("validatePayrollRow", () => {
    it("validates a correct standard row", () => {
      const row = {
        email: "alice@company.com",
        qp_id: "QP100000042",
        amount: "5000",
        token: "USDC",
        start_date: "2026-09-01",
        end_date: "2027-08-31",
      };

      const res = validatePayrollRow(row, 1);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.amount).toBe(5000);
      expect(res.token).toBe("USDC");
      expect(res.qpId).toBe("QP100000042");
    });

    it("converts hourly rate format to total amount", () => {
      const row = {
        email: "contractor@company.com",
        qp_id: "QP100000099",
        hourly_rate: "50",
        hours_per_week: "40",
        token: "USDC",
        start_date: "2026-09-01",
        end_date: "2026-09-29", // 4 weeks = 28 days
      };

      const res = validatePayrollRow(row, 1);
      expect(res.isValid).toBe(true);
      // 50 * 40 * 4 weeks = 8000
      expect(res.amount).toBe(8000);
    });

    it("flags validation errors for missing and invalid fields", () => {
      const invalidRow = {
        email: "not-an-email",
        qp_id: "INVALID_ID",
        amount: "-500",
        token: "DOGE",
        start_date: "2026-09-01",
        end_date: "2026-08-01", // end before start
      };

      const res = validatePayrollRow(invalidRow, 1);
      expect(res.isValid).toBe(false);
      expect(
        res.errors.some((e) => e.includes("Invalid QP ID format")),
      ).toBe(true);
      expect(
        res.errors.some((e) => e.includes("positive number")),
      ).toBe(true);
      expect(res.errors.some((e) => e.includes("Unsupported token"))).toBe(
        true,
      );
      expect(
        res.errors.some((e) => e.includes("end_date must be after start_date")),
      ).toBe(true);
      expect(res.warnings.some((w) => w.includes("Email"))).toBe(true);
    });
  });

  describe("parseAndValidatePayrollCsv", () => {
    it("parses, validates, calculates totals by token, and flags duplicates", () => {
      const csv = `email,qp_id,amount,token,start_date,end_date
alice@company.com,QP100000042,5000,USDC,2026-09-01,2027-08-31
bob@company.com,QP100000043,3000,USDC,2026-09-01,2027-08-31
charlie@company.com,QP100000044,1200,XLM,2026-09-01,2027-08-31
duplicate@company.com,QP100000042,1000,USDC,2026-09-01,2027-08-31`;

      const summary = parseAndValidatePayrollCsv(csv);
      expect(summary.totalRows).toBe(4);
      expect(summary.validCount).toBe(3);
      expect(summary.errorCount).toBe(1);
      expect(summary.duplicateQpIds).toContain("QP100000042");
      expect(summary.totalsByToken["USDC"]).toBe(8000);
      expect(summary.totalsByToken["XLM"]).toBe(1200);
    });

    it("handles 100+ rows rapidly without performance lag", () => {
      const rows: string[] = ["email,qp_id,amount,token,start_date,end_date"];
      for (let i = 1; i <= 150; i++) {
        rows.push(
          `emp${i}@company.com,QP1000000${i},${1000 + i},USDC,2026-09-01,2027-08-31`,
        );
      }
      const largeCsv = rows.join("\n");

      const t0 = performance.now();
      const summary = parseAndValidatePayrollCsv(largeCsv);
      const t1 = performance.now();

      expect(summary.totalRows).toBe(150);
      expect(summary.validCount).toBe(150);
      expect(t1 - t0).toBeLessThan(100); // under 100ms
    });
  });

  describe("exports", () => {
    it("generates CSV error report", () => {
      const summary = parseAndValidatePayrollCsv(
        `email,qp_id,amount,token,start_date,end_date\ninvalid@test.com,BAD_ID,100,USDC,2026-09-01,2027-08-31`,
      );
      const errorCsv = exportErrorsToCsv(summary.rows);
      expect(errorCsv).toContain("Row,QP ID,Email,Amount,Token");
      expect(errorCsv).toContain("BAD_ID");
      expect(errorCsv).toContain("Invalid QP ID format");
    });

    it("generates CSV batch summary report", () => {
      const summaryCsv = exportSummaryToCsv([
        {
          qpId: "QP100000042",
          email: "alice@company.com",
          amount: 5000,
          token: "USDC",
          workerAddress: "GA123",
          status: "success",
          txHash: "0xabcdef123456",
        },
      ]);
      expect(summaryCsv).toContain("QP100000042");
      expect(summaryCsv).toContain("SUCCESS");
      expect(summaryCsv).toContain("0xabcdef123456");
    });
  });
});
