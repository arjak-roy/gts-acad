type TwoFactorDemoTemplateInput = {
  appName: string;
  recipientName: string;
  code: string;
  expiresInMinutes: number;
  purposeLabel?: string;
};

export function renderTwoFactorDemoTemplate({
  appName,
  recipientName,
  code,
  expiresInMinutes,
  purposeLabel = "sign in",
}: TwoFactorDemoTemplateInput) {
  const subject = `${appName} verification code`;
  const text = [
    `Hello ${recipientName},`,
    "",
    `Use the verification code below to ${purposeLabel}:`,
    "",
    code,
    "",
    `This code expires in ${expiresInMinutes} minutes.`,
    "If you did not request this code, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
        <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">${appName}</p>
        <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Verification code</h1>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #334155;">Hello ${recipientName}, use the code below to ${purposeLabel}.</p>
        <div style="margin: 0 0 24px; border-radius: 18px; background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; text-align: center;">
          <div style="font-size: 30px; font-weight: 800; letter-spacing: 0.4em; color: #0f172a;">${code}</div>
        </div>
        <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #475569;">This code expires in ${expiresInMinutes} minutes.</p>
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">If you did not request this code, you can ignore this email.</p>
      </div>
    </div>
  `;

  return { subject, text, html };
}
