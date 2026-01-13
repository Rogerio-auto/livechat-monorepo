import express from "express";
import multer from "multer";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { 
  uploadBufferToStorage, 
  buildStoragePath, 
  computeSha256,
  pickFilename,
  sanitizeFilename
} from "../lib/storage.js";

// Multer para upload em memória
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

export function registerMediaLibraryRoutes(app: express.Application) {
  
  async function resolveCompanyId(req: any): Promise<string> {
    const companyId = req.profile?.company_id || req.user?.company_id;
    if (companyId) return companyId;

    const { data: userRow, error } = await supabaseAdmin
      .from("users")
      .select("company_id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const resolvedCompanyId = userRow?.company_id;
    if (!resolvedCompanyId) throw new Error("Usuário sem company_id");
    return resolvedCompanyId;
  }

  // ==================== UPLOAD DE MÍDIA ====================
  app.post("/livechat/media-library/upload", requireAuth, upload.single("file"), async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const file = req.file;
      
      if (!file || !file.buffer) {
        return res.status(400).json({ error: "Arquivo não enviado" });
      }

      // Validar tipo de arquivo
      const contentType = file.mimetype || "application/octet-stream";
      const allowedTypes = [
        "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
        "video/mp4", "video/webm", "video/quicktime",
        "audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/mp4",
        "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/csv"
      ];

      if (!allowedTypes.some(t => contentType.startsWith(t.split('/')[0]))) {
        return res.status(400).json({ error: "Tipo de arquivo não suportado" });
      }

      // Determinar media_type
      let mediaType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
      if (contentType.startsWith("image/")) mediaType = "IMAGE";
      else if (contentType.startsWith("video/")) mediaType = "VIDEO";
      else if (contentType.startsWith("audio/")) mediaType = "AUDIO";
      else mediaType = "DOCUMENT";

      // Metadados opcionais do body
      const title = req.body.title ? String(req.body.title).trim() : null;
      const tagsStr = req.body.tags ? String(req.body.tags).trim() : null;
      const tags = tagsStr ? tagsStr.split(",").map((t: string) => t.trim()).filter(Boolean) : null;

      // Calcular SHA256 para deduplicação
      const sha256 = computeSha256(file.buffer);

      // Verificar se já existe mídia com mesmo hash na empresa
      const { data: existing } = await supabaseAdmin
        .from("media_library")
        .select("id, public_url, storage_path")
        .eq("company_id", companyId)
        .eq("sha256", sha256)
        .maybeSingle();

      if (existing) {
        // Arquivo já existe, retorna o existente
        return res.json({
          ok: true,
          media: existing,
          message: "Arquivo já existe na biblioteca (deduplicado)"
        });
      }

      // Upload para Storage
      const filename = pickFilename(file.originalname, contentType);
      const storagePath = buildStoragePath({
        companyId,
        chatId: null,
        filename: sanitizeFilename(filename),
        prefix: "media-library"
      });

      const uploadResult = await uploadBufferToStorage({
        buffer: file.buffer,
        contentType,
        path: storagePath
      });

      // Buscar users.id local do criador
      let createdBy: string | null = null;
      if (req.user?.id) {
        const { data: userRow } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("user_id", req.user.id)
          .maybeSingle();
        createdBy = userRow?.id || null;
      }

      // Inserir metadados no banco
      const { data: media, error: insertErr } = await supabaseAdmin
        .from("media_library")
        .insert([{
          company_id: companyId,
          created_by: createdBy,
          storage_path: uploadResult.path,
          public_url: uploadResult.publicUrl,
          sha256: uploadResult.sha256,
          filename,
          content_type: contentType,
          file_size: file.size,
          media_type: mediaType,
          title,
          tags
        }])
        .select("id, storage_path, public_url, filename, content_type, file_size, media_type, title, tags, created_at")
        .single();

      if (insertErr) throw new Error(insertErr.message);

      return res.status(201).json({ ok: true, media });

    } catch (e: any) {
      console.error("[media-library/upload] Error:", e);
      return res.status(500).json({ error: e?.message || "Erro ao fazer upload" });
    }
  });

  // ==================== LISTAR MÍDIAS ====================
  app.get("/livechat/media-library", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      
      // Query params para filtros/paginação
      const schema = z.object({
        type: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]).optional(),
        search: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        sort: z.enum(["newest", "oldest", "name"]).default("newest")
      });

      const params = schema.parse(req.query);
      const offset = (params.page - 1) * params.limit;

      let query = supabaseAdmin
        .from("media_library")
        .select("id, storage_path, public_url, filename, content_type, file_size, media_type, title, tags, created_at, created_by", { count: "exact" })
        .eq("company_id", companyId);

      // Filtros
      if (params.type) {
        query = query.eq("media_type", params.type);
      }

      if (params.search) {
        // Busca por filename ou title
        query = query.or(`filename.ilike.%${params.search}%,title.ilike.%${params.search}%`);
      }

      // Ordenação
      if (params.sort === "newest") {
        query = query.order("created_at", { ascending: false });
      } else if (params.sort === "oldest") {
        query = query.order("created_at", { ascending: true });
      } else if (params.sort === "name") {
        query = query.order("filename", { ascending: true });
      }

      // Paginação
      query = query.range(offset, offset + params.limit - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);

      return res.json({
        items: data || [],
        pagination: {
          page: params.page,
          limit: params.limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / params.limit)
        }
      });

    } catch (e: any) {
      console.error("[media-library] List error:", e);
      return res.status(500).json({ error: e?.message || "Erro ao listar mídias" });
    }
  });

  // ==================== BUSCAR MÍDIA POR ID ====================
  app.get("/livechat/media-library/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      const { data, error } = await supabaseAdmin
        .from("media_library")
        .select("id, storage_path, public_url, filename, content_type, file_size, media_type, title, tags, created_at, created_by")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ error: "Mídia não encontrada" });

      return res.json(data);

    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao buscar mídia" });
    }
  });

  // ==================== ATUALIZAR METADADOS ====================
  app.patch("/livechat/media-library/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      const schema = z.object({
        title: z.string().trim().optional().nullable(),
        tags: z.array(z.string()).optional().nullable()
      });

      const body = schema.parse(req.body);

      const { data, error } = await supabaseAdmin
        .from("media_library")
        .update(body)
        .eq("id", id)
        .eq("company_id", companyId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ error: "Mídia não encontrada" });

      return res.json({ ok: true, media: data });

    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao atualizar mídia" });
    }
  });

  // ==================== DELETAR MÍDIA ====================
  app.delete("/livechat/media-library/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;

      // Buscar mídia para pegar storage_path
      const { data: media } = await supabaseAdmin
        .from("media_library")
        .select("storage_path, company_id")
        .eq("id", id)
        .maybeSingle();

      if (!media) {
        return res.status(404).json({ error: "Mídia não encontrada" });
      }

      if (media.company_id !== companyId) {
        return res.status(403).json({ error: "Sem permissão para deletar esta mídia" });
      }

      // Deletar do Storage
      try {
        await supabaseAdmin.storage
          .from("chat-uploads")
          .remove([media.storage_path]);
      } catch (storageErr) {
        console.warn("[media-library] Storage delete warning:", storageErr);
        // Continua mesmo se falhar no storage
      }

      // Deletar do banco
      const { error: deleteErr } = await supabaseAdmin
        .from("media_library")
        .delete()
        .eq("id", id)
        .eq("company_id", companyId);

      if (deleteErr) throw new Error(deleteErr.message);

      return res.json({ ok: true, message: "Mídia deletada com sucesso" });

    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao deletar mídia" });
    }
  });
}
