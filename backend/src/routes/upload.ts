import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import multer from "multer";
import sharp from "sharp";

const router = Router();

// Configurar multer para logo (PNG apenas)
const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PNG são permitidos'));
    }
  },
});

// Configurar multer para avatar (PNG, JPG, JPEG)
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.match(/^image\/(png|jpeg|jpg)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PNG, JPG ou JPEG são permitidos'));
    }
  },
});

router.post("/company-logo", requireAuth, uploadLogo.single('logo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const file = req.file;

      // Validar e redimensionar imagem se necessário
      const image = sharp(file.buffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        return res.status(400).json({ error: "Não foi possível ler as dimensões da imagem" });
      }

      const maxDimension = 1000;
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        return res.status(400).json({ 
          error: `As dimensões devem ser no máximo ${maxDimension}x${maxDimension}px` 
        });
      }

      // Gerar nome único para o arquivo
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      const filePath = `company-logos/${fileName}`;

      // Upload para o Supabase Storage usando o admin client
      const { data, error } = await supabaseAdmin.storage
        .from('public_logo')
        .upload(filePath, file.buffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error("Erro ao fazer upload:", error);
        throw error;
      }

      // Obter URL pública
      const { data: publicData } = supabaseAdmin.storage
        .from('public_logo')
        .getPublicUrl(filePath);

      return res.json({ 
        success: true, 
        url: publicData.publicUrl,
        path: filePath 
      });

    } catch (error: any) {
      console.error("Erro no upload:", error);
      return res.status(500).json({ 
        error: error.message || "Erro ao fazer upload da imagem" 
      });
    }
  });

router.post("/profile-avatar", requireAuth, uploadAvatar.single('avatar'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const file = req.file;

      // Validar e redimensionar imagem se necessário
      const image = sharp(file.buffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        return res.status(400).json({ error: "Não foi possível ler as dimensões da imagem" });
      }

      const maxDimension = 500;
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        return res.status(400).json({ 
          error: `As dimensões devem ser no máximo ${maxDimension}x${maxDimension}px` 
        });
      }

      // Gerar nome único para o arquivo
      const userId = req.user?.id || 'unknown';
      const fileExt = file.mimetype.split('/')[1];
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload para o Supabase Storage usando o admin client
      const { data, error } = await supabaseAdmin.storage
        .from('profile_avatars')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error("Erro ao fazer upload do avatar:", error);
        throw error;
      }

      // Obter URL pública
      const { data: publicData } = supabaseAdmin.storage
        .from('profile_avatars')
        .getPublicUrl(filePath);

      return res.json({ 
        success: true, 
        url: publicData.publicUrl,
        path: filePath 
      });

    } catch (error: any) {
      console.error("Erro no upload do avatar:", error);
      return res.status(500).json({ 
        error: error.message || "Erro ao fazer upload do avatar" 
      });
    }
  });

export default router;
