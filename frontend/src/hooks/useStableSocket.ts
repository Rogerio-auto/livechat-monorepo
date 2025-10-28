import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";


/**
* Conecta o socket **uma vez** e despacha eventos para callbacks sempre atualizados.
* NÃO usa estados voláteis como dependências – evita perder foco a cada tecla.
*/
export function useStableSocket(
apiBase: string,
handlers: Partial<{
onCompanyUpdated: (p: any) => void;
onProfileUpdated: (p: any) => void;
onInboxCreated: (p: any) => void;
onInboxUpdated: (p: any) => void;
onInboxUsersUpdated: (p: any) => void;
}>
) {
const hRef = useRef(handlers);
const socketRef = useRef<Socket | null>(null);


useEffect(() => { hRef.current = handlers; }, [handlers]);


useEffect(() => {
const s = io(apiBase, { withCredentials: true });
socketRef.current = s;


s.on("company:updated", (p) => hRef.current.onCompanyUpdated?.(p));
s.on("profile:updated", (p) => hRef.current.onProfileUpdated?.(p));
s.on("inbox:created", (p) => hRef.current.onInboxCreated?.(p));
s.on("inbox:updated", (p) => hRef.current.onInboxUpdated?.(p));
s.on("inbox:users:updated", (p) => hRef.current.onInboxUsersUpdated?.(p));


return () => { s.disconnect(); };
}, [apiBase]);


return socketRef;
}