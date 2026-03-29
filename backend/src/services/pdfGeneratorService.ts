import PDFDocument from "pdfkit";
import { generateQRCode } from "./signatureService";
import {
  logServiceInfo,
  logServiceWarn,
  logServiceError,
} from "../audit/serviceLogger";

export interface StreamRecord {
  stream_id: number;
  employer: string;
  worker: string;
  total_amount: string;
  withdrawn_amount: string;
  start_ts: number;
  end_ts: number;
  status: string;
  created_at: Date;
}

export interface WithdrawalRecord {
  id: number;
  stream_id: number;
  worker: string;
  amount: string;
  ledger: number;
  ledger_ts: number;
  created_at: Date;
}

export interface BrandingSettings {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

export interface GeneratePayslipParams {
  streamId: number;
  streamData: StreamRecord;
  withdrawals: WithdrawalRecord[];
  branding: BrandingSettings;
  signature: string;
  payslipId: string;
  generatedAt: Date;
}

/**
 * Generate a PDF payslip for a given stream
 */
export async function generatePayslip(
  params: GeneratePayslipParams,
): Promise<Buffer> {
  const {
    streamId,
    streamData,
    withdrawals,
    branding,
    signature,
    payslipId,
    generatedAt,
  } = params;

  logServiceInfo("pdfGenerator", "Generating payslip", {
    streamId,
    payslipId,
    workerAddress: streamData.worker,
    employerAddress: streamData.employer,
  });

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => {
        logServiceError("pdfGenerator", "PDF generation failed", {
          error: err.message,
          streamId,
          payslipId,
        });
        reject(err);
      });

      // Generate QR code for signature
      let qrCodeBuffer: Buffer | null = null;
      try {
        qrCodeBuffer = await generateQRCode(signature);
      } catch (err) {
        logServiceWarn("pdfGenerator", "QR code generation failed", {
          error: err instanceof Error ? err.message : String(err),
          streamId,
        });
      }

      // Fetch logo if available
      let logoBuffer: Buffer | null = null;
      if (branding.logoUrl) {
        try {
          // In a real implementation, fetch from S3
          // For now, we'll handle graceful degradation
          logServiceInfo("pdfGenerator", "Logo URL provided", {
            logoUrl: branding.logoUrl,
          });
        } catch (err) {
          logServiceWarn("pdfGenerator", "Logo retrieval failed", {
            error: err instanceof Error ? err.message : String(err),
            logoUrl: branding.logoUrl,
            streamId,
          });
        }
      }

      // Header with branding
      addHeader(doc, branding, logoBuffer);

      // Payslip title
      doc
        .fontSize(20)
        .fillColor(branding.primaryColor)
        .text("PAYSLIP", { align: "center" })
        .moveDown();

      // Payslip metadata
      doc
        .fontSize(10)
        .fillColor("#000000")
        .text(`Payslip ID: ${payslipId}`, { align: "right" })
        .text(`Generated: ${generatedAt.toISOString()}`, { align: "right" })
        .moveDown();

      // Worker and Employer information
      addPartyInformation(doc, streamData, branding);

      // Stream details
      addStreamDetails(doc, streamData, branding);

      // Withdrawal history
      addWithdrawalHistory(doc, withdrawals, branding);

      // Signature section
      addSignatureSection(doc, signature, qrCodeBuffer, branding);

      // Footer
      addFooter(doc);

      doc.end();
    } catch (err) {
      logServiceError(
        "pdfGenerator",
        "Unexpected error during PDF generation",
        {
          error: err instanceof Error ? err.message : String(err),
          streamId,
          payslipId,
        },
      );
      reject(err);
    }
  });
}

