import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../services/api";
import {
  Truck,
  ShieldCheck,
  ArrowRight,
  Lock,
  User,
  Mail,
  Building,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";

type AuthMode = "signin" | "signup" | "forgot_email" | "forgot_code" | "forgot_newpass";

export const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password visibility
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sign In state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Sign Up state
  const [regName, setRegName] = useState("");
  const [regTransportName, setRegTransportName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [receivedCode, setReceivedCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Standard email format validator
  const isValidEmailFormat = (email: string): boolean => {
    const clean = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(clean);
  };

  // 1. Handle Sign In
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      await login({ email: loginEmail.trim().toLowerCase(), password: loginPassword.trim() });
      toastSuccess("Welcome back to your Transport Dashboard!");
    } catch (err: any) {
      const msg = err.message || "Invalid email or password.";
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
    if (!regName.trim() || !regTransportName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setErrorMessage("Please fill out all required fields.");
      return;
    }
    if (regPassword.length < 4) {
      setErrorMessage("Password must be at least 4 characters.");
      return;
    }

    if (!isValidEmailFormat(regEmail)) {
      setErrorMessage("Please enter a valid email address.");
      toastError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: regName.trim(),
        company_name: regTransportName.trim(),
        email: regEmail.trim().toLowerCase(),
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

  // 3. Handle Forgot Password - Step 1: Send Code
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!forgotEmail.trim()) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.forgotPassword({ email: forgotEmail.trim().toLowerCase() });
      setReceivedCode(res.code || null);
      toastSuccess("6-digit verification code generated!");
      setMode("forgot_code");
    } catch (err: any) {
      const msg = err.message || "Invalid email: No account found with this email address.";
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Forgot Password - Step 2: Verify Code
  const handleVerifyResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!forgotCode.trim()) {
      setErrorMessage("Please enter the 6-digit verification code.");
      return;
    }
    setLoading(true);
    try {
      await api.verifyResetCode({
        email: forgotEmail.trim().toLowerCase(),
        code: forgotCode.trim(),
      });
      toastSuccess("Verification code confirmed. Set your new password.");
      setMode("forgot_newpass");
    } catch (err: any) {
      const msg = err.message || "Invalid verification code. Please check and try again.";
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend code
  const handleResendCode = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const res = await api.forgotPassword({ email: forgotEmail.trim().toLowerCase() });
      setReceivedCode(res.code || null);
      toastSuccess("New 6-digit verification code generated.");
    } catch (err: any) {
      toastError(err.message || "Failed to generate code.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Handle Forgot Password - Step 3: Save New Password
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
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword({
        email: forgotEmail.trim().toLowerCase(),
        code: forgotCode.trim(),
        newPassword: newPassword.trim(),
      });
      const successMsg = "Password reset successfully! Please sign in with your new password.";
      setSuccessBanner(successMsg);
      toastSuccess(successMsg);
      setLoginEmail(forgotEmail.trim().toLowerCase());
      setLoginPassword("");
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
    <div className="min-h-screen bg-[#09090b] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden text-zinc-100">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <Truck className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">
          Lorry TMS
        </h2>
        <p className="mt-1 text-center text-xs text-zinc-400">
          Fleet Operations, Trips, Expiries & Financials
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-[#18181b] border border-white/10 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 text-zinc-100">

          {/* Success Banner */}
          {successBanner && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-xs flex items-start gap-2.5 shadow-sm animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successBanner}</div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-300 text-xs flex items-start gap-2.5 shadow-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. SIGN IN VIEW */}
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
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="login-email-input"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="owner@transport.com"
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
                        setForgotEmail(loginEmail);
                        setMode("forgot_email");
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
          {/* 2. SIGN UP VIEW */}
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
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="reg-email-input"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="vinodhraja2007@gmail.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
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
                      className="w-full pl-9 pr-10 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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

                <button
                  id="signup-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
          {/* 3. FORGOT PASSWORD - STEP 1: ENTER EMAIL */}
          {/* ========================================================= */}
          {mode === "forgot_email" && (
            <div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white tracking-tight">Reset Password</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Enter your email to receive a 6-digit verification reset code
                </p>
              </div>

              <form onSubmit={handleSendResetCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="forgot-email-input"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="owner@transport.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <button
                  id="forgot-email-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? "Generating Code..." : "Get Reset Code"}
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
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Enter 6-Digit Code</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Verification code for <span className="text-zinc-200 font-medium">{forgotEmail}</span>
                </p>
              </div>

              {/* Code notification card */}
              {receivedCode && (
                <div className="mb-5 p-3 rounded-xl bg-blue-950/50 border border-blue-700/40 text-blue-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Code: <strong className="text-white font-mono text-sm tracking-widest">{receivedCode}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForgotCode(receivedCode)}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold cursor-pointer"
                  >
                    Fill Code
                  </button>
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
                    placeholder="123456"
                    className="w-full py-3 px-4 bg-zinc-900 border border-zinc-700 rounded-lg text-center font-mono text-xl tracking-[0.4em] text-white placeholder-zinc-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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

                <div className="flex flex-col gap-2.5 pt-3 text-xs border-t border-zinc-800 text-center">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      id="resend-code-btn"
                      onClick={handleResendCode}
                      disabled={loading}
                      className="text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Resend Code</span>
                    </button>

                    <button
                      type="button"
                      id="try-diff-email-btn"
                      onClick={() => {
                        setErrorMessage(null);
                        setForgotCode("");
                        setMode("forgot_email");
                      }}
                      className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      Try different email
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setMode("signin");
                    }}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center justify-center gap-1 cursor-pointer pt-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. FORGOT PASSWORD - STEP 3: RESET PASSWORD */}
          {/* ========================================================= */}
          {mode === "forgot_newpass" && (
            <div>
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Create New Password</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Set a new secure password for <span className="text-zinc-200 font-medium">{forgotEmail}</span>
                </p>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    New Password
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
                    Confirm New Password
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
                      className="w-full pl-9 pr-10 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
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
              <span>Secure Dedicated Email & Password Authentication</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
