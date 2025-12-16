import express from "express";
import { stripe } from "../lib/stripe.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import db from "../pg.js";

export const checkoutRouter = express.Router();

// POST /api/checkout/session
checkoutRouter.post("/session", requireAuth, async (req: any, res) => {
  try {
    const { planId, interval = "monthly" } = req.body;
    const companyId = req.user.company_id;
    const userEmail = req.user.email;

    if (!planId) {
      return res.status(400).json({ error: "Plan ID is required" });
    }

    // 1. Get Plan Details (Price ID)
    const plan = await db.oneOrNone(
      `SELECT * FROM public.plans WHERE id = $1`,
      [planId]
    );

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const priceId = interval === "yearly" 
      ? plan.stripe_price_id_yearly 
      : plan.stripe_price_id_monthly;

    if (!priceId) {
      // Fallback for testing if DB is not populated yet, BUT ideally should fail
      // return res.status(400).json({ error: "This plan is not configured for payments yet (missing price ID)" });
      console.warn(`[Checkout] Missing price ID for plan ${planId} (${interval}). Ensure DB is populated.`);
      return res.status(400).json({ error: "Plan configuration error: Missing Stripe Price ID" });
    }

    // 2. Get or Create Stripe Customer
    // Check if subscription already has a customer_id
    const subscription = await db.oneOrNone(
      `SELECT stripe_customer_id FROM public.subscriptions WHERE company_id = $1`,
      [companyId]
    );

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      // Create new customer in Stripe
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          companyId: companyId,
        },
      });
      customerId = customer.id;

      // Save customer ID immediately
      await db.none(
        `UPDATE public.subscriptions SET stripe_customer_id = $1 WHERE company_id = $2`,
        [customerId, companyId]
      );
    }

    // 3. Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        companyId: companyId,
        planId: planId,
      },
      success_url: process.env.STRIPE_SUCCESS_URL || "http://localhost:3000/subscription/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: process.env.STRIPE_CANCEL_URL || "http://localhost:3000/subscription",
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });

  } catch (error: any) {
    console.error("[Checkout] Error creating session:", error);
    res.status(500).json({ error: "Failed to create checkout session", details: error.message });
  }
});

// POST /api/checkout/portal
checkoutRouter.post("/portal", requireAuth, async (req: any, res) => {
  try {
    const companyId = req.user.company_id;

    const subscription = await db.oneOrNone(
      `SELECT stripe_customer_id FROM public.subscriptions WHERE company_id = $1`,
      [companyId]
    );

    if (!subscription?.stripe_customer_id) {
      return res.status(400).json({ error: "No Stripe customer found for this account" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: process.env.STRIPE_CANCEL_URL || "http://localhost:3000/subscription",
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("[Portal] Error creating portal session:", error);
    res.status(500).json({ error: "Failed to create portal session" });
  }
});
