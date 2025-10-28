import express from "express";
import multer from "multer";
import { supabaseAdmin } from "../lib/supabase.ts";
import { requireAuth } from "../middlewares/requireAuth.ts";

/** Configuração do multer com storage temporário local */
const storage = multer.diskStorage({
  destination: (_req: express.Request, _file: any, cb: (error: Error | null, destination: string) => void) => {
    cb(null, "/tmp");
  },
  filename: (_req: express.Request, file: any, cb: (error: Error | null, filename: string) => void) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

export function registerCampaignUploadsRoutes(app: express.Application) {
  async function resolveCompanyId(req: any): Promise<string> {
    const { data } = await supabaseAdmin
      .from("users")
      .select("company_id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    return data?.company_id;
  }

  app.post("/livechat/campaigns/uploads", requireAuth, upload.single("file"), async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const file = req.file;
      if (!file) return res.status(400).json({ error: "Arquivo não enviado" });

      const { data, error } = await supabaseAdmin
        .from("contact_import_batches")
        .insert([
          {
            company_id: companyId,
            name: file.originalname,
            file_url: `storage://contact_imports/${file.filename}`,
            total_rows: 0,
            imported_rows: 0,
            created_by: req.user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return res.json({ ok: true, batch: data });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
