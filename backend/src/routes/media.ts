import express, { Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { requireAuth } from "../middlewares/requireAuth";
import { supabaseAdmin } from "../lib/supabase";
import { randomUUID } from "crypto";

const router = express.Router();

// Configuração do multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// ============================================
// TYPES
// ============================================

type MediaType = "image" | "video" | "document" | "audio";
type MediaCategory = "product" | "service" | "marketing" | "documentation" | "other";
type UsageContext = "thumbnail" | "gallery" | "detail" | "variation" | "banner";

interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  size?: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Determina o tipo de mídia baseado no MIME type
 */
function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * Valida e processa imagem com sharp
 */
async function processImage(buffer: Buffer): Promise<{ metadata: MediaMetadata; buffer: Buffer }> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Otimizar imagem se for muito grande (redimensionar mantendo proporção)
  let processedBuffer = buffer;
  if (metadata.width && metadata.width > 2000) {
    processedBuffer = await image
      .resize(2000, null, {
        withoutEnlargement: true,
        fit: "inside",
      })
      .toBuffer();
  }

  return {
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    },
    buffer: processedBuffer,
  };
}

/**
 * Faz upload do arquivo para o Supabase Storage
 */
async function uploadToStorage(
  companyId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const storagePath = `${companyId}/${fileName}`;

  const { data, error } = await supabaseAdmin.storage
    .from("media_gallery")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Erro ao fazer upload: ${error.message}`);
  }

  // Gerar URL pública
  const { data: publicUrlData } = supabaseAdmin.storage
    .from("media_gallery")
    .getPublicUrl(storagePath);

  return publicUrlData.publicUrl;
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/media/upload
 * Upload de mídia com vinculação opcional a produtos
 */
router.post("/upload", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Arquivo não enviado" });
    }

    const { company_id } = (req as any).user;
    const {
      title,
      description,
      alt_text,
      category,
      tags,
      is_public,
      catalog_item_ids, // Array de IDs de produtos para vincular
    } = req.body;

    // Determinar tipo de mídia
    const mediaType = getMediaType(file.mimetype);

    // Processar imagem se necessário
    let fileBuffer = file.buffer;
    let metadata: MediaMetadata = { size: file.size };

    if (mediaType === "image") {
      const processed = await processImage(file.buffer);
      fileBuffer = processed.buffer;
      metadata = { ...metadata, ...processed.metadata };
    }

    // Gerar nome único para o arquivo
    const fileExtension = file.originalname.split(".").pop() || "bin";
    const fileName = `${randomUUID()}.${fileExtension}`;

    // Upload para o Supabase Storage
    const publicUrl = await uploadToStorage(company_id, fileName, fileBuffer, file.mimetype);

    // Buscar o ID do usuário na tabela users (não o auth user ID)
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("user_id", (req as any).user.id)
      .maybeSingle();

    // Inserir registro na tabela media_gallery
    const { data: mediaData, error: mediaError } = await supabaseAdmin
      .from("media_gallery")
      .insert({
        company_id,
        file_name: fileName,
        original_name: file.originalname,
        mime_type: file.mimetype,
        file_size: fileBuffer.length,
        storage_bucket: "media_gallery",
        storage_path: `${company_id}/${fileName}`,
        public_url: publicUrl,
        media_type: mediaType,
        category: category || null,
        tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
        title: title || null,
        description: description || null,
        alt_text: alt_text || null,
        metadata,
        is_active: true,
        is_public: is_public === "true" || is_public === true,
        uploaded_by: userData?.id || null,
      })
      .select()
      .single();

    if (mediaError) {
      throw new Error(`Erro ao salvar no banco: ${mediaError.message}`);
    }

    // Vincular a produtos se fornecido
    if (catalog_item_ids && Array.isArray(catalog_item_ids) && catalog_item_ids.length > 0) {
      const catalogLinks = catalog_item_ids.map((itemId: string, index: number) => ({
        catalog_item_id: itemId,
        media_id: mediaData.id,
        display_order: index,
        is_primary: index === 0, // primeiro da lista é primary
        usage_context: "gallery",
      }));

      const { error: linkError } = await supabaseAdmin
        .from("catalog_item_media")
        .insert(catalogLinks);

      if (linkError) {
        console.error("Erro ao vincular produtos:", linkError);
        // Não falha o upload, apenas loga o erro
      }
    }

    res.json({
      success: true,
      media: mediaData,
      message: "Mídia enviada com sucesso",
    });
  } catch (error: any) {
    console.error("Erro no upload:", error);
    res.status(500).json({
      error: "Erro ao fazer upload",
      details: error.message,
    });
  }
});

/**
 * GET /api/media
 * Listar mídias com filtros
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { company_id } = (req as any).user;
    const {
      media_type,
      category,
      tags,
      search,
      is_active = "true",
      limit = "50",
      offset = "0",
    } = req.query;

    let query = supabaseAdmin
      .from("media_gallery")
      .select("*, catalog_item_media(catalog_item_id, is_primary)", { count: "exact" })
      .eq("company_id", company_id)
      .order("created_at", { ascending: false });

    // Filtros
    if (media_type) {
      query = query.eq("media_type", media_type);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (is_active) {
      query = query.eq("is_active", is_active === "true");
    }

    if (tags) {
      const tagsArray = Array.isArray(tags) ? tags : [tags];
      query = query.overlaps("tags", tagsArray);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,original_name.ilike.%${search}%`
      );
    }

    // Paginação
    query = query.range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      media: data,
      pagination: {
        total: count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error: any) {
    console.error("Erro ao listar mídias:", error);
    res.status(500).json({
      error: "Erro ao listar mídias",
      details: error.message,
    });
  }
});

