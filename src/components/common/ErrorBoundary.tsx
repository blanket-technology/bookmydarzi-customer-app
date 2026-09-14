import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SPACING } from "../../../constants/theme";
import { captureException } from "../../services/sentryService";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Top-level crash net for the whole app (wraps everything inside
// GestureHandlerRootView in app/_layout.tsx) - without this, an uncaught
// render error anywhere in the tree produces a blank white screen in a
// production build with no way for the user to recover short of a manual
// app restart, and no visibility for us into why it happened.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    captureException(error, { componentStack: info.componentStack });
  }

  private handleRestart = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Ionicons name="warning-outline" size={48} color={COLORS.error} />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          The app hit an unexpected error. Please try again - if this keeps happening, restart the app.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={this.handleRestart}>
          <Ionicons name="refresh-outline" size={16} color={COLORS.white} />
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.black,
    marginTop: SPACING.sm,
  },
  message: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 20,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: SPACING.md,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },
});
