import { useCallback, useState } from "react";

export function useAsync(asyncFn) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(
    async (...args) => {
      setIsLoading(true);
      setError("");

      try {
        return await asyncFn(...args);
      } catch (err) {
        const message = err?.message || "Something went wrong.";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [asyncFn]
  );

  return { run, isLoading, error, setError };
}
