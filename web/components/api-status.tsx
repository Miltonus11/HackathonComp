"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Health = { status: string; database: string; postgres: string };

export function ApiStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Health>("/health/")
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">Backend unreachable: {error}</p>;
  if (!health) return <p>Checking backend…</p>;
  return (
    <p className="text-green-600">
      Backend {health.status}, database {health.database}
    </p>
  );
}
