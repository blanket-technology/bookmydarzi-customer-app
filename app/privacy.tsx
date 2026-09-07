import React from "react";
import LegalScreen from "../src/components/common/LegalScreen";

export default function PrivacyScreen() {
  return (
    <LegalScreen
      title="Privacy Policy"
      updatedLabel="Last updated: January 2026"
      sections={[
        {
          heading: "Information we collect",
          body:
            "We collect the information you give us directly - your name, phone number, email, delivery addresses, and body measurements - so we can schedule pickups, deliver garments, and get the fit right. We also collect order and payment details needed to process your bookings.",
        },
        {
          heading: "How we use your information",
          body:
            "Your details are used to run your orders end to end: assigning a tailor, scheduling pickup and delivery, processing payments via Razorpay, sending order updates and support messages, and improving the accuracy of our sizing over time.",
        },
        {
          heading: "Who we share it with",
          body:
            "Tailors only see the measurements and instructions needed to stitch your order - never your full contact details. Payment information is handled directly by Razorpay, our payment gateway partner; we do not store your card or UPI details. We never sell your personal information to third parties.",
        },
        {
          heading: "Data retention",
          body:
            "We keep your order history, measurements, and address book for as long as your account is active, so you don't have to re-enter them for future orders. You can request deletion of your account and associated data at any time by contacting support.",
        },
        {
          heading: "Your choices",
          body:
            "You can update or delete your saved addresses and measurement profiles at any time from your account. You can also request a copy of your data, or full account deletion, through the Support section of the app.",
        },
        {
          heading: "Contact us",
          body:
            "If you have questions about this policy or how your data is handled, reach out through Support in the app and our team will help.",
        },
      ]}
    />
  );
}
