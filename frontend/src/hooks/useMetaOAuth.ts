import { useEffect, useState } from "react";

const META_APP_ID = import.meta.env.VITE_META_APP_ID;

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: any;
  }
}

export function useMetaOAuth() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.FB) {
      setIsLoaded(true);
      return;
    }

    window.fbAsyncInit = function() {
      window.FB.init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v21.0"
      });
      setIsLoaded(true);
    };

    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s) as HTMLScriptElement;
      js.id = id;
      js.src = "https://connect.facebook.net/pt_BR/sdk.js";
      fjs.parentNode?.insertBefore(js, fjs);
    })(document, "script", "facebook-jssdk");
  }, []);

  const launchWhatsAppSignup = (): Promise<{ accessToken: string; wabaId: string }> => {
    return new Promise((resolve, reject) => {
      if (!window.FB) {
        return reject(new Error("Facebook SDK não carregado"));
      }

      window.FB.login(
        (response: any) => {
          if (response.authResponse) {
            const accessToken = response.authResponse.accessToken;
            // Para Embedded Signup, o WABA ID costuma vir em response.authResponse.waba_id 
            // ou através de um evento message. Mas no login direto simplificado:
            resolve({ 
                accessToken, 
                wabaId: response.authResponse.graphDomain === "facebook" ? "" : "" // Fallback
            });
          } else {
            reject(new Error("O usuário cancelou o login ou não autorizou o aplicativo."));
          }
        },
        {
          scope: "whatsapp_business_management,whatsapp_business_messaging",
          extras: {
            setup: {
              // Configurações extras de setup se necessário
            }
          }
        }
      );
    });
  };

  return { isLoaded, launchWhatsAppSignup };
}
