import type { ChatConversation, ChatMessage } from "../types";
import { TAILORS_DATA } from "./tailors";

export const MESSAGES_DATA: Record<string, ChatMessage[]> = {
  cnv_001: [
    {
      id: "msg_001",
      sender_id: "tlr_001",
      sender_name: "Arjun Sharma",
      sender_avatar: "AS",
      message: "Hello! I've received your order for the Navy Blue Suit. I'll start measurements tomorrow.",
      timestamp: "2026-05-01T10:00:00Z",
      read: true,
    },
    {
      id: "msg_002",
      sender_id: "usr_current",
      sender_name: "You",
      message: "Great! What time works for you?",
      timestamp: "2026-05-01T10:05:00Z",
      read: true,
    },
    {
      id: "msg_003",
      sender_id: "tlr_001",
      sender_name: "Arjun Sharma",
      sender_avatar: "AS",
      message: "I can come at 2 PM. Does that work for you?",
      timestamp: "2026-05-01T10:07:00Z",
      read: false,
    },
  ],
  cnv_002: [
    {
      id: "msg_004",
      sender_id: "tlr_002",
      sender_name: "Priya Mehta",
      sender_avatar: "PM",
      message: "Your bridal consultation is confirmed for May 18th at 2 PM. Please bring fabric references.",
      timestamp: "2026-05-03T14:00:00Z",
      read: true,
    },
    {
      id: "msg_005",
      sender_id: "usr_current",
      sender_name: "You",
      message: "Thank you! I'll be there.",
      timestamp: "2026-05-03T14:10:00Z",
      read: true,
    },
  ],
};

export const CONVERSATIONS_DATA: ChatConversation[] = [
  {
    id: "cnv_001",
    tailor: TAILORS_DATA[0],
    last_message: MESSAGES_DATA["cnv_001"][2],
    unread_count: 1,
    online: true,
  },
  {
    id: "cnv_002",
    tailor: TAILORS_DATA[1],
    last_message: MESSAGES_DATA["cnv_002"][1],
    unread_count: 0,
    online: true,
  },
];
