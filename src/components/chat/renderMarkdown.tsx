import React from "react";
import { Linking, Text, View, type StyleProp, type TextStyle } from "react-native";

/**
 * Minimal markdown-to-RN renderer for AI/agent chat messages. AI replies
 * come back with basic markdown - **bold**, numbered/bulleted lists,
 * paragraph breaks, occasional bare URLs - which previously rendered as
 * literal asterisks and un-tappable text in a plain <Text>{body}</Text>
 * (see MessageBubble.tsx). Mirrors the same bounded pattern already proven
 * in the admin web panel's renderMarkdown.jsx, ported to RN primitives
 * (Text/View have no <strong>/<ol>/<li> equivalents). Only ever builds
 * React elements from parsed text - no HTML injection surface either way.
 */

function renderInline(text: string, keyPrefix: string, baseStyle: StyleProp<TextStyle>) {
  const parts = text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <Text key={key} style={[baseStyle, { fontWeight: "700" }]}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <Text
          key={key}
          style={[baseStyle, { textDecorationLine: "underline" }]}
          onPress={() => Linking.openURL(part).catch(() => {})}
        >
          {part}
        </Text>
      );
    }
    return (
      <Text key={key} style={baseStyle}>
        {part}
      </Text>
    );
  });
}

export function renderMarkdown(text: string, baseStyle: StyleProp<TextStyle>) {
  if (!text) return null;
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let listType: "ol" | "ul" | null = null;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer;
    const type = listType;
    blocks.push(
      <View key={`list-${blocks.length}`} style={{ marginVertical: 2 }}>
        {items.map((item, i) => (
          <View key={i} style={{ flexDirection: "row", paddingLeft: 4, marginBottom: 1 }}>
            <Text style={baseStyle}>{type === "ol" ? `${i + 1}. ` : "• "}</Text>
            <Text style={[baseStyle, { flex: 1 }]}>{renderInline(item, `li-${blocks.length}-${i}`, baseStyle)}</Text>
          </View>
        ))}
      </View>,
    );
    listBuffer = [];
    listType = null;
  };

  lines.forEach((line, idx) => {
    const numbered = line.match(/^\s*\d+\.\s+(.*)/);
    const bulleted = line.match(/^\s*[-*]\s+(.*)/);

    if (numbered) {
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(numbered[1]);
      return;
    }
    if (bulleted) {
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(bulleted[1]);
      return;
    }

    flushList();
    if (line.trim() === "") {
      // Collapse to a small paragraph gap rather than an empty line - avoids
      // large dead whitespace when the AI double-newlines between sections.
      blocks.push(<View key={`gap-${idx}`} style={{ height: 6 }} />);
    } else {
      blocks.push(
        <Text key={`p-${idx}`} style={baseStyle}>
          {renderInline(line, `p-${idx}`, baseStyle)}
        </Text>,
      );
    }
  });
  flushList();

  return <>{blocks}</>;
}