/**
 * GET /api/media/:id
 * Buscar detalhes de uma mídia específica
 */
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { company_id } = (req as any).user;
    const { id } = req.params;

    // Buscar mídia
    const { data: mediaData, error: mediaError } = await supabaseAdmin
      .from("media_gallery")
      .select("*")
      .eq("id", id)
      .eq("company_id", company_id)
      .single();

    if (mediaError || !mediaData) {
      return res.status(404).json({ error: "Mídia não encontrada" });
    }

    // Buscar produtos vinculados
    const { data: linkedProducts, error: linkError } = await supabaseAdmin
      .from("catalog_item_media")
      .select(`
        catalog_item_id,
        is_primary,
        display_order,
        usage_context,
        catalog_items:catalog_item_id (
          id,
          name,
          item_type,
          sale_price
        )
      `)
      .eq("media_id", id);

    if (linkError) {
      console.error("Erro ao buscar produtos vinculados:", linkError);
    }

    res.json({
      success: true,
      media: {
        ...mediaData,
        linked_products: linkedProducts || [],
      },
    });
  } catch (error: any) {
    console.error("Erro ao buscar mídia:", error);
    res.status(500).json({
      error: "Erro ao buscar mídia",
      details: error.message,
    });
  }
});

/**
 * PUT /api/media/:id
 * Atualizar metadados de uma mídia
 */
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { company_id } = (req as any).user;
    const { id } = req.params;
    const { title, description, alt_text, category, tags, is_active, is_public } = req.body;

    // Construir objeto de atualização
    const updateData: any = { updated_at: new Date().toISOString() };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (alt_text !== undefined) updateData.alt_text = alt_text;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (is_public !== undefined) updateData.is_public = is_public;

    const { data, error } = await supabaseAdmin
      .from("media_gallery")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", company_id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Mídia não encontrada ou erro ao atualizar" });
    }

    res.json({
      success: true,
      media: data,
      message: "Mídia atualizada com sucesso",
    });
  } catch (error: any) {
    console.error("Erro ao atualizar mídia:", error);
    res.status(500).json({
      error: "Erro ao atualizar mídia",
      details: error.message,
    });
  }
});

