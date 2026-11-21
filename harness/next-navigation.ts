/** Compile-time stand-in for the app-router `next/navigation` surface items use. */
export interface RouterStub {
  push(href: string): void;
  replace(href: string): void;
  refresh(): void;
  back(): void;
}

export function useRouter(): RouterStub {
  return {
    push: () => {},
    replace: () => {},
    refresh: () => {},
    back: () => {},
  };
}

export interface SearchParamsStub {
  get(name: string): string | null;
}

export function useSearchParams(): SearchParamsStub {
  return { get: () => null };
}
