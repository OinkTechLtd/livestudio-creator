import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Crown, Dices, Palette, Code, Shield, Ban, Gift, Tv, Radio, Users, Globe, 
  Sparkles, Bell, Play, Settings, Monitor, Mic, Video, List, Search, Heart,
  ExternalLink, Layers, Lock, Zap, MessageSquare, Clock, Star
} from "lucide-react";
import { Link } from "react-router-dom";

const Changelog = () => {
  const updates = [
    {
      version: "2.0.0",
      date: "Январь 2026",
      title: "StreamLiveTV 2.0: Мультисорс, Restream, VPN-прокси, Расширенные роли",
      description: "Крупнейшее обновление с поддержкой множественных источников контента, интеграцией Restream и улучшенной системой ролей.",
      features: [
        { icon: Globe, text: "YouTube IFrame Player API — корректный рендер с автоплеем" },
        { icon: Layers, text: "Ultra Aggregator — iframe-плеер с локальным fallback и ?watch= параметром" },
        { icon: Video, text: "Источники контента: YouTube, MP4, M3U8, Ultra Aggregator" },
        { icon: Play, text: "UniversalPlayer — единый плеер для всех типов источников" },
        { icon: Lock, text: "VPN-прокси переключатель с backend-мониторингом доступности" },
        { icon: Zap, text: "Интеграция Restream.io — RTMP стриминг через OBS" },
        { icon: Users, text: "Роли канала: владелец/админ = полный доступ, ведущий = только трансляции" },
        { icon: Crown, text: "Ручная выдача премиум-подписки через контекстное меню чата" },
        { icon: MessageSquare, text: "Значки подписчиков в чате (эмодзи рядом с ником)" },
        { icon: Shield, text: "Исправлены баны: корректный учёт ban_expires_at" },
        { icon: List, text: "Улучшенный плейлист с навигацией и отображением длительности" },
        { icon: Sparkles, text: "Баннер-рекомендация Ultra Aggregator (автозакрытие 60 сек)" },
        { icon: ExternalLink, text: "Лендинг страница с презентацией платформы" },
        { icon: Code, text: "Edge-функция proxy-stream для проксирования и кеширования" },
        { icon: Settings, text: "Обновлённые настройки канала с секцией прокси" },
      ],
    },
    {
      version: "1.9.0",
      date: "Декабрь 2025",
      title: "Рулетка и награды",
      features: [
        { icon: Dices, text: "Рулетка призов — трата 500 баллов за спин" },
        { icon: Gift, text: "Покупка премиум-подписки за баллы канала" },
        { icon: Star, text: "Настраиваемые призы рулетки для владельцев каналов" },
      ],
    },
    {
      version: "1.8.0",
      date: "Октябрь 2025",
      title: "Профиль и персонализация",
      features: [
        { icon: Palette, text: "Темы профиля и оформление интерфейса" },
        { icon: Users, text: "Улучшения подписок и уведомлений" },
        { icon: Heart, text: "Избранные каналы с быстрым доступом" },
      ],
    },
    {
      version: "1.7.0",
      date: "Сентябрь 2025",
      title: "WebRTC стриминг",
      features: [
        { icon: Monitor, text: "Стриминг экрана напрямую из браузера (без OBS)" },
        { icon: Mic, text: "Голосовое вещание для радиостанций" },
        { icon: Video, text: "Стриминг с веб-камеры" },
      ],
    },
    {
      version: "1.6.0",
      date: "Август 2025",
      title: "Премиум подписки",
      features: [
        { icon: Crown, text: "Платные подписки на каналы" },
        { icon: Shield, text: "Режим чата только для подписчиков" },
        { icon: Clock, text: "Таймер ожидания для новых подписчиков в чате" },
      ],
    },
    {
      version: "1.5.0",
      date: "Июль 2025",
      title: "Чат-бот и автоматизация",
      features: [
        { icon: Settings, text: "Настраиваемый чат-бот с автоматическими сообщениями" },
        { icon: Bell, text: "Push-уведомления для подписчиков" },
        { icon: Ban, text: "Временные баны с указанием срока" },
      ],
    },
    {
      version: "1.4.0",
      date: "Июнь 2025",
      title: "Аналитика и статистика",
      features: [
        { icon: Users, text: "Реальный подсчёт зрителей в реальном времени" },
        { icon: Search, text: "Расширенная аналитика канала" },
        { icon: Clock, text: "История просмотров и время смотрения" },
      ],
    },
    {
      version: "1.3.0",
      date: "Май 2025",
      title: "Модерация и безопасность",
      features: [
        { icon: Shield, text: "Система модераторов канала" },
        { icon: Ban, text: "Блокировка пользователей с причиной" },
        { icon: MessageSquare, text: "Закреплённые сообщения в чате" },
      ],
    },
    {
      version: "1.2.0",
      date: "Апрель 2025",
      title: "Плеер и плейлисты",
      features: [
        { icon: Play, text: "Синхронизированное воспроизведение для всех зрителей" },
        { icon: List, text: "Управление плейлистом с drag-and-drop" },
        { icon: Clock, text: "Расписание программ" },
      ],
    },
    {
      version: "1.1.0",
      date: "Февраль 2025",
      title: "HLS стриминг",
      features: [
        { icon: Video, text: "Поддержка HLS (.m3u8) потоков" },
        { icon: ExternalLink, text: "Embed-плеер для встраивания" },
        { icon: Play, text: "Popout-плеер в отдельном окне" },
      ],
    },
    {
      version: "1.0.0",
      date: "Декабрь 2024",
      title: "Запуск платформы StreamLiveTV",
      features: [
        { icon: Tv, text: "Создание ТВ-каналов с 24/7 вещанием" },
        { icon: Radio, text: "Создание радиостанций" },
        { icon: MessageSquare, text: "Живой чат с эмодзи" },
        { icon: Crown, text: "Система баллов канала за просмотр" },
        { icon: Users, text: "Подписка на каналы" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-4xl font-bold mb-2">История обновлений</h1>
        <p className="text-muted-foreground mb-8">Все изменения и улучшения платформы StreamLiveTV</p>
        
        <div className="mb-6">
          <Link to="/api-docs" className="text-primary hover:underline flex items-center gap-2">
            <Code className="w-4 h-4" />
            Документация API для партнёров
          </Link>
        </div>

        <div className="space-y-6">
          {updates.map((update, index) => (
            <Card key={update.version} className={index === 0 ? "border-primary/50 bg-primary/5" : ""}>
              <CardHeader>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge 
                    variant={index === 0 ? "default" : "secondary"} 
                    className="text-lg px-3 py-1"
                  >
                    v{update.version}
                  </Badge>
                  {index === 0 && (
                    <Badge variant="outline" className="border-primary text-primary">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Новое
                    </Badge>
                  )}
                  <CardTitle className="text-xl">{update.title}</CardTitle>
                </div>
                <CardDescription>{update.date}</CardDescription>
                {update.description && (
                  <p className="text-sm text-muted-foreground mt-2">{update.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {update.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <feature.icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Changelog;
