// src/routes/devTest.ts
import type { Request, Response } from "express";
import { handleMetaWebhook } from "../services/meta/handlers.service.js";

export async function devTestWebhook(req: Request, res: Response) {
  const sample = {
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: "<SEU_PHONE_NUMBER_ID>" },
          contacts: [{ profile: { name: "Push Name Teste" }, wa_id: "556922030077" }],
          messages: [{
            id: "wamid.TESTE123",
            from: "556999670030",
            timestamp: Math.floor(Date.now()/1000).toString(),
            type: "text",
            text: { body: "Olá!" }
          }]
        }
      }]
    }]
  };
  await handleMetaWebhook(sample);
  res.json({ ok: true });
}
