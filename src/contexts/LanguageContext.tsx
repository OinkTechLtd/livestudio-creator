import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "ru" | "en" | "es" | "de" | "fr" | "zh" | "ja" | "ko" | "pt" | "ar";

interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

const translations: Translations = {
  // Header
  "search": { ru: "Поиск каналов...", en: "Search channels...", es: "Buscar canales...", de: "Kanäle suchen...", fr: "Rechercher des chaînes...", zh: "搜索频道...", ja: "チャンネルを検索...", ko: "채널 검색...", pt: "Buscar canais...", ar: "البحث عن القنوات..." },
  "login": { ru: "Войти", en: "Login", es: "Iniciar sesión", de: "Anmelden", fr: "Connexion", zh: "登录", ja: "ログイン", ko: "로그인", pt: "Entrar", ar: "تسجيل الدخول" },
  "logout": { ru: "Выйти", en: "Logout", es: "Cerrar sesión", de: "Abmelden", fr: "Déconnexion", zh: "退出", ja: "ログアウト", ko: "로그아웃", pt: "Sair", ar: "تسجيل الخروج" },
  "profile": { ru: "Профиль", en: "Profile", es: "Perfil", de: "Profil", fr: "Profil", zh: "个人资料", ja: "プロフィール", ko: "프로필", pt: "Perfil", ar: "الملف الشخصي" },
  "create_channel": { ru: "Создать канал", en: "Create Channel", es: "Crear canal", de: "Kanal erstellen", fr: "Créer une chaîne", zh: "创建频道", ja: "チャンネル作成", ko: "채널 만들기", pt: "Criar canal", ar: "إنشاء قناة" },
  
  // Channel types
  "tv": { ru: "ТВ", en: "TV", es: "TV", de: "TV", fr: "TV", zh: "电视", ja: "テレビ", ko: "TV", pt: "TV", ar: "تلفزيون" },
  "radio": { ru: "Радио", en: "Radio", es: "Radio", de: "Radio", fr: "Radio", zh: "广播", ja: "ラジオ", ko: "라디오", pt: "Rádio", ar: "راديو" },
  
  // Chat
  "live_chat": { ru: "Live чат", en: "Live Chat", es: "Chat en vivo", de: "Live-Chat", fr: "Chat en direct", zh: "实时聊天", ja: "ライブチャット", ko: "실시간 채팅", pt: "Chat ao vivo", ar: "دردشة مباشرة" },
  "messages": { ru: "сообщений", en: "messages", es: "mensajes", de: "Nachrichten", fr: "messages", zh: "消息", ja: "メッセージ", ko: "메시지", pt: "mensagens", ar: "رسائل" },
  "viewers": { ru: "зрителей", en: "viewers", es: "espectadores", de: "Zuschauer", fr: "spectateurs", zh: "观众", ja: "視聴者", ko: "시청자", pt: "espectadores", ar: "مشاهدين" },
  "write_message": { ru: "Написать сообщение...", en: "Write a message...", es: "Escribir mensaje...", de: "Nachricht schreiben...", fr: "Écrire un message...", zh: "输入消息...", ja: "メッセージを入力...", ko: "메시지 작성...", pt: "Escrever mensagem...", ar: "اكتب رسالة..." },
  "login_to_send": { ru: "Войдите для отправки", en: "Login to send", es: "Inicia sesión para enviar", de: "Anmelden zum Senden", fr: "Connectez-vous pour envoyer", zh: "登录后发送", ja: "送信するにはログイン", ko: "전송하려면 로그인", pt: "Entre para enviar", ar: "سجل الدخول للإرسال" },
  "welcome_to_chat": { ru: "Добро пожаловать в чат!", en: "Welcome to chat!", es: "¡Bienvenido al chat!", de: "Willkommen im Chat!", fr: "Bienvenue dans le chat !", zh: "欢迎来到聊天室！", ja: "チャットへようこそ！", ko: "채팅에 오신 것을 환영합니다!", pt: "Bem-vindo ao chat!", ar: "مرحبا بك في الدردشة!" },
  "joined_chat": { ru: "присоединился к чату", en: "joined the chat", es: "se unió al chat", de: "ist dem Chat beigetreten", fr: "a rejoint le chat", zh: "加入了聊天", ja: "がチャットに参加しました", ko: "님이 채팅에 참여했습니다", pt: "entrou no chat", ar: "انضم إلى الدردشة" },
  
  // Moderation
  "pin": { ru: "Закрепить", en: "Pin", es: "Fijar", de: "Anheften", fr: "Épingler", zh: "置顶", ja: "ピン留め", ko: "고정", pt: "Fixar", ar: "تثبيت" },
  "unpin": { ru: "Открепить", en: "Unpin", es: "Desfijar", de: "Lösen", fr: "Désépingler", zh: "取消置顶", ja: "ピン解除", ko: "고정 해제", pt: "Desfixar", ar: "إلغاء التثبيت" },
  "pinned": { ru: "Закреплено", en: "Pinned", es: "Fijado", de: "Angeheftet", fr: "Épinglé", zh: "已置顶", ja: "ピン留め済み", ko: "고정됨", pt: "Fixado", ar: "مثبت" },
  "block": { ru: "Заблокировать", en: "Block", es: "Bloquear", de: "Blockieren", fr: "Bloquer", zh: "封禁", ja: "ブロック", ko: "차단", pt: "Bloquear", ar: "حظر" },
  "unblock": { ru: "Разблокировать", en: "Unblock", es: "Desbloquear", de: "Freigeben", fr: "Débloquer", zh: "解封", ja: "ブロック解除", ko: "차단 해제", pt: "Desbloquear", ar: "إلغاء الحظر" },
  "make_moderator": { ru: "Назначить модератором", en: "Make moderator", es: "Hacer moderador", de: "Zum Moderator machen", fr: "Faire modérateur", zh: "设为版主", ja: "モデレーターにする", ko: "관리자로 지정", pt: "Tornar moderador", ar: "جعله مشرف" },
  "remove_moderator": { ru: "Убрать модератора", en: "Remove moderator", es: "Quitar moderador", de: "Moderator entfernen", fr: "Retirer modérateur", zh: "取消版主", ja: "モデレーター解除", ko: "관리자 해제", pt: "Remover moderador", ar: "إزالة المشرف" },
  "channel_owner": { ru: "Владелец канала", en: "Channel owner", es: "Propietario del canal", de: "Kanalbesitzer", fr: "Propriétaire de la chaîne", zh: "频道所有者", ja: "チャンネルオーナー", ko: "채널 소유자", pt: "Dono do canal", ar: "صاحب القناة" },
  "moderator": { ru: "Модератор", en: "Moderator", es: "Moderador", de: "Moderator", fr: "Modérateur", zh: "版主", ja: "モデレーター", ko: "관리자", pt: "Moderador", ar: "مشرف" },
  
  // Points system
  "points": { ru: "баллов", en: "points", es: "puntos", de: "Punkte", fr: "points", zh: "积分", ja: "ポイント", ko: "포인트", pt: "pontos", ar: "نقاط" },
  "your_points": { ru: "Ваши баллы", en: "Your points", es: "Tus puntos", de: "Deine Punkte", fr: "Vos points", zh: "您的积分", ja: "あなたのポイント", ko: "내 포인트", pt: "Seus pontos", ar: "نقاطك" },
  "rewards": { ru: "Награды", en: "Rewards", es: "Recompensas", de: "Belohnungen", fr: "Récompenses", zh: "奖励", ja: "報酬", ko: "보상", pt: "Recompensas", ar: "مكافآت" },
  "redeem": { ru: "Получить", en: "Redeem", es: "Canjear", de: "Einlösen", fr: "Échanger", zh: "兑换", ja: "交換", ko: "교환", pt: "Resgatar", ar: "استبدال" },
  "not_enough_points": { ru: "Недостаточно баллов", en: "Not enough points", es: "No hay suficientes puntos", de: "Nicht genug Punkte", fr: "Pas assez de points", zh: "积分不足", ja: "ポイントが足りません", ko: "포인트가 부족합니다", pt: "Pontos insuficientes", ar: "نقاط غير كافية" },
  
  // Subscriptions
  "subscribe": { ru: "Подписаться", en: "Subscribe", es: "Suscribirse", de: "Abonnieren", fr: "S'abonner", zh: "订阅", ja: "チャンネル登録", ko: "구독", pt: "Inscrever-se", ar: "اشتراك" },
  "unsubscribe": { ru: "Отписаться", en: "Unsubscribe", es: "Cancelar suscripción", de: "Abbestellen", fr: "Se désabonner", zh: "取消订阅", ja: "登録解除", ko: "구독 취소", pt: "Cancelar inscrição", ar: "إلغاء الاشتراك" },
  "subscribers": { ru: "подписчиков", en: "subscribers", es: "suscriptores", de: "Abonnenten", fr: "abonnés", zh: "订阅者", ja: "登録者", ko: "구독자", pt: "inscritos", ar: "مشتركين" },
  
  // Actions
  "like": { ru: "Нравится", en: "Like", es: "Me gusta", de: "Gefällt mir", fr: "J'aime", zh: "喜欢", ja: "いいね", ko: "좋아요", pt: "Curtir", ar: "إعجاب" },
  "dislike": { ru: "Не нравится", en: "Dislike", es: "No me gusta", de: "Gefällt mir nicht", fr: "Je n'aime pas", zh: "不喜欢", ja: "低評価", ko: "싫어요", pt: "Não curtir", ar: "لا يعجبني" },
  "share": { ru: "Поделиться", en: "Share", es: "Compartir", de: "Teilen", fr: "Partager", zh: "分享", ja: "共有", ko: "공유", pt: "Compartilhar", ar: "مشاركة" },
  "report": { ru: "Пожаловаться", en: "Report", es: "Reportar", de: "Melden", fr: "Signaler", zh: "举报", ja: "報告", ko: "신고", pt: "Denunciar", ar: "إبلاغ" },
  "donate": { ru: "Поддержать", en: "Donate", es: "Donar", de: "Spenden", fr: "Donner", zh: "捐赠", ja: "寄付", ko: "후원", pt: "Doar", ar: "تبرع" },
  
  // Home page
  "live_channels": { ru: "Прямой эфир", en: "Live Channels", es: "Canales en vivo", de: "Live-Kanäle", fr: "Chaînes en direct", zh: "直播频道", ja: "ライブチャンネル", ko: "라이브 채널", pt: "Canais ao vivo", ar: "القنوات المباشرة" },
  "popular": { ru: "Популярное", en: "Popular", es: "Popular", de: "Beliebt", fr: "Populaire", zh: "热门", ja: "人気", ko: "인기", pt: "Popular", ar: "شائع" },
  "all_channels": { ru: "Все каналы", en: "All Channels", es: "Todos los canales", de: "Alle Kanäle", fr: "Toutes les chaînes", zh: "所有频道", ja: "すべてのチャンネル", ko: "모든 채널", pt: "Todos os canais", ar: "جميع القنوات" },
  
  // Channel management
  "media_files": { ru: "Медиафайлы", en: "Media Files", es: "Archivos multimedia", de: "Mediendateien", fr: "Fichiers média", zh: "媒体文件", ja: "メディアファイル", ko: "미디어 파일", pt: "Arquivos de mídia", ar: "ملفات الوسائط" },
  "schedule": { ru: "Расписание", en: "Schedule", es: "Horario", de: "Zeitplan", fr: "Programme", zh: "时间表", ja: "スケジュール", ko: "일정", pt: "Agenda", ar: "الجدول" },
  "analytics": { ru: "Аналитика", en: "Analytics", es: "Analítica", de: "Analysen", fr: "Analytique", zh: "分析", ja: "分析", ko: "분석", pt: "Análises", ar: "التحليلات" },
  "settings": { ru: "Настройки", en: "Settings", es: "Configuración", de: "Einstellungen", fr: "Paramètres", zh: "设置", ja: "設定", ko: "설정", pt: "Configurações", ar: "الإعدادات" },
  "upload_video": { ru: "Загрузить видео", en: "Upload Video", es: "Subir video", de: "Video hochladen", fr: "Télécharger une vidéo", zh: "上传视频", ja: "動画をアップロード", ko: "동영상 업로드", pt: "Enviar vídeo", ar: "تحميل فيديو" },
  "add_url": { ru: "Добавить ссылку", en: "Add URL", es: "Agregar URL", de: "URL hinzufügen", fr: "Ajouter URL", zh: "添加链接", ja: "URLを追加", ko: "URL 추가", pt: "Adicionar URL", ar: "إضافة رابط" },
  
  // Auth
  "email": { ru: "Email", en: "Email", es: "Correo electrónico", de: "E-Mail", fr: "Email", zh: "电子邮件", ja: "メール", ko: "이메일", pt: "E-mail", ar: "البريد الإلكتروني" },
  "password": { ru: "Пароль", en: "Password", es: "Contraseña", de: "Passwort", fr: "Mot de passe", zh: "密码", ja: "パスワード", ko: "비밀번호", pt: "Senha", ar: "كلمة المرور" },
  "sign_up": { ru: "Регистрация", en: "Sign Up", es: "Registrarse", de: "Registrieren", fr: "S'inscrire", zh: "注册", ja: "登録", ko: "가입", pt: "Cadastrar", ar: "إنشاء حساب" },
  "sign_in": { ru: "Вход", en: "Sign In", es: "Iniciar sesión", de: "Anmelden", fr: "Se connecter", zh: "登录", ja: "ログイン", ko: "로그인", pt: "Entrar", ar: "تسجيل الدخول" },
  
  // Errors
  "error": { ru: "Ошибка", en: "Error", es: "Error", de: "Fehler", fr: "Erreur", zh: "错误", ja: "エラー", ko: "오류", pt: "Erro", ar: "خطأ" },
  "auth_required": { ru: "Требуется авторизация", en: "Authentication required", es: "Se requiere autenticación", de: "Authentifizierung erforderlich", fr: "Authentification requise", zh: "需要身份验证", ja: "認証が必要です", ko: "인증이 필요합니다", pt: "Autenticação necessária", ar: "يتطلب تسجيل الدخول" },
  "blocked_user": { ru: "Вы заблокированы в этом чате", en: "You are blocked in this chat", es: "Estás bloqueado en este chat", de: "Du bist in diesem Chat blockiert", fr: "Vous êtes bloqué dans ce chat", zh: "您已被禁止在此聊天", ja: "このチャットでブロックされています", ko: "이 채팅에서 차단되었습니다", pt: "Você está bloqueado neste chat", ar: "أنت محظور في هذه الدردشة" },
  
  // Bot messages
  "bot": { ru: "БОТ", en: "BOT", es: "BOT", de: "BOT", fr: "BOT", zh: "机器人", ja: "ボット", ko: "봇", pt: "BOT", ar: "بوت" },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  availableLanguages: { code: Language; name: string }[];
}

const availableLanguages: { code: Language; name: string }[] = [
  { code: "ru", name: "Русский" },
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "pt", name: "Português" },
  { code: "ar", name: "العربية" },
];

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("language");
    if (saved && availableLanguages.some(l => l.code === saved)) {
      return saved as Language;
    }
    // Auto-detect browser language
    const browserLang = navigator.language.split("-")[0] as Language;
    if (availableLanguages.some(l => l.code === browserLang)) {
      return browserLang;
    }
    return "ru";
  });

  useEffect(() => {
    localStorage.setItem("language", language);
    document.documentElement.lang = language;
    if (language === "ar") {
      document.documentElement.dir = "rtl";
    } else {
      document.documentElement.dir = "ltr";
    }
  }, [language]);

  const t = (key: string): string => {
    return translations[key]?.[language] || translations[key]?.["en"] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, availableLanguages }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
