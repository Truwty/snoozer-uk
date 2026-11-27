import type { AccountLocale } from "@/lib/account-locale";

export type HomeContent = {
  nav: { help: string; templates: string; discover: string; leaderboard: string; pricing: string };
  hero: { badge: string; title: string; lead: string; signup: string; viewPricing: string; note: string };
  proof: { eyebrow: string; title: string; description: string };
  features: { title: string; description: string }[];
  claim: { eyebrow: string; title: string; description: string };
  plans: {
    eyebrow: string; title: string; emphasis: string; description: string;
    freeKicker: string; freeDescription: string; freeFeatures: string[]; freeButton: string;
    premiumKicker: string; premiumDescription: string; premiumFeatures: string[]; premiumButton: string;
    priceLabel: string; pricesNote: string; compareLink: string;
  };
  faq: { eyebrow: string; title: string; items: { question: string; answer: string }[] };
  finalCta: { eyebrow: string; title: string; description: string };
  footer: {
    description: string; general: string; resources: string; contact: string; legal: string;
    login: string; signup: string; pricing: string; leaderboard: string; help: string;
    templates: string; discover: string; support: string; supportEmail: string;
    terms: string; privacy: string; legalInfo: string; copyright: string; tagline: string;
  };
  claimForm: {
    username: string; checking: string; checkAvailability: string; claimNow: string;
    claiming: string; claimAddress: string; available: string; unavailable: string; checkFailed: string;
    invalid: string;
  };
};

const english: HomeContent = {
  nav: { help: "Help Center", templates: "Templates", discover: "Discover", leaderboard: "Leaderboard", pricing: "Pricing" },
  hero: {
    badge: "YOUR SPACE. YOUR WAY.",
    title: "Everything you want, right here.",
    lead: "Your socials, photos and projects, brought together on one custom Snoozer profile. Build a page that feels like you, then share it with one simple link.",
    signup: "Sign up for free", viewPricing: "View pricing", note: "Free to start. Yours to customise.",
  },
  proof: {
    eyebrow: "ONE LINK. YOUR WHOLE WORLD.",
    title: "A little space for everything you do.",
    description: "Bring the things people come to find together, and give them a page that feels unmistakably yours.",
  },
  features: [
    { title: "Your links", description: "Keep socials, websites, communities and projects together." },
    { title: "Your look", description: "Make your page yours with themes, layouts, effects and widgets." },
    { title: "Your media", description: "Showcase photos, creative work and supported profile media." },
    { title: "Your control", description: "Choose what to publish and whether to opt into creator discovery." },
  ],
  claim: {
    eyebrow: "MAKE IT YOURS",
    title: "Claim your profile and get started in minutes.",
    description: "Choose a username people will remember. Your Snoozer address is ready to become your own.",
  },
  plans: {
    eyebrow: "START FREE. GROW WHEN YOU'RE READY.",
    title: "Explore your options.",
    emphasis: "Make room for more.",
    description: "Create a page for free, then choose the Snoozer Premium tier that fits the way you create.",
    freeKicker: "THE STARTING POINT",
    freeDescription: "For getting started and bringing your socials together in one place.",
    freeFeatures: [
      "Create and publish a personal page",
      "Add your links and profile content",
      "Choose from available themes and layouts",
      "Share one memorable profile address",
    ],
    freeButton: "Get started free",
    premiumKicker: "MORE ROOM TO CREATE",
    premiumDescription: "More ways to build, customise and grow your online space. Choose a tier and billing cycle.",
    premiumFeatures: [
      "More profile customisation",
      "Additional profile and media options",
      "More tools for growing creators",
      "Monthly and yearly plan options",
    ],
    premiumButton: "Compare Premium plans",
    priceLabel: "Snoozer Premium prices",
    pricesNote: "Prices are in GBP.",
    compareLink: "Compare plan limits, features and billing details.",
  },
  faq: {
    eyebrow: "A FEW THINGS YOU MIGHT BE WONDERING",
    title: "Frequently Asked Questions",
    items: [
      { question: "What is Snoozer?", answer: "Snoozer is a link-in-bio platform where you can bring your socials, websites, projects and supported media together on one personal page. Share one Snoozer address instead of sending people all over the internet." },
      { question: "Can I use Snoozer for free?", answer: "Yes. You can create and publish a free Snoozer page. Plus, Pro and Studio are optional Premium tiers for people who want additional profile, storage and customisation features." },
      { question: "What can I put on my profile?", answer: "Add social links, websites, profile text, photos and supported widgets. Available media tools and limits depend on your plan. Your public page only shows the content you choose to publish." },
      { question: "Can I customise how my page looks?", answer: "Yes. Creator Studio lets you work with themes, colours, layouts, backgrounds, effects and profile widgets. You can preview your changes before publishing your page." },
      { question: "Is my profile automatically listed in Discover?", answer: "No. Creator discovery is opt-in and your directory listing is off by default. You choose whether your profile can appear in public creator discovery; publishing a profile does not switch that setting on." },
      { question: "How do Premium plans and cancellations work?", answer: "Snoozer Premium offers Plus, Pro and Studio with monthly or yearly billing. You can compare the current features and prices on the Pricing page. Active subscribers can manage their subscription through the account billing tools." },
    ],
  },
  finalCta: {
    eyebrow: "READY WHEN YOU ARE",
    title: "Everything you want, right here.",
    description: "Join Snoozer and bring the links, work and moments you want to share into one place.",
  },
  footer: {
    description: "Your links, your work and everything you want to share. All in one place.",
    general: "General", resources: "Resources", contact: "Contact", legal: "Legal",
    login: "Login", signup: "Sign up", pricing: "Pricing", leaderboard: "Leaderboard",
    help: "Help Center", templates: "Templates", discover: "Discover",
    support: "Help and support", supportEmail: "Support email",
    terms: "Terms of Service", privacy: "Privacy Policy", legalInfo: "Legal information",
    copyright: "© 2026 Snoozer.uk. All rights reserved.", tagline: "A place to be yourself.",
  },
  claimForm: {
    username: "Username", checking: "Checking…", checkAvailability: "Check availability",
    claimNow: "Claim now", claiming: "Claiming…", claimAddress: "Claim address",
    available: "Available. Claim it to reserve it.", unavailable: "That address is unavailable.",
    checkFailed: "Couldn’t check availability. Try again.", invalid: "Enter a valid username.",
  },
};

