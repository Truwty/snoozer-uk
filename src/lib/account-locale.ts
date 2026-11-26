export const accountLocales = [
  { value: "en-US", label: "🇺🇸 English (United States)" },
  { value: "es-ES", label: "🇪🇸 Español (España)" },
  { value: "pt-BR", label: "🇧🇷 Português (Brasil)" },
  { value: "fr-FR", label: "🇫🇷 Français (France)" },
  { value: "de-DE", label: "🇩🇪 Deutsch (Deutschland)" },
  { value: "tr-TR", label: "🇹🇷 Türkçe (Türkiye)" },
] as const;
export type AccountLocale = typeof accountLocales[number]["value"];
export const defaultAccountLocale: AccountLocale = "en-US";
export function accountLocale(value: unknown): AccountLocale {
  return accountLocales.some((locale) => locale.value === value) ? value as AccountLocale : defaultAccountLocale;
}

const accountText: Record<AccountLocale, Record<string,string>> = {
  "en-US": {},
  "es-ES": {
    "Account Settings":"Configuración de la cuenta","General Information":"Información general","Username":"Nombre de usuario","Display Name":"Nombre para mostrar","Alias":"Alias","Email":"Correo electrónico","Language Settings":"Configuración de idioma","Choose language":"Elige el idioma de tu cuenta y panel.","Security Settings":"Configuración de seguridad","Multi-factor authentication":"Autenticación multifactor","Active sessions":"Sesiones activas","Connections":"Conexiones","Login with Google":"Iniciar sesión con Google","Login with Discord":"Iniciar sesión con Discord","Gift Links":"Enlaces de regalo","Buy a gift":"Comprar un regalo","No gift links yet":"Aún no hay enlaces de regalo","You don’t have any gift links yet.":"Todavía no tienes enlaces de regalo.","Email Marketing":"Correos de marketing","Email updates":"Novedades por correo","Account Actions":"Acciones de la cuenta","Regenerate Recovery Codes":"Regenerar códigos de recuperación","Change Email":"Cambiar correo electrónico","Change Password":"Cambiar contraseña","Logout":"Cerrar sesión","Delete Account":"Eliminar cuenta"
  },
  "pt-BR": {
    "Account Settings":"Configurações da conta","General Information":"Informações gerais","Username":"Nome de usuário","Display Name":"Nome de exibição","Alias":"Apelido","Email":"E-mail","Language Settings":"Configurações de idioma","Choose language":"Escolha o idioma da sua conta e do painel.","Security Settings":"Configurações de segurança","Multi-factor authentication":"Autenticação multifator","Active sessions":"Sessões ativas","Connections":"Conexões","Login with Google":"Entrar com Google","Login with Discord":"Entrar com Discord","Gift Links":"Links de presente","Buy a gift":"Comprar um presente","No gift links yet":"Ainda não há links de presente","You don’t have any gift links yet.":"Você ainda não tem links de presente.","Email Marketing":"E-mails de marketing","Email updates":"Atualizações por e-mail","Account Actions":"Ações da conta","Regenerate Recovery Codes":"Gerar novos códigos de recuperação","Change Email":"Alterar e-mail","Change Password":"Alterar senha","Logout":"Sair","Delete Account":"Excluir conta"
  },
  "fr-FR": {
    "Account Settings":"Paramètres du compte","General Information":"Informations générales","Username":"Nom d’utilisateur","Display Name":"Nom affiché","Alias":"Alias","Email":"E-mail","Language Settings":"Paramètres de langue","Choose language":"Choisissez la langue de votre compte et du tableau de bord.","Security Settings":"Paramètres de sécurité","Multi-factor authentication":"Authentification multifacteur","Active sessions":"Sessions actives","Connections":"Connexions","Login with Google":"Se connecter avec Google","Login with Discord":"Se connecter avec Discord","Gift Links":"Liens cadeaux","Buy a gift":"Acheter un cadeau","No gift links yet":"Aucun lien cadeau","You don’t have any gift links yet.":"Vous n’avez pas encore de lien cadeau.","Email Marketing":"E-mails marketing","Email updates":"Actualités par e-mail","Account Actions":"Actions du compte","Regenerate Recovery Codes":"Régénérer les codes de récupération","Change Email":"Changer d’e-mail","Change Password":"Changer le mot de passe","Logout":"Se déconnecter","Delete Account":"Supprimer le compte"
  },
  "de-DE": {
    "Account Settings":"Kontoeinstellungen","General Information":"Allgemeine Informationen","Username":"Benutzername","Display Name":"Anzeigename","Alias":"Alias","Email":"E-Mail","Language Settings":"Spracheinstellungen","Choose language":"Wähle die Sprache für dein Konto und Dashboard.","Security Settings":"Sicherheitseinstellungen","Multi-factor authentication":"Mehrstufige Authentifizierung","Active sessions":"Aktive Sitzungen","Connections":"Verbindungen","Login with Google":"Mit Google anmelden","Login with Discord":"Mit Discord anmelden","Gift Links":"Geschenklinks","Buy a gift":"Geschenk kaufen","No gift links yet":"Noch keine Geschenklinks","You don’t have any gift links yet.":"Du hast noch keine Geschenklinks.","Email Marketing":"E-Mail-Marketing","Email updates":"E-Mail-Neuigkeiten","Account Actions":"Kontoaktionen","Regenerate Recovery Codes":"Wiederherstellungscodes neu erstellen","Change Email":"E-Mail ändern","Change Password":"Passwort ändern","Logout":"Abmelden","Delete Account":"Konto löschen"
  },
  "tr-TR": {
    "Account Settings":"Hesap Ayarları","General Information":"Genel Bilgiler","Username":"Kullanıcı adı","Display Name":"Görünen ad","Alias":"Takma ad","Email":"E-posta","Language Settings":"Dil Ayarları","Choose language":"Hesabınız ve kontrol paneliniz için dili seçin.","Security Settings":"Güvenlik Ayarları","Multi-factor authentication":"Çok faktörlü kimlik doğrulama","Active sessions":"Etkin oturumlar","Connections":"Bağlantılar","Login with Google":"Google ile giriş","Login with Discord":"Discord ile giriş","Gift Links":"Hediye bağlantıları","Buy a gift":"Hediye satın al","No gift links yet":"Henüz hediye bağlantısı yok","You don’t have any gift links yet.":"Henüz hediye bağlantınız yok.","Email Marketing":"E-posta pazarlaması","Email updates":"E-posta güncellemeleri","Account Actions":"Hesap İşlemleri","Regenerate Recovery Codes":"Kurtarma kodlarını yenile","Change Email":"E-postayı değiştir","Change Password":"Şifreyi değiştir","Logout":"Çıkış yap","Delete Account":"Hesabı sil"
  },
};
export function accountLabel(locale: AccountLocale, key: string) {
  return accountText[locale][key] ?? key;
}
