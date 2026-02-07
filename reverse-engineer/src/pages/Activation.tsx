import { useState, useCallback, useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { useIPC } from "../contexts/ipc-context";
import { BACKEND_HOSTNAME } from "../lib/environment";
import { getRequestOrigin } from "../lib/utils";
import { platform } from "../platform";

interface ActivationProps {
  onActivation: () => void;
}

type ActivationStep = "email" | "code";

const RESEND_COOLDOWN_SECONDS = 60;

export const Activation: React.FC<ActivationProps> = ({ onActivation }) => {
  const { ipc, isReady } = useIPC();
  const posthog = usePostHog();
  const baseUri = getRequestOrigin();

  const [step, setStep] = useState<ActivationStep>("email");
  const [email, setEmail] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [fetching, setFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [resendCountdown, setResendCountdown] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer effect
  useEffect(() => {
    if (resendCountdown > 0) {
      countdownRef.current = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [resendCountdown]);

  const handleRequestCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!email) {
        setError("Please enter your email address");
        return;
      }

      setFetching(true);
      setError(undefined);

      try {
        const res = await fetch(
          `${BACKEND_HOSTNAME}/public/activation/request`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
          },
        );

        if (!res.ok) {
          if (res.headers.get("content-type")?.includes("application/json")) {
            const data: { message: string } = await res.json();
            setError(data.message);
          } else {
            setError(await res.text());
          }
        } else {
          setError(undefined);
          setStep("code");
          setResendCountdown(RESEND_COOLDOWN_SECONDS);
        }
      } catch {
        setError("Failed to send activation code. Please try again.");
      } finally {
        setFetching(false);
      }
    },
    [email],
  );

  const handleResendCode = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (resendCountdown > 0 || fetching) return;

      setFetching(true);
      setError(undefined);

      try {
        const res = await fetch(
          `${BACKEND_HOSTNAME}/public/activation/request`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
          },
        );

        if (!res.ok) {
          if (res.headers.get("content-type")?.includes("application/json")) {
            const data: { message: string } = await res.json();
            setError(data.message);
          } else {
            setError(await res.text());
          }
        } else {
          setError(undefined);
          setResendCountdown(RESEND_COOLDOWN_SECONDS);
        }
      } catch {
        setError("Failed to resend activation code. Please try again.");
      } finally {
        setFetching(false);
      }
    },
    [email, resendCountdown, fetching],
  );

  const handleVerifyCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!ipc || !isReady) {
        setError("Pencil didn't initialize properly, please try again.");
        return;
      }

      if (!code) {
        setError("Please enter the activation code");
        return;
      }

      setFetching(true);
      setError(undefined);

      try {
        const res = await fetch(
          `${BACKEND_HOSTNAME}/public/activation/verify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, code }),
          },
        );

        if (!res.ok) {
          if (res.headers.get("content-type")?.includes("application/json")) {
            const data: { message: string } = await res.json();
            setError(data.message);
          } else {
            setError(await res.text());
          }
        } else {
          const data: { email: string; licenseToken: string } =
            await res.json();
          setError(undefined);

          // Save license with signed token
          ipc.notify<{ email: string; licenseToken: string }>("set-license", {
            email: data.email,
            licenseToken: data.licenseToken,
          });

          posthog.identify(data.email, {
            email: data.email,
          });

          posthog.register({
            client: platform.isElectron ? "desktop" : "extension",
          });

          posthog.capture("session-start");

          onActivation();
        }
      } catch {
        setError("Failed to verify activation code. Please try again.");
      } finally {
        setFetching(false);
      }
    },
    [email, code, ipc, isReady, posthog, onActivation],
  );

  const handleBackToEmail = useCallback(() => {
    setStep("email");
    setCode("");
    setError(undefined);
  }, []);

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newCode = e.target.value.replace(/\D/g, "").slice(0, 6);
      setCode(newCode);

      // Auto-submit when 6 digits are entered (e.g., paste)
      if (newCode.length === 6 && !fetching && ipc && isReady) {
        // Use setTimeout to allow state to update before submitting
        setTimeout(() => {
          const form = e.target.closest("form");
          if (form) {
            form.requestSubmit();
          }
        }, 50);
      }
    },
    [fetching, ipc, isReady],
  );

  return (
    <div
      role="alertdialog"
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 opacity-100 backdrop-blur-sm bg-black/50`}
      onMouseMove={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div
        className={`bg-white shadow-2xl w-[480px] mx-4 max-h-[90vh] flex flex-col transition-all duration-200 translate-y-0 opacity-100`}
        style={{
          // @ts-expect-error - cornerShape is a non-standard CSS property
          cornerShape: platform.isElectron ? "squircle" : "round",
          borderRadius: platform.isElectron ? "80px" : "32px",
        }}
      >
        {/* Form */}
        <form
          onSubmit={step === "email" ? handleRequestCode : handleVerifyCode}
          className="flex flex-col p-10 gap-4"
          autoComplete="off"
          data-1p-ignore
        >
          {/* Header with Logo and Headline */}
          <div className="flex flex-col items-center gap-8">
            {/* Logo */}
            <img
              src={`${baseUri}images/512x512.png`}
              alt="Pencil Logo"
              className="w-[128px] h-[128px]"
            />

            {/* Headline */}
            <h2 className="text-[30px] font-semibold text-[#05331c] leading-[1.2] font-sans">
              {step === "email" ? "Activate Pencil" : "Enter Activation Code"}
            </h2>

            {/* Subtitle for code step */}
            {step === "code" && (
              <p className="text-[14px] text-gray-600 text-center -mt-4">
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
            )}
          </div>

          {/* Error Message */}
          <div
            className={`transition-all duration-200 overflow-hidden ${
              error ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[13px] leading-tight">
                {error}
              </div>
            )}
          </div>

          {/* Inputs and Button Wrapper */}
          <div className="flex flex-col gap-4">
            {/* Fields */}
            <div className="flex flex-col gap-3">
              {step === "email" ? (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="email"
                    className="text-[14px] font-normal text-[#05331c] leading-[1.5] font-sans"
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    required
                    autoComplete="off"
                    data-1p-ignore
                    className="h-[52px] px-4 border border-[#c5cfc9] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#64927b] focus:border-transparent text-base text-[#05331c] placeholder:text-[#adadb2] transition-all font-sans"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="code"
                    className="text-[14px] font-normal text-[#05331c] leading-[1.5] font-sans"
                  >
                    Activation Code
                  </label>
                  <input
                    type="text"
                    id="code"
                    value={code}
                    onChange={handleCodeChange}
                    placeholder="123456"
                    required
                    autoComplete="off"
                    data-1p-ignore
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="h-[52px] px-4 border border-[#c5cfc9] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#64927b] focus:border-transparent text-base text-[#05331c] placeholder:text-[#adadb2] transition-all font-sans text-center tracking-[0.5em] text-xl"
                  />
                </div>
              )}
            </div>

            {/* Button */}
            <button
              type="submit"
              className="h-[52px] px-6 py-3 rounded-lg bg-[#222222] hover:bg-[#666666] text-white font-medium text-[15px] tracking-wide transition-colors relative disabled:opacity-80 disabled:cursor-not-allowed font-sans leading-[1.5]"
              disabled={fetching}
              aria-busy={fetching}
            >
              <span className={fetching ? "opacity-0" : ""}>
                {step === "email" ? "Send Code" : "Activate"}
              </span>
              {fetching && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                </span>
              )}
            </button>

            {/* Secondary actions */}
            {step === "code" && (
              <div className="flex flex-col gap-3 items-center">
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="text-[13px] text-gray-500 font-medium text-center font-sans hover:text-gray-700 transition-colors"
                >
                  ← Use a different email
                </button>

                {/* Resend with countdown */}
                <div className="flex items-center gap-2">
                  {resendCountdown > 0 ? (
                    <div className="flex items-center gap-2 text-[13px] text-gray-400 font-sans">
                      <div className="relative w-6 h-6">
                        {/* Background circle */}
                        <svg
                          className="w-6 h-6 -rotate-90"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="2"
                          />
                          {/* Progress circle */}
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="none"
                            stroke="#64927b"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 10}
                            strokeDashoffset={
                              2 *
                              Math.PI *
                              10 *
                              (1 - resendCountdown / RESEND_COOLDOWN_SECONDS)
                            }
                            className="transition-all duration-1000 ease-linear"
                          />
                        </svg>
                      </div>
                      <span>Resend available in {resendCountdown}s</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={fetching}
                      className="text-[13px] underline text-gray-500 font-medium text-center font-sans hover:text-gray-700 transition-colors disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Terms */}
          <div className="text-[13px] text-gray-500 text-center leading-[1.5] font-sans font-light mt-2">
            By using this product you agree to our
            <br />
            <a
              href="https://www.pencil.dev/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#555555] no-underline hover:opacity-80"
            >
              Privacy Policy
            </a>
            ,{" "}
            <a
              href="https://www.pencil.dev/terms-of-use"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#555555] no-underline hover:opacity-80"
            >
              Terms of Use
            </a>{" "}
            and{" "}
            <a
              href="https://www.pencil.dev/eula"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#555555] no-underline hover:opacity-80"
            >
              EULA
            </a>
            .
          </div>
        </form>
      </div>
    </div>
  );
};
