import { useEffect, useState } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  /** True only after the first NetInfo event has resolved (avoids false-offline flash on mount) */
  isResolved: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    isResolved: false,
  });

  useEffect(() => {
    // Bug fix: "Can't perform a React state update on a component that
    // hasn't mounted yet"/"on an unmounted component" - NetInfo.fetch()'s
    // initial one-shot read had no mount guard, so a component using this
    // hook that unmounted before the fetch resolved (this hook is used
    // widely across the app) could fire setStatus after unmount. The
    // addEventListener subscription itself was already safely torn down
    // via unsubscribe.
    let cancelled = false;
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
        isResolved: true,
      });
    });
    // Fetch immediately so we have state right away
    NetInfo.fetch().then((state) => {
      if (cancelled) return;
      setStatus({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
        isResolved: true,
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return status;
}
