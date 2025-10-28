import { consume, publish, EX_APP, Q_CAMPAIGN_FOLLOWUP } from "./queue/rabbit.ts";
import { supabaseAdmin } from "./lib/supabase.ts";

export async function registerCampaignWorker() {
  await consume(Q_CAMPAIGN_FOLLOWUP, async (msg: any) => {
    const data = JSON.parse(msg.content?.toString?.() || "{}");
    const { type, campaignId, customerId, customerPhone } = data;


    if (type === "chat_inbound") {
      const { data: camp } = await supabaseAdmin
        .from("campaigns")
        .select("id, ai_handoff_on_reply, auto_followups")
        .eq("id", campaignId)
        .maybeSingle();

      if (!camp) return;

      await supabaseAdmin
        .from("campaign_recipients")
        .update({ responded: true })
        .eq("campaign_id", campaignId)
        .eq("phone", customerPhone);

      if (camp.ai_handoff_on_reply) {
        await publish(EX_APP, "outbound", {
          jobType: "ai.handoff",
          campaignId,
          customerId,
          customerPhone,
        });
      } else if (camp.auto_followups) {
        const { data: next } = await supabaseAdmin
          .from("campaign_followups")
          .select("delay_minutes, template_id")
          .eq("campaign_id", campaignId)
          .order("order_index")
          .limit(1)
          .maybeSingle();

        if (next) {
          const { data: tpl } = await supabaseAdmin
            .from("message_templates")
            .select("payload, kind")
            .eq("id", next.template_id)
            .maybeSingle();

          setTimeout(async () => {
            await publish(EX_APP, "outbound", {
              jobType: "message.send",
              inboxId: null,
              content: tpl?.payload?.text,
              customerPhone,
            });
          }, next.delay_minutes * 60000);
        }
      }
    }
  });
}
