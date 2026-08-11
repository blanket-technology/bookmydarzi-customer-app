import Constants from "expo-constants";
import React from "react";
import LegalScreen from "../src/components/common/LegalScreen";

export default function AboutScreen() {
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <LegalScreen
      title="About BookMyDarzi"
      sections={[
        {
          heading: "Tailoring, reimagined for your doorstep",
          body:
            "BookMyDarzi is India's premium doorstep tailoring platform. We bring the traditional darzi experience into the modern age - no more hunting for a reliable tailor, no more repeat shop visits, no more guesswork on fit or delivery date. You book in a few taps, we pick up your fabric or garment from home, our verified expert tailors stitch or alter it exactly to your measurements, and we deliver it back to your door, perfectly fitted.",
        },
        {
          heading: "Why customers choose us",
          bullets: [
            "Doorstep pickup and delivery - everything happens from the comfort of your home.",
            "Verified, experienced tailors - every darzi on our platform is vetted for quality and craftsmanship.",
            "Fit guaranteed - if the fit isn't right, we redo the alteration free of charge.",
            "Transparent pricing - the price you see at checkout is the price you pay, with no hidden charges.",
            "Real-time tracking - follow your order from pickup to stitching to delivery, live.",
            "Secure online payments and Cash on Delivery, with instant digital receipts.",
          ],
        },
        {
          heading: "Our services",
          body:
            "From everyday essentials to once-in-a-lifetime occasion wear, we stitch, alter, and repair a complete range of garments:",
          bullets: [
            "Men's Clothing - shirts, trousers, kurtas, pathani suits, blazers, sherwanis and more, in both Normal and Designer finishes.",
            "Women's Clothing - blouses, kurtis, salwar-kameez, lehengas, gowns, sarees (fall & edging) and custom ethnic wear.",
            "Kids' Clothing - comfortable, well-fitted everyday and festive outfits stitched to your child's exact measurements.",
            "Pet Clothing - custom-fit outfits and accessories for your furry family members.",
            "Home & Decor - table linen, dining linen, cushion covers and other soft-furnishing stitching.",
            "Wedding & Occasion Collection - premium sherwani, blazer and bridal stitching crafted with specialist designers.",
          ],
        },
        {
          heading: "Stitching your way",
          body:
            "Every service comes in two tiers so you're always in control of the outcome. Choose Normal Stitching for clean, reliable, everyday tailoring at a great price - or Designer Stitching, where a specialist tailor works to your personal design brief: pick a design style, embellishment level, and describe exactly what you have in mind, even attach reference photos.",
        },
        {
          heading: "Alterations & repairs",
          body:
            "Already own something you love but the fit isn't right? We handle alterations and repairs too - resizing, hemming, tapering, zip and button fixes, and more - picked up and returned to your door with the same care as a fresh stitch.",
        },
        {
          heading: "Measurements made easy",
          body:
            "Not sure of your measurements? No problem. Enter them yourself with our step-by-step size guide, pick a standard size from our chart, or simply book a Home Measurement and our team will take precise measurements at your doorstep during pickup. Your measurement profiles are saved securely for faster future bookings.",
        },
        {
          heading: "How it works",
          bullets: [
            "Browse services and pick what you need - choose your garment, finish, and quantity.",
            "Share your measurements, or book a home measurement at pickup.",
            "Schedule a doorstep pickup slot that suits you.",
            "Our tailors craft your order while you track every stage in the app.",
            "Receive your perfectly-stitched garment back at your door.",
          ],
        },
        {
          heading: "Our promise",
          body:
            "We're building the most trusted tailoring platform in India - one where quality craftsmanship, honest pricing, and effortless convenience come as standard. Behind every order is a real darzi taking pride in their work, and a team committed to making sure it fits you perfectly. That's our promise.",
        },
        {
          heading: "Get in touch",
          body:
            "Have a question, a special request, or feedback? Our support team is available right inside the app - head to Help & Support to chat with us, or reach out anytime. We'd love to hear from you.",
        },
        {
          heading: "App version",
          body: `Version ${appVersion}`,
        },
      ]}
    />
  );
}
