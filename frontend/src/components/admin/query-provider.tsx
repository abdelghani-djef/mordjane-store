"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError } from "@/lib/api";

const ME_KEY = ["admin", "me"];

function is401(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    // A 401 anywhere means the session expired: re-check `me`, whose error state makes the
    // panel guard redirect to login. (Skip `me` itself to avoid an invalidate loop.)
    const recheckSession = () => client.invalidateQueries({ queryKey: ME_KEY });
    const client: QueryClient = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          if (is401(error) && query.queryKey[1] !== "me") recheckSession();
        },
      }),
      mutationCache: new MutationCache({
        onError: (error) => {
          if (is401(error)) recheckSession();
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 15_000,
          retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
        },
      },
    });
    return client;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
