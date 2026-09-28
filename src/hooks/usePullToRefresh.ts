import { useState, useCallback, useEffect, useRef } from "react";

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  // Bug fix: "Can't perform a React state update on a component that
  // hasn't mounted yet"/"on an unmounted component" - this hook is shared
  // by every pull-to-refresh screen in the app, and setRefreshing(false)
  // in the finally block ran unconditionally even if the owning screen had
  // already unmounted while onRefresh() was in flight (fast navigation
  // away during a refresh). Same isMountedRef guard pattern as
  // OrderTimeline/index.tsx.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  }, [onRefresh]);

  return { refreshing, handleRefresh };
}
