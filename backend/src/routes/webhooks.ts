import express from "express";
import { stripe } from "../lib/stripe.js";
import db from "../pg.js";
import { rDel } from "../lib/redis.js";

export const webhookRouter = express.Router();

// Stripe requires the raw body to verify the signature
webhookRouter.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      console.error("[Stripe] Missing signature or webhook secret");
      res.status(400).send("Webhook Error: Missing signature or secret");
      return;
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error(`[Stripe] Webhook signature verification failed: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    console.log(`[Stripe] Received event: ${event.type}`);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          await handleCheckoutSessionCompleted(session);
          break;
        }
        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          await handleInvoicePaymentSucceeded(invoice);
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          await handleInvoicePaymentFailed(invoice);
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          await handleSubscriptionDeleted(subscription);
          break;
        }
        case "customer.subscription.updated": {
          const subscription = event.data.object;
          await handleSubscriptionUpdated(subscription);
          break;
        }
        default:
          // Unhandled event type
          break;
      }
    } catch (error) {
      console.error(`[Stripe] Error handling event ${event.type}:`, error);
      // Return 200 to acknowledge receipt even if processing failed, 
      // otherwise Stripe will retry and potentially cause more errors.
      // Alternatively return 500 if you want retries.
    }

    res.json({ received: true });
  }
);

async function handleCheckoutSessionCompleted(session: any) {
  const companyId = session.metadata?.companyId;
  const planId = session.metadata?.planId;
  
  if (!companyId) {
    console.error("[Stripe] Missing companyId in metadata for session", session.id);
    return;
  }

  console.log(`[Stripe] Checkout completed for company ${companyId}, plan ${planId}`);

  // Update subscription with Stripe details
  await db.none(
    `UPDATE public.subscriptions 
     SET stripe_customer_id = $1,
         stripe_subscription_id = $2,
         status = 'active',
         plan_id = COALESCE($3, plan_id),
         updated_at = NOW()
     WHERE company_id = $4`,
    [
      session.customer,
      session.subscription,
      planId, // If planId is passed in metadata, update it. Otherwise keep existing (unlikely for new sub)
      companyId
    ]
  );

  // Invalidate cache
  await rDel(`subscription:${companyId}`);
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // Extend the subscription period based on the invoice
  // This is optional if you rely on 'status=active', but good for record keeping
  console.log(`[Stripe] Payment succeeded for subscription ${subscriptionId}`);
  
  // You might want to update current_period_end here if you track it locally
}

async function handleInvoicePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  console.warn(`[Stripe] Payment failed for subscription ${subscriptionId}`);

  // Mark as past_due
  const result = await db.oneOrNone(
    `UPDATE public.subscriptions 
     SET status = 'past_due',
         updated_at = NOW()
     WHERE stripe_subscription_id = $1
     RETURNING company_id`,
    [subscriptionId]
  );

  if (result?.company_id) {
    await rDel(`subscription:${result.company_id}`);
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  const subscriptionId = subscription.id;
  console.log(`[Stripe] Subscription deleted: ${subscriptionId}`);

  // Mark as canceled or expired
  const result = await db.oneOrNone(
    `UPDATE public.subscriptions 
     SET status = 'canceled',
         canceled_at = NOW(),
         updated_at = NOW()
     WHERE stripe_subscription_id = $1
     RETURNING company_id`,
    [subscriptionId]
  );

  if (result?.company_id) {
    await rDel(`subscription:${result.company_id}`);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const priceId = subscription.items?.data?.[0]?.price?.id;

  console.log(`[Stripe] Subscription updated: ${subscriptionId}, status: ${status}, price: ${priceId}`);

  if (!priceId) {
    console.warn("[Stripe] No price ID found in subscription update");
    return;
  }

  // Find which plan corresponds to this price ID
  const plan = await db.oneOrNone(
    `SELECT id FROM public.plans 
     WHERE stripe_price_id_monthly = $1 OR stripe_price_id_yearly = $1`,
    [priceId]
  );

  if (!plan) {
    console.warn(`[Stripe] No plan found for price ID ${priceId}`);
    // Could be a legacy plan or custom price, handle accordingly or ignore
    return;
  }

  // Update subscription in DB
  const result = await db.oneOrNone(
    `UPDATE public.subscriptions 
     SET status = $1,
         plan_id = $2,
         updated_at = NOW()
     WHERE stripe_subscription_id = $3
     RETURNING company_id`,
    [status, plan.id, subscriptionId]
  );

  if (result?.company_id) {
    await rDel(`subscription:${result.company_id}`);
    console.log(`[Stripe] Updated subscription for company ${result.company_id} to plan ${plan.id}`);
  } else {
    console.warn(`[Stripe] Subscription ${subscriptionId} not found in DB`);
  }
}
