export type InboundMessageJob = {
  provider: "META";                 // por enquanto
  inboxId: string;                  // resolvido pelo phone_number_id
  companyId: string;
  eventUid: string;                 // "messages:<wamid>"
  contact: { wa_id: string; name?: string | null };
  message: { wamid: string; type: "TEXT"; text: string; timestamp: number };
  raw: any;                         // raw webhook (pra auditoria)
};

export type OutboundRequestJob = {
  inboxId: string;
  chatId: string;
  content: string;
  type?: "TEXT";                    // expandir para IMAGE/AUDIO no futuro
  // controle de retry:
  attempt?: number;
};
