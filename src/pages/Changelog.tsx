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
      title: "Подписки, Рулетка, Источники и Restream",
      features: [
        { icon: Crown, text: "Система подписок за баллы канала (30 дней)" },
        { icon: Gift, text: "Ручная выдача подписок через меню чата" },
        { icon: Dices, text: "Рулетка с призами (500 баллов или бесплатно раз в 24ч)" },
        { icon: Code, text: "API документация для партнёров (/api-docs)" },
        { icon: Palette, text: "Настройка темы в профиле (Neon Cyberpunk / Liquid Glass)" },
        { icon: Shield, text: "Исправлена система блокировки с проверкой ban_expires_at" },
        { icon: Gift, text: "Значки подписчиков в чате с эмодзи" },
        { icon: Ban, text: "Улучшенная модерация: удаление сообщений с баном" },
        { icon: Globe, text: "Множество источников: YouTube, MP4, M3U8, Ultra Aggregator" },
        { icon: Play, text: "Интеграция с Restream.io для мультистриминга" },
        { icon: Users, text: "Исправлены роли канала (админ/ведущий)" },
        { icon: Sparkles, text: "Баннер-рекомендация Ultra Aggregator (60 сек)" },
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