import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Dices, Palette, Code, Shield, Ban, Gift } from "lucide-react";
import { Link } from "react-router-dom";

const Changelog = () => {
  const updates = [
    {
      version: "2.0.0",
      date: "Январь 2026",
      title: "Подписки, Рулетка и API",
      features: [
        { icon: Crown, text: "Система подписок за баллы канала (30 дней)" },
        { icon: Dices, text: "Рулетка с призами (500 баллов или бесплатно раз в 24ч)" },
        { icon: Code, text: "API документация для партнёров (/api-docs)" },
        { icon: Palette, text: "Настройка темы в профиле (Neon Cyberpunk / Liquid Glass)" },
        { icon: Shield, text: "Исправлена система блокировки пользователей в чате" },
        { icon: Gift, text: "Значки подписчиков в чате" },
        { icon: Ban, text: "Улучшенная модерация: удаление сообщений с баном" },
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