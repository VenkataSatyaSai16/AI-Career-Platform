import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { storeAuthToken } from "../utils/auth";

function AuthSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setError("Missing login token.");
      return;
    }

    storeAuthToken(token);
    navigate("/dashboard", { replace: true });
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold text-slate-900">{error ? "Authentication failed" : "Signing you in..."}</h1>
        <p className="mt-3 text-sm text-slate-600">
          {error || "Your Google login succeeded. Redirecting to your dashboard now."}
        </p>
      </div>
    </div>
  );
}

export default AuthSuccess;
