import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../services/api";
import {
  Truck,
  ShieldCheck,
  ArrowRight,
  Lock,
  User,
  Building,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowLeft,
  RefreshCw,
  Phone,
  Smartphone,
  Info,
} from "lucide-react";

type AuthMode = "signin" | "signup" | "forgot_phone" | "forgot_code" | "forgot_newpass";

export const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sign In state (Username & Password)
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Sign Up state (Full Name, Company Name, Username, Phone, Password, Re-enter Password)
  const [regName, setRegName] = useState("");
  const [regTransportName, setRegTransportName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // Forgot Password state (Phone Number, 6-digit code, New Password, Re-enter Password)
  const [forgotPhone, setForgotPhone] = useState("");
  const [targetPhoneFormatted, setTargetPhoneFormatted] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [smsNotice, setSmsNotice] = useState<string | null>(null);

  // Countdown timer for 60-second OTP resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // 1. Handle Sign In
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setErrorMessage("Please enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      await login({ username: loginUsername.trim(), password: loginPassword.trim() });
      toastSuccess("Welcome back to your Transport Dashboard!");
    } catch (err: any) {
      const msg = err.message || "Invalid username or password.";
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Sign Up
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (
      !regName.trim() ||
      !regTransportName.trim() ||
      !regUsername.trim() ||
      !regPhone.trim() ||
      !regPassword.trim() ||
      !regConfirmPassword.trim()
    ) {
      setErrorMessage("Please fill out all required fields.");
      return;
    }

    if (regUsername.trim().length < 3) {
      setErrorMessage("Username must be at least 3 characters long.");
      return;
    }

    const phoneDigits = regPhone.replace(/\D/g, "");
    if (phoneDigits.length < 7) {
      setErrorMessage("Please enter a valid phone number (at least 7 to 10 digits).");
      return;
    }

    if (regPassword.length < 4) {
      setErrorMessage("Password must be at least 4 characters.");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      toastError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: regName.trim(),
        company_name: regTransportName.trim(),
        username: regUsername.trim(),
        phone: regPhone.trim(),
        password: regPassword.trim(),
      });

      const successMsg = "Account created successfully! Logged in to your transport fleet.";
      setSuccessBanner(successMsg);
      toastSuccess(successMsg);
    } catch (err: any) {
      const msg = err.message || "Registration failed. Please try again.";
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Forgot Password - Step 1: Send 6-Digit Code to Phone Number via SMS
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!forgotPhone.trim()) {
      setErrorMessage("Please enter your registered phone number.");
      return;
    }
    const digits = forgotPhone.replace(/\D/g, "");
    if (digits.length < 7) {
      setErrorMessage("Please enter a valid registered phone number (at least 7 to 10 digits).");
      return;
    }

    setLoading(true);
    try {
      const res = await api.forgotPassword({ phone: forgotPhone.trim() });
      setTargetPhoneFormatted(res.phone || forgotPhone);
      setResendCooldown(60);
      if (res.devOtp) {
        setDemoCode(res.devOtp);
        setForgotCode(res.devOtp);
        setSmsNotice(res.note || "Twilio SMS credentials are not configured in settings. A demo verification code has been auto-filled below.");
        toastSuccess(`Demo Verification Code: ${res.devOtp} (Auto-filled)`);
      } else {
        setDemoCode(null);
        setSmsNotice(null);
        toastSuccess(`6-digit verification code sent via SMS to ${res.phone || forgotPhone}!`);
      }
      setMode("forgot_code");
    } catch (err: any) {
      const msg = err.message || "No registered account found with this phone number.";
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Forgot Password - Step 2: Verify 6-Digit Code
  const handleVerifyResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!forgotCode.trim()) {
      setErrorMessage("Please enter the 6-digit verification code.");
      return;
    }
    if (forgotCode.trim().length !== 6) {
      setErrorMessage("Invalid code. Please enter exactly 6 digits.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyResetCode({
        phone: forgotPhone.trim(),
        code: forgotCode.trim(),
      });
      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
      toastSuccess("Verification code verified! Please set your new password.");
      setMode("forgot_newpass");
    } catch (err: any) {
      const msg = err.message || "Invalid verification code. Please check your SMS and try again.";
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend 6-Digit Code via SMS
  const handleResendCode = async () => {
    if (resendCooldown > 0) {
      toastError(`Please wait ${resendCooldown} seconds before requesting another code.`);
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    try {
      const res = await api.forgotPassword({ phone: forgotPhone.trim() });
      setTargetPhoneFormatted(res.phone || forgotPhone);
      setResendCooldown(60);
      if (res.devOtp) {
        setDemoCode(res.devOtp);
        setForgotCode(res.devOtp);
        setSmsNotice(res.note || "Twilio SMS credentials are not configured in settings. A new demo verification code has been auto-filled below.");
        toastSuccess(`New Demo Verification Code: ${res.devOtp}`);
      } else {
        setDemoCode(null);
        setSmsNotice(null);
        toastSuccess(`New 6-digit verification code sent via SMS to ${res.phone || forgotPhone}.`);
      }
    } catch (err: any) {
      toastError(err.message || "Failed to resend verification code.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Handle Forgot Password - Step 3: Set Password & Re-enter Password (Dual-Write Sync)
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!newPassword.trim()) {
      setErrorMessage("Please enter a new password.");
      return;
    }
    if (newPassword.length < 4) {
      setErrorMessage("Password must be at least 4 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      toastError("Passwords do not match. Please re-enter.");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword({
        phone: forgotPhone.trim(),
        resetToken: resetToken || undefined,
        code: forgotCode.trim(),
        newPassword: newPassword.trim(),
      });
      const successMsg = "Password reset successfully! Please sign in with your new password.";
      setSuccessBanner(successMsg);
      toastSuccess(successMsg);
      setLoginUsername(forgotPhone.trim());
      setLoginPassword("");
      setResetToken(null);
      setForgotCode("");
      setMode("signin");
    } catch (err: any) {
      const msg = err.message || "Failed to reset password. Please restart the reset process.";
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col justify-center py-6 sm:py-12 px-3 sm:px-6 lg:px-8 relative overflow-hidden text-zinc-100">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <Truck className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
        </div>
        <h2 className="mt-3 sm:mt-4 text-center text-xl sm:text-2xl font-bold tracking-tight text-white">
          Lorry TMS
        </h2>
        <p className="mt-0.5 sm:mt-1 text-center text-[11px] sm:text-xs text-zinc-400">
          Fleet Operations, Trips, Expiries & Financials
        </p>
      </div>

      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 w-full">
        <div className="bg-[#18181b] border border-white/10 p-4 sm:p-8 sm:px-10 shadow-2xl rounded-2xl text-zinc-100">

          {/* Success Banner */}
          {successBanner && (
            <div className="mb-4 sm:mb-5 p-3 sm:p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-xs flex items-start gap-2.5 shadow-sm animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successBanner}</div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-4 sm:mb-5 p-3 sm:p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-300 text-xs flex items-start gap-2.5 shadow-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. SIGN IN VIEW (Username & Password) */}
          {/* ========================================================= */}
          {mode === "signin" && (
            <div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white tracking-tight">Sign In</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Access your transport management fleet and reports
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="login-username-input"
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Enter your username"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-zinc-300">
                      Password
                    </label>
                    <button
                      type="button"
                      id="forgot-password-link-btn"
                      onClick={() => {
                        setErrorMessage(null);
                        setForgotPhone("");
                        setMode("forgot_phone");
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="login-password-input"
                      type={showLoginPassword ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      id="toggle-login-password-btn"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 focus:outline-hidden cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  id="signin-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? "Signing In..." : "Sign In"}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="text-center pt-3 border-t border-zinc-800 text-xs text-zinc-400">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    id="switch-to-signup-btn"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessBanner(null);
                      setMode("signup");
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer ml-1"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. SIGN UP VIEW (Name, Company, Username, Phone, Password, Re-enter Password) */}
          {/* ========================================================= */}
          {mode === "signup" && (
            <div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white tracking-tight">Create Account</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Start managing your transport lorries, trips and finances
                </p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Your Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="reg-name-input"
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Vinodh Raja"
                      className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Transport Company Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Building className="w-4 h-4" />
                    </div>
                    <input
                      id="reg-transport-input"
                      type="text"
                      required
                      value={regTransportName}
                      onChange={(e) => setRegTransportName(e.target.value)}
                      placeholder="SRI TRANSPORT"
                      className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        id="reg-username-input"
                        type="text"
                        required
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="vinodhraja"
                        className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        id="reg-phone-input"
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="98949 03533"
                        className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reg-password-input"
                      type={showRegPassword ? "text" : "password"}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      id="toggle-reg-password-btn"
                      onClick={() => setShowRegPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 focus:outline-hidden cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Re-enter Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reg-confirm-password-input"
                      type={showRegConfirmPassword ? "text" : "password"}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-9 pr-10 py-2 bg-zinc-900 border ${
                        regConfirmPassword && regPassword !== regConfirmPassword
                          ? "border-rose-500 focus:ring-rose-500"
                          : "border-zinc-700 focus:ring-blue-500"
                      } rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:border-transparent transition-all`}
                    />
                    <button
                      type="button"
                      id="toggle-reg-confirm-password-btn"
                      onClick={() => setShowRegConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 focus:outline-hidden cursor-pointer"
                    >
                      {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {regConfirmPassword && regPassword !== regConfirmPassword && (
                    <p className="text-[11px] text-rose-400 mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  id="signup-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-3 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="text-center pt-3 border-t border-zinc-800 text-xs text-zinc-400">
                  Already have an account?{" "}
                  <button
                    type="button"
                    id="switch-to-signin-btn"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessBanner(null);
                      setMode("signin");
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer ml-1"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. FORGOT PASSWORD - STEP 1: ENTER PHONE NUMBER */}
          {/* ========================================================= */}
          {mode === "forgot_phone" && (
            <div>
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Forgot Password</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Enter your registered mobile phone number (e.g. 9363645124) to verify and reset your password
                </p>
              </div>

              <form onSubmit={handleSendResetCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Registered Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      id="forgot-phone-input"
                      type="tel"
                      required
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="e.g. 9894903533"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <button
                  id="forgot-phone-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? "Sending Code..." : "Send 6-Digit Code"}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="text-center pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setMode("signin");
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. FORGOT PASSWORD - STEP 2: ENTER 6-DIGIT CODE */}
          {/* ========================================================= */}
          {mode === "forgot_code" && (
            <div>
              <div className="mb-5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Enter Verification Code</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  A 6-digit verification code has been sent via SMS to your registered mobile phone <span className="text-zinc-200 font-semibold">{targetPhoneFormatted || forgotPhone}</span>
                </p>
              </div>

              {/* SMS Dispatch Notice / Sandbox Fallback */}
              {demoCode ? (
                <div className="mb-5 p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs shadow-inner">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-medium text-xs">Sandbox Mode (Twilio Unconfigured)</p>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-semibold">
                          Demo OTP
                        </span>
                      </div>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        Twilio credentials (Account SID starting with &apos;AC&apos;) are not configured in settings. A demo verification code has been generated and auto-filled below for immediate access:
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="font-mono text-base font-bold text-amber-200 bg-amber-900/60 px-2.5 py-1 rounded border border-amber-600/40 tracking-wider">
                          {demoCode}
                        </span>
                        <span className="text-[11px] text-zinc-400">(Ready to verify below)</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-5 p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/40 text-blue-300 text-xs shadow-inner">
                  <div className="flex items-start gap-3">
                    <Smartphone className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-white font-medium text-xs">SMS Verification Dispatched</p>
                      <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                        A 6-digit verification code has been sent via SMS to your registered mobile{" "}
                        <span className="text-zinc-200 font-semibold">{targetPhoneFormatted || forgotPhone}</span>.
                        This code is valid for 5 minutes.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleVerifyResetCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="verify-code-input"
                    type="text"
                    required
                    maxLength={6}
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    className="w-full py-3 px-2 sm:px-4 bg-zinc-900 border border-zinc-700 rounded-lg text-center font-mono text-xl sm:text-2xl tracking-[0.25em] sm:tracking-[0.4em] text-white placeholder-zinc-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <button
                  id="verify-code-submit-btn"
                  type="submit"
                  disabled={loading || forgotCode.length !== 6}
                  className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? "Verifying..." : "Verify Code"}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex flex-col gap-2.5 pt-4 text-xs border-t border-zinc-800 text-center">
                  <div className="flex flex-col xs:flex-row items-center justify-between gap-2">
                    <button
                      type="button"
                      id="resend-code-btn"
                      onClick={handleResendCode}
                      disabled={loading || resendCooldown > 0}
                      className="text-blue-400 hover:text-blue-300 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                      <span>{resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : "Resend Code"}</span>
                    </button>

                    <button
                      type="button"
                      id="try-diff-phone-btn"
                      onClick={() => {
                        setErrorMessage(null);
                        setForgotCode("");
                        setMode("forgot_phone");
                      }}
                      className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      Change Phone Number
                    </button>
                  </div>

                  <button
                    type="button"
                    id="back-to-signin-btn-code"
                    onClick={() => {
                      setErrorMessage(null);
                      setMode("signin");
                    }}
                    className="text-zinc-500 hover:text-zinc-400 text-center pt-2 transition-colors cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. FORGOT PASSWORD - STEP 3: RESET PASSWORD & RE-ENTER */}
          {/* ========================================================= */}
          {mode === "forgot_newpass" && (
            <div>
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Set New Password</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Create a new password for account linked to <span className="text-zinc-200 font-medium">{forgotPhone}</span>
                </p>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reset-new-password-input"
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      id="toggle-new-password-btn"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 focus:outline-hidden cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Re-enter Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reset-confirm-password-input"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-9 pr-10 py-2.5 bg-zinc-900 border ${
                        confirmPassword && newPassword !== confirmPassword
                          ? "border-rose-500 focus:ring-rose-500"
                          : "border-zinc-700 focus:ring-emerald-500"
                      } rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:border-transparent transition-all`}
                    />
                    <button
                      type="button"
                      id="toggle-confirm-password-btn"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 focus:outline-hidden cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[11px] text-rose-400 mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  id="reset-password-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? "Updating Password..." : "Reset Password & Sign In"}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setMode("signin");
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Footer Security Badge */}
          <div className="mt-8 pt-4 border-t border-zinc-800 text-center text-xs text-zinc-500">
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Secure Transport Management Authentication</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
