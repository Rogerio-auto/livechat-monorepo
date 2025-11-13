// Middleware de autenticação simplificado para onboarding
// Usa sessão criada durante o signup

export function requireOnboardingAuth(req: any, res: any, next: any) {
  // Verificar se existe sessão ativa
  if (!req.session || (!req.session.userId && !req.session.companyId)) {
    return res.status(401).json({ 
      error: "Não autenticado", 
      message: "Você precisa fazer login primeiro" 
    });
  }

  // Adicionar dados da sessão ao req.user para compatibilidade
  req.user = req.user || {};
  req.user.id = req.session.userId;
  req.user.companyId = req.session.companyId;

  next();
}
