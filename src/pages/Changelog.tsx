import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Dices, Palette, Code, Shield, Ban, Gift, Tv, Radio, Users, Globe, Sparkles, Bell, Play, Settings } from "lucide-react";
import { Link } from "react-router-dom";

const Changelog = () => {
  const updates = [
    {
      version: "2.0.0",
      date: "Январь 2026",
      title: "StreamLiveTV 2.0: Чат, Источники, Роли, Restream, Proxy",
      features: [
        { icon: Crown, text: "Ручная выдача подписки через меню сообщения (чат)" },
        { icon: Crown, text: "Значки подписчиков в чате (эмодзи рядом с ником)" },
        { icon: Shield, text: "Исправлены баны: учёт ban_expires_at + отображение причины/срока" },
        { icon: Dices, text: "Трата баллов: рулетка за 500 баллов + покупка подписки за баллы" },
        { icon: Globe, text: "Источники: YouTube, MP4, M3U8, Ultra Aggregator" },
        { icon: Sparkles, text: "Баннер-рекомендация Ultra Aggregator (1 раз за сессию, 60 сек)" },
        { icon: Users, text: "Роли канала: администратор = полный доступ, ведущий = запуск трансляций" },
        { icon: Play, text: "Интеграция Restream.io для RTMP (OBS)" },
        { icon: Shield, text: "Переключатель VPN-прокси для проксирования источников" },
        { icon: Code, text: "API документация для партнёров (/api-docs)" },
      ],
    },
    {
      version: "1.8.0",
      date: "Август 2025",
      title: "Профиль и персонализация",
      features: [
        { icon: Palette, text: "Темы профиля и оформление интерфейса" },
        { icon: Users, text: "Улучшения подписок и уведомлений" },
      ],
    },
    {
      version: "1.5.0",
      date: "Декабрь 2025",
      title: "Чат-бот и аналитика",
      features: [
        { icon: Settings, text: "Настраиваемый чат-бот с автоматическими сообщениями" },
        { icon: Bell, text: "Система уведомлений для подписчиков" },
        { icon: Users, text: "Реальный подсчёт зрителей" },
      ],
    },
    {
      version: "1.2.0",
      date: "Март 2025",
      title: "Плеер и плейлисты",
      features: [
        { icon: Play, text: "Улучшения плейлиста и синхронизации воспроизведения" },
        { icon: Tv, text: "Оптимизация TV/Radio каналов" },
      ],
    },
    {
      version: "1.0.0",
      date: "Ноябрь 2024",
      title: "Запуск платформы",
      features: [
        { icon: Tv, text: "Создание ТВ-каналов с 24/7 вещанием" },
        { icon: Radio, text: "Создание радиостанций" },
        { icon: Users, text: "Живой чат с модерацией" },
        { icon: Crown, text: "Система баллов канала" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-4xl font-bold mb-8">История обновлений</h1>
        
        <div className="mb-6">
          <Link to="/api-docs" className="text-primary hover:underline flex items-center gap-2">
            <Code className="w-4 h-4" />
            Документация API для партнёров
          </Link>
        </div>

        <div className="space-y-6">
          {updates.map((update) => (
            <Card key={update.version} className="glass">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="text-lg px-3 py-1">v{update.version}</Badge>
                  <CardTitle>{update.title}</CardTitle>
                </div>
                <CardDescription>{update.date}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {update.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <feature.icon className="w-5 h-5 text-primary" />
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