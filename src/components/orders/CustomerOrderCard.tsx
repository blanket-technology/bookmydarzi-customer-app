import React, { memo } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import BookingCompactCard from "./BookingCompactCard";
import type { CustomerOrderListItem } from "../../types/customerOrders";
import { ORDER_DISPLAY_FALLBACK } from "../../types/api";

interface Props {
  item: CustomerOrderListItem;
  index: number;
  onSummaryPress: (orderId: number) => void;
  onPayNow?: (orderId: number) => void;
}

function CustomerOrderCard({ item, index, onSummaryPress, onPayNow }: Props) {
  const serviceLine =
    item.serviceTitle && item.serviceTitle !== ORDER_DISPLAY_FALLBACK
      ? item.serviceSubtitle && item.serviceSubtitle !== ORDER_DISPLAY_FALLBACK
        ? `${item.serviceTitle} · ${item.serviceSubtitle}`
        : item.serviceTitle
      : undefined;

  const needsPayment = item.canPayNow === true;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(350)}>
      <BookingCompactCard
        status={item.status}
        statusLabel={item.statusLabel}
        bookingId={item.bookingId}
        scheduledLabel={item.scheduledLabel}
        amountPaidDisplay={item.amountPaidDisplay}
        serviceLine={serviceLine}
        onSummaryPress={() => onSummaryPress(item.id)}
        onPayNow={needsPayment && onPayNow ? () => onPayNow(item.id) : undefined}
        showRatingPlaceholder
      />
    </Animated.View>
  );
}

export default memo(CustomerOrderCard);
