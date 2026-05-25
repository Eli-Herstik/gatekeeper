import { inject } from '@angular/core';
import {
  injectMutation,
  injectQuery,
  injectQueryClient
} from '@tanstack/angular-query-experimental';
import type { Finding, ScanDetail } from '@core/models';
import { ScansApi } from './scans.api';

export const scanKeys = {
  all: ['scans'] as const,
  list: () => [...scanKeys.all, 'list'] as const,
  detail: (id: string) => [...scanKeys.all, 'detail', id] as const,
  findings: (id: string) => [...scanKeys.all, 'findings', id] as const,
  appScans: (appId: string) => ['apps', appId, 'scans'] as const,
  appDiff: (appId: string, from: string, to: string) =>
    ['apps', appId, 'diff', from, to] as const
};

export const appKeys = {
  all: ['apps'] as const,
  list: () => [...appKeys.all, 'list'] as const
};

export function useScansListQuery() {
  const api = inject(ScansApi);
  return injectQuery(() => ({
    queryKey: scanKeys.list(),
    queryFn: () => api.listScans(),
    staleTime: 10_000
  }));
}

export function useAppsListQuery() {
  const api = inject(ScansApi);
  return injectQuery(() => ({
    queryKey: appKeys.list(),
    queryFn: () => api.listApps(),
    staleTime: 10_000
  }));
}

export function useScanDetailQuery(id: () => string) {
  const api = inject(ScansApi);
  return injectQuery(() => ({
    queryKey: scanKeys.detail(id()),
    queryFn: () => api.getScan(id()),
    enabled: !!id()
  }));
}

export function useFindingsQuery(id: () => string) {
  const api = inject(ScansApi);
  return injectQuery(() => ({
    queryKey: scanKeys.findings(id()),
    queryFn: () => api.getFindings(id()),
    enabled: !!id()
  }));
}

export function useCreateAppMutation() {
  const api = inject(ScansApi);
  const qc = injectQueryClient();
  return injectMutation(() => ({
    mutationFn: api.createApp,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appKeys.list() });
    }
  }));
}

export function useCreateScanMutation() {
  const api = inject(ScansApi);
  const qc = injectQueryClient();
  return injectMutation(() => ({
    mutationFn: api.createScan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scanKeys.list() });
    }
  }));
}

export function useCancelScanMutation() {
  const api = inject(ScansApi);
  const qc = injectQueryClient();
  return injectMutation(() => ({
    mutationFn: (id: string) => api.cancelScan(id),
    onSuccess: (_void, id) => {
      qc.invalidateQueries({ queryKey: scanKeys.detail(id) });
      qc.invalidateQueries({ queryKey: scanKeys.list() });
    }
  }));
}

export function useSubmitScanMutation() {
  const api = inject(ScansApi);
  const qc = injectQueryClient();
  return injectMutation(() => ({
    mutationFn: (id: string) => api.submitScan(id),
    onSuccess: (_data, scanId) => {
      // After submit: dashboard exposure_state flips to "submitted", history
      // row gets the current-version badge, and the submitted scan itself is
      // now frozen — invalidate all three caches that surface that state.
      qc.invalidateQueries({ queryKey: appKeys.list() });
      qc.invalidateQueries({ queryKey: scanKeys.detail(scanId) });
      const detail = qc.getQueryData<ScanDetail>(scanKeys.detail(scanId));
      if (detail?.app_id) {
        qc.invalidateQueries({ queryKey: scanKeys.appScans(detail.app_id) });
      }
    }
  }));
}

interface ToggleArgs {
  scanId: string;
  findingId: string;
  excluded: boolean;
}

/**
 * Optimistic exclusion toggle. Snapshots, mutates, rolls back on error and
 * surfaces the rollback via an explicit onError callback the component can
 * use to show a toast.
 */
export function useToggleExclusionMutation(opts?: { onRollback?: (a: ToggleArgs) => void }) {
  const api = inject(ScansApi);
  const qc = injectQueryClient();
  return injectMutation(() => ({
    mutationFn: (args: ToggleArgs) =>
      api.patchFinding(args.scanId, args.findingId, {
        excluded: args.excluded,
      }),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: scanKeys.findings(args.scanId) });
      const previous = qc.getQueryData<Finding[]>(scanKeys.findings(args.scanId));
      qc.setQueryData<Finding[]>(scanKeys.findings(args.scanId), (old) =>
        (old ?? []).map((f) =>
          f.id === args.findingId
            ? { ...f, excluded: args.excluded }
            : f
        )
      );
      return { previous };
    },
    onError: (_err, args, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(scanKeys.findings(args.scanId), ctx.previous);
      }
      opts?.onRollback?.(args);
    },
    onSettled: (_data, _err, args) => {
      qc.invalidateQueries({ queryKey: scanKeys.findings(args.scanId) });
    }
  }));
}

export function useAppScansQuery(appId: () => string) {
  const api = inject(ScansApi);
  return injectQuery(() => ({
    queryKey: scanKeys.appScans(appId()),
    queryFn: () => api.getAppScans(appId()),
    enabled: !!appId()
  }));
}

export function useAppDiffQuery(args: () => { appId: string; from: string; to: string } | null) {
  const api = inject(ScansApi);
  return injectQuery(() => {
    const a = args();
    return {
      queryKey: a ? scanKeys.appDiff(a.appId, a.from, a.to) : ['apps', 'diff', 'noop'],
      queryFn: () => (a ? api.getAppDiff(a.appId, a.from, a.to) : Promise.reject('no args')),
      enabled: !!a
    };
  });
}

export type { ScanDetail };