function addHeader(
  doc: PDFKit.PDFDocument,
  branding: BrandingSettings,
  logoBuffer: Buffer | null,
): void {
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, 45, { width: 100 });
    } catch (err) {
      logServiceWarn("pdfGenerator", "Failed to embed logo in PDF", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  doc
    .fontSize(12)
    .fillColor(branding.secondaryColor)
    .text("Quipay Payment Stream", 200, 50, { align: "right" })
    .moveDown(2);
}

function addPartyInformation(
  doc: PDFKit.PDFDocument,
  streamData: StreamRecord,
  branding: BrandingSettings,
): void {
  const startY = doc.y;

  // Worker information (left column)
  doc
    .fontSize(12)
    .fillColor(branding.primaryColor)
    .text("Worker", 50, startY)
    .fontSize(10)
    .fillColor("#000000")
    .text(streamData.worker, 50, startY + 20, { width: 200 });

  // Employer information (right column)
  doc
    .fontSize(12)
    .fillColor(branding.primaryColor)
    .text("Employer", 300, startY)
    .fontSize(10)
    .fillColor("#000000")
    .text(streamData.employer, 300, startY + 20, { width: 200 });

  doc.moveDown(3);
}

function addStreamDetails(
  doc: PDFKit.PDFDocument,
  streamData: StreamRecord,
  branding: BrandingSettings,
): void {
  doc
    .fontSize(14)
    .fillColor(branding.primaryColor)
    .text("Payment Stream Details")
    .moveDown(0.5);

  const startY = doc.y;
  const leftX = 50;
  const rightX = 300;
  const lineHeight = 20;

  // Left column
  doc
    .fontSize(10)
    .fillColor("#666666")
    .text("Stream ID:", leftX, startY)
    .fillColor("#000000")
    .text(streamData.stream_id.toString(), leftX + 100, startY);

  doc
    .fillColor("#666666")
    .text("Total Amount:", leftX, startY + lineHeight)
    .fillColor("#000000")
    .text(
      formatAmount(streamData.total_amount),
      leftX + 100,
      startY + lineHeight,
    );

  doc
    .fillColor("#666666")
    .text("Withdrawn Amount:", leftX, startY + lineHeight * 2)
    .fillColor("#000000")
    .text(
      formatAmount(streamData.withdrawn_amount),
      leftX + 100,
      startY + lineHeight * 2,
    );

  // Right column
  doc
    .fillColor("#666666")
    .text("Start Date:", rightX, startY)
    .fillColor("#000000")
    .text(formatTimestamp(streamData.start_ts), rightX + 100, startY);

  doc
    .fillColor("#666666")
    .text("End Date:", rightX, startY + lineHeight)
    .fillColor("#000000")
    .text(
      formatTimestamp(streamData.end_ts),
      rightX + 100,
      startY + lineHeight,
    );

  doc
    .fillColor("#666666")
    .text("Status:", rightX, startY + lineHeight * 2)
    .fillColor("#000000")
    .text(streamData.status, rightX + 100, startY + lineHeight * 2);

  doc.moveDown(3);
}

function addWithdrawalHistory(
  doc: PDFKit.PDFDocument,
  withdrawals: WithdrawalRecord[],
  branding: BrandingSettings,
): void {
  doc
    .fontSize(14)
    .fillColor(branding.primaryColor)
    .text("Withdrawal History")
    .moveDown(0.5);

  if (withdrawals.length === 0) {
    doc
      .fontSize(10)
      .fillColor("#666666")
      .text("No withdrawals recorded")
      .moveDown(2);
    return;
  }

  // Table header
  const tableTop = doc.y;
  const colWidths = { date: 120, amount: 120, ledger: 120 };
  const leftMargin = 50;

  doc
    .fontSize(10)
    .fillColor("#FFFFFF")
    .rect(leftMargin, tableTop, 495, 20)
    .fill(branding.primaryColor);

  doc
    .fillColor("#FFFFFF")
    .text("Date", leftMargin + 5, tableTop + 5, { width: colWidths.date })
    .text("Amount", leftMargin + colWidths.date + 5, tableTop + 5, {
      width: colWidths.amount,
    })
    .text(
      "Ledger",
      leftMargin + colWidths.date + colWidths.amount + 5,
      tableTop + 5,
      {
        width: colWidths.ledger,
      },
    );

  // Table rows
  let currentY = tableTop + 25;
  withdrawals.forEach((withdrawal, index) => {
    const bgColor = index % 2 === 0 ? "#F9FAFB" : "#FFFFFF";
    doc.rect(leftMargin, currentY, 495, 20).fill(bgColor);

    doc
      .fillColor("#000000")
      .text(
        formatTimestamp(withdrawal.ledger_ts),
        leftMargin + 5,
        currentY + 5,
        {
          width: colWidths.date,
        },
      )
      .text(
        formatAmount(withdrawal.amount),
        leftMargin + colWidths.date + 5,
        currentY + 5,
        { width: colWidths.amount },
      )
      .text(
        withdrawal.ledger.toString(),
        leftMargin + colWidths.date + colWidths.amount + 5,
        currentY + 5,
        { width: colWidths.ledger },
      );

    currentY += 20;
  });

  doc.y = currentY + 10;
  doc.moveDown(2);
}

function addSignatureSection(
  doc: PDFKit.PDFDocument,
  signature: string,
  qrCodeBuffer: Buffer | null,
  branding: BrandingSettings,
): void {
  doc
    .fontSize(14)
    .fillColor(branding.primaryColor)
    .text("Cryptographic Signature")
    .moveDown(0.5);

  if (!signature) {
    doc
      .fontSize(10)
      .fillColor("#DC2626")
      .text("Signature unavailable")
      .moveDown(2);
    return;
  }

  // QR code
  if (qrCodeBuffer) {
    try {
      doc.image(qrCodeBuffer, 50, doc.y, { width: 100 });
    } catch (err) {
      logServiceWarn("pdfGenerator", "Failed to embed QR code in PDF", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Signature text
  doc
    .fontSize(8)
    .fillColor("#000000")
    .text("Signature:", 170, doc.y)
    .text(signature, 170, doc.y + 15, { width: 350 })
    .moveDown(2);

  doc
    .fontSize(8)
    .fillColor("#666666")
    .text(
      "This payslip is cryptographically signed. Verify authenticity at /verify-signature",
      50,
      doc.y,
      { width: 495, align: "center" },
    )
    .moveDown();
}

function addFooter(doc: PDFKit.PDFDocument): void {
  const pageHeight = doc.page.height;
  doc
    .fontSize(8)
    .fillColor("#666666")
    .text(
      "This is a computer-generated document. No signature is required.",
      50,
      pageHeight - 50,
      { align: "center", width: 495 },
    );
}

function formatAmount(amount: string): string {
  // Convert stroops to XLM (1 XLM = 10,000,000 stroops)
  const xlm = parseFloat(amount) / 10000000;
  return `${xlm.toFixed(7)} XLM`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split("T")[0];
}
