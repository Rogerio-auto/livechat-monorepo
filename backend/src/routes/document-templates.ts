/**
 * Rotas para gerenciamento de templates de documentos
 */

import express from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { DOCS_BUCKET } from "../config/env.js";
import {
  generateDocumentFromTemplate,
  createSignedUrl,
  downloadGeneratedDocument,
} from "../services/document-generator.js";
import { getAvailableVariables } from "../services/document-variables.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function registerDocumentTemplateRoutes(app: express.Application) {
  // Listar templates da empresa
  app.get("/document-templates", requireAuth, async (req: any, res) => {
    try {
      const { data: urow } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (!urow?.company_id) {
        return res.status(404).json({ error: "Usuário sem empresa" });
      }

      const docType = req.query.doc_type as string | undefined;

      let query = supabaseAdmin
        .from("document_templates")
        .select("*")
        .eq("company_id", urow.company_id)
        .order("created_at", { ascending: false });

      if (docType) {
        query = query.eq("doc_type", docType.toUpperCase());
      }

      const { data, error } = await query;

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erro ao listar templates" });
    }
  });

  // Obter um template específico
  app.get("/document-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;

      const { data: urow } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (!urow?.company_id) {
        return res.status(404).json({ error: "Usuário sem empresa" });
      }

      const { data, error } = await supabaseAdmin
        .from("document_templates")
        .select("*")
        .eq("id", id)
        .eq("company_id", urow.company_id)
        .maybeSingle();

      if (error || !data) {
        return res.status(404).json({ error: "Template não encontrado" });
      }

      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erro ao buscar template" });
    }
  });

  // Upload de novo template
  app.post(
    "/document-templates",
    requireAuth,
    upload.single("template"),
    async (req: any, res) => {
      try {
        const { data: urow } = await supabaseAdmin
          .from("users")
          .select("id, company_id")
          .eq("user_id", req.user.id)
          .maybeSingle();

        if (!urow?.company_id) {
          return res.status(404).json({ error: "Usuário sem empresa" });
        }

        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: "Arquivo de template obrigatório" });
        }

        // Validar tipo de arquivo
        if (
          file.mimetype !==
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          return res.status(400).json({ error: "Apenas arquivos DOCX são permitidos" });
        }

        const body = req.body;
        const name = body.name || "Template sem nome";
        const description = body.description || null;
        const docType = (body.doc_type || "OUTRO").toUpperCase();
        const isDefault = body.is_default === "true" || body.is_default === true;

        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const sanitizedName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        const fileName = `template_${sanitizedName}_${timestamp}.docx`;
        const templatePath = `${urow.company_id}/templates/${fileName}`;

        // Upload do template para o Storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from(DOCS_BUCKET)
          .upload(templatePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          return res.status(500).json({ error: `Erro ao fazer upload: ${uploadError.message}` });
        }

        // Se for default, remover default dos outros templates do mesmo tipo
        if (isDefault) {
          await supabaseAdmin
            .from("document_templates")
            .update({ is_default: false })
            .eq("company_id", urow.company_id)
            .eq("doc_type", docType);
        }

        // Inserir registro do template no banco
        const { data: template, error: insertError } = await supabaseAdmin
          .from("document_templates")
          .insert([
            {
              company_id: urow.company_id,
              name,
              description,
              doc_type: docType,
              template_path: templatePath,
              is_active: true,
              is_default: isDefault,
              created_by: urow.id,
            },
          ])
          .select()
          .single();

        if (insertError) {
          // Tentar deletar o arquivo do storage
          await supabaseAdmin.storage.from(DOCS_BUCKET).remove([templatePath]);
          return res.status(500).json({ error: insertError.message });
        }

        return res.status(201).json(template);
      } catch (e: any) {
        return res.status(500).json({ error: e.message || "Erro ao criar template" });
      }
    }
  );

  // Atualizar template
  app.patch("/document-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;

      const { data: urow } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (!urow?.company_id) {
        return res.status(404).json({ error: "Usuário sem empresa" });
      }

      const body = req.body;
      const updates: any = {};

      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined) updates.description = body.description;
      if (body.is_active !== undefined) updates.is_active = body.is_active;
      if (body.is_default !== undefined) {
        updates.is_default = body.is_default;

        // Se estiver setando como default, remover dos outros
        if (body.is_default) {
          const { data: template } = await supabaseAdmin
            .from("document_templates")
            .select("doc_type")
            .eq("id", id)
            .maybeSingle();

          if (template) {
            await supabaseAdmin
              .from("document_templates")
              .update({ is_default: false })
              .eq("company_id", urow.company_id)
              .eq("doc_type", template.doc_type)
              .neq("id", id);
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar" });
      }

      const { data, error } = await supabaseAdmin
        .from("document_templates")
        .update(updates)
        .eq("id", id)
        .eq("company_id", urow.company_id)
        .select()
        .maybeSingle();

      if (error || !data) {
        return res.status(404).json({ error: "Template não encontrado" });
      }

      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erro ao atualizar template" });
    }
  });

  // Deletar template
  app.delete("/document-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;

      const { data: urow } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (!urow?.company_id) {
        return res.status(404).json({ error: "Usuário sem empresa" });
      }

      // Buscar template
      const { data: template, error: fetchError } = await supabaseAdmin
        .from("document_templates")
        .select("template_path")
        .eq("id", id)
        .eq("company_id", urow.company_id)
        .maybeSingle();

      if (fetchError || !template) {
        return res.status(404).json({ error: "Template não encontrado" });
      }

      // Deletar arquivo do storage
      await supabaseAdmin.storage.from(DOCS_BUCKET).remove([template.template_path]);

      // Deletar registro do banco
      const { error: deleteError } = await supabaseAdmin
        .from("document_templates")
        .delete()
        .eq("id", id)
        .eq("company_id", urow.company_id);

      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erro ao deletar template" });
    }
  });

  // ========================================
  // NOVA ROTA: Gerar documento direto de proposta
  // ========================================
  app.post("/document-templates/:templateId/generate-from-proposal", requireAuth, async (req: any, res) => {
    try {
      console.log("[DocGen Route] Iniciando geração de documento...");
      const { templateId } = req.params;
      const { proposal_id, custom_variables } = req.body;

      console.log("[DocGen Route] Params:", { templateId, proposal_id });

      if (!proposal_id) {
        return res.status(400).json({ error: "proposal_id obrigatório" });
      }

      const { data: urow } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (!urow?.company_id) {
        return res.status(404).json({ error: "Usuário sem empresa" });
      }

      console.log("[DocGen Route] Company ID:", urow.company_id);

      // Buscar template
      const { data: template, error: templateError } = await supabaseAdmin
        .from("document_templates")
        .select("*")
        .eq("id", templateId)
        .eq("company_id", urow.company_id)
        .eq("is_active", true)
        .maybeSingle();

      if (templateError || !template) {
        console.error("[DocGen Route] Template não encontrado:", templateError);
        return res.status(404).json({ error: "Template não encontrado" });
      }

      console.log("[DocGen Route] Template encontrado:", template.name);

      // Buscar dados da proposta e relacionados
      const { data: proposal, error: proposalError } = await supabaseAdmin
        .from("proposals")
        .select("*")
        .eq("id", proposal_id)
        .eq("company_id", urow.company_id)
        .maybeSingle();

      if (proposalError || !proposal) {
        console.error("[DocGen Route] Proposta não encontrada:", proposalError);
        return res.status(404).json({ error: "Proposta não encontrada" });
      }

      console.log("[DocGen Route] Proposta encontrada:", proposal.number);

      // Buscar dados relacionados em paralelo
      const [companyRes, customerRes, leadRes] = await Promise.all([
        supabaseAdmin.from("companies").select("*").eq("id", urow.company_id).maybeSingle(),
        proposal.customer_id
          ? supabaseAdmin.from("customers").select("*").eq("id", proposal.customer_id).maybeSingle()
          : Promise.resolve({ data: null }),
        proposal.lead_id
          ? supabaseAdmin.from("leads").select("*").eq("id", proposal.lead_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      console.log("[DocGen Route] Dados relacionados carregados:", {
        hasCompany: !!companyRes.data,
        hasCustomer: !!customerRes.data,
        hasLead: !!leadRes.data,
      });

      // Gerar documento
      console.log("[DocGen Route] Chamando generateDocumentFromTemplate...");
      const result = await generateDocumentFromTemplate(
        templateId,
        urow.company_id,
        {
          company: companyRes.data,
          customer: customerRes.data,
          lead: leadRes.data,
          proposal,
        },
        custom_variables
      );

      if (!result.success) {
        console.error("[DocGen Route] Falha na geração:", result.error);
        return res.status(500).json({ error: result.error });
      }

      console.log("[DocGen Route] Documento gerado com sucesso:", result.generatedPath);

      // Criar registro do documento gerado
      const { data: newDoc, error: docError } = await supabaseAdmin
        .from("documents")
        .insert({
          company_id: urow.company_id,
          customer_id: proposal.customer_id,
          proposta_id: proposal_id,
          doc_type: template.doc_type,
          template_id: templateId,
          generated_path: result.generatedPath,
          pdf_path: result.generatedPath,
          created_by: urow.id,
          variables: custom_variables || {},
        })
        .select()
        .single();

      if (docError) {
        console.error("[DocGen Route] Erro ao criar registro do documento:", docError);
        // Não falha aqui, apenas loga
      }

      console.log("[DocGen Route] Registro criado:", newDoc?.id);

      // Criar signed URL para download
      const signedUrlResult = await createSignedUrl(result.generatedPath!, 300);

      console.log("[DocGen Route] URL assinada criada");

      return res.json({
        success: true,
        document_id: newDoc?.id,
        generated_path: result.generatedPath,
        public_url: result.publicUrl,
        download_url: signedUrlResult.signedUrl,
      });
    } catch (e: any) {
      console.error("[DocGen Route] Erro geral:", e);
      console.error("[DocGen Route] Stack:", e.stack);
      return res.status(500).json({ error: e.message || "Erro ao gerar documento" });
    }
  });

  // Gerar documento a partir de um template
  app.post("/documents/:id/generate", requireAuth, async (req: any, res) => {
    try {
      const { id: documentId } = req.params;

      const { data: urow } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (!urow?.company_id) {
        return res.status(404).json({ error: "Usuário sem empresa" });
      }

      // Buscar documento
      const { data: document, error: docError } = await supabaseAdmin
        .from("documents")
        .select("*, template_id, customer_id, proposta_id")
        .eq("id", documentId)
        .eq("company_id", urow.company_id)
        .maybeSingle();

      if (docError || !document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      // Buscar dados relacionados
      const [companyRes, customerRes, proposalRes] = await Promise.all([
        supabaseAdmin.from("companies").select("*").eq("id", urow.company_id).maybeSingle(),
        document.customer_id
          ? supabaseAdmin.from("customers").select("*").eq("id", document.customer_id).maybeSingle()
          : Promise.resolve({ data: null }),
        document.proposta_id
          ? supabaseAdmin.from("proposals").select("*").eq("id", document.proposta_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const templateId = document.template_id || req.body.template_id;

      if (!templateId) {
        return res.status(400).json({ error: "template_id obrigatório" });
      }

      // Gerar documento
      const result = await generateDocumentFromTemplate(
        templateId,
        urow.company_id,
        {
          company: companyRes.data,
          customer: customerRes.data,
          proposal: proposalRes.data,
          document,
        },
        req.body.custom_variables
      );

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      // Atualizar documento com caminho gerado
      await supabaseAdmin
        .from("documents")
        .update({
          generated_path: result.generatedPath,
          pdf_path: result.generatedPath, // por compatibilidade
        })
        .eq("id", documentId);

      return res.json({
        success: true,
        generated_path: result.generatedPath,
        public_url: result.publicUrl,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erro ao gerar documento" });
    }
  });

  // Download de documento gerado
  app.get("/documents/:id/download-generated", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;

      const { data: urow } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (!urow?.company_id) {
        return res.status(404).json({ error: "Usuário sem empresa" });
      }

      const { data: document } = await supabaseAdmin
        .from("documents")
        .select("generated_path")
        .eq("id", id)
        .eq("company_id", urow.company_id)
        .maybeSingle();

      if (!document?.generated_path) {
        return res.status(404).json({ error: "Documento gerado não encontrado" });
      }

      const urlResult = await createSignedUrl(document.generated_path, 60);

      if (!urlResult.success || !urlResult.signedUrl) {
        return res.status(500).json({ error: urlResult.error });
      }

      return res.redirect(urlResult.signedUrl);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erro ao baixar documento" });
    }
  });

  // Obter variáveis disponíveis
  app.get("/document-variables", requireAuth, async (_req, res) => {
    try {
      const variables = getAvailableVariables();
      return res.json(variables);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
}
