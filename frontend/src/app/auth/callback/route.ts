import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { normalizeApiBaseUrl } from "@/lib/api";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const baseUrl = isLocalEnv || !forwardedHost ? origin : `https://${forwardedHost}`;

  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // 1. Handle OAuth errors or user cancellation from Google/Supabase
  if (error) {
    console.warn("Google OAuth callback error:", error, errorDescription);
    const userMessage =
      error === "access_denied" || (errorDescription && errorDescription.toLowerCase().includes("cancel"))
        ? "Google authentication was cancelled."
        : errorDescription || "Google authentication failed. Please try again.";

    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(userMessage)}`);
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("No authentication code was received.")}`
    );
  }

  try {
    // 2. Exchange authorization code for Supabase session using server-side cookies
    const supabase = await getSupabaseServerClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !data?.session) {
      console.error("Supabase code exchange error:", exchangeError);
      const message =
        exchangeError?.message || "Unable to verify Google authentication session.";
      return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(message)}`);
    }

    const session = data.session;

    // 3. Retrieve preserved registration profile data if user came from register form
    let firstName: string | undefined;
    let lastName: string | undefined;

    const signupProfileCookie = request.cookies.get("aerotrace_signup_profile")?.value;
    if (signupProfileCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(signupProfileCookie));
        firstName = parsed.first_name;
        lastName = parsed.last_name;
      } catch (e) {
        console.debug("Could not parse signup profile cookie:", e);
      }
    }

    // 4. Verify Google session with FastAPI backend and issue AeroTrace JWT tokens
    const apiBaseUrl = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);

    const backendRes = await fetch(`${apiBaseUrl}/auth/google/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        supabase_token: session.access_token,
        first_name: firstName,
        last_name: lastName,
      }),
    });

    if (!backendRes.ok) {
      let errMsg = "Failed to establish AeroTrace account.";
      try {
        const errData = await backendRes.json();
        if (typeof errData.detail === "string") {
          errMsg = errData.detail;
        } else if (errData.error?.message) {
          errMsg = errData.error.message;
        }
      } catch {
        // Fallback to default error message
      }

      return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(errMsg)}`);
    }

    const authTokens = await backendRes.json();

    // 5. Build successful redirect to dashboard
    const response = NextResponse.redirect(`${baseUrl}/`);

    // Transfer AeroTrace access and refresh tokens via temporary cookies so AuthContext can persist to localStorage
    response.cookies.set("aerotrace_access_token", authTokens.access_token, {
      path: "/",
      maxAge: 120, // 2 minutes window to hydrate into localStorage
      sameSite: "lax",
      httpOnly: false,
    });

    if (authTokens.refresh_token) {
      response.cookies.set("aerotrace_refresh_token", authTokens.refresh_token, {
        path: "/",
        maxAge: 120,
        sameSite: "lax",
        httpOnly: false,
      });
    }

    // Clear temporary signup profile cookie
    response.cookies.delete("aerotrace_signup_profile");

    return response;
  } catch (err) {
    console.error("OAuth callback processing exception:", err);
    const msg = err instanceof Error ? err.message : "Authentication failed.";
    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(msg)}`);
  }
}