/**
 * DELETE /api/media/:id
 * Deletar mídia (apenas ADMIN, MANAGER, SUPERVISOR)
 */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { company_id } = (req as any).user;
    const { role } = (req as any).profile || {};
    const { id } = req.params;

    // Verificar permissão
    if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(role)) {
      return res.status(403).json({
        error: "Acesso negado",
        message: "Apenas ADMIN, MANAGER ou SUPERVISOR podem deletar mídias",
      });
    }

    // Buscar informações da mídia
    const { data: mediaData, error: mediaError } = await supabaseAdmin
      .from("media_gallery")
      .select("storage_path")
      .eq("id", id)
      .eq("company_id", company_id)
      .single();

    if (mediaError || !mediaData) {
      return res.status(404).json({ error: "Mídia não encontrada" });
    }

    // Deletar do storage
    const { error: storageError } = await supabaseAdmin.storage
      .from("media_gallery")
      .remove([mediaData.storage_path]);

    if (storageError) {
      console.error("Erro ao deletar do storage:", storageError);
      // Continua mesmo com erro no storage
    }

    // Deletar do banco (cascade vai remover os links)
    const { error: deleteError } = await supabaseAdmin
      .from("media_gallery")
      .delete()
      .eq("id", id)
      .eq("company_id", company_id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    res.json({
      success: true,
      message: "Mídia deletada com sucesso",
    });
  } catch (error: any) {
    console.error("Erro ao deletar mídia:", error);
    res.status(500).json({
      error: "Erro ao deletar mídia",
      details: error.message,
    });
  }
});

/**
 * POST /api/media/:id/link-products
 * Vincular/desvincular produtos de uma mídia
 */
router.post("/:id/link-products", requireAuth, async (req: Request, res: Response) => {
  try {
    const { company_id } = (req as any).user;
    const { id: mediaId } = req.params;
    const { catalog_item_ids, action = "add" } = req.body; // action: 'add' | 'remove' | 'replace'

    if (!Array.isArray(catalog_item_ids) || catalog_item_ids.length === 0) {
      return res.status(400).json({
        error: "catalog_item_ids deve ser um array não vazio",
      });
    }

    // Verificar se a mídia existe e pertence à empresa
    const { data: mediaData, error: mediaError } = await supabaseAdmin
      .from("media_gallery")
      .select("id")
      .eq("id", mediaId)
      .eq("company_id", company_id)
      .single();

    if (mediaError || !mediaData) {
      return res.status(404).json({ error: "Mídia não encontrada" });
    }

    if (action === "remove") {
      // Remover vínculos
      const { error: deleteError } = await supabaseAdmin
        .from("catalog_item_media")
        .delete()
        .eq("media_id", mediaId)
        .in("catalog_item_id", catalog_item_ids);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return res.json({
        success: true,
        message: "Produtos desvinculados com sucesso",
      });
    }

    if (action === "replace") {
      // Remover todos os vínculos existentes primeiro
      await supabaseAdmin.from("catalog_item_media").delete().eq("media_id", mediaId);
    }

    // Adicionar novos vínculos
    const catalogLinks = catalog_item_ids.map((itemId: string, index: number) => ({
      catalog_item_id: itemId,
      media_id: mediaId,
      display_order: index,
      is_primary: index === 0,
      usage_context: "gallery",
    }));

    const { error: insertError } = await supabaseAdmin
      .from("catalog_item_media")
      .upsert(catalogLinks, {
        onConflict: "catalog_item_id,media_id",
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    res.json({
      success: true,
      message: "Produtos vinculados com sucesso",
    });
  } catch (error: any) {
    console.error("Erro ao vincular produtos:", error);
    res.status(500).json({
      error: "Erro ao vincular produtos",
      details: error.message,
    });
  }
});

/**
 * GET /api/media/products/:catalogItemId
 * Buscar todas as mídias vinculadas a um produto
 */
router.get("/products/:catalogItemId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { company_id } = (req as any).user;
    const { catalogItemId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("catalog_item_media")
      .select(`
        display_order,
        is_primary,
        usage_context,
        media_gallery:media_id (
          id,
          file_name,
          original_name,
          mime_type,
          file_size,
          public_url,
          media_type,
          title,
          description,
          alt_text,
          metadata,
          created_at
        )
      `)
      .eq("catalog_item_id", catalogItemId)
      .order("is_primary", { ascending: false })
      .order("display_order", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      media: data || [],
    });
  } catch (error: any) {
    console.error("Erro ao buscar mídias do produto:", error);
    res.status(500).json({
      error: "Erro ao buscar mídias do produto",
      details: error.message,
    });
  }
});

export default router;