const translations: Record<Exclude<AccountLocale, "en-US">, HomeContent> = {
  "es-ES": {
    nav: { help: "Centro de ayuda", templates: "Plantillas", discover: "Descubrir", leaderboard: "Clasificación", pricing: "Precios" },
    hero: {
      badge: "TU ESPACIO. A TU MANERA.",
      title: "Todo lo que quieres, aquí mismo.",
      lead: "Tus redes sociales, fotos y proyectos, reunidos en un perfil Snoozer personalizado. Crea una página que te represente y compártela con un solo enlace.",
      signup: "Regístrate gratis", viewPricing: "Ver precios", note: "Empieza gratis. Personalízalo a tu gusto.",
    },
    proof: {
      eyebrow: "UN ENLACE. TODO TU MUNDO.",
      title: "Un pequeño espacio para todo lo que haces.",
      description: "Reúne todo lo que la gente busca y dales una página que sea inconfundiblemente tuya.",
    },
    features: [
      { title: "Tus enlaces", description: "Reúne tus redes sociales, sitios web, comunidades y proyectos." },
      { title: "Tu estilo", description: "Personaliza tu página con temas, diseños, efectos y widgets." },
      { title: "Tu contenido", description: "Muestra fotos, trabajos creativos y contenido multimedia compatible." },
      { title: "Tu control", description: "Elige qué publicar y si quieres aparecer en el directorio de creadores." },
    ],
    claim: {
      eyebrow: "HAZLO TUYO",
      title: "Reclama tu perfil y empieza en solo unos minutos.",
      description: "Elige un nombre de usuario fácil de recordar. Tu dirección de Snoozer está lista para ser tuya.",
    },
    plans: {
      eyebrow: "EMPIEZA GRATIS. CRECE CUANDO QUIERAS.",
      title: "Descubre tus opciones.",
      emphasis: "Haz sitio para más.",
      description: "Crea una página gratis y después elige el plan Snoozer Premium que mejor se adapte a ti.",
      freeKicker: "EL PUNTO DE PARTIDA",
      freeDescription: "Para empezar y reunir tus redes sociales en un solo lugar.",
      freeFeatures: [
        "Crea y publica una página personal",
        "Añade tus enlaces y contenido de perfil",
        "Elige entre los temas y diseños disponibles",
        "Comparte una dirección de perfil fácil de recordar",
      ],
      freeButton: "Empieza gratis",
      premiumKicker: "MÁS ESPACIO PARA CREAR",
      premiumDescription: "Más formas de crear, personalizar y hacer crecer tu espacio online. Elige un plan y un ciclo de facturación.",
      premiumFeatures: [
        "Más opciones de personalización del perfil",
        "Opciones adicionales de perfil y contenido multimedia",
        "Más herramientas para creadores en crecimiento",
        "Planes de pago mensuales y anuales",
      ],
      premiumButton: "Comparar planes Premium",
      priceLabel: "Precios de Snoozer Premium",
      pricesNote: "Los precios están en GBP.",
      compareLink: "Compara los límites, las funciones y los detalles de facturación.",
    },
    faq: {
      eyebrow: "ALGUNAS COSAS QUE QUIZÁ TE PREGUNTES",
      title: "Preguntas frecuentes",
      items: [
        { question: "¿Qué es Snoozer?", answer: "Snoozer es una plataforma de enlaces en la que puedes reunir tus redes sociales, sitios web, proyectos y contenido multimedia compatible en una página personal. Comparte una dirección de Snoozer en lugar de enviar a la gente a distintos sitios." },
        { question: "¿Puedo usar Snoozer gratis?", answer: "Sí. Puedes crear y publicar una página Snoozer gratis. Plus, Pro y Studio son planes Premium opcionales para quienes quieren más funciones de perfil, almacenamiento y personalización." },
        { question: "¿Qué puedo poner en mi perfil?", answer: "Añade enlaces a redes sociales, sitios web, texto, fotos y widgets compatibles. Las herramientas multimedia y los límites disponibles dependen de tu plan. Tu página pública solo muestra el contenido que decidas publicar." },
        { question: "¿Puedo personalizar el aspecto de mi página?", answer: "Sí. Creator Studio te permite trabajar con temas, colores, diseños, fondos, efectos y widgets de perfil. Puedes previsualizar los cambios antes de publicar tu página." },
        { question: "¿Mi perfil aparece automáticamente en Descubrir?", answer: "No. La aparición en el directorio de creadores es opcional y está desactivada de forma predeterminada. Tú decides si tu perfil puede aparecer en el directorio público; publicar un perfil no activa esta opción." },
        { question: "¿Cómo funcionan los planes Premium y las cancelaciones?", answer: "Snoozer Premium ofrece Plus, Pro y Studio con facturación mensual o anual. Puedes comparar las funciones y los precios actuales en la página de Precios. Los suscriptores pueden gestionar su plan desde las herramientas de facturación de la cuenta." },
      ],
    },
    finalCta: {
      eyebrow: "CUANDO TÚ QUIERAS",
      title: "Todo lo que quieres, aquí mismo.",
      description: "Únete a Snoozer y reúne en un solo lugar los enlaces, trabajos y momentos que quieras compartir.",
    },
    footer: {
      description: "Tus enlaces, tu trabajo y todo lo que quieras compartir. En un solo lugar.",
      general: "General", resources: "Recursos", contact: "Contacto", legal: "Legal",
      login: "Iniciar sesión", signup: "Registrarse", pricing: "Precios", leaderboard: "Clasificación",
      help: "Centro de ayuda", templates: "Plantillas", discover: "Descubrir",
      support: "Ayuda y asistencia", supportEmail: "Correo de soporte",
      terms: "Términos del servicio", privacy: "Política de privacidad", legalInfo: "Información legal",
      copyright: "© 2026 Snoozer.uk. Todos los derechos reservados.", tagline: "Un lugar para ser tú.",
    },
    claimForm: {
      username: "Nombre de usuario", checking: "Comprobando…", checkAvailability: "Comprobar disponibilidad",
      claimNow: "Reservar ahora", claiming: "Reservando…", claimAddress: "Reservar dirección",
      available: "Disponible. Resérvalo ahora.", unavailable: "Esa dirección no está disponible.",
      checkFailed: "No se pudo comprobar la disponibilidad. Inténtalo de nuevo.", invalid: "Introduce un nombre de usuario válido.",
    },
  },
  "pt-BR": {
    nav: { help: "Central de ajuda", templates: "Modelos", discover: "Descobrir", leaderboard: "Classificação", pricing: "Preços" },
    hero: {
      badge: "SEU ESPAÇO. DO SEU JEITO.",
      title: "Tudo o que você quer, em um só lugar.",
      lead: "Suas redes sociais, fotos e projetos reunidos em um perfil Snoozer personalizado. Crie uma página com a sua cara e compartilhe tudo com um único link.",
      signup: "Cadastre-se grátis", viewPricing: "Ver preços", note: "Comece grátis. Personalize como quiser.",
    },
    proof: {
      eyebrow: "UM LINK. SEU MUNDO INTEIRO.",
      title: "Um espaço para tudo o que você faz.",
      description: "Reúna o que as pessoas procuram e ofereça uma página que tenha a sua identidade.",
    },
    features: [
      { title: "Seus links", description: "Reúna redes sociais, sites, comunidades e projetos." },
      { title: "Seu visual", description: "Personalize sua página com temas, layouts, efeitos e widgets." },
      { title: "Sua mídia", description: "Mostre fotos, trabalhos criativos e mídias compatíveis com o perfil." },
      { title: "Seu controle", description: "Escolha o que publicar e se deseja participar da descoberta de criadores." },
    ],
    claim: {
      eyebrow: "DEIXE COM A SUA CARA",
      title: "Garanta seu perfil e comece em poucos minutos.",
      description: "Escolha um nome de usuário fácil de lembrar. Seu endereço Snoozer está pronto para ser seu.",
    },
    plans: {
      eyebrow: "COMECE GRÁTIS. CRESÇA QUANDO QUISER.",
      title: "Explore suas opções.",
      emphasis: "Abra espaço para mais.",
      description: "Crie uma página grátis e depois escolha o plano Snoozer Premium que combina com seu jeito de criar.",
      freeKicker: "O PONTO DE PARTIDA",
      freeDescription: "Para começar e reunir suas redes sociais em um só lugar.",
      freeFeatures: [
        "Crie e publique uma página pessoal",
        "Adicione seus links e conteúdo de perfil",
        "Escolha entre os temas e layouts disponíveis",
        "Compartilhe um endereço de perfil fácil de lembrar",
      ],
      freeButton: "Começar grátis",
      premiumKicker: "MAIS ESPAÇO PARA CRIAR",
      premiumDescription: "Mais maneiras de criar, personalizar e expandir seu espaço online. Escolha um plano e um ciclo de cobrança.",
      premiumFeatures: [
        "Mais opções de personalização do perfil",
        "Opções adicionais de perfil e mídia",
        "Mais ferramentas para criadores em crescimento",
        "Planos mensais e anuais",
      ],
      premiumButton: "Comparar planos Premium",
      priceLabel: "Preços do Snoozer Premium",
      pricesNote: "Os preços estão em GBP.",
      compareLink: "Compare limites, recursos e detalhes de cobrança.",
    },
    faq: {
      eyebrow: "ALGUMAS DÚVIDAS QUE VOCÊ PODE TER",
      title: "Perguntas frequentes",
      items: [
        { question: "O que é o Snoozer?", answer: "Snoozer é uma plataforma de links na qual você reúne suas redes sociais, sites, projetos e mídias compatíveis em uma página pessoal. Compartilhe um único endereço Snoozer em vez de espalhar vários links pela internet." },
        { question: "Posso usar o Snoozer de graça?", answer: "Sim. Você pode criar e publicar uma página Snoozer gratuita. Plus, Pro e Studio são planos Premium opcionais para quem deseja recursos adicionais de perfil, armazenamento e personalização." },
        { question: "O que posso colocar no meu perfil?", answer: "Adicione links sociais, sites, textos, fotos e widgets compatíveis. As ferramentas de mídia e os limites disponíveis dependem do seu plano. Sua página pública mostra apenas o conteúdo que você escolher publicar." },
        { question: "Posso personalizar a aparência da minha página?", answer: "Sim. O Creator Studio permite trabalhar com temas, cores, layouts, fundos, efeitos e widgets de perfil. Você pode visualizar as alterações antes de publicar sua página." },
        { question: "Meu perfil aparece automaticamente no Descobrir?", answer: "Não. A descoberta de criadores é opcional e a listagem fica desativada por padrão. Você escolhe se seu perfil pode aparecer no diretório público; publicar um perfil não ativa essa opção." },
        { question: "Como funcionam os planos Premium e os cancelamentos?", answer: "O Snoozer Premium oferece Plus, Pro e Studio com cobrança mensal ou anual. Compare os recursos e preços atuais na página de Preços. Assinantes ativos podem gerenciar a assinatura nas ferramentas de cobrança da conta." },
      ],
    },
    finalCta: {
      eyebrow: "QUANDO VOCÊ ESTIVER PRONTO",
      title: "Tudo o que você quer, em um só lugar.",
      description: "Entre para o Snoozer e reúna links, trabalhos e momentos que deseja compartilhar em um só lugar.",
    },
    footer: {
      description: "Seus links, seu trabalho e tudo o que você deseja compartilhar. Em um só lugar.",
      general: "Geral", resources: "Recursos", contact: "Contato", legal: "Jurídico",
      login: "Entrar", signup: "Cadastrar-se", pricing: "Preços", leaderboard: "Classificação",
      help: "Central de ajuda", templates: "Modelos", discover: "Descobrir",
      support: "Ajuda e suporte", supportEmail: "E-mail de suporte",
      terms: "Termos de serviço", privacy: "Política de privacidade", legalInfo: "Informações legais",
      copyright: "© 2026 Snoozer.uk. Todos os direitos reservados.", tagline: "Um lugar para ser você.",
    },
    claimForm: {
      username: "Nome de usuário", checking: "Verificando…", checkAvailability: "Verificar disponibilidade",
      claimNow: "Reservar agora", claiming: "Reservando…", claimAddress: "Reservar endereço",
      available: "Disponível. Reserve agora.", unavailable: "Esse endereço não está disponível.",
      checkFailed: "Não foi possível verificar a disponibilidade. Tente novamente.", invalid: "Digite um nome de usuário válido.",
    },
  },
  "fr-FR": {
    nav: { help: "Centre d’aide", templates: "Modèles", discover: "Découvrir", leaderboard: "Classement", pricing: "Tarifs" },
    hero: {
      badge: "VOTRE ESPACE. À VOTRE IMAGE.",
      title: "Tout ce que vous voulez, au même endroit.",
      lead: "Vos réseaux sociaux, photos et projets réunis sur un profil Snoozer personnalisé. Créez une page qui vous ressemble, puis partagez-la avec un seul lien.",
      signup: "S’inscrire gratuitement", viewPricing: "Voir les tarifs", note: "Gratuit pour commencer. À personnaliser selon vos envies.",
    },
    proof: {
      eyebrow: "UN LIEN. TOUT VOTRE UNIVERS.",
      title: "Un petit espace pour tout ce que vous faites.",
      description: "Rassemblez ce que les visiteurs viennent chercher et offrez-leur une page qui vous ressemble vraiment.",
    },
    features: [
      { title: "Vos liens", description: "Rassemblez réseaux sociaux, sites web, communautés et projets." },
      { title: "Votre style", description: "Personnalisez votre page avec des thèmes, mises en page, effets et widgets." },
      { title: "Vos médias", description: "Présentez vos photos, créations et médias de profil compatibles." },
      { title: "Votre contrôle", description: "Choisissez ce que vous publiez et votre participation à la découverte de créateurs." },
    ],
    claim: {
      eyebrow: "FAITES-EN VOTRE ESPACE",
      title: "Réservez votre profil et commencez en quelques minutes.",
      description: "Choisissez un nom d’utilisateur facile à retenir. Votre adresse Snoozer n’attend plus que vous.",
    },
    plans: {
      eyebrow: "COMMENCEZ GRATUITEMENT. ÉVOLUEZ À VOTRE RYTHME.",
      title: "Découvrez vos options.",
      emphasis: "Faites de la place pour plus.",
      description: "Créez une page gratuitement, puis choisissez l’offre Snoozer Premium adaptée à votre façon de créer.",
      freeKicker: "POUR BIEN COMMENCER",
      freeDescription: "Pour débuter et réunir vos réseaux sociaux au même endroit.",
      freeFeatures: [
        "Créer et publier une page personnelle",
        "Ajouter vos liens et le contenu de votre profil",
        "Choisir parmi les thèmes et mises en page disponibles",
        "Partager une adresse de profil facile à retenir",
      ],
      freeButton: "Commencer gratuitement",
      premiumKicker: "PLUS D’ESPACE POUR CRÉER",
      premiumDescription: "Davantage de façons de créer, personnaliser et développer votre espace en ligne. Choisissez une offre et une périodicité.",
      premiumFeatures: [
        "Davantage de personnalisation du profil",
        "Des options supplémentaires pour le profil et les médias",
        "Plus d’outils pour les créateurs en développement",
        "Des formules mensuelles et annuelles",
      ],
      premiumButton: "Comparer les offres Premium",
      priceLabel: "Tarifs Snoozer Premium",
      pricesNote: "Les prix sont en GBP.",
      compareLink: "Comparez les limites, les fonctionnalités et les modalités de facturation.",
    },
    faq: {
      eyebrow: "QUELQUES QUESTIONS QUE VOUS VOUS POSEZ PEUT-ÊTRE",
      title: "Foire aux questions",
      items: [
        { question: "Qu’est-ce que Snoozer ?", answer: "Snoozer est une plateforme de liens qui vous permet de réunir vos réseaux sociaux, sites web, projets et médias compatibles sur une page personnelle. Partagez une seule adresse Snoozer plutôt que de disperser vos liens sur Internet." },
        { question: "Puis-je utiliser Snoozer gratuitement ?", answer: "Oui. Vous pouvez créer et publier une page Snoozer gratuite. Plus, Pro et Studio sont des offres Premium facultatives pour celles et ceux qui souhaitent davantage de fonctionnalités de profil, de stockage et de personnalisation." },
        { question: "Que puis-je ajouter à mon profil ?", answer: "Ajoutez des liens vers vos réseaux sociaux, des sites web, du texte, des photos et des widgets compatibles. Les outils multimédias et les limites dépendent de votre offre. Votre page publique n’affiche que le contenu que vous choisissez de publier." },
        { question: "Puis-je personnaliser l’apparence de ma page ?", answer: "Oui. Creator Studio vous permet de modifier les thèmes, couleurs, mises en page, arrière-plans, effets et widgets de profil. Vous pouvez prévisualiser vos changements avant de publier votre page." },
        { question: "Mon profil apparaît-il automatiquement dans Découvrir ?", answer: "Non. La découverte des créateurs est facultative et votre inscription à l’annuaire est désactivée par défaut. Vous décidez si votre profil peut apparaître dans l’annuaire public ; publier un profil n’active pas cette option." },
        { question: "Comment fonctionnent les offres Premium et les résiliations ?", answer: "Snoozer Premium propose Plus, Pro et Studio avec une facturation mensuelle ou annuelle. Comparez les fonctionnalités et les tarifs actuels sur la page Tarifs. Les abonnés actifs peuvent gérer leur abonnement depuis les outils de facturation du compte." },
      ],
    },
    finalCta: {
      eyebrow: "À VOUS DE JOUER",
      title: "Tout ce que vous voulez, au même endroit.",
      description: "Rejoignez Snoozer et rassemblez au même endroit les liens, créations et moments que vous souhaitez partager.",
    },
    footer: {
      description: "Vos liens, vos créations et tout ce que vous souhaitez partager. Au même endroit.",
      general: "Général", resources: "Ressources", contact: "Contact", legal: "Informations légales",
      login: "Connexion", signup: "S’inscrire", pricing: "Tarifs", leaderboard: "Classement",
      help: "Centre d’aide", templates: "Modèles", discover: "Découvrir",
      support: "Aide et assistance", supportEmail: "E-mail d’assistance",
      terms: "Conditions d’utilisation", privacy: "Politique de confidentialité", legalInfo: "Mentions légales",
      copyright: "© 2026 Snoozer.uk. Tous droits réservés.", tagline: "Un espace pour être vous-même.",
    },
    claimForm: {
      username: "Nom d’utilisateur", checking: "Vérification…", checkAvailability: "Vérifier la disponibilité",
      claimNow: "Réserver", claiming: "Réservation…", claimAddress: "Réserver l’adresse",
      available: "Disponible. Réservez cette adresse.", unavailable: "Cette adresse n’est pas disponible.",
      checkFailed: "Impossible de vérifier la disponibilité. Réessayez.", invalid: "Saisissez un nom d’utilisateur valide.",
    },
  },
  "de-DE": {
    nav: { help: "Hilfezentrum", templates: "Vorlagen", discover: "Entdecken", leaderboard: "Rangliste", pricing: "Preise" },
    hero: {
      badge: "DEIN BEREICH. DEIN STIL.",
      title: "Alles, was du willst. An einem Ort.",
      lead: "Deine Social-Media-Profile, Fotos und Projekte – vereint auf einem persönlichen Snoozer-Profil. Gestalte eine Seite, die zu dir passt, und teile sie mit nur einem Link.",
      signup: "Kostenlos registrieren", viewPricing: "Preise ansehen", note: "Kostenlos starten. Ganz nach deinen Vorstellungen.",
    },
    proof: {
      eyebrow: "EIN LINK. DEINE GANZE WELT.",
      title: "Ein Platz für alles, was du machst.",
      description: "Führe alles zusammen, wonach andere suchen, und gib ihnen eine Seite, die unverkennbar dir gehört.",
    },
    features: [
      { title: "Deine Links", description: "Bündle soziale Netzwerke, Websites, Communities und Projekte." },
      { title: "Dein Stil", description: "Gestalte deine Seite mit Designs, Layouts, Effekten und Widgets." },
      { title: "Deine Medien", description: "Präsentiere Fotos, kreative Arbeiten und unterstützte Profilmedien." },
      { title: "Deine Kontrolle", description: "Entscheide, was du veröffentlichst und ob du bei der Creator-Suche mitmachst." },
    ],
    claim: {
      eyebrow: "MACH ES ZU DEINEM",
      title: "Sichere dir dein Profil und starte in wenigen Minuten.",
      description: "Wähle einen einprägsamen Benutzernamen. Deine Snoozer-Adresse wartet darauf, dir zu gehören.",
    },
    plans: {
      eyebrow: "KOSTENLOS STARTEN. WACHSEN, WENN DU BEREIT BIST.",
      title: "Entdecke deine Möglichkeiten.",
      emphasis: "Schaffe Platz für mehr.",
      description: "Erstelle kostenlos eine Seite und wähle anschließend den Snoozer-Premium-Tarif, der zu deiner Art zu gestalten passt.",
      freeKicker: "DER EINSTIEG",
      freeDescription: "Für den Start und um deine sozialen Netzwerke an einem Ort zu bündeln.",
      freeFeatures: [
        "Eine persönliche Seite erstellen und veröffentlichen",
        "Links und Profilinhalte hinzufügen",
       "Aus verfügbaren Designs und Layouts wählen",
       "Eine einprägsame Profiladresse teilen",
      ],
      freeButton: "Kostenlos starten",
      premiumKicker: "MEHR RAUM ZUM GESTALTEN",
      premiumDescription: "Mehr Möglichkeiten, deinen Online-Auftritt aufzubauen, anzupassen und weiterzuentwickeln. Wähle einen Tarif und Abrechnungszeitraum.",
      premiumFeatures: [
        "Mehr Möglichkeiten zur Profilanpassung",
        "Zusätzliche Profil- und Medienoptionen",
        "Mehr Werkzeuge für wachsende Creator",
        "Monatliche und jährliche Tarife",
      ],
      premiumButton: "Premium-Tarife vergleichen",
      priceLabel: "Snoozer-Premium-Preise",
      pricesNote: "Alle Preise sind in GBP.",
      compareLink: "Vergleiche Tariflimits, Funktionen und Abrechnungsdetails.",
    },
    faq: {
      eyebrow: "EIN PAAR FRAGEN, DIE DU DIR VIELLEICHT STELLST",
      title: "Häufig gestellte Fragen",
      items: [
        { question: "Was ist Snoozer?", answer: "Snoozer ist eine Link-in-Bio-Plattform, auf der du deine sozialen Netzwerke, Websites, Projekte und unterstützten Medien auf einer persönlichen Seite bündeln kannst. Teile eine Snoozer-Adresse, statt überall im Internet einzelne Links zu verschicken." },
        { question: "Kann ich Snoozer kostenlos nutzen?", answer: "Ja. Du kannst eine kostenlose Snoozer-Seite erstellen und veröffentlichen. Plus, Pro und Studio sind optionale Premium-Tarife für zusätzliche Profil-, Speicher- und Anpassungsfunktionen." },
        { question: "Was kann ich auf meinem Profil zeigen?", answer: "Füge Social-Links, Websites, Profiltexte, Fotos und unterstützte Widgets hinzu. Die verfügbaren Medientools und Limits hängen von deinem Tarif ab. Deine öffentliche Seite zeigt nur Inhalte, die du veröffentlichen möchtest." },
        { question: "Kann ich das Aussehen meiner Seite anpassen?", answer: "Ja. Im Creator Studio kannst du Designs, Farben, Layouts, Hintergründe, Effekte und Profil-Widgets anpassen. Vor der Veröffentlichung kannst du deine Änderungen in der Vorschau ansehen." },
        { question: "Wird mein Profil automatisch unter Entdecken angezeigt?", answer: "Nein. Die Creator-Suche ist freiwillig und dein Verzeichniseintrag ist standardmäßig deaktiviert. Du entscheidest, ob dein Profil im öffentlichen Creator-Verzeichnis erscheint. Allein durch die Veröffentlichung wird diese Einstellung nicht aktiviert." },
        { question: "Wie funktionieren Premium-Tarife und Kündigungen?", answer: "Snoozer Premium bietet Plus, Pro und Studio mit monatlicher oder jährlicher Abrechnung. Die aktuellen Funktionen und Preise findest du auf der Preisseite. Aktive Abonnenten verwalten ihr Abo über die Abrechnungsfunktionen des Kontos." },
      ],
    },
    finalCta: {
      eyebrow: "WENN DU BEREIT BIST",
      title: "Alles, was du willst. An einem Ort.",
      description: "Werde Teil von Snoozer und bündle Links, Projekte und Momente, die du teilen möchtest, an einem Ort.",
    },
    footer: {
      description: "Deine Links, deine Arbeit und alles, was du teilen möchtest. An einem Ort.",
      general: "Allgemeines", resources: "Ressourcen", contact: "Kontakt", legal: "Rechtliches",
      login: "Anmelden", signup: "Registrieren", pricing: "Preise", leaderboard: "Rangliste",
      help: "Hilfezentrum", templates: "Vorlagen", discover: "Entdecken",
      support: "Hilfe und Support", supportEmail: "Support-E-Mail",
      terms: "Nutzungsbedingungen", privacy: "Datenschutzerklärung", legalInfo: "Rechtliche Hinweise",
      copyright: "© 2026 Snoozer.uk. Alle Rechte vorbehalten.", tagline: "Ein Ort, an dem du du selbst sein kannst.",
    },
    claimForm: {
      username: "Benutzername", checking: "Wird geprüft…", checkAvailability: "Verfügbarkeit prüfen",
      claimNow: "Jetzt sichern", claiming: "Wird gesichert…", claimAddress: "Adresse sichern",
      available: "Verfügbar. Sichere dir die Adresse.", unavailable: "Diese Adresse ist nicht verfügbar.",
      checkFailed: "Die Verfügbarkeit konnte nicht geprüft werden. Bitte versuche es erneut.", invalid: "Gib einen gültigen Benutzernamen ein.",
    },
  },
  "tr-TR": {
    nav: { help: "Yardım Merkezi", templates: "Şablonlar", discover: "Keşfet", leaderboard: "Sıralama", pricing: "Fiyatlar" },
    hero: {
      badge: "SENİN ALANIN. SENİN TARZIN.",
      title: "İstediğin her şey, tek bir yerde.",
      lead: "Sosyal medya hesapların, fotoğrafların ve projelerin kişiselleştirilmiş bir Snoozer profilinde bir arada. Seni yansıtan bir sayfa oluştur ve tek bir bağlantıyla paylaş.",
      signup: "Ücretsiz kaydol", viewPricing: "Fiyatları gör", note: "Ücretsiz başla. Dilediğin gibi özelleştir.",
    },
    proof: {
      eyebrow: "TEK BAĞLANTI. TÜM DÜNYAN.",
      title: "Yaptığın her şey için küçük bir alan.",
      description: "İnsanların aradığı her şeyi bir araya getir ve onlara tamamen sana ait bir sayfa sun.",
    },
    features: [
      { title: "Bağlantıların", description: "Sosyal medya hesaplarını, web sitelerini, topluluklarını ve projelerini bir arada tut." },
      { title: "Görünümün", description: "Temalar, düzenler, efektler ve bileşenlerle sayfanı kişiselleştir." },
      { title: "Medyan", description: "Fotoğraflarını, yaratıcı çalışmalarını ve desteklenen profil medyalarını sergile." },
      { title: "Kontrol sende", description: "Neleri yayınlayacağını ve içerik üretici keşfine katılıp katılmayacağını seç." },
    ],
    claim: {
      eyebrow: "SANA AİT OLSUN",
      title: "Profilini al ve dakikalar içinde başla.",
      description: "Kolay hatırlanan bir kullanıcı adı seç. Snoozer adresin artık senin olabilir.",
    },
    plans: {
      eyebrow: "ÜCRETSİZ BAŞLA. HAZIR OLDUĞUNDA BÜYÜ.",
      title: "Seçeneklerini keşfet.",
      emphasis: "Daha fazlasına yer aç.",
      description: "Ücretsiz bir sayfa oluştur, ardından üretim tarzına uygun Snoozer Premium planını seç.",
      freeKicker: "BAŞLANGIÇ NOKTASI",
      freeDescription: "Başlamak ve sosyal medya hesaplarını tek bir yerde toplamak için.",
      freeFeatures: [
        "Kişisel bir sayfa oluştur ve yayınla",
        "Bağlantılarını ve profil içeriğini ekle",
        "Mevcut temalar ve düzenler arasından seçim yap",
        "Akılda kalıcı bir profil adresi paylaş",
      ],
      freeButton: "Ücretsiz başla",
      premiumKicker: "ÜRETMEK İÇİN DAHA FAZLA ALAN",
      premiumDescription: "Çevrimiçi alanını oluşturmak, özelleştirmek ve büyütmek için daha fazla seçenek. Bir plan ve faturalandırma dönemi seç.",
      premiumFeatures: [
        "Daha fazla profil özelleştirme seçeneği",
        "Ek profil ve medya seçenekleri",
        "Gelişen içerik üreticileri için daha fazla araç",
        "Aylık ve yıllık plan seçenekleri",
      ],
      premiumButton: "Premium planları karşılaştır",
      priceLabel: "Snoozer Premium fiyatları",
      pricesNote: "Fiyatlar GBP cinsindendir.",
      compareLink: "Plan limitlerini, özellikleri ve faturalandırma ayrıntılarını karşılaştır.",
    },
    faq: {
      eyebrow: "MERAK EDEBİLECEĞİN BAZI KONULAR",
      title: "Sıkça Sorulan Sorular",
      items: [
        { question: "Snoozer nedir?", answer: "Snoozer; sosyal medya hesaplarını, web sitelerini, projelerini ve desteklenen medyalarını kişisel bir sayfada bir araya getirebileceğin bir bağlantı platformudur. İnternette farklı yerlere bağlantı göndermek yerine tek bir Snoozer adresi paylaş." },
        { question: "Snoozer'ı ücretsiz kullanabilir miyim?", answer: "Evet. Ücretsiz bir Snoozer sayfası oluşturup yayınlayabilirsin. Plus, Pro ve Studio; daha fazla profil, depolama ve özelleştirme özelliği isteyenler için isteğe bağlı Premium planlardır." },
        { question: "Profilime neler ekleyebilirim?", answer: "Sosyal bağlantılar, web siteleri, profil metni, fotoğraflar ve desteklenen bileşenler ekleyebilirsin. Medya araçları ve sınırlar planına bağlıdır. Herkese açık sayfanda yalnızca yayınlamayı seçtiğin içerikler görünür." },
        { question: "Sayfamın görünümünü özelleştirebilir miyim?", answer: "Evet. Creator Studio ile temaları, renkleri, düzenleri, arka planları, efektleri ve profil bileşenlerini düzenleyebilirsin. Sayfanı yayınlamadan önce değişikliklerini önizleyebilirsin." },
        { question: "Profilim otomatik olarak Keşfet'te listelenir mi?", answer: "Hayır. İçerik üreticisi keşfi isteğe bağlıdır ve dizin listelemen varsayılan olarak kapalıdır. Profilinin herkese açık dizinde görünüp görünmeyeceğine sen karar verirsin; profil yayınlamak bu ayarı açmaz." },
        { question: "Premium planlar ve iptaller nasıl çalışır?", answer: "Snoozer Premium, aylık veya yıllık faturalandırmayla Plus, Pro ve Studio planlarını sunar. Güncel özellikleri ve fiyatları Fiyatlar sayfasında karşılaştırabilirsin. Aktif aboneler aboneliklerini hesap faturalandırma araçlarından yönetebilir." },
      ],
    },
    finalCta: {
      eyebrow: "HAZIR OLDUĞUNDA",
      title: "İstediğin her şey, tek bir yerde.",
      description: "Snoozer'a katıl ve paylaşmak istediğin bağlantıları, çalışmaları ve anları tek bir yerde topla.",
    },
    footer: {
      description: "Bağlantıların, çalışmaların ve paylaşmak istediğin her şey. Hepsi tek bir yerde.",
      general: "Genel", resources: "Kaynaklar", contact: "İletişim", legal: "Yasal",
      login: "Giriş yap", signup: "Kaydol", pricing: "Fiyatlar", leaderboard: "Sıralama",
      help: "Yardım Merkezi", templates: "Şablonlar", discover: "Keşfet",
      support: "Yardım ve destek", supportEmail: "Destek e-postası",
      terms: "Hizmet şartları", privacy: "Gizlilik politikası", legalInfo: "Yasal bilgiler",
      copyright: "© 2026 Snoozer.uk. Tüm hakları saklıdır.", tagline: "Kendin olabileceğin bir yer.",
    },
    claimForm: {
      username: "Kullanıcı adı", checking: "Kontrol ediliyor…", checkAvailability: "Kullanılabilirliği kontrol et",
      claimNow: "Şimdi al", claiming: "Alınıyor…", claimAddress: "Adresi al",
      available: "Kullanılabilir. Hemen ayırt.", unavailable: "Bu adres kullanılamıyor.",
      checkFailed: "Kullanılabilirlik kontrol edilemedi. Yeniden dene.", invalid: "Geçerli bir kullanıcı adı gir.",
    },
  },
};

export function homeContent(locale: AccountLocale): HomeContent {
  return locale === "en-US" ? english : translations[locale] ?? english;
}
