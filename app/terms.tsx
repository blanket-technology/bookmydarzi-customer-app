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
            "BookMyDarzi is a doorstep tailoring service. We pick up your fabric or garment, have it stitched or altered by one of our tailors, and deliver it back to you. Turnaround times shown in the app are estimates and may vary based on the service and tailor availability. The company operating BookMyDarzi is [FILL IN: LEGAL ENTITY NAME], registered in [FILL IN: JURISDICTION / STATE].",
        },
        {
          heading: "Accounts and verification",
          body:
            "You create an account using your mobile number and a one-time password (OTP) sent by SMS, or your email and password. You're responsible for keeping your OTP and login credentials confidential and for all activity under your account. Let us know immediately if you suspect unauthorized access.",
        },
        {
          heading: "Serviceability",
          body:
            "BookMyDarzi is currently available only in the pincodes/areas we actively service. If your address falls outside our current service area, you won't be able to complete a booking there - we may still let you register interest so we can notify you if we expand to your area.",
        },
        {
          heading: "Bookings and payments",
          body:
            "Orders are confirmed once payment is completed (online) or pickup is scheduled (cash on delivery, where available). Some orders require an advance/booking amount paid upfront at checkout, with the remaining balance due on delivery; others are paid in full upfront. The amount and split shown at checkout for your order is final for that order. Payments are processed securely through Razorpay - we never see or store your full card, UPI, or bank details.",
        },
        {
          heading: "Measurements and fit",
          body:
            "You are responsible for providing accurate measurements at the time of booking, either self-entered or taken by our team during pickup. We stitch to the measurements provided; if something doesn't fit as expected, contact Support and we'll help make it right under our alteration policy.",
        },
        {
          heading: "Tailors and service providers",
          body:
            "Garments are stitched by independent tailors who work with BookMyDarzi, not by BookMyDarzi employees directly. We select and manage the tailors on our platform and remain your point of contact for any issue with your order, but a tailor's identity and contact details are not shared with you directly.",
        },
        {
          heading: "Your responsibilities",
          body:
            "Please ensure someone is available at the scheduled pickup and delivery windows, and that the address and contact details you provide are accurate. Fabric or garments handed over for stitching should be free of concealed valuables. Providing false information, abusing our staff or delivery partners, or misusing the app (e.g. placing orders you don't intend to honor) may result in your account being suspended or terminated.",
        },
        {
          heading: "Cancellations and refunds",
          body:
            "Orders can be cancelled before stitching begins, subject to the cancellation policy shown at the time of cancellation - this may include a partial refund or a cancellation charge depending on how far the order has progressed. Once stitching has started, cancellations are handled on a case-by-case basis through Support. Approved refunds are processed within 5-7 business days to your original payment method.",
        },
        {
          heading: "Order disputes",
          body:
            "If you're unhappy with the quality of a completed order or believe there's an error in your bill, contact Support within the app as soon as possible with details of the issue. We'll review the order history and communicate with the assigned tailor to reach a resolution, which may include a free alteration, partial refund, or other remedy at our discretion.",
        },
        {
          heading: "Account termination",
          body:
            "You can delete your own account at any time from Profile → Delete My Account. We may suspend or terminate an account that violates these terms, engages in fraud, or abuses the platform, with notice where practicable. Order, payment, and tax records tied to a terminated account are retained as described in our Privacy Policy.",
        },
        {
          heading: "Intellectual property",
          body:
            "The BookMyDarzi app, its design, logo, and content are owned by [FILL IN: LEGAL ENTITY NAME] and may not be copied, reproduced, or used without permission. You retain ownership of any photos or reference images you upload, and grant us a limited license to use them only to fulfil your order.",
        },
        {
          heading: "Governing law",
          body:
            "These terms are governed by the laws of [FILL IN: COUNTRY/STATE], and any disputes arising from them are subject to the jurisdiction of the courts in [FILL IN: CITY].",
        },
        {
          heading: "Changes to these terms",
          body:
            "We may update these terms from time to time as our service evolves. Continued use of the app after an update means you accept the revised terms.",
        },
        {
          heading: "Contact us",
          body:
            "Questions about these terms? Reach out through Support in the app and our team will help.",
        },
      ]}
    />
  );
}
