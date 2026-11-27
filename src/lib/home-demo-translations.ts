import type { AccountLocale } from "@/lib/account-locale";

const demoCopy = {
  "en-US": {
    alt: "Snoozer dashboard preview beside three overlapping creator profile previews, with profile backgrounds and social icons.",
    yourSpace: "YOUR SPACE", exampleNavigation: "Example dashboard navigation",
    account: "Account", customize: "Customize", links: "Links", premium: "Premium", imageHost: "Image host",
    accountOverview: "ACCOUNT OVERVIEW", dashboard: "Your dashboard", example: "EXAMPLE",
    username: "USERNAME", alias: "ALIAS", profileViews: "PROFILE VIEWS", pageStatus: "PAGE STATUS", published: "Published",
    viewsTitle: "Profile views", activity: "Example activity", lastSevenDays: "LAST 7 DAYS",
    manageAccount: "Manage your account", quickLinks: "Quick links and settings",
    changeUsername: "Change username", changeDisplayName: "Change display name",
    accountSettings: "Account settings", discordConnected: "Discord connected",
    weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    tagline: "YOUR SPACE. YOUR WAY.",
  },
  "es-ES": {
    alt: "Vista previa del panel de Snoozer junto a tres perfiles de creadores superpuestos, con fondos de perfil e iconos sociales.",
    yourSpace: "TU ESPACIO", exampleNavigation: "Navegación de ejemplo del panel",
    account: "Cuenta", customize: "Personalizar", links: "Enlaces", premium: "Premium", imageHost: "Alojamiento de imágenes",
    accountOverview: "RESUMEN DE LA CUENTA", dashboard: "Tu panel", example: "EJEMPLO",
    username: "NOMBRE DE USUARIO", alias: "ALIAS", profileViews: "VISITAS AL PERFIL", pageStatus: "ESTADO DE LA PÁGINA", published: "Publicado",
    viewsTitle: "Visitas al perfil", activity: "Actividad de ejemplo", lastSevenDays: "ÚLTIMOS 7 DÍAS",
    manageAccount: "Gestionar tu cuenta", quickLinks: "Accesos directos y ajustes",
    changeUsername: "Cambiar nombre de usuario", changeDisplayName: "Cambiar nombre visible",
    accountSettings: "Configuración de la cuenta", discordConnected: "Discord conectado",
    weekdays: ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"],
    tagline: "TU ESPACIO. A TU MANERA.",
  },
  "pt-BR": {
    alt: "Prévia do painel do Snoozer ao lado de três perfis de criadores sobrepostos, com fundos de perfil e ícones sociais.",
    yourSpace: "SEU ESPAÇO", exampleNavigation: "Navegação de exemplo do painel",
    account: "Conta", customize: "Personalizar", links: "Links", premium: "Premium", imageHost: "Hospedagem de imagens",
    accountOverview: "VISÃO GERAL DA CONTA", dashboard: "Seu painel", example: "EXEMPLO",
    username: "NOME DE USUÁRIO", alias: "APELIDO", profileViews: "VISUALIZAÇÕES DO PERFIL", pageStatus: "STATUS DA PÁGINA", published: "Publicado",
    viewsTitle: "Visualizações do perfil", activity: "Atividade de exemplo", lastSevenDays: "ÚLTIMOS 7 DIAS",
    manageAccount: "Gerencie sua conta", quickLinks: "Atalhos e configurações",
    changeUsername: "Alterar nome de usuário", changeDisplayName: "Alterar nome de exibição",
    accountSettings: "Configurações da conta", discordConnected: "Discord conectado",
    weekdays: ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"],
    tagline: "SEU ESPAÇO. DO SEU JEITO.",
  },
  "fr-FR": {
    alt: "Aperçu du tableau de bord Snoozer à côté de trois profils de créateurs superposés, avec leurs arrière-plans et icônes sociales.",
    yourSpace: "VOTRE ESPACE", exampleNavigation: "Navigation d’exemple du tableau de bord",
    account: "Compte", customize: "Personnaliser", links: "Liens", premium: "Premium", imageHost: "Hébergement d’images",
    accountOverview: "APERÇU DU COMPTE", dashboard: "Votre tableau de bord", example: "EXEMPLE",
    username: "NOM D’UTILISATEUR", alias: "ALIAS", profileViews: "VUES DU PROFIL", pageStatus: "ÉTAT DE LA PAGE", published: "Publié",
    viewsTitle: "Vues du profil", activity: "Activité fictive", lastSevenDays: "7 DERNIERS JOURS",
    manageAccount: "Gérer votre compte", quickLinks: "Raccourcis et paramètres",
    changeUsername: "Modifier le nom d’utilisateur", changeDisplayName: "Modifier le nom affiché",
    accountSettings: "Paramètres du compte", discordConnected: "Discord connecté",
    weekdays: ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"],
    tagline: "VOTRE ESPACE. À VOTRE IMAGE.",
  },
  "de-DE": {
    alt: "Snoozer-Dashboard-Vorschau neben drei überlappenden Creator-Profilen mit Profilhintergründen und Social-Media-Symbolen.",
    yourSpace: "DEIN BEREICH", exampleNavigation: "Beispielnavigation des Dashboards",
    account: "Konto", customize: "Anpassen", links: "Links", premium: "Premium", imageHost: "Bildhosting",
    accountOverview: "KONTOÜBERSICHT", dashboard: "Dein Dashboard", example: "BEISPIEL",
    username: "BENUTZERNAME", alias: "ALIAS", profileViews: "PROFILAUFRUFE", pageStatus: "SEITENSTATUS", published: "Veröffentlicht",
    viewsTitle: "Profilaufrufe", activity: "Beispielaktivität", lastSevenDays: "LETZTE 7 TAGE",
    manageAccount: "Konto verwalten", quickLinks: "Kurzlinks und Einstellungen",
    changeUsername: "Benutzernamen ändern", changeDisplayName: "Anzeigenamen ändern",
    accountSettings: "Kontoeinstellungen", discordConnected: "Discord verbunden",
    weekdays: ["MO", "DI", "MI", "DO", "FR", "SA", "SO"],
    tagline: "DEIN BEREICH. DEIN STIL.",
  },
  "tr-TR": {
    alt: "Snoozer kontrol paneli önizlemesi ve profil arka planları ile sosyal simgeler içeren, üst üste duran üç içerik üretici profili.",
    yourSpace: "SENİN ALANIN", exampleNavigation: "Örnek kontrol paneli gezinmesi",
    account: "Hesap", customize: "Özelleştir", links: "Bağlantılar", premium: "Premium", imageHost: "Görsel barındırma",
    accountOverview: "HESAP GENEL BAKIŞI", dashboard: "Kontrol panelin", example: "ÖRNEK",
    username: "KULLANICI ADI", alias: "TAKMA AD", profileViews: "PROFİL GÖRÜNTÜLENMESİ", pageStatus: "SAYFA DURUMU", published: "Yayında",
    viewsTitle: "Profil görüntülenmeleri", activity: "Örnek etkinlik", lastSevenDays: "SON 7 GÜN",
    manageAccount: "Hesabını yönet", quickLinks: "Hızlı bağlantılar ve ayarlar",
    changeUsername: "Kullanıcı adını değiştir", changeDisplayName: "Görünen adı değiştir",
    accountSettings: "Hesap ayarları", discordConnected: "Discord bağlı",
    weekdays: ["PZT", "SAL", "ÇAR", "PER", "CUM", "CMT", "PAZ"],
    tagline: "SENİN ALANIN. SENİN TARZIN.",
  },
} satisfies Record<AccountLocale, {
  alt: string; yourSpace: string; exampleNavigation: string; account: string; customize: string; links: string;
  premium: string; imageHost: string; accountOverview: string; dashboard: string; example: string;
  username: string; alias: string; profileViews: string; pageStatus: string; published: string;
  viewsTitle: string; activity: string; lastSevenDays: string; manageAccount: string; quickLinks: string;
  changeUsername: string; changeDisplayName: string; accountSettings: string; discordConnected: string;
  weekdays: string[]; tagline: string;
}>;

export function homeDemoContent(locale: AccountLocale) {
  return demoCopy[locale];
}
