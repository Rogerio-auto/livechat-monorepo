import React from 'react';
import { 
  Users, 
  Eye, 
  Edit2, 
  Plus, 
  Settings, 
  Ban, 
  Check, 
  Calendar 
} from 'lucide-react';
import { useCalendarPermissionsSettings } from '../../hooks/useCalendarPermissionsSettings';
import { Button } from '../../components/ui/Button';

const Field = ({ label, children, description }: { label: string; children: React.ReactNode; description?: string }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <div className="md:col-span-1">
      <label className="block text-sm font-semibold text-gray-900 dark:text-white">
        {label}
      </label>
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div className="md:col-span-2">
      {children}
    </div>
  </div>
);

const PermissoesCalendarioPage: React.FC = () => {
  const {
    calendars,
    allUsers,
    selectedCalendarId,
    setSelectedCalendarId,
    permissions,
    loading,
    newPermission,
    setNewPermission,
    handleGrantAccess,
    handleRevokeAccess,
  } = useCalendarPermissionsSettings();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Permissões de Calendário</h2>
        <p className="text-gray-500 dark:text-gray-400">Gerencie quem pode visualizar e editar seus calendários.</p>
      </div>

      <div className="space-y-12">
        <section className="overflow-hidden">
          <div className="py-6 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar size={20} className="text-blue-500" />
              Configurar Acessos
            </h3>
          </div>

          <div className="">
            <Field 
              label="Calendário" 
              description="Selecione qual calendário você deseja gerenciar as permissões."
            >
              <select
                value={selectedCalendarId}
                onChange={(e) => setSelectedCalendarId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              >
                <option value="">Escolha um calendário...</option>
                {calendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.name}
                  </option>
                ))}
              </select>
            </Field>

            {selectedCalendarId && (
              <>
                <Field 
                  label="Usuários com Acesso" 
                  description="Lista de colaboradores que possuem permissão neste calendário."
                >
                  <div className="space-y-3">
                    {loading ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                      </div>
                    ) : permissions.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma permissão concedida ainda.</p>
                      </div>
                    ) : (
                      permissions.map((perm) => (
                        <div
                          key={perm.user_id}
                          className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                              {perm.users?.name?.substring(0, 2).toUpperCase() || "??"}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                {perm.users?.name || "Usuário"}
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{perm.users?.email}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex gap-1">
                              {perm.can_view && <span className="px-2 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase">Ver</span>}
                              {perm.can_edit && <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase">Edit</span>}
                              {perm.can_manage && <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-[10px] font-bold uppercase">Adm</span>}
                            </div>
                            <button
                              onClick={() => handleRevokeAccess(perm.user_id)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Ban size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Field>

                <Field 
                  label="Conceder Acesso" 
                  description="Adicione um novo colaborador e defina suas permissões."
                >
                  <div className="space-y-4">
                    <select
                      value={newPermission.user_id}
                      onChange={(e) => setNewPermission({ ...newPermission, user_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                    >
                      <option value="">Selecione um usuário...</option>
                      {allUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.email}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'can_view', label: 'Visualizar', icon: <Eye size={14} /> },
                        { id: 'can_edit', label: 'Editar', icon: <Edit2 size={14} /> },
                        { id: 'can_create_events', label: 'Criar Eventos', icon: <Plus size={14} /> },
                        { id: 'can_manage', label: 'Gerenciar', icon: <Settings size={14} /> },
                      ].map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-500 cursor-pointer transition-all"
                        >
                          <input
                            type="checkbox"
                            checked={(newPermission as any)[item.id]}
                            onChange={(e) => setNewPermission({ ...newPermission, [item.id]: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                            {item.icon}
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>

                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={handleGrantAccess}
                      disabled={!newPermission.user_id}
                    >
                      Conceder Acesso
                    </Button>
                  </div>
                </Field>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PermissoesCalendarioPage;
