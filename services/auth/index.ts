import "server-only";

export { loginWithPassword, resendLoginTwoFactor, verifyLoginTwoFactor, verifyRecoveryCode } from "@/services/auth/login";
export { changeAuthenticatedPassword, requestPasswordReset, resetPasswordWithToken } from "@/services/auth/password-reset";
export { startTwoFactorSetup, verifyTwoFactorSetup } from "@/services/auth/two-factor-setup";
export { sendDemoTwoFactorMail } from "@/services/auth/demo";

export type { AuthUser, LoginResult, PasswordResetRequestMetadata } from "@/services/auth/internal-helpers";
export { PASSWORD_RESET_TOKEN_MIN_PASSWORD_LENGTH } from "@/services/auth/internal-helpers";
