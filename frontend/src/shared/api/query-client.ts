import { QueryClient } from "@tanstack/react-query";

/**
 * アプリ全体で共有する TanStack Query の QueryClient。
 * `QueryClientProvider` への配線は app 層で行う。
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
