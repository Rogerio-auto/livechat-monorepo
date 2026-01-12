import express from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";

const router = express.Router();



// GET /livechat/messages/:id - Buscar mensagem original para reply preview
router.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: message, error } = await supabaseAdmin
      .from("chat_messages")
      .select(`
        id,
        content,
        type,
        sender_name,
        sender_avatar_url,
        created_at,
        media_url,
        media_public_url,
        media_storage_path,
        is_media_sensitive,
        reply_to_message_id,
        interactive_content
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    return res.json(message);
  } catch (e: any) {
    console.error("[GET /messages/:id] error:", e);
    return res.status(500).json({ error: e?.message || "fetch error" });
  }
});

export default router;
