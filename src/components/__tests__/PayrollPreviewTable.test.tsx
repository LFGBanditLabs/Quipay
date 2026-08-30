import React, { act } from "react";
import renderer from "react-test-renderer";
import { PayrollPreviewTable } from "../PayrollPreviewTable";
import { parseAndValidatePayrollCsv } from "../../lib/csvParser";

describe("PayrollPreviewTable Component", () => {
  const csv = `email,qp_id,amount,token,start_date,end_date
alice@company.com,QP100000042,5000,USDC,2026-09-01,2027-08-31
invalid@company.com,BAD_ID,3000,USDC,2026-09-01,2027-08-31`;

  const parsed = parseAndValidatePayrollCsv(csv);

  it("renders parsed rows with correct status indicators", async () => {
    const onUpdateRow = jest.fn();
    const onDeleteRow = jest.fn();
    const onDeleteInvalidRows = jest.fn();
    const onDownloadErrors = jest.fn();

    let testRenderer!: renderer.ReactTestRenderer;
    await act(async () => {
      testRenderer = renderer.create(
        <PayrollPreviewTable
          rows={parsed.rows}
          onUpdateRow={onUpdateRow}
          onDeleteRow={onDeleteRow}
          onDeleteInvalidRows={onDeleteInvalidRows}
          onDownloadErrors={onDownloadErrors}
        />,
      );
    });

    const inputs = testRenderer.root.findAllByType("input");
    const inputValues = inputs.map((i) => i.props.value);
    expect(inputValues).toContain("QP100000042");
    expect(inputValues).toContain("alice@company.com");

    const badges = testRenderer.root.findAllByType("span");
    const badgeTexts = badges.map((b) => b.children.join(""));
    expect(badgeTexts.some((t) => t.includes("Invalid QP ID format"))).toBe(
      true,
    );
  });

  it("triggers onDeleteRow when delete button clicked", async () => {
    const onUpdateRow = jest.fn();
    const onDeleteRow = jest.fn();
    const onDeleteInvalidRows = jest.fn();
    const onDownloadErrors = jest.fn();

    let testRenderer!: renderer.ReactTestRenderer;
    await act(async () => {
      testRenderer = renderer.create(
        <PayrollPreviewTable
          rows={parsed.rows}
          onUpdateRow={onUpdateRow}
          onDeleteRow={onDeleteRow}
          onDeleteInvalidRows={onDeleteInvalidRows}
          onDownloadErrors={onDownloadErrors}
        />,
      );
    });

    const deleteButtons = testRenderer.root.findAllByProps({
      title: "Delete row",
    });
    expect(deleteButtons.length).toBe(2);

    await act(async () => {
      deleteButtons[0].props.onClick();
    });

    expect(onDeleteRow).toHaveBeenCalledWith(parsed.rows[0].id);
  });
});
