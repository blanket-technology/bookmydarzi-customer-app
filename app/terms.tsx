import React from "react";
import LegalScreen from "../src/components/common/LegalScreen";

export default function TermsScreen() {
  return (
    <LegalScreen
      title="Terms of Service"
      updatedLabel="Last updated: January 2026"
      sections={[
        {
          heading: "Our service",
          body:
            "BookMyDarzi is a doorstep tailoring service. We pick up your fabric or garment, have it stitched or altered by one of our tailors, and deliver it back to you. Turnaround times shown in the app are estimates and may vary based on the service and tailor availability.",
        },
        {
          heading: "Bookings and payments",
          body:
            "Orders are confirmed once payment is completed (online) or pickup is scheduled (cash on delivery, where available). Prices shown at checkout are final for that order. Payments are processed securely through Razorpay.",
        },
        {
          heading: "Measurements and fit",
          body:
            "You are responsible for providing accurate measurements at the time of booking, either self-entered or taken by our team during pickup. We stitch to the measurements provided; if something doesn't fit as expected, contact Support and we'll help make it right under our alteration policy.",
        },
        {
          heading: "Cancellations and refunds",
          body:
            "Orders can be cancelled before stitching begins, subject to the cancellation policy shown at the time of cancellation - this may include a partial refund or a cancellation charge depending on how far the order has progressed. Once stitching has started, cancellations are handled on a case-by-case basis through Support.",
        },
        {
          heading: "Your responsibilities",
          body:
            "Please ensure someone is available at the scheduled pickup and delivery windows, and that the address and contact details you provide are accurate. Fabric or garments handed over for stitching should be free of concealed valuables.",
        },
        {
          heading: "Changes to these terms",
          body:
            "We may update these terms from time to time as our service evolves. Continued use of the app after an update means you accept the revised terms.",
        },
      ]}
    />
  );
}
