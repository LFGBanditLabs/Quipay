import axios from "axios";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const SENDGRID_FROM_EMAIL =
  process.env.SENDGRID_FROM_EMAIL || "noreply@quipay.com";

export interface PayrollReportData {
  employerId: string;
  periodStart: Date;
  periodEnd: Date;
  totalPaid: string;
  activeStreams: number;
  completedStreams: number;
  workers: Array<{
    workerAddress: string;
    totalReceived: string;
    streamCount: number;
  }>;
}

/**
 * Send payroll report via email using SendGrid
 */
export const sendPayrollReportEmail = async (
  to: string,
  report: PayrollReportData,
): Promise<boolean> => {
  if (!SENDGRID_API_KEY) {
    console.warn("[Email] SendGrid API key not configured, skipping email");
    return false;
  }

  try {
    const htmlContent = generateReportHTML(report);

    await axios.post(
      "https://api.sendgrid.com/v3/mail/send",
      {
        personalizations: [
          {
            to: [{ email: to }],
            subject: `Payroll Report - ${report.periodStart.toLocaleDateString()} to ${report.periodEnd.toLocaleDateString()}`,
          },
        ],
        from: { email: SENDGRID_FROM_EMAIL, name: "Quipay Payroll" },
        content: [{ type: "text/html", value: htmlContent }],
      },
      {
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log(`[Email] Payroll report sent to ${to}`);
    return true;
  } catch (error: any) {
    console.error(`[Email] Failed to send payroll report:`, error.message);
    return false;
  }
};

/**
 * Generate HTML report for email
 */
const generateReportHTML = (report: PayrollReportData): string => {
  const workerRows = report.workers
    .map(
      (w) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${w.workerAddress.slice(0, 6)}...${w.workerAddress.slice(-4)}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${w.totalReceived}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${w.streamCount}</td>
      </tr>
    `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #007bff; color: white; padding: 20px; text-align: center; }
    .summary { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #007bff; color: white; padding: 10px; text-align: left; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payroll Report</h1>
      <p>${report.periodStart.toLocaleDateString()} - ${report.periodEnd.toLocaleDateString()}</p>
    </div>
    
    <div class="summary">
      <h2>Summary</h2>
      <p><strong>Total Paid:</strong> ${report.totalPaid} XLM</p>
      <p><strong>Active Streams:</strong> ${report.activeStreams}</p>
      <p><strong>Completed Streams:</strong> ${report.completedStreams}</p>
    </div>
    
    <h2>Worker Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Worker</th>
          <th>Total Received</th>
          <th>Streams</th>
        </tr>
      </thead>
      <tbody>
        ${workerRows}
      </tbody>
    </table>
    
    <div class="footer">
      <p>This is an automated report from Quipay Payroll System.</p>
      <p>To unsubscribe from these reports, please contact your administrator.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};
