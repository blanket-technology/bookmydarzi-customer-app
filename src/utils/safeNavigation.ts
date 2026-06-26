import { InteractionManager } from "react-native";
import type { Href, Router } from "expo-router";

/** Run navigation after the root navigator has finished mounting. */
export function runSafeNavigation(action: () => void): void {
  InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(action);
  });
}

export function safeRouterReplace(router: Router, href: Href): void {
  runSafeNavigation(() => {
    router.replace(href);
  });
}

export function safeRouterPush(router: Router, href: Href): void {
  runSafeNavigation(() => {
    router.push(href);
  });
}
