import path from "node:path";
import fs from "node:fs/promises";
import express from "express";
import db from "../pg.js";

const router = express.Router();
const MEDIA_DIR =
  process.env.MEDIA_DIR || path.resolve(process.cwd(), "media");

router.get("/files/:messageId", async (req, res) => {
  const mid = String(req.params.messageId || "");
  if (!/^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(mid)) {
    return res.status(400).json({ error: "invalid_message_id" });
  }

  const row = await db.oneOrNone<{
    storage_key: string | null;
    mime_type: string | null;
    filename: string | null;
  }>(
    `select storage_key, mime_type, filename
       from public.chat_attachments
      where message_id = $1
      order by created_at desc
      limit 1`,
    [mid],
  );
  if (!row?.storage_key) return res.status(404).json({ error: "file_not_found" });

  const abs = path.join(MEDIA_DIR, row.storage_key);
  try {
    await fs.access(abs);
  } catch {
    return res.status(404).json({ error: "file_missing_on_disk" });
  }

  if (row.mime_type) res.setHeader("Content-Type", row.mime_type);
  const baseName = row.filename || path.basename(abs);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${baseName.replace(/"/g, "")}"`,
  );
  res.sendFile(abs);
});

export default router;
